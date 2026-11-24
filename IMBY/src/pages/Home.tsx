import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/motion';
import { useProjects } from '../lib/data';
import { Statement } from '../components/Titles';
import ClientWall from '../components/ClientWall';
import InsightSystem from '../components/InsightSystem';
import BrainField from '../components/BrainField';
import Typewriter from '../components/Typewriter';
import WorkMosaic from '../components/WorkMosaic';
import { useDocTitle } from '../lib/useDocTitle';


/* ------------------------------------------------------------------ */
/* 01. KV — 은색 픽셀 뇌 하나, 문장 하나. 나머지는 덜어낸다.              */
/* ------------------------------------------------------------------ */
function Kv() {
  const root = useRef<HTMLElement | null>(null);
  const [typed, setTyped] = useState(false);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.to('.kv__sign', { yPercent: -40, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: '70% top', scrub: true } });
      gsap.to('.kv__copy', { yPercent: -30, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: '60% top', scrub: true } });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="kv" ref={root}>
      <div className="kv__stage"><BrainField className="kv__brain" topSrc="/brand/insight-agency-imby.svg" topCrop={[1272, 0, 480, 192]} view={typed ? 1 : 0} /></div>
      {/* 타이핑이 끝나면 문장이 사라지고, 아래쪽에 IMBY 워드마크가 가로로 가득 차게 나타난다 */}
      <div className={`kv__sign wrap ${typed ? 'is-on' : ''}`}>
        <img src="/brand/insight-agency-imby.svg" alt="Insight Agency, IMBY" />
      </div>
      <div className="kv__copy wrap">
        <Typewriter className={`kv__head ${typed ? 'is-gone' : ''}`} lines={['Machines make content.', 'We make insight.']} onDone={() => window.setTimeout(() => setTyped(true), 250)} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 01-2. Work — 제일기획 Work처럼 큰 이미지와 작은 캡션(제목 · 클라이언트)  */
/* ------------------------------------------------------------------ */
function WorkGrid() {
  const { data } = useProjects();
  const list = data.filter((p) => p.thumbnail_url || p.cover_url);
  return (
    <section className="hw wrap">
      <div className="hw__head">
        <h2 className="hw__title">Work</h2>
        <Link to="/work" className="pill">View all</Link>
      </div>
      <WorkMosaic items={list} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 02. Why IMBY                                                        */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* 05. Contact                                                          */
/* ------------------------------------------------------------------ */
function ContactCta() {
  return (
    <section className="hc wrap">
      <Statement lines={['문제를 같이 고민할', '뇌가 필요하다면.']} />
      <div className="hc__grid">
        <div className="hc__info">
          <a href="mailto:idealee@inmybackyard.kr">idealee@inmybackyard.kr</a>
        </div>
        <div className="hc__btns">
          <Link to="/contact" className="pill pill--xl">Get On Board</Link>
          <Link to="/contact/coffee-chat" className="pill pill--xl">Coffee Chat</Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useDocTitle('IMBY — In My BackYard, Creative & Insight Agency');
  useEffect(() => {
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <>
      <Kv />
      <WorkGrid />
      <InsightSystem />
      <ClientWall />
      <ContactCta />
    </>
  );
}
