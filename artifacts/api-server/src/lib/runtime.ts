import { resolveTxt } from "node:dns/promises";
import type { Request } from "express";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type CareerPassportRuntime = {
  resolveIdentity?: (req: Request) => Promise<
    | {
        userId: string;
        email: string;
        emailDomain: string;
        fullName: string;
        emailVerified: true;
      }
    | null
  >;
  resolveDnsTxt?: (hostname: string) => Promise<string[]>;
  sendEmail?: (message: EmailMessage) => Promise<void>;
};

export async function resolveDnsTxtRecords(hostname: string): Promise<string[]> {
  const records = await resolveTxt(hostname);
  return records.map((parts) => parts.join(""));
}

export function runtimeFor(req: Request): CareerPassportRuntime {
  return req.app.locals.careerPassportRuntime ?? {};
}
