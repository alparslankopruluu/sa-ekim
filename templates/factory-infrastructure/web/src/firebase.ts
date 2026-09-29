import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required public build configuration: ${name}`);
  }
  return value;
}

const config: FirebaseOptions = {
  apiKey: required("VITE_FIREBASE_API_KEY"),
  authDomain: required("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: required("VITE_FIREBASE_PROJECT_ID"),
  appId: required("VITE_FIREBASE_APP_ID"),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(config);

if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG === "true") {
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    required("VITE_FIREBASE_APPCHECK_SITE_KEY"),
  ),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);
export const functions = getFunctions(
  app,
  import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? "us-central1",
);

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
