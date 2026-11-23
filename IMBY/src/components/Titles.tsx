import type { ReactNode } from 'react';
import { useInView } from './Reveal';

/** 페이지 제목: 대문자, 아래에서 위로 올라오는 마스크 */
export function PageTitle({ children, sub }: { children: string; sub?: ReactNode }) {
  const ref = useInView<HTMLHeadingElement>(0.05);
  return (
    <header className="ptitle wrap">
      <h1 ref={ref} className="ptitle__h"><span>{children}</span></h1>
      {sub && <div className="ptitle__sub">{sub}</div>}
    </header>
  );
}

/**
 * 큰 문장: 줄마다 아래에서 올라오고, dim 으로 지정한 줄은 회색으로 남는다.
 * 사진을 끼워 넣지 않는다 — 문장 자체가 주인공.
 */
export function Statement({ lines, dim = [], as: Tag = 'h2', className = '' }: { lines: string[]; dim?: number[]; as?: 'h1' | 'h2'; className?: string }) {
  const ref = useInView<HTMLHeadingElement>(0.25);
  return (
    <Tag ref={ref} className={`stm ${className}`}>
      {lines.map((l, i) => (
        <span key={i} className={`stm__line ${dim.includes(i) ? 'is-dim' : ''}`} style={{ '--i': i } as React.CSSProperties}>
          <span>{l}</span>
        </span>
      ))}
    </Tag>
  );
}
