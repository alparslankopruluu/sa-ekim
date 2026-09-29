export type AdminIdentity = {
  email?: string;
  emailVerified?: boolean;
  signInProvider?: string;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function parseAdminEmails(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(/[\n,]/u)
      .map(normalizeEmail)
      .filter((value) => value.length > 0),
  );
}

export function isApprovedAdmin(
  identity: AdminIdentity,
  allowedEmails: ReadonlySet<string>,
): boolean {
  return (
    identity.emailVerified === true &&
    identity.signInProvider === "google.com" &&
    typeof identity.email === "string" &&
    allowedEmails.has(normalizeEmail(identity.email))
  );
}
