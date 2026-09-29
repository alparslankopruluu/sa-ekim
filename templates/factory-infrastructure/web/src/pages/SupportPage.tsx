import { useTranslation } from "react-i18next";

export function SupportPage() {
  const { t } = useTranslation();
  return (
    <section className="page prose">
      <h1>{t("support.title")}</h1>
      <p>{t("support.body")}</p>
      <a className="button primary" href="mailto:__SUPPORT_EMAIL__">
        {t("support.cta")}
      </a>
    </section>
  );
}
