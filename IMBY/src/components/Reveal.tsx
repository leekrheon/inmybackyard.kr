import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';

export function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }),
      { threshold, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

/** 아래에서 살짝 올라오며 나타남. 한 번만. */
export function Rv({ children, as: Tag = 'div', className = '', delay = 0, style }: {
  children: ReactNode; as?: ElementType; className?: string; delay?: number; style?: CSSProperties;
}) {
  const ref = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={`rv ${className}`} style={{ '--d': delay, ...style } as CSSProperties}>
      {children}
    </Tag>
  );
}
