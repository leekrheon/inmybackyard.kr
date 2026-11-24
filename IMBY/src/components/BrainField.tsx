import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Silver Pixel Field — 피그마 AI로 렌더한 크롬 뇌(또는 로고)를 픽셀 단위로 샘플링해 3D 파티클로 다시 세운다.
 *  - 밝기 = 은색 톤, 하이라이트 픽셀은 제각각 반짝인다
 *  - 스크롤을 내리면 흩어지고, 올리면 다시 모인다 (스프링처럼 쫀득하게 따라온다)
 *
 * 이중 투영(아나모픽) 모드 — topSrc 를 주면:
 *  픽셀 하나하나의 (x, y)는 정면에서 본 뇌를, (x, z)는 위에서 본 글자(IMBY)를 이루도록 공간에 배치한다.
 *  모양이 바뀌는 게 아니라 카메라가 위로 올라가며 내려다보는 순간, 같은 픽셀들이 다른 그림으로 읽힌다.
 *  (참고: 정면에선 로고, 돌아가면 병이 되는 공중 설치물 영상의 원리)
 */
const SRC = '/media/brain-silver.png';
const GRID = 300; // 가로 샘플 수

export const VERT = /* glsl */ `
  attribute float aLum;
  attribute float aLum2;
  attribute vec2 aVis;
  attribute float aSeed;
  attribute vec3 aScatter;
  uniform float uTime;
  uniform float uIn;
  uniform float uView;
  uniform float uSize;
  uniform float uPR;
  uniform float uOrtho;
  varying float vLum;
  varying float vSpark;
  varying float vVis;
  varying float vIn;

  void main() {
    float k = smoothstep(0.0, 1.0, clamp(uIn * 1.25 - aSeed * 0.25, 0.0, 1.0));
    vIn = k;
    vec3 p = mix(aScatter, position, k);
    // 숨쉬듯 아주 미세한 일렁임
    p += vec3(0.0, 0.0, 1.0) * sin(uTime * 1.3 + position.x * 6.0 + position.y * 4.0) * 0.004;

    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // 위에서 본 글자는 한 단계 밝게
    float lum = mix(aLum, min(1.0, aLum2 * 1.3 + 0.14), uView);
    vVis = mix(aVis.x, aVis.y, smoothstep(0.15, 0.85, uView));
    // 하이라이트 반짝임: 밝은 픽셀일수록 자주, 날카롭게
    float tw = pow(max(0.0, sin(uTime * (1.2 + aSeed * 2.6) + aSeed * 40.0)), 24.0);
    vSpark = tw * smoothstep(0.55, 0.95, lum);
    vLum = lum;

    float persp = uOrtho > 0.5 ? uOrtho : 2.2 / -mv.z;
    gl_PointSize = uSize * uPR * (0.75 + lum * 0.55 + vSpark * 1.6) * persp;
  }
`;

export const FRAG = /* glsl */ `
  precision highp float;
  varying float vLum;
  varying float vSpark;
  varying float vVis;
  varying float vIn;
  void main() {
    if (vVis < 0.02 || vIn < 0.01) discard;
    // 정사각 픽셀 — 가장자리만 살짝 깎아 계단을 줄인다
    vec2 c = abs(gl_PointCoord - 0.5);
    if (max(c.x, c.y) > 0.46) discard;
    vec3 shadow = vec3(0.30, 0.32, 0.36);
    vec3 mid = vec3(0.68, 0.70, 0.74);
    vec3 hi = vec3(0.97, 0.98, 1.0);
    vec3 col = vLum < 0.5 ? mix(shadow, mid, vLum * 2.0) : mix(mid, hi, (vLum - 0.5) * 2.0);
    col += vSpark * 1.4;
    float a = 0.35 + vLum * 0.65;
    // 흩어진 픽셀은 거의 투명했다가 모일수록 또렷해진다 — 캔버스 네모 경계가 드러나지 않게
    float fade = smoothstep(0.0, 0.75, vIn);
    gl_FragColor = vec4(col, clamp(a + vSpark, 0.0, 1.0) * vVis * fade);
  }
`;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/** 실루엣 안쪽까지의 거리(체스보드 거리 변환, 픽셀 단위) */
function insideDistance(mask: Uint8Array, W: number, H: number) {
  const INF = 1e6;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!d[i]) continue;
    const a = x > 0 ? d[i - 1] : 0, b = y > 0 ? d[i - W] : 0;
    d[i] = Math.min(d[i], a + 1, b + 1);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (!d[i]) continue;
    const a = x < W - 1 ? d[i + 1] : 0, b = y < H - 1 ? d[i + W] : 0;
    d[i] = Math.min(d[i], a + 1, b + 1);
  }
  return d;
}

