import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { getLenis } from '../lib/motion';

/** 메뉴는 네 개. 하위 메뉴 없이 각 메뉴가 한 페이지. */
export const MENU = [
  { label: 'Work', to: '/work' },
  { label: 'About', to: '/about' },
  { label: 'Press', to: '/press' },
  { label: 'Contact', to: '/contact' },
];

// 이전 컴포넌트 호환
export const NAV = MENU.map((m) => ({ to: m.to, label: m.label.toUpperCase() }));

export const INSTAGRAM = 'https://www.instagram.com/imbykorea/';

/** 언어 선택 — 지금은 한국어만. 영어 페이지가 생기면 여기서 연결한다. */
function LangMenu() {
  const [on, setOn] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!on) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOn(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOn(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [on]);
  return (
    <div className="hd__lang" ref={box}>
      <button className="hd__ico" onClick={() => setOn((v) => !v)} aria-expanded={on} aria-haspopup="menu" aria-label="언어 선택">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" /></svg>
      </button>
      <ul className={`hd__langmenu ${on ? 'is-on' : ''}`} role="menu">
        <li role="menuitemradio" aria-checked="true" className="is-on">한국어</li>
        <li role="menuitemradio" aria-checked="false" aria-disabled="true">English <em>준비 중</em></li>
      </ul>
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const l = getLenis();
    if (open) l?.stop(); else l?.start();
  }, [open]);

  const section = '/' + (loc.pathname.split('/')[1] ?? '');

  return (
    <>
      <header className="hd">
        <div className="hd__bar">
          <Link to="/" className="hd__logo" aria-label="IMBY 홈">
            <img src="/brand/imby-logo-white.png" alt="IMBY" width="616" height="238" />
          </Link>
          <nav className="hd__nav" aria-label="주요 메뉴">
            {MENU.map((m) => (
              <div key={m.label} className="hd__col">
                <NavLink to={m.to} className={`hd__top ${m.to === section ? 'is-on' : ''}`}>{m.label}</NavLink>
              </div>
            ))}
          </nav>
          <div className="hd__right">
            <LangMenu />
            <a className="hd__ico" href={INSTAGRAM} target="_blank" rel="noopener noreferrer" aria-label="IMBY 인스타그램 @imbykorea 새 창으로 열기">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.6" className="dot" /></svg>
            </a>
            <button className="hd__burger" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="메뉴">
              <span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`mnav ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <nav className="mnav__list">
          {MENU.map((m) => (
            <div key={m.label} className="mnav__group">
              <Link to={m.to} className="mnav__top">{m.label}</Link>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
