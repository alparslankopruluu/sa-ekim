import assert from "node:assert/strict";
import test from "node:test";

import {
  isApprovedAdmin,
  normalizeEmail,
  parseAdminEmails,
} from "../src/admin-access.js";

test("normalizes and deduplicates the secret allowlist", () => {
  const emails = parseAdminEmails("Owner@Example.com, owner@example.com\nops@example.com");
  assert.deepEqual([...emails], ["owner@example.com", "ops@example.com"]);
});

test("requires an allowed, verified Google identity", () => {
  const allowed = parseAdminEmails("owner@example.com");
  assert.equal(
    isApprovedAdmin(
      {
        email: "OWNER@example.com",
        emailVerified: true,
        signInProvider: "google.com",
      },
      allowed,
    ),
    true,
  );
  assert.equal(
    isApprovedAdmin(
      {
        email: "owner@example.com",
        emailVerified: false,
        signInProvider: "google.com",
      },
      allowed,
    ),
    false,
  );
  assert.equal(
    isApprovedAdmin(
      {
        email: "owner@example.com",
        emailVerified: true,
        signInProvider: "password",
      },
      allowed,
    ),
    false,
  );
});

test("normalization is locale-stable", () => {
  assert.equal(normalizeEmail("  Admin@EXAMPLE.COM "), "admin@example.com");
});
