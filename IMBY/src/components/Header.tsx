import { useEffect, useState } from 'react';
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
