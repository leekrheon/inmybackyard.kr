import { Link } from 'react-router-dom';
import { useClients } from '../lib/data';
import { useInView } from './Reveal';
import BrainField from './BrainField';

/**
 * Work 상단 클라이언트 줄 — 로고마다 뇌·Relevance와 같은 은색 픽셀 3D.
 * 로고 모양은 처음부터 완성된 상태로, 화면에 들어오면 왼쪽부터 0.3초 간격으로 하나씩 부드럽게 나타난다.
 * 클라이언트는 관리자 › Clients 에서 추가하면 자동으로 늘어난다 (한 줄 4개, 넘치면 다음 줄).
 */
export default function ClientRow() {
  const { data } = useClients();
  const ref = useInView<HTMLUListElement>(0.2);
  if (!data.length) return null;
  return (
    <section className="crow wrap" aria-label="Clients">
      <ul ref={ref} className="crow__grid" style={{ ['--n' as string]: Math.min(4, data.length) }}>
        {data.map((c, i) => {
          const fx = (
            <div className="crow__fx">
              <BrainField src={c.logo_url} mode="shape" grid={520} fit tilt={0.6} dissolve={false} springy={false} assemble={false} />
            </div>
          );
          const ext = c.link && /^https?:\/\//.test(c.link);
          return (
            <li key={c.id} className="crow__item" style={{ ['--i' as string]: i }}>
              {c.link
                ? ext
                  ? <a href={c.link} target="_blank" rel="noopener noreferrer" className="crow__link" aria-label={c.name}>{fx}</a>
                  : <Link to={c.link} className="crow__link" aria-label={c.name}>{fx}</Link>
                : <div className="crow__link" aria-label={c.name}>{fx}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
