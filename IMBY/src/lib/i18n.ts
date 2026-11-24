import { useSyncExternalStore } from 'react';

/**
 * 한/영 전환 — 헤더의 지구 아이콘에서 바꾼다.
 *  - 고른 언어는 브라우저에 기억 (다음 방문에도 유지)
 *  - 주소에 ?lang=en / ?lang=ko 가 붙어 오면 그 언어로 시작 (공유 링크용)
 * 쓰는 법:  const { lang, t } = useLang();  t('한국어 문구', 'English copy')
 */
export type Lang = 'ko' | 'en';
const KEY = 'imby-lang';
/** 영어판 공개 여부 — 번역을 마칠 때까지 false (메뉴에 'English 준비 중'으로만 보이고 전환되지 않는다) */
export const EN_READY = false;
const listeners = new Set<() => void>();

function initial(): Lang {
  if (!EN_READY) return 'ko';
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'ko') { localStorage.setItem(KEY, q); return q; }
    const s = localStorage.getItem(KEY);
    if (s === 'en' || s === 'ko') return s;
  } catch { /* 저장소를 못 쓰는 브라우저 */ }
  return 'ko';
}

let current: Lang = typeof window === 'undefined' ? 'ko' : initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export function setLang(l: Lang) {
  if (!EN_READY && l === 'en') return;
  if (l === current) return;
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* noop */ }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

export function getLang() { return current; }

export function useLang() {
  const lang = useSyncExternalStore(
    (f) => { listeners.add(f); return () => listeners.delete(f); },
    () => current,
    () => 'ko' as Lang,
  );
  const t = <T,>(ko: T, en: T): T => (lang === 'en' ? en : ko);
  return { lang, t, setLang };
}

/** DB 행의 en(jsonb) 덮어쓰기를 적용 — 영어일 때 값이 있으면 영어, 없으면 원문 */
export function pickEn<T extends Record<string, unknown>>(row: T, lang: Lang): T {
  const en = (row as { en?: Record<string, unknown> | null }).en;
  if (lang !== 'en' || !en || typeof en !== 'object') return row;
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(en)) {
    if (v === null || v === undefined || v === '') continue;
    if (k === 'sections' && Array.isArray(v) && Array.isArray(row.sections)) {
      // 라벨 · 이미지는 원문 행에서, 제목 · 본문만 영어로
      out.sections = (row.sections as Record<string, unknown>[]).map((s, i) => ({ ...s, ...((v[i] as object) ?? {}) }));
    } else if (k === 'metrics' && Array.isArray(v) && Array.isArray(row.metrics)) {
      out.metrics = (row.metrics as Record<string, unknown>[]).map((m, i) => ({ ...m, ...((v[i] as object) ?? {}) }));
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
