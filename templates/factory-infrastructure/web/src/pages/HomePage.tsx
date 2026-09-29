import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <section className="hero page">
      <p className="eyebrow">{t("home.eyebrow")}</p>
      <h1>{t("home.title")}</h1>
      <p>{t("home.body")}</p>
      <NavLink className="button primary" to="/support">
        {t("home.cta")}
      </NavLink>
    </section>
  );
}
