import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  auditEventsTable,
  db,
  employeeProfilesTable,
  performanceRecordsTable,
  verificationRequestsTable,
} from "@workspace/db";
import {
  calculateAttainmentPercent,
  deriveRequestStatus,
  isPublishableClaim,
  type ClaimStatus,
} from "./performance";

export type ActorRole = "employee" | "admin" | "verifier" | "system";

export async function ensureEmployeeProfile(
  userId: string,
  fullName = "",
) {
  const existing = await db.query.employeeProfilesTable.findFirst({
    where: eq(employeeProfilesTable.userId, userId),
  });
  if (existing) return existing;

  await db
    .insert(employeeProfilesTable)
    .values({
      userId,
      fullName: fullName.slice(0, 120),
      publicSlug: `cp-${randomBytes(8).toString("hex")}`,
    })
    .onConflictDoNothing();

  const created = await db.query.employeeProfilesTable.findFirst({
    where: eq(employeeProfilesTable.userId, userId),
  });
  if (!created) throw new Error("Unable to create employee profile");
  return created;
}

export async function writeAuditEvent(
  tx: Pick<typeof db, "insert">,
  input: {
    subjectType: string;
    subjectId: string;
    employeeUserId?: string | null;
    organizationId?: string | null;
    actorUserId: string;
    actorRole: ActorRole;
    eventType: string;
    claimKey?: "quota" | "achieved_revenue" | null;
  },
) {
  await tx.insert(auditEventsTable).values({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    employeeUserId: input.employeeUserId ?? null,
    organizationId: input.organizationId ?? null,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    eventType: input.eventType,
    claimKey: input.claimKey ?? null,
  });
}

export async function getLatestVerificationRequest(performanceId: string) {
  return db.query.verificationRequestsTable.findFirst({
    where: eq(verificationRequestsTable.performanceId, performanceId),
    orderBy: [desc(verificationRequestsTable.createdAt)],
  });
}

export async function expireVerificationRequestIfNeeded(requestId: string) {
  await db.transaction(async (tx) => {
    const request = await tx.query.verificationRequestsTable.findFirst({
      where: eq(verificationRequestsTable.id, requestId),
    });
    if (
      !request ||
      !["pending", "partially_verified"].includes(request.status) ||
      request.expiresAt > new Date()
    ) {
      return;
    }
    const record = await tx.query.performanceRecordsTable.findFirst({
      where: eq(performanceRecordsTable.id, request.performanceId),
    });
    if (!record) return;

    const quotaStatus: ClaimStatus =
      record.quotaStatus === "pending" ? "expired" : record.quotaStatus;
    const revenueStatus: ClaimStatus =
      record.revenueStatus === "pending" ? "expired" : record.revenueStatus;
    await tx
      .update(performanceRecordsTable)
      .set({ quotaStatus, revenueStatus })
      .where(eq(performanceRecordsTable.id, record.id));

    const status = deriveRequestStatus(
      [quotaStatus, revenueStatus],
      true,
    );
    await tx
      .update(verificationRequestsTable)
      .set({ status, completedAt: new Date() })
      .where(eq(verificationRequestsTable.id, request.id));

    for (const [key, previous, next] of [
      ["quota", record.quotaStatus, quotaStatus],
      ["achieved_revenue", record.revenueStatus, revenueStatus],
    ] as const) {
      if (previous === "pending" && next === "expired") {
        await writeAuditEvent(tx, {
          subjectType: "performance_record",
          subjectId: record.id,
          employeeUserId: record.employeeUserId,
          organizationId: request.organizationId,
          actorUserId: "system",
          actorRole: "system",
          eventType: "claim_expired",
          claimKey: key,
        });
      }
    }
    await writeAuditEvent(tx, {
      subjectType: "verification_request",
      subjectId: request.id,
      employeeUserId: record.employeeUserId,
      organizationId: request.organizationId,
      actorUserId: "system",
      actorRole: "system",
      eventType: "verification_request_expired",
    });
  });
}

export async function serializePerformanceRecord(record: {
  id: string;
  employmentId: string;
  periodStart: string;
  periodEnd: string;
  definition: string;
  currency: string;
  selfReportedQuota: string;
  selfReportedRevenue: string;
  verifiedQuota: string | null;
  verifiedRevenue: string | null;
  quotaStatus: ClaimStatus;
  revenueStatus: ClaimStatus;
  quotaCorrectionReason: string | null;
  revenueCorrectionReason: string | null;
  quotaPublic: boolean;
  revenuePublic: boolean;
  createdAt: Date;
}) {
  let request = await getLatestVerificationRequest(record.id);
  if (request) {
    await expireVerificationRequestIfNeeded(request.id);
    request = await getLatestVerificationRequest(record.id);
  }

  const hasVerifiedValues =
    isPublishableClaim(record.quotaStatus) &&
    isPublishableClaim(record.revenueStatus) &&
    record.verifiedQuota !== null &&
    record.verifiedRevenue !== null;

  return {
    id: record.id,
    employmentId: record.employmentId,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    definition: record.definition,
    currency: record.currency,
    quota: {
      key: "quota" as const,
      selfReportedValue: record.selfReportedQuota,
      verifiedValue: record.verifiedQuota,
      status: record.quotaStatus,
      correctionReason: record.quotaCorrectionReason,
      publicVisible: record.quotaPublic,
    },
    achievedRevenue: {
      key: "achieved_revenue" as const,
      selfReportedValue: record.selfReportedRevenue,
      verifiedValue: record.verifiedRevenue,
      status: record.revenueStatus,
      correctionReason: record.revenueCorrectionReason,
      publicVisible: record.revenuePublic,
    },
    attainmentPercent: hasVerifiedValues
      ? calculateAttainmentPercent(record.verifiedQuota!, record.verifiedRevenue!)
      : null,
    attainmentLabel: hasVerifiedValues ? "system_calculated" as const : "not_available" as const,
    requestStatus: request?.status ?? "draft",
    requestExpiresAt: request?.expiresAt ?? null,
    createdAt: record.createdAt,
  };
}

export async function getOwnedPerformanceRecord(
  performanceId: string,
  employeeUserId: string,
) {
  const record = await db.query.performanceRecordsTable.findFirst({
    where: and(
      eq(performanceRecordsTable.id, performanceId),
      eq(performanceRecordsTable.employeeUserId, employeeUserId),
    ),
  });
  return record ?? null;
}
