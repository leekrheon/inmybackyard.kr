import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { sample } from './BrainField';
import { loadGraphic } from '../lib/loadImage';

/**
 * 하나의 은색 픽셀 무리가 여러 그림 사이를 오가는 그래픽.
 * 장면(index)이 바뀌면 픽셀이 제자리에서 흩어졌다가 곧바로 다음 그림의 자리로 다시 짜인다 — 트랜스포머처럼.
 * 각 픽셀은 그림마다(최대 4장) 자기 자리(aP0..aP3)와 밝기(aL0..aL3)를 미리 갖고 있고, 셰이더가 그 사이를 잇는다.
 */
const VERT = /* glsl */ `
  attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aP2; attribute vec3 aP3;
  attribute float aL0; attribute float aL1; attribute float aL2; attribute float aL3;
  attribute float aSeed;
  attribute vec3 aDir;
  uniform float uFrom; uniform float uTo; uniform float uT;
  uniform float uIn; uniform float uTime; uniform float uSize; uniform float uPR;
  varying float vLum; varying float vSpark; varying float vA;

  vec3 posOf(float i) { return i < 0.5 ? aP0 : (i < 1.5 ? aP1 : (i < 2.5 ? aP2 : aP3)); }
  float lumOf(float i) { return i < 0.5 ? aL0 : (i < 1.5 ? aL1 : (i < 2.5 ? aL2 : aL3)); }

  void main() {
    // 픽셀마다 출발 시각을 조금씩 어긋나게 → 한꺼번에가 아니라 물결처럼 변한다
    float k = clamp(uT * 1.45 - aSeed * 0.45, 0.0, 1.0);
    float e = k * k * (3.0 - 2.0 * k);
    vec3 a = posOf(uFrom), b = posOf(uTo);
    vec3 p = mix(a, b, e);
    // 가는 도중엔 바깥으로 부풀며 흩어졌다가 새 자리로 접혀 들어간다
    float burst = sin(e * 3.14159);
    p += aDir * burst * (0.38 + aSeed * 0.5);
    p += vec3(sin(uTime * 0.9 + aSeed * 30.0), cos(uTime * 0.7 + aSeed * 21.0), 0.0) * burst * 0.06;

    // 처음 화면에 들어올 때: 자기 자리 주변 구름에서 모인다
    float ki = smoothstep(0.0, 1.0, clamp(uIn * 1.3 - aSeed * 0.3, 0.0, 1.0));
    p = mix(p + aDir * 1.1, p, ki);
    p += vec3(0.0, 0.0, 1.0) * sin(uTime * 1.3 + p.x * 6.0 + p.y * 4.0) * 0.004;

    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float lum = mix(lumOf(uFrom), lumOf(uTo), e);
    float tw = pow(max(0.0, sin(uTime * (1.2 + aSeed * 2.6) + aSeed * 40.0)), 24.0);
    vSpark = tw * smoothstep(0.55, 0.95, lum);
    vLum = lum;
    vA = smoothstep(0.0, 0.75, ki) * (1.0 - burst * 0.25);
    gl_PointSize = uSize * uPR * (0.75 + lum * 0.55 + vSpark * 1.6) * (2.2 / -mv.z);
  }
`;
const FRAG = /* glsl */ `
  precision highp float;
  varying float vLum; varying float vSpark; varying float vA;
  void main() {
    if (vLum < 0.02 || vA < 0.01) discard;
    vec2 c = abs(gl_PointCoord - 0.5);
    if (max(c.x, c.y) > 0.46) discard;
    vec3 shadow = vec3(0.30, 0.32, 0.36), mid = vec3(0.68, 0.70, 0.74), hi = vec3(0.97, 0.98, 1.0);
    vec3 col = vLum < 0.5 ? mix(shadow, mid, vLum * 2.0) : mix(mid, hi, (vLum - 0.5) * 2.0);
    col += vSpark * 1.4;
    float a = 0.35 + vLum * 0.65;
    gl_FragColor = vec4(col, clamp(a + vSpark, 0.0, 1.0) * vA);
  }
`;


type Props = {
  srcs: string[];
  /** 시간으로 넘기는 방식: 장면 번호가 바뀌면 1.5초 동안 변신 */
  index?: number;
  /** 스크롤로 넘기는 방식: 0 = 첫 그림, 1 = 두 번째 그림 … 소수점은 그 사이(흩어진 정도). 주면 index 대신 쓴다 */
  progress?: number;
  grid?: number; className?: string; tilt?: number;
  /** 1 = 칸에 꼭 맞게, 1.2 = 20% 크게 */
  zoom?: number;
};

