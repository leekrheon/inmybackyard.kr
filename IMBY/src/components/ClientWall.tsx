import { Link } from 'react-router-dom';
import { useClients } from '../lib/data';

/** 클라이언트 로고 — 선 없이 흰색 로고만, 왼쪽 위에 Client 라벨 */
export default function ClientWall({ title = true }: { title?: boolean }) {
  const { data } = useClients();
  return (
    <section className="cw wrap">
      {title && <p className="cw__label">Client</p>}
      <ul className="cw__grid">
        {data.map((c) => (
          <li key={c.id}>
            {c.link && /^https?:\/\//.test(c.link)
              ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="cw__item" aria-label={c.name}><img src={c.logo_url} alt={c.name} /></a>
              : <Link to={c.link || '/work'} className="cw__item" aria-label={c.name}><img src={c.logo_url} alt={c.name} /></Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}
