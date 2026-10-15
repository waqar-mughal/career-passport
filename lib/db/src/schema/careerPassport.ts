import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const organizationStatusEnum = pgEnum("career_organization_status", [
  "pending_domain",
  "verified",
  "revoked",
]);

export const membershipRoleEnum = pgEnum("career_membership_role", [
  "admin",
  "verifier",
]);

export const membershipStatusEnum = pgEnum("career_membership_status", [
  "invited",
  "active",
  "revoked",
]);

export const claimStatusEnum = pgEnum("career_claim_status", [
  "draft",
  "pending",
  "verified",
  "corrected",
  "declined",
  "expired",
  "revoked",
]);

export const requestStatusEnum = pgEnum("career_request_status", [
  "draft",
  "pending",
  "partially_verified",
  "verified",
  "declined",
  "expired",
  "revoked",
]);

export const employeeProfilesTable = pgTable("career_employee_profiles", {
  userId: text("user_id").primaryKey(),
  fullName: varchar("full_name", { length: 120 }).notNull().default(""),
  headline: varchar("headline", { length: 180 }).notNull().default(""),
  location: varchar("location", { length: 160 }),
  bio: text("bio"),
  publicSlug: varchar("public_slug", { length: 80 }).notNull().unique(),
  publicEnabled: boolean("public_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const employmentsTable = pgTable(
  "career_employments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeUserId: text("employee_user_id")
      .notNull()
      .references(() => employeeProfilesTable.userId, { onDelete: "cascade" }),
    company: varchar("company", { length: 160 }).notNull(),
    role: varchar("role", { length: 160 }).notNull(),
    location: varchar("location", { length: 160 }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    current: boolean("current").notNull().default(false),
    summary: text("summary"),
    publicVisible: boolean("public_visible").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("career_employments_owner_idx").on(table.employeeUserId)],
);

export const achievementsTable = pgTable(
  "career_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeUserId: text("employee_user_id")
      .notNull()
      .references(() => employeeProfilesTable.userId, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    issuer: varchar("issuer", { length: 180 }).notNull().default(""),
    date: date("date", { mode: "string" }),
    description: text("description"),
    publicVisible: boolean("public_visible").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("career_achievements_owner_idx").on(table.employeeUserId)],
);

export const organizationsTable = pgTable(
  "career_employer_organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    domain: varchar("domain", { length: 253 }).notNull().unique(),
    status: organizationStatusEnum("status").notNull().default("pending_domain"),
    domainChallengeHash: text("domain_challenge_hash"),
    domainChallengeExpiresAt: timestamp("domain_challenge_expires_at", {
      withTimezone: true,
    }),
    createdByUserId: text("created_by_user_id").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("career_org_domain_lower_idx").on(table.domain),
    index("career_org_status_idx").on(table.status),
  ],
);

export const organizationMembershipsTable = pgTable(
  "career_organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    email: varchar("email", { length: 320 }).notNull(),
    role: membershipRoleEnum("role").notNull().default("verifier"),
    status: membershipStatusEnum("status").notNull().default("invited"),
    invitationTokenHash: text("invitation_token_hash"),
    invitationExpiresAt: timestamp("invitation_expires_at", {
      withTimezone: true,
    }),
    invitedByUserId: text("invited_by_user_id").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("career_org_membership_email_idx").on(
      table.organizationId,
      table.email,
    ),
    index("career_org_membership_user_idx").on(table.userId),
    index("career_org_membership_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const performanceRecordsTable = pgTable(
  "career_performance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employmentId: uuid("employment_id")
      .notNull()
      .references(() => employmentsTable.id, { onDelete: "cascade" }),
    employeeUserId: text("employee_user_id")
      .notNull()
      .references(() => employeeProfilesTable.userId, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    definition: varchar("definition", { length: 500 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    selfReportedQuota: numeric("self_reported_quota", {
      precision: 16,
      scale: 3,
    }).notNull(),
    selfReportedRevenue: numeric("self_reported_revenue", {
      precision: 16,
      scale: 3,
    }).notNull(),
    verifiedQuota: numeric("verified_quota", { precision: 16, scale: 3 }),
    verifiedRevenue: numeric("verified_revenue", { precision: 16, scale: 3 }),
    quotaStatus: claimStatusEnum("quota_status").notNull().default("draft"),
    revenueStatus: claimStatusEnum("revenue_status").notNull().default("draft"),
    quotaCorrectionReason: varchar("quota_correction_reason", { length: 1000 }),
    revenueCorrectionReason: varchar("revenue_correction_reason", {
      length: 1000,
    }),
    quotaPublic: boolean("quota_public").notNull().default(false),
    revenuePublic: boolean("revenue_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("career_performance_employment_idx").on(table.employmentId),
    index("career_performance_owner_idx").on(table.employeeUserId),
  ],
);

export const verificationRequestsTable = pgTable(
  "career_verification_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    performanceId: uuid("performance_id")
      .notNull()
      .unique()
      .references(() => performanceRecordsTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "restrict" }),
    requestedByUserId: text("requested_by_user_id").notNull(),
    status: requestStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("career_verification_request_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const verificationInvitationsTable = pgTable(
  "career_verification_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => verificationRequestsTable.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organizationMembershipsTable.id, {
        onDelete: "cascade",
      }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("career_verification_invite_request_member_idx").on(
      table.requestId,
      table.membershipId,
    ),
  ],
);

export const auditEventsTable = pgTable(
  "career_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: varchar("subject_type", { length: 80 }).notNull(),
    subjectId: uuid("subject_id").notNull(),
    employeeUserId: text("employee_user_id"),
    organizationId: uuid("organization_id").references(
      () => organizationsTable.id,
      { onDelete: "set null" },
    ),
    actorUserId: text("actor_user_id").notNull(),
    actorRole: varchar("actor_role", { length: 40 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    claimKey: varchar("claim_key", { length: 40 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("career_audit_employee_time_idx").on(
      table.employeeUserId,
      table.occurredAt,
    ),
    index("career_audit_org_time_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
    index("career_audit_subject_idx").on(table.subjectType, table.subjectId),
  ],
);
