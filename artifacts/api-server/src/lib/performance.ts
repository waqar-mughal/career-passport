export type ClaimStatus =
  | "draft"
  | "pending"
  | "verified"
  | "corrected"
  | "declined"
  | "expired"
  | "revoked";

export type RequestStatus =
  | "draft"
  | "pending"
  | "partially_verified"
  | "verified"
  | "declined"
  | "expired"
  | "revoked";

const AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/;

export function isValidAmount(value: string): boolean {
  return AMOUNT_PATTERN.test(value);
}

function milliUnits(value: string): bigint {
  if (!isValidAmount(value)) throw new Error("Invalid monetary amount");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

export function calculateAttainmentPercent(
  quota: string,
  achievedRevenue: string,
): number | null {
  if (!isValidAmount(quota) || !isValidAmount(achievedRevenue)) {
    throw new Error("Invalid monetary amount");
  }
  const quotaMilli = milliUnits(quota);
  if (quotaMilli <= 0n) return null;
  const achievedMilli = milliUnits(achievedRevenue);
  const roundedHundredths =
    (achievedMilli * 10_000n + quotaMilli / 2n) / quotaMilli;
  return Number(roundedHundredths) / 100;
}

const ACCEPTED: ClaimStatus[] = ["verified", "corrected"];
const RESOLVED: ClaimStatus[] = [
  "verified",
  "corrected",
  "declined",
  "expired",
  "revoked",
];

export function deriveRequestStatus(
  statuses: readonly ClaimStatus[],
  requestExpired = false,
): RequestStatus {
  if (statuses.length === 0 || statuses.every((status) => status === "draft")) {
    return "draft";
  }
  if (statuses.every((status) => status === "revoked")) return "revoked";
  if (statuses.every((status) => status === "expired")) return "expired";
  if (statuses.every((status) => status === "declined")) return "declined";
  if (statuses.every((status) => ACCEPTED.includes(status))) return "verified";
  if (statuses.every((status) => status === "pending")) return "pending";
  if (
    requestExpired &&
    !statuses.some((status) => ACCEPTED.includes(status) || status === "declined")
  ) {
    return "expired";
  }
  if (statuses.every((status) => RESOLVED.includes(status))) {
    return "partially_verified";
  }
  return "partially_verified";
}

export function isPublishableClaim(status: ClaimStatus): boolean {
  return status === "verified" || status === "corrected";
}

export function isValidPeriod(start: string, end: string): boolean {
  const isCalendarDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toISOString().slice(0, 10) === value;
  };
  return isCalendarDate(start) && isCalendarDate(end) && start <= end;
}
