import { Component, lazy, Suspense, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { retryImport } from '../lib/loadImage';

/**
 * 픽셀 그래픽(BrainField · MorphField)을 가볍게 띄우는 껍데기.
 *  1) 3D 코드(three.js)는 첫 화면 묶음에서 빼고, 필요할 때 따로 받는다 → 글과 사진이 먼저 뜬다
 *  2) 화면 가까이(400px 앞) 왔을 때만 받기·그리기를 시작한다 → 아래쪽 그래픽이 첫 로딩을 잡아먹지 않는다
 *  3) 받기에 실패해도 페이지 전체가 깨지지 않고, 그 자리만 비워 둔 채 조용히 넘어간다
 * 자리 표시는 실제 그래픽과 같은 클래스(.brain …)의 빈 div 라서 레이아웃이 흔들리지 않는다.
 */
const BrainFieldImpl = lazy(() => retryImport(() => import('./BrainField')));
const MorphFieldImpl = lazy(() => retryImport(() => import('./MorphField')));

class Quiet extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* 그래픽 하나가 실패해도 페이지는 그대로 */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function useNear(margin = '400px') {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!('IntersectionObserver' in window)) { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return { ref, near };
}

function Deferred({ className = '', children }: { className?: string; children: ReactNode }) {
  const { ref, near } = useNear();
  const hold = <div ref={ref} className={`brain ${className}`} aria-hidden="true" />;
  if (!near) return hold;
  const still = <div className={`brain ${className}`} aria-hidden="true" />;
  return <Quiet fallback={still}><Suspense fallback={still}>{children}</Suspense></Quiet>;
}

type BrainProps = ComponentProps<typeof BrainFieldImpl>;
type MorphProps = ComponentProps<typeof MorphFieldImpl>;

export function BrainField(props: BrainProps) {
  return <Deferred className={props.className}><BrainFieldImpl {...props} /></Deferred>;
}

export function MorphField(props: MorphProps) {
  return <Deferred className={props.className}><MorphFieldImpl {...props} /></Deferred>;
}