export default function MorphField({ srcs, index = 0, progress, grid = 300, className = '', tilt = 0.7, zoom = 1 }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const idxRef = useRef(index);
  idxRef.current = index;
  const progRef = useRef<number | undefined>(progress);
  progRef.current = progress;
  const key = srcs.join('|');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed = false, raf = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    const pr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    camera.position.set(0, 0, 3.75);
    const group = new THREE.Group();
    scene.add(group);

    const u = {
      uFrom: { value: 0 }, uTo: { value: 0 }, uT: { value: 1 }, uIn: { value: reduced ? 1 : 0 },
      uTime: { value: 0 }, uSize: { value: 2.6 }, uPR: { value: pr },
    };
    let halfH = 1;
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.z = (Math.max(1.08 / (t * camera.aspect), (halfH * 1.25) / t) + 0.3) / zoom;
      camera.updateProjectionMatrix();
      u.uSize.value = Math.max(1.6, Math.min(3.2, w / 520));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const target = { rx: 0, ry: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.ry = (((e.clientX - r.left) / r.width) * 2 - 1) * 0.45 * tilt;
      target.rx = (((e.clientY - r.top) / r.height) * 2 - 1) * 0.18 * tilt;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; });
    io.observe(el);

    let geo: THREE.BufferGeometry | null = null, mat: THREE.ShaderMaterial | null = null;
    Promise.all(srcs.slice(0, 4).map((s) => loadGraphic(s))).then((imgs) => {
      if (disposed) return;
      const S = imgs.map((im) => sample(im, 'image', grid, undefined, true));
      while (S.length < 4) S.push(S[S.length - 1]);
      halfH = Math.max(...S.map((s) => s.aspect));
      resize();
      const N = Math.max(...S.map((s) => s.xs.length));
      const P = [0, 1, 2, 3].map(() => new Float32Array(N * 3));
      const L = [0, 1, 2, 3].map(() => new Float32Array(N));
      // 그림마다 픽셀 순서를 섞어 둔다 → 같은 픽셀이 다음 그림에선 엉뚱한 곳으로 날아가며 교차한다
      const order = S.map((s) => { const a = Array.from({ length: s.xs.length }, (_, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
      for (let s = 0; s < 4; s++) {
        const smp = S[s], n = smp.xs.length;
        for (let i = 0; i < N; i++) {
          const dup = i >= n;
          const j = order[s][i % n];
          const jit = dup ? 0.006 : 0;
          P[s][i * 3] = smp.xs[j] + (Math.random() - 0.5) * jit;
          P[s][i * 3 + 1] = smp.ys[j] + (Math.random() - 0.5) * jit;
          P[s][i * 3 + 2] = smp.zs[j];
          L[s][i] = dup ? smp.lums[j] * 0.35 : smp.lums[j]; // 개수를 맞추려 겹친 점은 흐리게
        }
      }
      const seed = new Float32Array(N), dir = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        seed[i] = Math.random();
        const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
        dir[i * 3] = Math.sin(ph) * Math.cos(th); dir[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * 0.8; dir[i * 3 + 2] = Math.cos(ph);
      }
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P[0], 3));
      ['aP0', 'aP1', 'aP2', 'aP3'].forEach((k, s) => geo!.setAttribute(k, new THREE.BufferAttribute(P[s], 3)));
      ['aL0', 'aL1', 'aL2', 'aL3'].forEach((k, s) => geo!.setAttribute(k, new THREE.BufferAttribute(L[s], 1)));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
      mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      group.add(new THREE.Points(geo, mat));
      u.uFrom.value = u.uTo.value = progRef.current !== undefined ? Math.round(progRef.current) : idxRef.current;
      smooth = progRef.current ?? 0;
      el.classList.add('is-ready');
    }).catch(() => { /* 원본·저용량 모두 실패: 그 자리만 비워 둔다 */ });

    const clock = new THREE.Clock();
    const DUR = 1.5; // 한 번 변신에 걸리는 시간(초)
    let smooth = 0; // 스크롤 진행을 살짝 늦게 따라가 쫀득하게
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || !geo) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      u.uTime.value = t;
      u.uIn.value = Math.min(1, u.uIn.value + dt * 0.6);
      if (progRef.current !== undefined) {
        // 스크롤 연동: 스크롤한 만큼 흩어지고, 되돌리면 다시 모인다
        const last = Math.min(3, srcs.length - 1);
        smooth += (progRef.current - smooth) * Math.min(1, dt * 7);
        const sv = Math.max(0, Math.min(last, smooth));
        const a = Math.min(last, Math.floor(sv));
        u.uFrom.value = a;
        u.uTo.value = Math.min(last, a + 1);
        u.uT.value = sv - a;
      } else {
      const want = Math.max(0, Math.min(3, idxRef.current));
      if (want !== u.uTo.value) {
        // 변신 도중에 또 바뀌면, 지금까지 간 쪽을 출발점으로 삼아 이어서 간다
        u.uFrom.value = u.uT.value > 0.5 ? u.uTo.value : u.uFrom.value;
        u.uTo.value = want;
        u.uT.value = reduced ? 1 : 0;
      }
      if (u.uT.value < 1) u.uT.value = Math.min(1, u.uT.value + dt / DUR);
      if (u.uT.value >= 1) u.uFrom.value = u.uTo.value;
      }
      const idle = reduced ? 0 : Math.sin(t * 0.35) * 0.18 * Math.min(1, tilt);
      group.rotation.y += (target.ry + idle - group.rotation.y) * 0.05;
      group.rotation.x += (target.rx - group.rotation.x) * 0.05;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      geo?.dispose(); mat?.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, grid]);

  return <div ref={host} className={`brain ${className}`} aria-hidden="true" />;
}
