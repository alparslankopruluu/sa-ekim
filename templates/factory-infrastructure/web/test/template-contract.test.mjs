import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const firebaseSource = await readFile(
  new URL("../src/firebase.ts", import.meta.url),
  "utf8",
);

test("declares every factory web route", () => {
  for (const route of ["/", "/support", "/privacy", "/terms", "/admin"]) {
    assert.match(appSource, new RegExp(`path=["']${route.replace("/", "\\/")}["']`, "u"));
  }
});

test("initializes App Check and exposes no privileged Firebase credential", () => {
  assert.match(firebaseSource, /initializeAppCheck/u);
  assert.doesNotMatch(firebaseSource, /serviceAccount|private_key|ADMIN_EMAILS/u);
});
