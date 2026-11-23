import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { ScrollTrigger, scrollToTop, startSmoothScroll } from '../lib/motion';

export default function Layout() {
  const loc = useLocation();
  const first = useRef(true);

  useEffect(() => {
    startSmoothScroll();
  }, []);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    scrollToTop(true);
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => window.clearTimeout(t);
  }, [loc.pathname]);

  return (
    <>
      <Header />
      <main id="main" key={loc.pathname} className="page">
        <Outlet />
      </main>
      {!loc.pathname.startsWith('/admin') && <Footer />}
    </>
  );
}
