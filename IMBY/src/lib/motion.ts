import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

/**
 * "쫀득한" 스크롤: 관성은 남기되 끝에서 살짝 늦게 멈추는 감쇠.
 * lerp 값을 낮출수록 더 끈적해진다. 0.05 는 휠을 굴려도 한 박자 늦게, 끈적하게 따라오는 느낌.
 */
export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return lenis;
  lenis = new Lenis({
    lerp: 0.05,
    wheelMultiplier: 0.78,
    touchMultiplier: 1.2,
    // 터치에서도 같은 감쇠를 걸어 모바일에서도 손끝에 붙어 따라오게
    syncTouch: true,
    syncTouchLerp: 0.07,
    touchInertiaExponent: 1.6,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function getLenis() {
  return lenis;
}

export function scrollToTop(immediate = true) {
  if (lenis) lenis.scrollTo(0, { immediate, force: true });
  else window.scrollTo(0, 0);
}

export { gsap, ScrollTrigger };
