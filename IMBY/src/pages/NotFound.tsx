import { Link } from 'react-router-dom';
import { useLang } from '../lib/i18n';
import { useDocTitle } from '../lib/useDocTitle';

export default function NotFound() {
  const { t } = useLang();
  useDocTitle('404 — IMBY');
  return (
    <section className="page-head nf">
      <h1 className="page-title">404</h1>
      <p className="t-body">{t('찾으시는 페이지가 없습니다.', 'The page you are looking for does not exist.')}</p>
      <Link to="/" className="pill">Home</Link>
    </section>
  );
}
