/**
 * 느린·끊기는 네트워크용 이미지 불러오기.
 *  - 실패하거나 오래 걸리면(기본 12초) 잠시 쉬었다 다시 시도한다 (최대 4번, 간격이 점점 길어짐)
 *  - 다시 시도할 땐 주소 끝에 ?r=n 을 붙여 끊긴 응답이 캐시에 남아 있어도 새로 받는다
 * 그래픽은 이 함수로 받은 이미지를 픽셀로 쪼개 쓴다.
 */
export function loadImage(src: string, tries = 4, timeoutMs = 12000): Promise<HTMLImageElement> {
  const once = (url: string) => new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    const t = window.setTimeout(() => { im.src = ''; rej(new Error('timeout')); }, timeoutMs);
    im.onload = () => { window.clearTimeout(t); res(im); };
    im.onerror = () => { window.clearTimeout(t); rej(new Error('error')); };
    im.src = url;
  });
  const attempt = (n: number): Promise<HTMLImageElement> =>
    once(n === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}r=${n}`).catch((e) => {
      if (n + 1 >= tries) throw e;
      return new Promise<HTMLImageElement>((r) => window.setTimeout(() => r(attempt(n + 1)), 800 * 2 ** n));
    });
  return attempt(0);
}

/**
 * 그래픽 원본 이미지 불러오기 — 원본을 그대로 쓰는 것이 기본.
 * 원본이 실패하거나 너무 오래 걸릴 때(느린 와이파이)만 같은 그림의 저용량 버전(/media/px/*.webp)으로 대신한다.
 */
const LOW: Record<string, string> = {
  '/media/brain-silver.png': '/media/px/brain-silver.webp',
  '/media/fx-gears.png': '/media/px/fx-gears.webp',
  '/media/fx-hands.png': '/media/px/fx-hands.webp',
  '/media/fx-heart.png': '/media/px/fx-heart.webp',
  '/media/fx-iceberg.png': '/media/px/fx-iceberg.webp',
  '/media/fx-mobius.png': '/media/px/fx-mobius.webp',
  '/media/fx-pen.png': '/media/px/fx-pen.webp',
};
export function loadGraphic(src: string): Promise<HTMLImageElement> {
  const low = LOW[src];
  if (!low) return loadImage(src);
  // 원본은 두 번까지(각 9초) 기다리고, 안 되면 저용량으로
  return loadImage(src, 2, 9000).catch(() => loadImage(low));
}

/** 코드 조각(chunk) 불러오기도 같은 방식으로 다시 시도 — 배포 직후나 끊긴 연결에서 화면이 깨지지 않게 */
export function retryImport<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  const attempt = (n: number): Promise<T> =>
    fn().catch((e) => {
      if (n + 1 >= tries) throw e;
      return new Promise<T>((r) => window.setTimeout(() => r(attempt(n + 1)), 800 * 2 ** n));
    });
  return attempt(0);
}
