import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLenis } from '../lib/motion';

/** 이노션식 푸터: 한 줄 — 로고·카피라이트 / 링크 / 연락처. + 우하단 맨 위로 버튼 */
export default function Footer() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const top = () => {
    const l = getLenis();
    if (l) l.scrollTo(0, { duration: 1.2 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer className="ft wrap">
        <div className="ft__brand">
          <Link to="/" aria-label="IMBY 홈"><img src="/brand/imby-logo-white.png" alt="IMBY" width="616" height="238" /></Link>
          <p className="g2">ⓒ IMBY — IN MY BACKYARD. ALL RIGHTS RESERVED.</p>
        </div>
        <nav className="ft__links" aria-label="하단 메뉴">
          <Link to="/work">Work</Link>
          <Link to="/about">About</Link>
          <Link to="/press">Press</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="ft__contact">
          <a href="mailto:idealee@inmybackyard.kr">idealee@inmybackyard.kr</a>
        </div>
      </footer>
      <button className={`totop ${show ? 'is-on' : ''}`} onClick={top} aria-label="맨 위로">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 13.5V3M3.5 7.5 8 3l4.5 4.5" /></svg>
      </button>
    </>
  );
}
