import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';
import { Link } from 'react-router-dom';
import { usePress } from '../lib/data';
import { Rv } from '../components/Reveal';
import { useDocTitle } from '../lib/useDocTitle';

/**
 * Press
 * 1) 맨 위: 가장 최신 기사 배너 — 왼쪽 헤드라인, 오른쪽 큰 사진. 여러 개면 자동으로 넘어간다.
 * 2) 그 아래: 카드 줄 + 연도 필터 표.
 * 외부 기사(관리자에서 URL만 넣으면 자동 수집)는 클릭하면 원문 기사로 새 창에서 이동한다.
 * 모든 기사는 관리자 › Press 에서 등록한다 (코드에 적어 둔 기사는 없다).
 */
type Row = { id: string; title: string; desc: string; source: string; date: string; img: string | null; href: string; external: boolean };


const fmt = (d: string) => d.replaceAll('-', '.');

/** 외부 기사는 원문으로 새 창, 내부 소식은 사이트 안에서 이동 */
function Item({ r, children, className, tabIndex }: { r: Row; children: React.ReactNode; className: string; tabIndex?: number }) {
  const { t } = useLang();
  return r.external
    ? <a href={r.href} target="_blank" rel="noopener noreferrer" className={className} tabIndex={tabIndex} aria-label={t(`${r.title} — ${r.source} 원문 기사 새 창으로 열기`, `${r.title} — read on ${r.source} (opens in a new tab)`)}>{children}</a>
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
  const { t } = useLang();
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
      aria-roledescription="carousel" aria-label={t('최신 기사', 'Latest news')}
    >
      <div className="prb__stage">
        {rows.map((r, k) => (
          <Item key={r.id} r={r} className={`prb__slide ${k === i ? 'is-on' : ''}`} tabIndex={k === i ? 0 : -1}>
            <div className="prb__text" aria-hidden={k !== i}>
              <h1 className="prb__title">{r.title}</h1>
              {r.desc && <p className="prb__desc">{r.desc}</p>}
              <span className="prb__more">{r.external ? t('원문 기사 보기 ↗', 'Read the article ↗') : t('자세히 보기 →', 'Read more →')}</span>
            </div>
            <div className="prb__img"><Pic src={r.img} alt={k === i ? r.title : ''} fallback={r.source} /></div>
          </Item>
        ))}
      </div>
      {n > 1 && (
        <div className="prb__nav">
          <div className="prb__dots" role="tablist" aria-label={t('기사 선택', 'Choose article')}>
            {rows.map((r, k) => (
              <button key={r.id} role="tab" aria-selected={k === i} aria-label={t(`${k + 1}번째 기사`, `Article ${k + 1}`)} className={k === i ? 'is-on' : ''} onClick={() => go(k)}>
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
  const { t } = useLang();
  useDocTitle('Press — IMBY', t('IMBY의 소식과 언론 보도.', 'News and press coverage of IMBY.'));
  const { data, loading } = usePress();
  const external: Row[] = useMemo(
    () => data.map((n) => ({
      id: n.id, title: n.title ?? n.url, desc: n.description ?? '', source: n.source ?? new URL(n.url).hostname.replace(/^www\./, ''),
      date: n.published_at ?? '', img: n.image_url, href: n.url, external: true,
    })),
    [data],
  );
  const rows: Row[] = useMemo(() => [...external].sort((a, b) => b.date.localeCompare(a.date)), [external]);
  // 배너: 최신 기사 5개
  const banner = rows.slice(0, 5);
  const years = ['All', ...Array.from(new Set(rows.map((r) => r.date.slice(0, 4)).filter(Boolean)))];
  const [year, setYear] = useState('All');
  const list = rows.filter((r) => year === 'All' || r.date.startsWith(year));

  return (
    <>
      {loading ? <div className="prb prb--ph" /> : <Banner rows={banner} />}

      {!loading && rows.length === 0 && (
        <section className="wrap pr-empty">
          <h1 className="pr-empty__t">Press</h1>
          <p className="g2">{t('아직 등록된 기사가 없습니다.', 'No articles yet.')}</p>
        </section>
      )}

      {!loading && rows.length > 0 && (
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
