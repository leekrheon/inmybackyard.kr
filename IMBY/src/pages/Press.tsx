import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePress } from '../lib/data';
import { Rv } from '../components/Reveal';
import { useDocTitle } from '../lib/useDocTitle';

/**
 * Press
 * 1) 맨 위: 가장 최신 기사 배너 — 왼쪽 헤드라인, 오른쪽 큰 사진. 여러 개면 자동으로 넘어간다.
 * 2) 그 아래: 카드 줄 + 연도 필터 표.
 * 외부 기사(관리자에서 URL만 넣으면 자동 수집)는 클릭하면 원문 기사로 새 창에서 이동한다.
 * 외부 기사가 없으면 IMBY 소식(작업 · 수상)으로 채운다.
 */
type Row = { id: string; title: string; desc: string; source: string; date: string; img: string | null; href: string; external: boolean };

const NEWS: Row[] = [
  { id: 'n1', title: '성수 클럽하우스 외벽 광고, 광고비 없이 매거진 6곳 이상에 소개', desc: '', source: 'Earned Media', date: '2026-11-03', img: '/media/narrative-ooh-1.jpg', href: '/work/narrative-seongsu-ooh', external: false },
  { id: 'n2', title: 'THE 해커톤 본편, EO · BZCF · 더해커톤 유튜브 공개 — 후반 마케팅 총괄', desc: '', source: 'IMBY News', date: '2026-08-15', img: '/media/hackathon-screening-1.jpg', href: '/work/the-hackathon', external: false },
  { id: 'n3', title: 'Tiro AI 회의록 「사관」 캠페인, 강남 OOH · 버스 · 필름으로 집행', desc: '', source: 'IMBY News', date: '2026-08-01', img: '/media/tiro-sagwan-1.jpg', href: '/work/tiro-sagwan', external: false },
  { id: 'n4', title: '락인커피 캐릭터 IP 「제갈궁뎅」 공개', desc: '', source: 'IMBY News', date: '2026-08-01', img: '/media/lockin-mock.jpg', href: '/work/lockin-coffee', external: false },
  { id: 'n5', title: '로컬히어로즈100 창업경진대회 대상 · 교육부장관상 수상 (110+팀 중 1위)', desc: '', source: 'Award', date: '2025-12-01', img: '/media/goongnori.jpg', href: '/work', external: false },
];

const fmt = (d: string) => d.replaceAll('-', '.');

/** 외부 기사는 원문으로 새 창, 내부 소식은 사이트 안에서 이동 */
function Item({ r, children, className, tabIndex }: { r: Row; children: React.ReactNode; className: string; tabIndex?: number }) {
  return r.external
    ? <a href={r.href} target="_blank" rel="noopener noreferrer" className={className} tabIndex={tabIndex} aria-label={`${r.title} — ${r.source} 원문 기사 새 창으로 열기`}>{children}</a>
    : <Link to={r.href} className={className} tabIndex={tabIndex}>{children}</Link>;
}

/** 사진이 깨지면(외부 이미지 차단 등) 빈 회색 판 대신 매체명을 크게 보여 준다 */
function Pic({ src, alt, fallback }: { src: string | null; alt: string; fallback: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className="pr-noimg"><span>{fallback}</span></div>;
  return <img src={src} alt={alt} referrerPolicy="no-referrer" loading="lazy" onError={() => setBad(true)} />;
}

const SLIDE_MS = 6000;

function Banner({ rows }: { rows: Row[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0); // 진행 막대 재시작용
  const n = rows.length;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (n < 2 || paused) return;
    timer.current = window.setTimeout(() => { setI((v) => (v + 1) % n); setTick((t) => t + 1); }, SLIDE_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [i, n, paused, tick]);

  const go = (k: number) => { setI(((k % n) + n) % n); setTick((t) => t + 1); };
  if (!n) return null;

  return (
    <section
      className={`prb wrap ${paused ? 'is-paused' : ''}`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      aria-roledescription="carousel" aria-label="최신 기사"
    >
      <div className="prb__stage">
        {rows.map((r, k) => (
          <Item key={r.id} r={r} className={`prb__slide ${k === i ? 'is-on' : ''}`} tabIndex={k === i ? 0 : -1}>
            <div className="prb__text" aria-hidden={k !== i}>
              <h1 className="prb__title">{r.title}</h1>
              {r.desc && <p className="prb__desc">{r.desc}</p>}
              <span className="prb__more">{r.external ? '원문 기사 보기 ↗' : '자세히 보기 →'}</span>
            </div>
            <div className="prb__img"><Pic src={r.img} alt={k === i ? r.title : ''} fallback={r.source} /></div>
          </Item>
        ))}
      </div>
      {n > 1 && (
        <div className="prb__nav">
          <div className="prb__dots" role="tablist" aria-label="기사 선택">
            {rows.map((r, k) => (
              <button key={r.id} role="tab" aria-selected={k === i} aria-label={`${k + 1}번째 기사`} className={k === i ? 'is-on' : ''} onClick={() => go(k)}>
                <i key={k === i ? `on-${tick}` : 'off'} style={{ animationDuration: `${SLIDE_MS}ms` }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function Press() {
  useDocTitle('Press — IMBY', 'IMBY의 소식과 언론 보도.');
  const { data, loading } = usePress();
  const external: Row[] = useMemo(
    () => data.map((n) => ({
      id: n.id, title: n.title ?? n.url, desc: n.description ?? '', source: n.source ?? new URL(n.url).hostname.replace(/^www\./, ''),
      date: n.published_at ?? '', img: n.image_url, href: n.url, external: true,
    })),
    [data],
  );
  const rows: Row[] = useMemo(() => [...external, ...NEWS].sort((a, b) => b.date.localeCompare(a.date)), [external]);
  // 배너: 언론 기사가 있으면 최신 기사 5개, 없으면 IMBY 소식 최신 3개
  const banner = external.length ? [...external].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5) : rows.slice(0, 3);
  const years = ['All', ...Array.from(new Set(rows.map((r) => r.date.slice(0, 4)).filter(Boolean)))];
  const [year, setYear] = useState('All');
  const list = rows.filter((r) => year === 'All' || r.date.startsWith(year));

  return (
    <>
      {loading ? <div className="prb prb--ph" /> : <Banner rows={banner} />}

      {!loading && (
        <>
          <div className="pr-cards" data-lenis-prevent>
            {rows.slice(0, 5).map((r, i) => (
              <Rv key={r.id} delay={i * 60}>
                <Item r={r} className="pr-card">
                  <div className="pr-card__img"><Pic src={r.img} alt="" fallback={r.source} /></div>
                  <p className="pr-card__src g2">{r.source}</p>
                  <p className="pr-card__t">{r.title}</p>
                </Item>
              </Rv>
            ))}
          </div>

          <section className="wrap pr-tbl">
            <div className="pr-tbl__filters">
              {years.map((y) => <button key={y} className={year === y ? 'is-on' : ''} onClick={() => setYear(y)}>{y === 'All' ? 'ALL' : y}</button>)}
            </div>
            <div className="pr-tbl__head t-cap"><span>Title</span><span>Source</span><span>Date</span></div>
            <ul>
              {list.map((r) => (
                <li key={r.id}>
                  <Item r={r} className="pr-tbl__row">
                    <span className="pr-tbl__t">{r.title}{r.external && <i className="pr-ext" aria-hidden="true"> ↗</i>}</span>
                    <span className="g2">{r.source}</span>
                    <span className="g2 tnum">{fmt(r.date)}</span>
                  </Item>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
