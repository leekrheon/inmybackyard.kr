import { Link } from 'react-router-dom';
import type { Project } from '../lib/supabase';
import { Rv } from './Reveal';

/** 이노션 Recent: 16:9 썸네일이 1px 간격으로 붙고, 아래에 클라이언트(회색) / 작업명 */
export default function WorkGrid({ items, cols = 4 }: { items: Project[]; cols?: 2 | 3 | 4 }) {
  return (
    <ul className="wg" style={{ '--cols': cols } as React.CSSProperties}>
      {items.map((p, i) => (
        <Rv as="li" key={p.slug} delay={(i % cols) * 50}>
          <Link to={`/work/${p.slug}`} className="wg__card">
            <div className="wg__media">{p.thumbnail_url && <img src={p.thumbnail_url} alt="" loading={i < 8 ? 'eager' : 'lazy'} />}</div>
            <div className="wg__cap">
              <span className="wg__client">{p.client}</span>
              <strong className="wg__title">{p.title}</strong>
            </div>
          </Link>
        </Rv>
      ))}
    </ul>
  );
}
