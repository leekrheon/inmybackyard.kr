import { Link } from 'react-router-dom';
import type { Project } from '../lib/supabase';

/** 제일기획 Work식 모자이크: 큰 카드·세로 카드가 섞인 3열 그리드, 캡션은 제목 + 회색 클라이언트.
 *  사진에 마우스를 올리면 어두워지며 흰색 클라이언트 로고가 떠오른다 (관리자 › Work › 클라이언트 로고). */
export default function WorkMosaic({ items }: { items: Project[] }) {
  return (
    <ul className="hw__grid">
      {items.map((p, i) => {
        const k = i % 7;
        const size = k === 0 ? 'is-big' : k === 3 ? 'is-tall' : '';
        const src = (size === 'is-big' ? p.cover_url ?? p.thumbnail_url : p.thumbnail_url ?? p.cover_url) ?? '';
        return (
          <li key={p.slug} className={size}>
            <Link to={`/work/${p.slug}`} className="hw__card">
              <div className="hw__img">
                {src && <img src={src} alt="" loading="lazy" />}
                {p.client_logo_url && <img className="hw__logo" src={p.client_logo_url} alt={p.client ?? ''} />}
              </div>
              <p className="hw__cap"><span>{p.title}</span><span className="g2">{p.client}</span></p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
