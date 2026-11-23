import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

/** 한 글자씩 빠르게 타이핑되는 문장. 줄은 배열로 받고, 끝나면 커서가 깜빡인다. */
export default function Typewriter({ lines, speed = 42, delay = 500, className = '', onDone }: { lines: string[]; speed?: number; delay?: number; className?: string; onDone?: () => void }) {
  const full = lines.join('\n');
  const [n, setN] = useState(() => (prefersReducedMotion() ? full.length : 0));

  useEffect(() => {
    if (prefersReducedMotion()) { onDone?.(); return; }
    let i = 0;
    let t = 0;
    const tick = () => {
      i += 1;
      setN(i);
      // 줄바꿈과 마침표 뒤에서 살짝 쉬어 사람이 치는 리듬을 낸다
      const ch = full[i - 1];
      if (i < full.length) t = window.setTimeout(tick, ch === '\n' ? speed * 6 : ch === '.' ? speed * 3 : speed * (0.7 + Math.random() * 0.6));
      else onDone?.();
    };
    t = window.setTimeout(tick, delay);
    return () => window.clearTimeout(t);
  }, [full, speed, delay]);

  const shown = full.slice(0, n).split('\n');
  return (
    <h1 className={`tw ${className}`} aria-label={lines.join(' ')}>
      <span aria-hidden="true">
        {shown.map((l, k) => (
          <span key={k} className="tw__line">{l}{k === shown.length - 1 && <i className={`tw__caret ${n >= full.length ? 'is-done' : ''}`} />}</span>
        ))}
        {/* 자리를 미리 잡아 두어 타이핑 중에 레이아웃이 흔들리지 않게 */}
        {lines.slice(shown.length).map((_, k) => <span key={`p${k}`} className="tw__line">&nbsp;</span>)}
      </span>
    </h1>
  );
}