type Mode = 'image' | 'shape';
type Crop = [number, number, number, number]; // sx, sy, sw, sh (원본 이미지 픽셀)
type Sample = { xs: number[]; ys: number[]; zs: number[]; lums: number[]; aspect: number };

/**
 * 이미지 한 장 → 점 목록. x는 -1..1, y는 위가 +, z는 볼륨.
 * image: 사진 밝기를 그대로 은색 톤으로 / shape: 단색 도형에 크롬 볼륨·조명을 입힌다.
 */
export function sample(img: HTMLImageElement | HTMLCanvasElement, mode: Mode, grid: number, crop?: Crop, trim = false, keepAll = false): Sample {
  const iw = (img as HTMLImageElement).naturalWidth || img.width || 1, ih = (img as HTMLImageElement).naturalHeight || img.height || 1;
  const [sx, sy, sw, sh] = crop ?? [0, 0, iw, ih];
  const W = grid, H = Math.max(1, Math.round((grid * sh) / sw));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const px = cx.getImageData(0, 0, W, H).data;
  const N = W * H;
  const lum = new Float32Array(N);
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const l = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
    const a = px[i * 4 + 3] / 255;
    lum[i] = l * a;
    mask[i] = l * a > (mode === 'shape' ? 0.4 : 0.07) ? 1 : 0;
  }
  const dist = insideDistance(mask, W, H);
  let maxD = 1;
  for (let i = 0; i < N; i++) if (dist[i] > maxD) maxD = dist[i];

  if (mode === 'shape') {
    // 가장자리가 둥글게 솟은 볼륨의 기울기로 조명을 계산해 은색 명암을 만든다
    const hgt = new Float32Array(N);
    for (let i = 0; i < N; i++) hgt[i] = mask[i] ? Math.sqrt(Math.min(1, dist[i] / maxD)) : 0;
    const L = [-0.45, 0.55, 0.7]; const ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const gx = (hgt[y * W + Math.min(W - 1, x + 1)] - hgt[y * W + Math.max(0, x - 1)]) * 0.5;
      const gy = (hgt[Math.min(H - 1, y + 1) * W + x] - hgt[Math.max(0, y - 1) * W + x]) * 0.5;
      let nx = -gx * 9, ny = gy * 9, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const rz = 2 * diff * nz - L[2];
      const spec = Math.pow(Math.max(0, rz), 18);
      const band = 0.2 * Math.sin((y / H) * Math.PI * 2.6 + (x / W) * 5); // 크롬 반사 띠
      lum[i] = Math.max(0.05, Math.min(1, 0.05 + diff * diff * 0.62 + spec * 0.75 + band + (Math.random() - 0.5) * 0.12));
      dist[i] = hgt[i];
    }
  } else {
    for (let i = 0; i < N; i++) dist[i] = dist[i] / maxD;
  }

  // trim: 이미지의 검은 여백을 잘라 오브젝트 테두리 기준으로 꽉 차게
  let bx0 = 0, by0 = 0, bx1 = W - 1, by1 = H - 1;
  if (trim) {
    bx0 = W; by0 = H; bx1 = 0; by1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (bx1 <= bx0 || by1 <= by0) { bx0 = 0; by0 = 0; bx1 = W - 1; by1 = H - 1; }
  }
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  const aspect = bh / bw;
  const depth = mode === 'shape' ? 0.07 : 0.62;
  const out: Sample = { xs: [], ys: [], zs: [], lums: [], aspect };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!mask[i]) continue;
    const l = lum[i];
    // 어두운 곳은 듬성듬성, 밝은 곳은 촘촘하게
    if (!keepAll && Math.random() > (mode === 'shape' ? 0.22 + l * 0.7 : 0.35 + l * 0.9)) continue;
    const vol = mode === 'shape' ? dist[i] : Math.sqrt(dist[i]);
    out.xs.push(((x - bx0) / bw - 0.5) * 2);
    out.ys.push(-((y - by0) / bh - 0.5) * 2 * aspect);
    out.zs.push(vol * depth + (l - 0.5) * (mode === 'shape' ? 0.02 : 0.08));
    out.lums.push(l);
  }
  return out;
}

