import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

export function Shell({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  return (
    <>
      <a className="skip-link" href="#main-content">
        {t("common.skipLink")}
      </a>
      <header className="site-header">
        <NavLink className="brand" to="/" aria-label={t("app.name")}>
          {t("app.name")}
        </NavLink>
        <nav aria-label={t("nav.label")}>
          <NavLink to="/">{t("nav.home")}</NavLink>
          <NavLink to="/support">{t("nav.support")}</NavLink>
          <NavLink to="/privacy">{t("nav.privacy")}</NavLink>
          <NavLink to="/terms">{t("nav.terms")}</NavLink>
          <NavLink to="/admin">{t("nav.admin")}</NavLink>
        </nav>
      </header>
      <main id="main-content">{children}</main>
    </>
  );
}
