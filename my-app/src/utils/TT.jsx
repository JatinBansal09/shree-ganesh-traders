import { useTranslation } from "../i18n";

const TT = ({ children }) => {
  const { t } = useTranslation();
  return <span className="notranslate">{t(children)}</span>;
};

export default TT;