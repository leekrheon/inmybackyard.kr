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

function Block({ label, title, body, children }: { label: string; title?: string | null; body?: string | null; children?: ReactNode }) {
  if (!title && !body && !children) return null;
  return (
    <section className="cs__block">
      <div className="cs__text wrap">
        <Rv as="p" className="cs__label">{label}.</Rv>
        <div className="cs__main">
          {title && <Rv as="h2" className="cs__h"><Para text={title} className="cs__hl" /></Rv>}
          {body && <Rv className="cs__body" delay={80}><Para text={body} /></Rv>}
        </div>
      </div>
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
          <button className="wdc__back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/work'))}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 8H2.5M7 3.5 2.5 8 7 12.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
            back
          </button>
          <button className="wdc__share" onClick={share} aria-label="링크 복사">
            {copied ? <span className="wdc__copied">Copied</span> : (
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="15" cy="4.5" r="2.2" /><circle cx="5" cy="10" r="2.2" /><circle cx="15" cy="15.5" r="2.2" /><path d="M7 9l6-3.4M7 11l6 3.4" /></svg>
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
        <Block key={i} label={(s.label || 'EXECUTION').toUpperCase()} title={s.title} body={s.body}>
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
