import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjects } from '../lib/data';
import { Rv } from '../components/Reveal';
import { useDocTitle } from '../lib/useDocTitle';
import type { CaseSection } from '../lib/supabase';
import NotFound from './NotFound';

/**
 * Work 상세 — 케이스 스터디 구조 (ideot works 상세를 분석해 정리)
 *   상단: back · 프로젝트명 · 캠페인 카피 · 메타(Client / Period / Scope / Role)
 *   커버 이미지
 *   BACKGROUND → PROBLEM → INSIGHT → IDEA → 실행 섹션들(라벨 + 헤드라인 + 본문 + 이미지) → RESULT(헤드라인 + 지표)
 *   마지막 갤러리 → 이전 · 다음 작업
 * 모든 내용은 관리자 › Work 에서 편집한다.
 */

/** 줄바꿈을 살린 문단 — 빈 줄로 문단을 나눈다 */
function Para({ text, className = '' }: { text: string; className?: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p, i) => (
        <p key={i} className={className}>
          {p.split('\n').map((l, j, arr) => <span key={j}>{l}{j < arr.length - 1 && <br />}</span>)}
        </p>
      ))}
    </>
  );
}

/**
 * 섹션 큰 글자 — Figma IMBY › Section 12(6650-25)의 BACKGROUND · PROBLEM · INSIGHT · IDEA 글자를
 * 윤곽선 SVG로 뽑아 /brand/labels 에 두었다. (RESULT는 같은 글꼴의 글자를 조합해 만든 것)
 * 크기는 예전 13px 텍스트 라벨과 같은 폭(BACKGROUND ≈ 98px)으로 맞춘다 — CSS의 --art-u 한 값으로 조정.
 */
const ART: Record<string, { src: string; w: number }> = {
  BACKGROUND: { src: '/brand/labels/background.svg', w: 1040 },
  PROBLEM: { src: '/brand/labels/problem.svg', w: 711 },
  INSIGHT: { src: '/brand/labels/insight.svg', w: 603 },
  IDEA: { src: '/brand/labels/idea.svg', w: 347 },
  RESULT: { src: '/brand/labels/result.svg', w: 538.2 },
};

function Block({ label, title, body, children }: { label?: string; title?: string | null; body?: string | null; children?: ReactNode }) {
  if (!title && !body && !children) return null;
  const art = label ? ART[label] : undefined;
  return (
    <section className="cs__block">
      {(art || title || body) && (
        <div className="cs__text wrap">
          {art && (
            <Rv className="cs__art">
              <span role="img" aria-label={label} style={{ width: `calc(var(--art-u) * ${art.w})`, aspectRatio: `${art.w} / 161`, WebkitMaskImage: `url(${art.src})`, maskImage: `url(${art.src})` }} />
            </Rv>
          )}
          <div className="cs__main">
            {title && <Rv as="h2" className="cs__h"><Para text={title} className="cs__hl" /></Rv>}
            {body && <Rv className="cs__body" delay={80}><Para text={body} /></Rv>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

/** 섹션 이미지: 1장은 화면 폭, 2장 이상은 두 칸씩 */
function Images({ list }: { list?: string[] }) {
  if (!list?.length) return null;
  return (
    <div className={`cs__imgs wrap ${list.length > 1 ? 'is-grid' : ''}`}>
      {list.map((src) => (
        <Rv key={src} className="cs__img"><img src={src} alt="" loading="lazy" /></Rv>
      ))}
    </div>
  );
}

export default function WorkDetail() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const { data, loading } = useProjects();
  const idx = data.findIndex((x) => x.slug === slug);
  const p = idx >= 0 ? data[idx] : null;
  const [copied, setCopied] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  useDocTitle(p ? `${p.title} — IMBY` : 'Work — IMBY', p?.summary ?? undefined);
  if (!p && !loading) return <NotFound />;
  if (!p) return <div style={{ minHeight: '100svh' }} />;

  const sections = (p.sections ?? []) as CaseSection[];
  const prev = data[(idx - 1 + data.length) % data.length];
  const next = data[(idx + 1) % data.length];
  const meta = [
    { k: 'Client', v: p.client },
    { k: 'Period', v: p.period ?? (p.year ? String(p.year) : null) },
    { k: 'Scope', v: Array.from(new Set([p.category, ...(p.services ?? [])])).join(' · ') },
    { k: 'Role', v: p.role },
  ].filter((m) => m.v);
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  return (
    <article className="cs">
      <header className="cs__head wrap">
        <div className="cs__top">
          <button className="wdc__back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/work'))} aria-label="뒤로">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4.5M10.5 5.5 4 12l6.5 6.5" /></svg>
          </button>
          <button className="wdc__share" onClick={share} aria-label="링크 복사">
            {copied ? <span className="wdc__copied">Copied</span> : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="18.5" r="2.6" /><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" /></svg>
            )}
          </button>
        </div>
        <Rv as="h1" className="cs__title">{p.title}</Rv>
        {p.title_en && <Rv as="p" className="cs__copy" delay={80}>{p.title_en}</Rv>}
        <Rv as="dl" className="cs__meta" delay={140}>
          {meta.map((m) => <div key={m.k}><dt>{m.k}</dt><dd>{m.v}</dd></div>)}
        </Rv>
      </header>

      {p.cover_url && <div className="cs__cover"><img src={p.cover_url} alt={p.title} /></div>}

      {p.summary && (
        <section className="cs__lead wrap"><Rv as="p">{p.summary}</Rv></section>
      )}

      <Block label="BACKGROUND" title={p.background_title} body={p.background} />
      <Block label="PROBLEM" title={p.problem_title} body={p.problem} />
      <Block label="INSIGHT" title={p.insight_title} body={p.insight} />
      <Block label="IDEA" title={p.idea_title} body={p.idea} />
      {sections.map((s, i) => (
        <Block key={i} title={s.title} body={s.body}>
          <Images list={s.images} />
        </Block>
      ))}
      <Block label="RESULT" title={p.result_title} body={p.result}>
        {p.metrics && p.metrics.length > 0 && (
          <ul className="cs__metrics wrap">
            {p.metrics.map((m, i) => (
              <Rv as="li" key={m.label} delay={i * 60}><strong className="tnum">{m.value}</strong><span>{m.label}</span></Rv>
            ))}
          </ul>
        )}
      </Block>

      <Images list={p.gallery ?? undefined} />

      {data.length > 1 && (
        <nav className="wdc__pn wrap" aria-label="다른 작업">
          <Link to={`/work/${prev.slug}`} className="wdc__pn-item">
            <span className="g2">Prev</span>
            <strong>{prev.title}</strong>
          </Link>
          <Link to={`/work/${next.slug}`} className="wdc__pn-item wdc__pn-item--r">
            <span className="g2">Next</span>
            <strong>{next.title}</strong>
          </Link>
        </nav>
      )}
    </article>
  );
}
