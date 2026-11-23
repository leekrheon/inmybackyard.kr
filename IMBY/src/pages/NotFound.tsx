import { Link } from 'react-router-dom';
import { useDocTitle } from '../lib/useDocTitle';

export default function NotFound() {
  useDocTitle('404 — IMBY');
  return (
    <section className="page-head nf">
      <h1 className="page-title">404</h1>
      <p className="t-body">찾으시는 페이지가 없습니다.</p>
      <Link to="/" className="pill">Home</Link>
    </section>
  );
}
