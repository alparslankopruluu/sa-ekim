import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="page prose">
      <h1>{t("common.notFoundTitle")}</h1>
      <p>{t("common.notFoundBody")}</p>
    </section>
  );
}
