import { Navigate } from 'react-router-dom';
import { useTeam } from '../lib/data';
import { Rv } from '../components/Reveal';

/** 팀캔디드 Members 카드 — About 안의 Team 섹션으로 쓰인다 */
export function TeamMembers() {
  const { data } = useTeam();
  return (
    <section className="mb wrap" id="team">
      <div className="mb__head">
        {/* 스크롤에 맞춰 영어 → 한국어 순서로 페이드인 */}
        <Rv as="h2" className="mb__title">One team for One brain</Rv>
        <Rv as="p" className="mb__sub" delay={260}>최고의 크리에이티브를 위한 팀을 소개합니다.</Rv>
      </div>
      {/* 대표 2명은 윗줄, 나머지 3명은 아랫줄 */}
      {[data.slice(0, 2), data.slice(2)].map((row, r) => (
        <ul className="mb__grid" key={r}>
          {row.map((m, i) => (
            <Rv as="li" key={m.id} delay={i * 60}>
              <a className="mb__card" href={m.link_url ?? undefined}>
                <div className="mb__photo">{m.photo_url && <img src={m.photo_url} alt={`${m.name} 프로필 사진`} />}</div>
                <p className="mb__name">{m.name}</p>
                <p className="mb__role">{m.role}</p>
                {m.education && <p className="mb__edu">{m.education}</p>}
                {m.career && m.career.length > 0 && (
                  <ul className="mb__career">{m.career.map((c) => <li key={c}>{c}</li>)}</ul>
                )}
              </a>
            </Rv>
          ))}
        </ul>
      ))}
    </section>
  );
}

/** 예전 /team 주소는 About의 Team 섹션으로 보낸다 */
export default function Team() {
  return <Navigate to="/about#team" replace />;
}
