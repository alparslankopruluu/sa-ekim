import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      "app.name": "__APP_NAME__",
      "nav.label": "Primary navigation",
      "nav.home": "Home",
      "nav.support": "Support",
      "nav.privacy": "Privacy",
      "nav.terms": "Terms",
      "nav.admin": "Admin",
      "home.eyebrow": "__APP_NAME__",
      "home.title": "A focused experience, built around what matters.",
      "home.body": "Replace this copy with the approved product promise before launch.",
      "home.cta": "Get support",
      "support.title": "Support",
      "support.body": "Tell us what happened and we will help you find the next step.",
      "support.cta": "Email support",
      "privacy.title": "Privacy policy",
      "privacy.body": "Replace this placeholder with the approved policy covering collection, retention, deletion, consent, and subprocessors before deployment.",
      "terms.title": "Terms of use",
      "terms.body": "Replace this placeholder with the approved terms before deployment.",
      "admin.title": "Admin overview",
      "admin.signedOut": "Sign in with an approved Google account to continue.",
      "admin.signIn": "Sign in with Google",
      "admin.signOut": "Sign out",
      "admin.requestAccess": "Request admin access",
      "admin.notApproved": "This account does not currently have admin access.",
      "admin.approved": "Admin access verified.",
      "admin.totalUsers": "Total user records",
      "admin.generatedAt": "Updated",
      "admin.refresh": "Refresh overview",
      "admin.loading": "Loading secure overview…",
      "admin.error": "The secure overview is unavailable. Try again or verify the account allowlist.",
      "common.skipLink": "Skip to content",
      "common.notFoundTitle": "Page not found",
      "common.notFoundBody": "The requested page does not exist.",
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
