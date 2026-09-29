import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { httpsCallable } from "firebase/functions";

import { useAdminSession } from "../admin-session";
import { functions } from "../firebase";

type AdminOverview = {
  totalUsers: number;
  generatedAt: string;
};

export function AdminPage() {
  const { t } = useTranslation();
  const session = useAdminSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setOverviewError(false);
    setOverviewLoading(true);
    try {
      const getAdminOverview = httpsCallable<void, AdminOverview>(
        functions,
        "getAdminOverview",
      );
      const result = await getAdminOverview();
      setOverview(result.data);
    } catch {
      setOverviewError(true);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.isAdmin) void loadOverview();
  }, [session.isAdmin, loadOverview]);

  return (
    <section className="page prose">
      <h1>{t("admin.title")}</h1>
      <div className="admin-card" aria-live="polite">
        {session.isLoading ? <p>{t("admin.loading")}</p> : null}
        {session.hasError || overviewError ? (
          <p role="alert" className="error-text">
            {t("admin.error")}
          </p>
        ) : null}
        {!session.isLoading && !session.user ? (
          <>
            <p>{t("admin.signedOut")}</p>
            <button
              className="button primary"
              type="button"
              onClick={() => void session.signIn()}
            >
              {t("admin.signIn")}
            </button>
          </>
        ) : null}
        {!session.isLoading && session.user && !session.isAdmin ? (
          <>
            <p>{t("admin.notApproved")}</p>
            <button
              className="button primary"
              type="button"
              onClick={() => void session.requestAccess()}
            >
              {t("admin.requestAccess")}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => void session.signOut()}
            >
              {t("admin.signOut")}
            </button>
          </>
        ) : null}
        {!session.isLoading && session.user && session.isAdmin ? (
          <>
            <p>{t("admin.approved")}</p>
            {overview ? (
              <dl className="metrics">
                <div>
                  <dt>{t("admin.totalUsers")}</dt>
                  <dd>{overview.totalUsers.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{t("admin.generatedAt")}</dt>
                  <dd>{new Date(overview.generatedAt).toLocaleString()}</dd>
                </div>
              </dl>
            ) : null}
            {overviewLoading ? <p>{t("admin.loading")}</p> : null}
            <button
              className="button primary"
              type="button"
              onClick={() => void loadOverview()}
              disabled={overviewLoading}
            >
              {t("admin.refresh")}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => void session.signOut()}
            >
              {t("admin.signOut")}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