type Props = {
  className?: string;
  /** 정면에서 보이는 이미지 (png · svg) */
  src?: string;
  mode?: Mode;
  /** 가로 샘플 수 */
  grid?: number;
  /** 컨테이너에 꽉 차게 카메라 거리를 맞출지 */
  fit?: boolean;
  /** 마우스 회전 세기 */
  tilt?: number;
  /** 스크롤을 스프링처럼 따라 움직일지 */
  springy?: boolean;
  /** 위에서 내려다볼 때 읽히는 이미지 (단색 로고) */
  topSrc?: string;
  /** topSrc 에서 잘라 쓸 영역 */
  topCrop?: Crop;
  /** 0 = 정면, 1 = 카메라가 올라가 위에서 내려다봄 */
  view?: number;
  /** 스크롤을 내리면 픽셀이 흩어질지 */
  dissolve?: boolean;
  /** 화면에 처음 보인 뒤 몇 ms 후에 픽셀이 모이기 시작할지 (여러 개를 차례로 띄울 때) */
  delay?: number;
  /** false 면 픽셀이 모이는 연출 없이 처음부터 완성된 모양 */
  assemble?: boolean;
};

export default function BrainField({ className = '', src = SRC, mode = 'image', grid = GRID, fit = false, tilt = 1, springy = true, topSrc, topCrop, view = 0, dissolve = true, delay = 0, assemble = true }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const cropKey = topCrop?.join(',') ?? '';

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dual = !!topSrc;
    // 이중 투영은 정확한 시점에서만 그림이 맞으므로 마우스 기울기를 아주 작게
    const tiltAmt = dual ? tilt * 0.12 : tilt;
    let disposed = false;
    let raf = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    const pr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // 이중 투영은 직교 카메라: 깊이에 따른 원근 왜곡이 없어 정면·위 두 시점 모두 그림이 정확히 맞는다
    const VIEW_H = 1.12; // 화면에 보일 세로 반높이(월드 단위)
    const camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = dual
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30)
      : new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    const baseZ = dual ? 6 : 3.75;
    camera.position.set(0, 0, baseZ);
    const group = new THREE.Group();
    scene.add(group);

    const uniforms = {
      uTime: { value: 0 },
      uIn: { value: reduced || !assemble ? 1 : 0 },
      uView: { value: 0 },
      uSize: { value: 2.6 },
      uPR: { value: pr },
      uOrtho: { value: dual ? 0.6 : 0 },
    };

    let halfW = 0, halfH = 0, orthoH = VIEW_H;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      if (camera instanceof THREE.OrthographicCamera) {
        const a = w / h;
        // 가로가 좁은 화면(모바일)에서도 양옆이 잘리지 않게
        orthoH = Math.max(VIEW_H, 1.08 / a);
        camera.left = -orthoH * a; camera.right = orthoH * a; camera.top = orthoH; camera.bottom = -orthoH;
      } else {
        camera.aspect = w / h;
        if (fit && halfW) {
          const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          camera.position.z = Math.max((halfW * 1.08) / (t * camera.aspect), (halfH * 1.25) / t) + 0.3;
        }
      }
      camera.updateProjectionMatrix();
      uniforms.uSize.value = Math.max(1.6, Math.min(3.2, w / 520));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // 포인터 → 회전만
    const target = { rx: 0, ry: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.ry = (((e.clientX - r.left) / r.width) * 2 - 1) * 0.45 * tiltAmt;
      target.rx = (((e.clientY - r.top) / r.height) * 2 - 1) * 0.18 * tiltAmt;
    };
    const onLeave = () => { target.rx = 0; target.ry = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);

    let geo: THREE.BufferGeometry | null = null;
    let mat: THREE.ShaderMaterial | null = null;
    let visible = true;
    let seenAt = -1; // 처음 화면에 들어온 시각(초)
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && seenAt < 0) seenAt = performance.now() / 1000; }, { threshold: 0 });
    io.observe(el);

    const finish = (pos: Float32Array, lum: Float32Array, lum2: Float32Array, vis: Float32Array) => {
      const n = lum.length;
      const seeds = new Float32Array(n), scat = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        seeds[i] = Math.random();
        // 자기 자리 주변의 부드러운 구름(가우시안)에서 출발 — 멀리 네모 밖에서 날아오지 않는다
        const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
        const spread = 0.35 + Math.random() * 0.75;
        scat[i * 3] = pos[i * 3] * 1.15 + g() * spread;
        scat[i * 3 + 1] = pos[i * 3 + 1] * 1.15 + g() * spread;
        scat[i * 3 + 2] = pos[i * 3 + 2] + g() * spread * 1.4;
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aLum', new THREE.BufferAttribute(lum, 1));
      geo.setAttribute('aLum2', new THREE.BufferAttribute(lum2, 1));
      geo.setAttribute('aVis', new THREE.BufferAttribute(vis, 2));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
      geo.setAttribute('aScatter', new THREE.BufferAttribute(scat, 3));
      mat = new THREE.ShaderMaterial({
        uniforms, vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      group.add(new THREE.Points(geo, mat));
      el.classList.add('is-ready');
    };

    Promise.all([loadImage(src), topSrc ? loadImage(topSrc) : Promise.resolve(null)]).then(([img, img2]) => {
      if (disposed) return;
      const A = sample(img, mode, grid, undefined, fit);
      halfW = 1; halfH = A.aspect;
      resize();

      if (!img2) {
        // 일반 모드: 실루엣 볼륨으로 입체 + 뒤쪽도 얇게 채움
        const pos: number[] = [], lum: number[] = [];
        A.xs.forEach((x, i) => {
          pos.push(x, A.ys[i], A.zs[i]); lum.push(A.lums[i]);
          if (A.zs[i] > 0.15 && Math.random() < 0.28) { pos.push(x, A.ys[i], -A.zs[i] * 0.85); lum.push(A.lums[i] * 0.45); }
        });
        const l = new Float32Array(lum);
        finish(new Float32Array(pos), l, l, new Float32Array(lum.length * 2).fill(1));
        return;
      }

      // ---------- 이중 투영 ----------
      // 위에서 볼 글자(IMBY)는 크롬 도형으로 샘플링하고, 뇌의 가로 폭에 맞춰 x를 정렬한다
      const B = sample(img2, 'shape', 260, topCrop, true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      A.xs.forEach((x) => { if (x < minX) minX = x; if (x > maxX) maxX = x; });
      A.ys.forEach((y) => { if (y < minY) minY = y; if (y > maxY) maxY = y; });
      // 뇌 픽셀 묶음의 가로 중심을 0에 맞춘다 → 위에서 본 IMBY도 화면 가로 정중앙
      const midX = (minX + maxX) / 2;
      for (let i = 0; i < A.xs.length; i++) A.xs[i] -= midX;
      minX -= midX; maxX -= midX;
      const spanX = maxX - minX;
      const C = 240; // 열 개수
      const col = (x: number) => Math.max(0, Math.min(C - 1, Math.floor(((x - minX) / spanX) * C)));
      // 글자: x를 뇌 폭(-1..1 → minX..maxX)으로, 세로(위가 +)를 깊이 z로. 위가 화면 위쪽 = 카메라에서 먼 쪽(-z)
      const bx = B.xs.map((x) => minX + ((x + 1) / 2) * spanX);
      const bz = B.ys.map((y) => -y * (spanX / 2));
      const colsA: number[][] = Array.from({ length: C }, () => []);
      const colsB: number[][] = Array.from({ length: C }, () => []);
      A.xs.forEach((x, i) => colsA[col(x)].push(i));
      bx.forEach((x, i) => colsB[col(x)].push(i));
      const shuffle = (a: number[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const zRange = spanX * B.aspect; // 글자 깊이 폭
      const cw = spanX / C;

      const pos: number[] = [], lum: number[] = [], lum2: number[] = [], vis: number[] = [];
      for (let c = 0; c < C; c++) {
        const ca = shuffle(colsA[c]), cb = shuffle(colsB[c]);
        const n = Math.max(ca.length, cb.length);
        for (let k = 0; k < n; k++) {
          const ia = ca.length ? ca[k % ca.length] : -1;
          const ib = cb.length ? cb[k % cb.length] : -1;
          const x = ia >= 0 ? A.xs[ia] : bx[ib] + (Math.random() - 0.5) * cw;
          // 정면용 y: 뇌 픽셀. 뇌가 없는 열이면 위에서만 보이도록 아무 높이에 두고 정면에선 숨긴다
          const y = ia >= 0 ? A.ys[ia] : minY + Math.random() * (maxY - minY);
          // 위에서 볼 z: 글자 픽셀. 글자가 없는 열이면 뇌 볼륨 깊이를 쓰고 위에서 볼 땐 숨긴다
          const z = ib >= 0 ? bz[ib] : (Math.random() - 0.5) * zRange;
          pos.push(x, y, z);
          lum.push(ia >= 0 ? A.lums[ia] : 0);
          lum2.push(ib >= 0 ? B.lums[ib] : 0);
          // 같은 픽셀을 복제해 개수를 맞춘 점은 그 시점에서 숨겨 밝기가 겹치지 않게
          vis.push(ia >= 0 && k < ca.length ? 1 : 0, ib >= 0 && k < cb.length ? 1 : 0);
        }
      }
      finish(new Float32Array(pos), new Float32Array(lum), new Float32Array(lum2), new Float32Array(vis));
    });

    const clock = new THREE.Clock();
    let intro = reduced || !assemble ? 1 : 0;
    let lastY = window.scrollY, posY = 0, posV = 0, str = 0, strV = 0;
    let v = 0; // 0 정면 → 1 위에서 (처음 한 번 자동 전환)
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const TOP = Math.PI / 2;

    // ---------- 드래그로 자유롭게 돌려 보기 (이중 투영 모드) ----------
    // elev: 0 = 정면(뇌), π/2 = 위(IMBY). azim: 좌우로 도는 각.
    let manual = false, dragging = false;
    let elev = 0, azim = 0, elevGoal = 0, azimGoal = 0;
    let px0 = 0, py0 = 0;
    const onDown = (e: PointerEvent) => {
      if (!dual || e.pointerType === 'touch' || e.button !== 0) return;
      if (!manual) { manual = true; elev = ease(v) * TOP; azim = 0; }
      dragging = true; px0 = e.clientX; py0 = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('is-dragging');
      e.preventDefault();
    };
    const onDrag = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - px0, dy = e.clientY - py0;
      px0 = e.clientX; py0 = e.clientY;
      azim -= dx * 0.007;
      // 아래로 끌어내리면 카메라가 앞으로 내려와 뇌가, 위로 올리면 다시 IMBY가 보인다
      elev = Math.max(-0.45, Math.min(TOP, elev - dy * 0.007));
      elevGoal = elev; azimGoal = azim;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
      // 정면·위 두 시점 가까이에서 놓으면 그림이 딱 맞는 구도로 자석처럼 붙는다
      const az = Math.atan2(Math.sin(azim), Math.cos(azim));
      const near = Math.abs(az) < 0.6;
      if (near && elev < 0.38) { elevGoal = 0; azimGoal = azim - az; }
      else if (near && elev > TOP - 0.38) { elevGoal = TOP; azimGoal = azim - az; }
    };
    if (dual) {
      el.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onDrag);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      uniforms.uTime.value = t;
      // 스크롤: 첫 화면에선 모여 있고, 내려갈수록 흩어지고, 다시 올리면 모인다
      if (geo && seenAt >= 0 && performance.now() / 1000 - seenAt >= delay / 1000) intro = Math.min(1, intro + dt * 0.6);
      const rect = el.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.75)));
      const goal = reduced ? 1 : intro * (dissolve ? 1 - s : 1);
      uniforms.uIn.value += (goal - uniforms.uIn.value) * Math.min(1, dt * 7);

      // 카메라가 위로 올라가 내려다보는 전환 (약 1.8초, 천천히 시작해 천천히 멈춤)
      const vt = viewRef.current;
      v = reduced ? vt : v + Math.sign(vt - v) * Math.min(Math.abs(vt - v), dt / 1.8);
      if (manual && !dragging) {
        elev += (elevGoal - elev) * Math.min(1, dt * 6);
        azim += (azimGoal - azim) * Math.min(1, dt * 6);
      }
      const ang = manual ? elev : ease(v) * TOP;
      const az = manual ? azim : 0;
      const e = Math.max(0, Math.min(1, ang / TOP));
      uniforms.uView.value = e;
      if (dual) {
        const ce = Math.cos(ang), se = Math.sin(ang);
        camera.position.set(ce * Math.sin(az) * baseZ, se * baseZ, ce * Math.cos(az) * baseZ);
        camera.up.set(-se * Math.sin(az), ce, -se * Math.cos(az));
        camera.lookAt(0, 0, 0);
        // 돌아가는 도중 살짝 뒤로 물러났다가 다시 다가온다
        camera.zoom = 1 - Math.sin(e * Math.PI) * 0.14;
        // 내려다본 화면에서 글자가 위쪽에 오도록 시야를 아래로 내린다
        if (camera instanceof THREE.OrthographicCamera) { const off = orthoH * 0.2 * e; camera.top = orthoH - off; camera.bottom = -orthoH - off; }
        camera.updateProjectionMatrix();
      }

      // 쫀득한 스크롤: 스크롤 위치·속도를 스프링으로 따라간다
      if (!reduced && springy) {
        const k = dt * 60;
        const sy = window.scrollY;
        const vel = sy - lastY; lastY = sy;
        const goalY = s * 0.9;
        posV = (posV + (goalY - posY) * 0.06 * k) * Math.pow(0.8, k);
        posY += posV * k;
        const goalS = Math.max(-0.22, Math.min(0.22, vel * 0.006));
        strV = (strV + (goalS - str) * 0.12 * k) * Math.pow(0.72, k);
        str += strV * k;
        group.position.y = dual ? posY * (1 - e) : posY;
        group.scale.set(1 - str * 0.35, 1 + str, 1);
      }
      // 저절로 흔들리는 폭도 tilt 에 맞춰 줄인다 (로고처럼 차분해야 하는 곳은 tilt 를 낮게)
      const idle = reduced ? 0 : Math.sin(t * 0.35) * 0.18 * (dual ? 0.12 : Math.min(1, tilt));
      const hover = manual ? 0 : 1; // 직접 돌려 보는 중엔 마우스 기울기를 끈다
      group.rotation.y += ((target.ry + idle) * hover - group.rotation.y) * 0.05;
      group.rotation.x += (target.rx * hover - group.rotation.x) * 0.05;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      geo?.dispose();
      mat?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, topSrc, cropKey]);

  return <div ref={host} className={`brain ${className}`} aria-hidden="true" />;
}
