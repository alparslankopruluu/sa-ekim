import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import {
  type CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

import { isApprovedAdmin, parseAdminEmails } from "./admin-access.js";

if (getApps().length === 0) initializeApp();

const adminEmails = defineSecret("ADMIN_EMAILS");
const callableOptions = {
  region: "us-central1",
  enforceAppCheck: true,
} as const;

function requireAuthentication(auth: CallableRequest["auth"]) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  return auth;
}

export const requestAdminAccess = onCall(
  { ...callableOptions, secrets: [adminEmails] },
  async (request) => {
    const auth = requireAuthentication(request.auth);
    const approved = isApprovedAdmin(
      {
        email: typeof auth.token.email === "string" ? auth.token.email : undefined,
        emailVerified: auth.token.email_verified === true,
        signInProvider:
          typeof auth.token.firebase?.sign_in_provider === "string"
            ? auth.token.firebase.sign_in_provider
            : undefined,
      },
      parseAdminEmails(adminEmails.value()),
    );

    if (!approved) {
      throw new HttpsError("permission-denied", "This account is not approved.");
    }

    const user = await getAuth().getUser(auth.uid);
    await getAuth().setCustomUserClaims(auth.uid, {
      ...user.customClaims,
      admin: true,
    });

    return { granted: true as const };
  },
);

export const getAdminOverview = onCall(callableOptions, async (request) => {
  const auth = requireAuthentication(request.auth);
  if (auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }

  const snapshot = await getFirestore().collection("users").count().get();
  return {
    totalUsers: snapshot.data().count,
    generatedAt: new Date().toISOString(),
  };
});
