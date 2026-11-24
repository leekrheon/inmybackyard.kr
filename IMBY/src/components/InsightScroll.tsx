import { useEffect, useRef, useState } from 'react';
import { MorphField } from './LazyGraphic';
import { getLenis } from '../lib/motion';
import { INSIGHT_ITEMS, HANDOVER } from './InsightSystem';

/**
 * 홈 — "제작은 무한해졌고, 인사이트는 희소해졌습니다." (스크롤 고정형)
 * 섹션이 화면에 고정되고, 스크롤에 따라 장면(네 가지)이 차례로 바뀐다. 번호는 쓰지 않는다.
 *  - 왼쪽: 헤드라인 + 장면 목록(누르면 그 장면으로 이동, 진행 막대가 차오름)
 *  - 오른쪽: 은색 픽셀 무리 하나가 빙산 → 펜 → 톱니 → 뫼비우스 띠로 흩어졌다 다시 짜이며 변신(MorphField) + 본문
 */
export default function InsightScroll() {
  const root = useRef<HTMLElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [local, setLocal] = useState(0); // 현재 장면 안에서의 진행 0..1
  const [scene, setScene] = useState(0); // 스크롤 위치 기준 장면
  const [morph, setMorph] = useState(0); // 그래픽 변신 값: 0 = 첫 그림 … n-1 = 마지막 그림
  const n = INSIGHT_ITEMS.length;

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = Math.min(0.9999, Math.max(0, -r.top / Math.max(1, span)));
      const sv = p * n;
      const i = Math.floor(sv);
      setLocal(sv - i);
      setScene(i);
      // 각 장면의 앞 45%는 그림을 그대로 보여 주고, 뒤 55% 동안 흩어지며 다음 그림으로 이어진다
      const f = sv - i;
      const m = Math.min(n - 1, i + Math.max(0, (f - 0.45) / 0.55));
      setMorph(m);
      // 글은 그림이 절반 넘게 바뀌었을 때 넘긴다
      setIdx(Math.min(n - 1, Math.round(m)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [n]);

  // 장면 이름을 누르면 그 장면의 시작 지점으로 부드럽게 이동
  const go = (i: number) => {
    const el = root.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    const y = top + (span * (i + 0.08)) / n;
    const l = getLenis();
    if (l) l.scrollTo(y, { duration: 1.2 }); else window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const it = INSIGHT_ITEMS[idx];

  return (
    <section className="isx" ref={root} style={{ height: `${n * 100 + 40}svh` }}>
      <div className="isx__pin wrap">
        <div className="isx__side">
          <h2 className="isx__title">제작은 무한해졌고,<br />인사이트는 희소해졌습니다.</h2>
          <ol className="isx__steps">
            {INSIGHT_ITEMS.map((x, i) => (
              <li key={x.fx} className={i === idx ? 'is-on' : i < idx ? 'is-done' : ''}>
                <button onClick={() => go(i)}>
                  <span className="isx__name">{x.t.replace('\n', ' ')}</span>
                </button>
                <i className="isx__bar" style={{ transform: `scaleX(${i < scene ? 1 : i === scene ? local : 0})` }} />
              </li>
            ))}
          </ol>
        </div>

        <div className="isx__main">
          <div className="isx__stage">
            {/* 픽셀 무리 하나가 장면마다 흩어졌다가 다음 그림으로 다시 짜인다 */}
            <MorphField srcs={INSIGHT_ITEMS.map((x) => x.fx)} progress={morph} zoom={1.2} />
          </div>
          <div className="isx__copy" key={idx}>
            <h3 className="isx__t">{it.t.split('\n').map((l, k) => <span key={k}>{l}{k === 0 && <br />}</span>)}</h3>
            <p className="isx__d">{it.d}</p>
            {it.handover && (
              <ul className="isx__hand">
                {HANDOVER.map((h) => <li key={h.t}><strong>{h.t}</strong><em>{h.d}</em></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
