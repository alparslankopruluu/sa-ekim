import { useTranslation } from "react-i18next";

type LegalPageProps = {
  titleKey: string;
  bodyKey: string;
};

export function LegalPage({ titleKey, bodyKey }: LegalPageProps) {
  const { t } = useTranslation();
  return (
    <article className="page prose">
      <h1>{t(titleKey)}</h1>
      <p>{t(bodyKey)}</p>
    </article>
  );
}
