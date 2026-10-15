import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type AuthenticatedUser = {
  userId: string;
  email: string;
  emailDomain: string;
  fullName: string;
  emailVerified: true;
};

type RequestWithTestIdentity = Request & {
  careerPassportTestIdentity?: AuthenticatedUser;
};

export function authenticatedUserId(req: Request): string | null {
  const testIdentity = (req as RequestWithTestIdentity)
    .careerPassportTestIdentity;
  if (testIdentity) return testIdentity.userId;
  return getAuth(req).userId ?? null;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!authenticatedUserId(req)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export async function getAuthenticatedUser(
  req: Request,
): Promise<AuthenticatedUser | null> {
  const testIdentity = (req as RequestWithTestIdentity)
    .careerPassportTestIdentity;
  if (testIdentity?.emailVerified) return testIdentity;

  const userId = authenticatedUserId(req);
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  if (!primary || primary.verification?.status !== "verified") {
    return null;
  }

  const email = primary.emailAddress.trim().toLowerCase();
  const separator = email.lastIndexOf("@");
  if (separator < 1 || separator === email.length - 1) return null;
  return {
    userId,
    email,
    emailDomain: email.slice(separator + 1),
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" "),
    emailVerified: true,
  };
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
