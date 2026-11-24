import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../lib/i18n';
import { useLocation } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../lib/data';
import { CATEGORIES } from '../data/content';
import WorkMosaic from '../components/WorkMosaic';
import ClientRow from '../components/ClientRow';
import { PageTitle } from '../components/Titles';
import { useDocTitle } from '../lib/useDocTitle';

const match = (cat: string, p: { category: string; services: string[] | null }) =>
  cat === 'All' || p.category === cat || !!p.services?.some((s) => s.toLowerCase().includes(cat.toLowerCase()));

function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  return (
    <div className={`dd ${open ? 'is-open' : ''}`} onMouseLeave={() => setOpen(false)}>
      <button className="dd__btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {value === 'All' ? label : value}
        <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
      </button>
      <ul className="dd__menu" role="listbox">
        {options.map((o) => (
          <li key={o}><button role="option" aria-selected={o === value} className={o === value ? 'is-on' : ''} onClick={() => { onChange(o); setOpen(false); }}>{o === 'All' ? t('전체', 'All') : o}</button></li>
        ))}
      </ul>
    </div>
  );
}

/** Work 한 페이지: 클라이언트 3D 픽셀 로고 → 필터 → 모자이크. */
export default function Work() {
  const { t } = useLang();
  useDocTitle('Work — IMBY', t('IMBY의 캠페인과 프로젝트.', 'Campaigns and projects by IMBY.'));
  const { data } = useProjects();
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ block: 'start' }), 500);
    return () => window.clearTimeout(t);
  }, [hash]);
  const [params, setParams] = useSearchParams();
  const cat = params.get('c') ?? 'All';
  const year = params.get('y') ?? 'All';
  const cats = CATEGORIES.filter((c) => data.some((p) => match(c, p)));
  const years = ['All', ...Array.from(new Set(data.map((p) => String(p.year ?? '')).filter(Boolean))).sort().reverse()];
  const list = useMemo(() => data.filter((p) => match(cat, p) && (year === 'All' || String(p.year) === year)), [cat, year, data]);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'All') next.delete(k); else next.set(k, v);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  return (
    <>
      <PageTitle>Work</PageTitle>
      <ClientRow />
      <div className="wk-bar wrap">
        <div className="wk-bar__filters">
          <Dropdown label="YEAR" value={year} options={years} onChange={(v) => set('y', v)} />
          <Dropdown label="SERVICE" value={cat} options={cats} onChange={(v) => set('c', v)} />
        </div>
      </div>
      <section className="wkx__list wrap" key={`${cat}-${year}`}>
        <WorkMosaic items={list} />
        {list.length === 0 && <p className="g2" style={{ padding: '80px 0' }}>{t('조건에 맞는 작업이 없습니다.', 'No work matches these filters.')}</p>}
      </section>
    </>
  );
}
