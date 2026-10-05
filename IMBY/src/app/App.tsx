import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import DOMPurify from 'dompurify';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  title: string;
  description: string;
  img: string;
  content: string; // rich HTML
  detail_images: string[];
  category: string;
  year: string;
  website_url?: string;
  created_at?: string;
  order_index?: number;
  hidden?: boolean;
  hero_focal?: 'top' | 'center' | 'bottom';
  hover_logo?: string; // Work 목록 호버 시 썸네일 가운데 뜨는 PNG
  client?: string;
  brand?: string;
  credit?: string;
}

const HERO_FOCAL_OPTIONS: { value: NonNullable<Project['hero_focal']>; label: string; objectPosition: string }[] = [
  { value: 'top', label: '위쪽', objectPosition: 'center top' },
  { value: 'center', label: '가운데', objectPosition: 'center 25%' },
  { value: 'bottom', label: '아래쪽', objectPosition: 'center bottom' },
];

const ADMIN_EMAIL = 'support@inmybackyard.kr';

// GA4 — SPA라 페이지 새로고침이 없어서 gtag('config', ...)의 자동 페이지뷰는 최초 로드 1회만 잡힘.
// 탭/상세 페이지 전환마다 이 함수를 호출해서 개별 페이지뷰를 수동으로 전송한다.
declare global { interface Window { gtag?: (...args: any[]) => void; } }
function trackPageView(path: string, title?: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.origin + path,
  });
}

// 이미지 압축 후 Supabase Storage 업로드 → 공개 URL 반환
async function uploadImage(file: File, folder: string = 'projects'): Promise<string> {
  // 브라우저 내장 Canvas로 압축 (외부 라이브러리 없이)
  const compress = (f: File, maxPx: number, quality: number): Promise<Blob> =>
    new Promise((res) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => res(b!), 'image/webp', quality);
      };
      img.src = url;
    });

  const blob = await compress(file, 1600, 0.82);
  const ext = 'webp';
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('imby-images').upload(path, blob, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('imby-images').getPublicUrl(path);
  return data.publicUrl;
}

// ─── 원본 화질 업로드 (본문 삽입용) ────────────────────────────────────────────
// 썸네일과 달리 압축 없이 원본 그대로 업로드한다. 사진/동영상 모두 지원.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300MB

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
}

async function uploadOriginal(file: File, folder: string, kind: 'image' | 'video'): Promise<string> {
  const allowed = kind === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!allowed.includes(file.type)) {
    throw new Error(kind === 'image' ? '지원하지 않는 이미지 형식입니다.' : '지원하지 않는 동영상 형식입니다.');
  }
  if (file.size > maxBytes) {
    throw new Error(`파일이 너무 큽니다. (최대 ${Math.round(maxBytes / 1024 / 1024)}MB)`);
  }
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}_${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from('imby-images').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('imby-images').getPublicUrl(path);
  return data.publicUrl;
}

// ─── 본문 콘텐츠 sanitize (공개 페이지 렌더링용) ──────────────────────────────
// 에디터에서 삽입한 이미지/동영상/링크임베드가 포함된 HTML을 안전하게 정제한다.
function sanitizeProjectHtml(html: string): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div', 'ul', 'ol', 'li', 'a', 'img', 'video', 'iframe', 'figure', 'figcaption', 'h2', 'h3', 'h4', 'blockquote', 'hr'],
    ALLOWED_ATTR: ['style', 'href', 'target', 'rel', 'src', 'alt', 'controls', 'preload', 'class', 'sandbox', 'allow', 'referrerpolicy', 'loading'],
  });
}

// YouTube/Vimeo URL → 임베드 가능한 iframe src로 변환. 그 외 URL은 null 반환(링크 카드로 표시).
function toEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (/(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === 'youtu.be') {
      let id = '';
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
      else if (u.pathname === '/watch') id = u.searchParams.get('v') ?? '';
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (/(^|\.)vimeo\.com$/.test(u.hostname)) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch { return null; }
}

// 에디터 삽입용 HTML 조각 생성 헬퍼 (contenteditable=false + draggable=true 로 감싸서
// 본문 텍스트 사이에서 마우스로 자유롭게 드래그해 위치를 옮길 수 있게 한다)
function buildImageBlockHtml(url: string): string {
  return `<div class="rte-block" contenteditable="false" draggable="true"><img src="${url}" alt="" style="width:100%;height:auto;border-radius:12px;display:block;" /></div><p><br></p>`;
}
// 여러 장을 한 줄에 가로 스크롤로 넣는 블록 (사진 갤러리 느낌)
function buildImageRowBlockHtml(urls: string[]): string {
  const imgs = urls.map(u =>
    `<img src="${u}" alt="" style="height:340px;width:auto;max-width:none;flex-shrink:0;border-radius:12px;display:block;scroll-snap-align:start;" />`
  ).join('');
  return `<div class="rte-block rte-image-row" contenteditable="false" draggable="true"><div style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:6px;">${imgs}</div></div><p><br></p>`;
}
function buildVideoBlockHtml(url: string): string {
  return `<div class="rte-block" contenteditable="false" draggable="true"><video src="${url}" controls preload="metadata" style="width:100%;height:auto;border-radius:12px;display:block;background:#000;"></video></div><p><br></p>`;
}
// 노션 스타일 3가지 링크 삽입 방식
// 1) 북마크: 미리보기 카드(스크린샷+파비콘)만 보이는 형태
function buildBookmarkBlockHtml(url: string): string {
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch {}
  const safeUrl = url.replace(/"/g, '&quot;');
  return `<div class="rte-block" contenteditable="false" draggable="true"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow" style="display:block;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fafafa;text-decoration:none;color:inherit;">` +
    `<img src="https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url" alt="" style="width:100%;height:auto;display:block;" />` +
    `<div style="padding:12px 16px;display:flex;align-items:center;gap:8px;"><img src="https://www.google.com/s2/favicons?domain=${hostname}&sz=32" alt="" style="width:16px;height:16px;border-radius:4px;" /><span style="font-size:13px;color:#6b7280;">${hostname}</span></div>` +
    `</a></div><p><br></p>`;
}
// 2) URL: 텍스트 그대로, 클릭 가능한 링크로 본문 흐름 안에 삽입 (다른 글자처럼 편집 가능)
function buildInlineLinkHtml(url: string): string {
  const safeUrl = url.replace(/"/g, '&quot;');
  const label = url.replace(/"/g, '&quot;');
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#0FCD60;text-decoration:underline;">${label}</a>`;
}
// 3) 임베드: 유튜브/비메오는 실제 플레이어, 그 외 사이트는 iframe으로 직접 삽입 시도
function buildEmbedBlockHtml(url: string): string {
  const knownSrc = toEmbedSrc(url);
  const src = knownSrc ?? url;
  return `<div class="rte-block" contenteditable="false" draggable="true"><div style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000;"><iframe src="${src}" style="position:absolute;inset:0;width:100%;height:100%;border:0;" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; encrypted-media; picture-in-picture" referrerpolicy="no-referrer" loading="lazy"></iframe></div></div><p><br></p>`;
}

// ─── 예전 "블록 배열(JSON)" 저장 형식 자동 복구 ───────────────────────────────
// 한때 content를 [{type:'text'|'image'|'video'|'embed', ...}] JSON 배열로 저장했었다.
// 그 데이터가 DB에 남아있으면 이걸 감지해서 지금의 순수 HTML 형식으로 변환해준다.
// (DB의 원본 값은 건드리지 않고, 화면에 보여줄 때/에디터로 불러올 때 즉석 변환만 한다.
//  관리자가 해당 글을 열어서 저장하면 그때 새 형식으로 영구 저장된다.)
function normalizeLegacyContent(raw: string): string {
  if (!raw) return '';
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { return raw; } // JSON이 아니면 이미 HTML → 그대로 사용
  if (!Array.isArray(parsed)) return raw;
  const looksLikeBlocks = parsed.every(b => b && typeof b === 'object' && typeof b.type === 'string');
  if (!looksLikeBlocks) return raw;
  return parsed.map((b: any) => {
    if (b.type === 'text') return b.html ?? '';
    if (b.type === 'image' && b.url) return buildImageBlockHtml(b.url) + (b.caption ? `<p style="text-align:center;color:#9ca3af;font-size:14px;">${b.caption}</p>` : '');
    if (b.type === 'video' && b.url) return buildVideoBlockHtml(b.url) + (b.caption ? `<p style="text-align:center;color:#9ca3af;font-size:14px;">${b.caption}</p>` : '');
    if (b.type === 'embed' && b.url) return buildEmbedBlockHtml(b.url);
    return '';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Supabase DB helpers
// ═══════════════════════════════════════════════════════════════════════════════
// ─── 이미지 밝기 감지 (썸네일이 밝은지 어두운지에 따라 히어로 그라데이션/제목 색을 자동 결정) ───
function useImageBrightness(src: string | undefined): boolean | null {
  const [isLight, setIsLight] = useState<boolean | null>(null);
  useEffect(() => {
    if (!src) { setIsLight(null); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = 24, h = 24;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { if (!cancelled) setIsLight(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let sum = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          count++;
        }
        if (!cancelled) setIsLight(sum / count > 150);
      } catch { if (!cancelled) setIsLight(null); }
    };
    img.onerror = () => { if (!cancelled) setIsLight(null); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return isLight;
}

// 프로젝트 상세 히어로: 대표 이미지를 화면에 꽉 채우고, 이미지 밝기에 따라
// 밝으면 흰색 그라데이션+검은 제목, 어두우면 검은 그라데이션+흰 제목으로 자동 전환.
// 하단은 페이지 배경색으로 페이드되며 본문으로 자연스럽게 이어진다.
function ProjectHero({ project }: { project: Project }) {
  const focal = HERO_FOCAL_OPTIONS.find(f => f.value === (project.hero_focal ?? 'center'))!.objectPosition;
  const meta = ([['연도', project.year], ['클라이언트', project.client], ['브랜드', project.brand], ['분야', project.category], ['크레딧', project.credit]] as const).filter(([, v]) => !!v);
  return (
    <>
      <div className="pd-hero">
        {project.img ? <img src={project.img} alt={project.title} className="kb" style={{ objectPosition: focal }} /> : <div className="kb" />}
      </div>
      <div className="pd-panel">
        <span className="pd-bar" />
        <p className="pd-kicker">{[project.client, project.year].filter(Boolean).join(' ／ ')}</p>
        <h1 className="mk"><span>{project.title}</span></h1>
        {project.description && <p className="pd-sub fade-up">{project.description}</p>}
        {meta.length > 0 && (
          <div className="pd-meta">
            {meta.map(([k, v], i) => (
              <div key={k} className="fade-up" style={{ animationDelay: `${700 + i * 90}ms` }}><span>{k}</span><strong>{v}</strong></div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}


async function dbFetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('order_index', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return (data ?? []) as Project[];
}

async function dbUpsertProject(p: Project): Promise<void> {
  const { error } = await supabase.from('projects').upsert({
    id: p.id,
    title: p.title,
    description: p.description,
    img: p.img,
    content: p.content,
    detail_images: p.detail_images,
    category: p.category,
    year: p.year,
    website_url: p.website_url ?? null,
    order_index: p.order_index ?? null,
    hidden: p.hidden ?? false,
    hero_focal: p.hero_focal ?? 'center',
    hover_logo: p.hover_logo ?? null,
    client: p.client ?? '',
    brand: p.brand ?? '',
    credit: p.credit ?? '',
  });
  if (error) {
    console.error(error);
    throw new Error(error.message || '저장에 실패했습니다.');
  }
}

// 드래그로 바뀐 순서를 한 번에 반영 (배열 순서대로 0,1,2… order_index 부여)
async function dbReorderProjects(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, i) => supabase.from('projects').update({ order_index: i }).eq('id', id));
  const results = await Promise.all(updates);
  results.forEach(r => { if (r.error) console.error(r.error); });
}

async function dbSetProjectHidden(id: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.from('projects').update({ hidden }).eq('id', id);
  if (error) console.error(error);
}

async function dbDeleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error(error);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rich Text Editor (no external deps — uses execCommand)
// ═══════════════════════════════════════════════════════════════════════════════
const HIGHLIGHT_COLORS = ['#FFF176', '#A5F3A5', '#93C5FD', '#FCA5A5', '#F9A8D4', '#FCD34D'];
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px'];
// 관리자 에디터 기본 서체 — Pretendard (fonts.css에서 웹폰트 로드)
const EDITOR_FONT_FAMILY = "Pretendard, 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif";
// Pretendard Variable은 100~900 전 굵기를 지원한다
const FONT_WEIGHTS: { label: string; value: string }[] = [
  { label: '가늘게 200', value: '200' },
  { label: '조금 가늘게 300', value: '300' },
  { label: '보통 400', value: '400' },
  { label: '조금 굵게 500', value: '500' },
  { label: '세미볼드 600', value: '600' },
  { label: '볼드 700', value: '700' },
  { label: '엑스트라볼드 800', value: '800' },
  { label: '블랙 900', value: '900' },
];
// 선택 영역을 span으로 감싸 지정한 CSS 속성을 적용한다.
// (여러 노드에 걸친 선택은 surroundContents가 실패하므로 extractContents로 대체 처리)
function wrapSelectionWithStyle(
  editor: HTMLElement | null,
  prop: 'fontSize' | 'fontWeight',
  value: string,
) {
  editor?.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return false;
  const span = document.createElement('span');
  span.style[prop] = value;
  try {
    range.surroundContents(span);
  } catch {
    span.appendChild(range.extractContents());
    // 안쪽에 같은 속성이 이미 지정된 span이 남아있으면 새 값이 덮이지 않으므로 제거
    span.querySelectorAll<HTMLElement>('span').forEach(el => { el.style[prop] = ''; });
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const after = document.createRange();
  after.selectNodeContents(span);
  sel.addRange(after);
  return true;
}

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [fontSize, setFontSize] = useState('16px');
  const [fontWeight, setFontWeight] = useState('400');
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const handleInput = () => {
    isInternalUpdate.current = true;
    onChange(editorRef.current?.innerHTML ?? '');
    setTimeout(() => { isInternalUpdate.current = false; }, 0);
  };

  const applyFontSize = (size: string) => {
    setFontSize(size);
    if (wrapSelectionWithStyle(editorRef.current, 'fontSize', size)) handleInput();
  };

  const applyFontWeight = (weight: string) => {
    setFontWeight(weight);
    if (wrapSelectionWithStyle(editorRef.current, 'fontWeight', weight)) handleInput();
  };

  const applyHighlight = (color: string) => {
    exec('hiliteColor', color);
    setShowHighlights(false);
  };

  const removeHighlight = () => {
    exec('hiliteColor', 'transparent');
    setShowHighlights(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-wrap sticky top-0 z-10">
        {/* Font size */}
        <select
          value={fontSize}
          onChange={e => applyFontSize(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white mr-1"
          style={{ fontFamily: 'inherit' }}
        >
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fontWeight} onChange={e => applyFontWeight(e.target.value)} title="글자 굵기"
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white mr-1"
          style={{ fontFamily: EDITOR_FONT_FAMILY }}>
          {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value} style={{ fontWeight: Number(w.value) }}>{w.label}</option>)}
        </select>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Bold */}
        <button type="button" onClick={() => exec('bold')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-sm font-bold">B</button>
        {/* Italic */}
        <button type="button" onClick={() => exec('italic')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-sm italic ">I</button>
        {/* Underline */}
        <button type="button" onClick={() => exec('underline')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-sm underline">U</button>
        {/* Strikethrough */}
        <button type="button" onClick={() => exec('strikeThrough')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-sm line-through">S</button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Highlight */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHighlights(v => !v)}
            className="flex items-center gap-1 px-2 h-8 rounded hover:bg-gray-200 transition-colors text-xs font-medium"
          >
            <span style={{ background: 'linear-gradient(90deg,#FFF176,#A5F3A5,#93C5FD)', borderRadius: 2, padding: '0 6px', fontSize: 11 }}>형광펜</span>
            <span className="text-gray-400">▾</span>
          </button>
          {showHighlights && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 flex flex-col gap-2">
              <div className="flex gap-2">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => applyHighlight(c)}
                    className="w-7 h-7 rounded-full border-2 border-white shadow hover:scale-110 transition-transform"
                    style={{ background: c }} />
                ))}
              </div>
              <button type="button" onClick={removeHighlight}
                className="text-xs text-gray-400 hover:text-black transition-colors text-left">지우기</button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Align */}
        <button type="button" onClick={() => exec('justifyLeft')} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors" title="왼쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button type="button" onClick={() => exec('justifyCenter')} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors" title="가운데 정렬">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* List */}
        <button type="button" onClick={() => exec('insertUnorderedList')} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-xs" title="목록">≡</button>

        {/* Clear */}
        <button type="button" onClick={() => exec('removeFormat')}
          className="ml-auto text-xs text-gray-400 hover:text-black px-2 h-8 rounded hover:bg-gray-200 transition-colors">서식 제거</button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="flex-1 overflow-y-auto px-8 py-6 focus:outline-none text-gray-800 leading-relaxed"
        style={{ minHeight: '300px', fontFamily: EDITOR_FONT_FAMILY, fontWeight: 400, fontSize: '16px', lineHeight: 1.8 }}
        data-placeholder="프로젝트 내용을 작성하세요..."
      />
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #aaa;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inline Rich Editor — 네이버 블로그 스타일: 하나의 본문 안에 사진/동영상/링크임베드를
// 커서 위치에 바로 삽입하고, 삽입된 요소를 마우스로 드래그해 원하는 위치로 옮길 수 있다.
// (이미지/동영상/임베드는 contenteditable=false + draggable=true 로 감싸서
//  브라우저 네이티브 드래그로 텍스트 사이 어디로든 재배치 가능)
// ═══════════════════════════════════════════════════════════════════════════════
function InlineRichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [fontSize, setFontSize] = useState('16px');
  const [fontWeight, setFontWeight] = useState('400');
  const [imgUploading, setImgUploading] = useState(false);
  const [vidUploading, setVidUploading] = useState(false);
  const [rowUploading, setRowUploading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrlDraft, setLinkUrlDraft] = useState('');
  const isInternalUpdate = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    isInternalUpdate.current = true;
    onChange(editorRef.current?.innerHTML ?? '');
    setTimeout(() => { isInternalUpdate.current = false; }, 0);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } else {
      // 저장된 위치가 없으면 맨 끝으로
      const range = document.createRange();
      range.selectNodeContents(editorRef.current!);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  const insertHtmlAtCursor = (html: string) => {
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    handleInput();
    saveSelection();
  };

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const applyFontSize = (size: string) => {
    setFontSize(size);
    if (wrapSelectionWithStyle(editorRef.current, 'fontSize', size)) handleInput();
  };

  // 굵기 적용 — 선택 영역이 있으면 그 부분에, 없으면 안내 없이 무시 (드래그 후 선택 필요)
  const applyFontWeight = (weight: string) => {
    setFontWeight(weight);
    if (wrapSelectionWithStyle(editorRef.current, 'fontWeight', weight)) handleInput();
  };

  const applyHighlight = (color: string) => { exec('hiliteColor', color); setShowHighlights(false); };
  const removeHighlight = () => { exec('hiliteColor', 'transparent'); setShowHighlights(false); };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return;
    setImgUploading(true);
    try {
      for (const f of files) {
        const url = await uploadOriginal(f, 'projects/content', 'image');
        insertHtmlAtCursor(buildImageBlockHtml(url));
      }
    } catch (err: any) { alert(err?.message ?? '이미지 업로드 실패'); }
    setImgUploading(false);
    e.target.value = '';
  };

  // 여러 장을 한 줄에 가로 스크롤로 넣기 (선택한 사진들이 한 블록 안에 옆으로 나란히 배치됨)
  const handleAddImageRow = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return;
    setRowUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadOriginal(f, 'projects/content', 'image'));
      insertHtmlAtCursor(buildImageRowBlockHtml(urls));
    } catch (err: any) { alert(err?.message ?? '이미지 업로드 실패'); }
    setRowUploading(false);
    e.target.value = '';
  };

  const handleAddVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setVidUploading(true);
    try {
      const url = await uploadOriginal(file, 'projects/content', 'video');
      insertHtmlAtCursor(buildVideoBlockHtml(url));
    } catch (err: any) { alert(err?.message ?? '동영상 업로드 실패'); }
    setVidUploading(false);
    e.target.value = '';
  };

  const openLinkModal = () => { setLinkUrlDraft(''); setLinkModalOpen(true); };
  const closeLinkModal = () => setLinkModalOpen(false);

  const insertLink = (kind: 'bookmark' | 'plain' | 'embed') => {
    const url = linkUrlDraft.trim();
    if (!url) return;
    try { new URL(url); } catch { alert('올바른 URL 형식이 아닙니다.'); return; }
    if (kind === 'bookmark') insertHtmlAtCursor(buildBookmarkBlockHtml(url));
    else if (kind === 'plain') insertHtmlAtCursor(buildInlineLinkHtml(url));
    else insertHtmlAtCursor(buildEmbedBlockHtml(url));
    closeLinkModal();
  };

  const uploadAndInsertFiles = async (files: File[]) => {
    const imgs = files.filter(f => ALLOWED_IMAGE_TYPES.includes(f.type));
    if (!imgs.length) return false;
    setImgUploading(true);
    try {
      for (const f of imgs) {
        const url = await uploadOriginal(f, 'projects/content', 'image');
        insertHtmlAtCursor(buildImageBlockHtml(url));
      }
    } catch (err: any) { alert(err?.message ?? '이미지 업로드 실패'); }
    setImgUploading(false);
    return true;
  };
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length) { e.preventDefault(); saveSelection(); await uploadAndInsertFiles(files); return; }
    // 다른 곳에서 복사한 글은 배경색·폰트 같은 서식을 걷어내고 붙여넣기
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      e.preventDefault();
      const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote'], ALLOWED_ATTR: ['href'] });
      document.execCommand('insertHTML', false, clean);
      handleInput();
    }
  };
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (!files.length) return; // 블록 드래그 이동은 기본 동작 유지
    e.preventDefault();
    const range = (document as any).caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) savedRangeRef.current = range;
    await uploadAndInsertFiles(files);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); saveSelection(); openLinkModal(); }
  };
  const textCount = (value || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length;
  const mediaCount = ((value || '').match(/<img|<video|<iframe/g) || []).length;

  const Divider = () => <div className="w-px h-5 bg-gray-200 mx-1" />;
  const btnBase = "flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors";

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-2 border border-gray-200 rounded-2xl bg-white/95 backdrop-blur flex-wrap sticky top-3 z-10 mb-8 shadow-[0_6px_24px_rgba(0,0,0,0.05)]">
        <select value={fontSize} onChange={e => applyFontSize(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white mr-1 text-gray-600" style={{ fontFamily: 'inherit' }}>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* 글자 굵기 (Pretendard Variable 100~900) — 드래그로 선택한 부분에 적용 */}
        <select value={fontWeight} onChange={e => applyFontWeight(e.target.value)} title="글자 굵기"
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white mr-1 text-gray-600"
          style={{ fontFamily: EDITOR_FONT_FAMILY }}>
          {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value} style={{ fontWeight: Number(w.value) }}>{w.label}</option>)}
        </select>

        <Divider />

        <select value="" onChange={e => { const v = e.target.value; if (v) { exec('formatBlock', v); } e.currentTarget.value = ''; }} title="문단 형식"
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white mr-1 text-gray-600" style={{ fontFamily: 'inherit' }}>
          <option value="">문단 형식</option>
          <option value="<p>">본문</option>
          <option value="<h2>">제목</option>
          <option value="<h3>">소제목</option>
          <option value="<h4>">작은 제목</option>
          <option value="<blockquote>">인용</option>
        </select>

        <Divider />

        <button type="button" onClick={() => exec('bold')} className={`${btnBase} w-8 text-sm font-bold`} title="굵게 (Ctrl+B)">B</button>
        <button type="button" onClick={() => exec('italic')} className={`${btnBase} w-8 text-sm italic font-serif`}>I</button>
        <button type="button" onClick={() => exec('underline')} className={`${btnBase} w-8 text-sm underline`}>U</button>
        <button type="button" onClick={() => exec('strikeThrough')} className={`${btnBase} w-8 text-sm line-through`}>S</button>

        <Divider />

        <div className="relative">
          <button type="button" onClick={() => setShowHighlights(v => !v)} className={`${btnBase} text-xs font-medium`}>
            <span style={{ background: 'linear-gradient(90deg,#FFF176,#A5F3A5,#93C5FD)', borderRadius: 2, padding: '0 6px', fontSize: 11 }}>형광펜</span>
          </button>
          {showHighlights && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-lg p-3 z-50 flex flex-col gap-2">
              <div className="flex gap-2">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => applyHighlight(c)}
                    className="w-7 h-7 rounded-full border-2 border-white shadow hover:scale-110 transition-transform" style={{ background: c }} />
                ))}
              </div>
              <button type="button" onClick={removeHighlight} className="text-xs text-gray-400 hover:text-black transition-colors text-left">지우기</button>
            </div>
          )}
        </div>

        <Divider />

        <button type="button" onClick={() => exec('justifyLeft')} className={`${btnBase} w-8`} title="왼쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <button type="button" onClick={() => exec('justifyCenter')} className={`${btnBase} w-8`} title="가운데 정렬">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <button type="button" onClick={() => exec('insertUnorderedList')} className={`${btnBase} w-8`} title="목록">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className={`${btnBase} w-8 text-xs font-semibold`} title="번호 목록">1.</button>
        <button type="button" onMouseDown={saveSelection} onClick={() => insertHtmlAtCursor('<hr><p><br></p>')} className={`${btnBase} w-8`} title="구분선">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </button>
        <button type="button" onClick={() => exec('undo')} className={`${btnBase} w-8`} title="되돌리기 (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>
        </button>
        <button type="button" onClick={() => exec('redo')} className={`${btnBase} w-8`} title="다시 실행 (Ctrl+Shift+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/></svg>
        </button>
        <button type="button" onClick={() => exec('removeFormat')} className={`${btnBase} text-xs font-medium`} title="서식 제거">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="4" y1="4" x2="20" y2="20" stroke="#ef4444"/></svg>
        </button>

        <Divider />

        {/* 사진/동영상/링크 삽입 — 커서 위치에 바로 삽입되고, 이후 드래그로 위치 이동 가능 */}
        <label className={`${btnBase} text-xs font-medium cursor-pointer`} onMouseDown={saveSelection} title="사진 삽입">
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <span>{imgUploading ? '업로드 중…' : '사진'}</span>
        </label>
        <label className={`${btnBase} text-xs font-medium cursor-pointer`} onMouseDown={saveSelection} title="여러 장을 한 줄에 나란히 넣고 가로로 스크롤해서 볼 수 있어요">
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddImageRow} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="8" height="14" rx="1.5"/><rect x="14" y="5" width="8" height="14" rx="1.5"/></svg>
          <span>{rowUploading ? '업로드 중…' : '사진 여러 장'}</span>
        </label>
        <label className={`${btnBase} text-xs font-medium cursor-pointer`} onMouseDown={saveSelection} title="동영상 삽입">
          <input type="file" accept="video/mp4,video/webm,video/quicktime,video/ogg" className="hidden" onChange={handleAddVideo} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="15" height="14" rx="2"/><path d="M17 9l5-3v12l-5-3"/></svg>
          <span>{vidUploading ? '업로드 중…' : '동영상'}</span>
        </label>
        <button type="button" onMouseDown={saveSelection} onClick={openLinkModal} className={`${btnBase} text-xs font-medium`} title="링크 삽입">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5"/></svg>
          <span>링크</span>
        </button>

        <span className="ml-auto text-[11px] text-gray-400 hidden md:inline">삽입한 사진은 클릭해서 선택한 뒤 드래그하면 위치를 옮길 수 있어요</span>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
        className="focus:outline-none text-gray-800 leading-relaxed rte-editor project-content"
        style={{ minHeight: '300px', fontFamily: EDITOR_FONT_FAMILY, fontWeight: 400, fontSize: '16px', lineHeight: 1.8 }}
        data-placeholder="프로젝트 이야기를 써보세요. 사진은 끌어다 놓거나 붙여넣으면 바로 들어가요."
      />
      <div className="flex items-center gap-4 py-3 text-[11px] text-gray-400 border-t border-gray-100 mt-10">
        <span>글자 {textCount.toLocaleString()}자</span><span>미디어 {mediaCount}개</span>
        <span className="ml-auto hidden md:inline">Ctrl+B 굵게 · Ctrl+I 기울임 · Ctrl+K 링크 · 사진 끌어다 놓기</span>
      </div>

      {/* 링크 삽입 모달 — 노션처럼 북마크 / URL / 임베드 세 가지 방식 중 선택 */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closeLinkModal}>
          <div className="bg-white rounded-2xl shadow-xl w-[420px] max-w-[92vw] p-5" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-gray-900 mb-3">링크 삽입</p>
            <input
              type="url" autoFocus value={linkUrlDraft} onChange={e => setLinkUrlDraft(e.target.value)}
              placeholder="https://example.com"
              onKeyDown={e => { if (e.key === 'Enter') insertLink('bookmark'); if (e.key === 'Escape') closeLinkModal(); }}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm mb-4 focus:outline-none focus:border-gray-400"
            />
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => insertLink('bookmark')} disabled={!linkUrlDraft.trim()}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left disabled:opacity-40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gray-500 shrink-0"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><circle cx="6.5" cy="6.5" r="0.6" fill="currentColor" stroke="none"/></svg>
                <span>
                  <span className="block text-sm font-medium text-gray-900">북마크</span>
                  <span className="block text-xs text-gray-400">미리보기 카드로 삽입돼요</span>
                </span>
              </button>
              <button type="button" onClick={() => insertLink('plain')} disabled={!linkUrlDraft.trim()}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left disabled:opacity-40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gray-500 shrink-0"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07L12.5 19.5"/></svg>
                <span>
                  <span className="block text-sm font-medium text-gray-900">URL</span>
                  <span className="block text-xs text-gray-400">텍스트 링크 그대로 삽입돼요</span>
                </span>
              </button>
              <button type="button" onClick={() => insertLink('embed')} disabled={!linkUrlDraft.trim()}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left disabled:opacity-40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gray-500 shrink-0"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 10l-3 2 3 2"/><path d="M16 10l3 2-3 2"/></svg>
                <span>
                  <span className="block text-sm font-medium text-gray-900">임베드</span>
                  <span className="block text-xs text-gray-400">화면 안에 바로 재생/표시돼요 (유튜브·비메오 등)</span>
                </span>
              </button>
            </div>
            <button type="button" onClick={closeLinkModal} className="w-full mt-4 text-xs text-gray-400 hover:text-gray-700 transition-colors">취소</button>
          </div>
        </div>
      )}

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #aaa;
          pointer-events: none;
        }
        .rte-block { margin: 16px 0; cursor: grab; border-radius: 12px; outline-offset: 2px; }
        .rte-block:hover { outline: 2px dashed #05D560; }
        .rte-editor h2 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.35; margin: 40px 0 12px; }
        .rte-editor h3 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.4; margin: 32px 0 10px; }
        .rte-editor h4 { font-size: 17px; font-weight: 600; margin: 24px 0 8px; }
        .rte-editor blockquote { margin: 24px 0; padding: 4px 0 4px 20px; border-left: 3px solid #05D560; color: #5E5E5A; font-size: 19px; font-weight: 300; }
        .rte-editor hr { border: 0; height: 1px; background: #DADAD6; margin: 40px 0; }
        .rte-editor ol { list-style: decimal; padding-left: 1.5em; }
        .rte-editor { min-height: 420px; }
        .rte-editor img, .rte-editor video { max-width: 100%; }
        .rte-editor .rte-image-row img { max-width: none; }
        .rte-image-row > div { scrollbar-width: thin; }
        .rte-image-row > div::-webkit-scrollbar { height: 8px; }
        .rte-image-row > div::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fullscreen Project Editor Page
// ═══════════════════════════════════════════════════════════════════════════════
function ProjectEditorPage({
  project,
  onSave,
  onDelete,
  onClose,
}: {
  project: Project | null;
  onSave: (p: Project) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !project;
  const [form, setForm] = useState<Project>(project ? { ...project, content: normalizeLegacyContent(project.content) } : {
    id: Date.now().toString(),
    title: '', description: '', img: '', content: '',
    detail_images: [], category: 'Campaign', year: new Date().getFullYear().toString(),
    website_url: '', hidden: false, hero_focal: 'center',
  });
  const [uploading, setUploading] = useState(false);
  const [detailUploading, setDetailUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draftAt, setDraftAt] = useState<string | null>(null);

  const set = (k: keyof Project, v: string | string[]) => setForm(prev => ({ ...prev, [k]: v }));

  // 작성 중인 글을 브라우저에 자동 임시저장 (실수로 창을 닫아도 복구)
  const draftKey = `imby-draft-${project?.id ?? 'new'}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.form && JSON.stringify(d.form) !== JSON.stringify(form) && confirm(`저장하지 않은 임시 글이 있어요 (${d.at}). 불러올까요?`)) setForm(d.form);
      else localStorage.removeItem(draftKey);
    } catch { /* 무시 */ }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const at = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem(draftKey, JSON.stringify({ form, at }));
        setDraftAt(at);
      } catch { /* 무시 */ }
    }, 1200);
    return () => clearTimeout(t);
  }, [form]);

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { alert('지원하지 않는 이미지 형식입니다.'); return; }
    setUploading(true);
    try { set('img', await uploadImage(file, 'projects/thumb')); }
    catch { alert('업로드 실패. 다시 시도해주세요.'); }
    setUploading(false);
  };

  const [logoUploading, setLogoUploading] = useState(false);
  const handleHoverLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!['image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) { alert('PNG(투명 배경) 파일을 올려주세요.'); return; }
    setLogoUploading(true);
    try { set('hover_logo', await uploadOriginal(file, 'projects/hover-logo', 'image')); }
    catch { alert('업로드 실패. 다시 시도해주세요.'); }
    setLogoUploading(false);
    e.target.value = '';
  };

  const handleDetailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => ALLOWED_IMAGE_TYPES.includes(f.type));
    if (!files.length) return;
    setDetailUploading(true);
    try {
      const urls = await Promise.all(files.map(f => uploadImage(f, 'projects/detail')));
      set('detail_images', [...form.detail_images, ...urls]);
    } catch { alert('일부 이미지 업로드에 실패했습니다.'); }
    setDetailUploading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      try { localStorage.removeItem(draftKey); } catch { /* 무시 */ }
      setDraftAt(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(`저장 실패: ${err?.message ?? '알 수 없는 오류'}\n\n새로고침하면 방금 입력한 내용이 사라질 수 있어요. 이 창을 닫지 말고 원인을 먼저 확인해주세요.`);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-gray-100 bg-white shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-400 hover:text-black transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          뒤로
        </button>
        <span className="text-gray-200">|</span>
        <span className="text-[13px] font-semibold text-gray-400 tracking-tight">{isNew ? '새 프로젝트' : '프로젝트 편집'}</span>
        <div className="flex-1" />
        {draftAt && <span className="text-[11px] text-gray-400 hidden md:inline">임시저장 {draftAt}</span>}
        <div className="flex p-0.5 rounded-full" style={{ background: '#F4F4F2' }}>
          {([[false, '쓰기'], [true, '미리보기']] as const).map(([v, l]) => (
            <button key={l} type="button" onClick={() => setPreview(v)}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{ background: preview === v ? '#1C1C1C' : 'transparent', color: preview === v ? '#fff' : '#6E6E6A' }}>{l}</button>
          ))}
        </div>
        {!isNew && onDelete && (
          <button onClick={async () => { if (confirm('삭제할까요?')) { await onDelete(form.id); onClose(); } }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">삭제</button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-black text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50">
          {saving ? '저장 중…' : saved ? (
              <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>저장됨</span>
            ) : '저장'}
        </button>
      </div>

      {/* Body: 2-column */}
      <div className="flex flex-1 overflow-hidden flex-row-reverse">
        {/* 오른쪽: 프로젝트 설정 */}
        <div className="w-80 shrink-0 border-l border-gray-100 overflow-y-auto p-6 flex flex-col gap-5" style={{ background: '#FAFAF9' }}>
          <p className="text-[13px] font-semibold text-gray-900 -mb-1">프로젝트 설정</p>
          {/* Thumbnail */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">대표 이미지</label>
            {form.img
              ? <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 mb-2">
                  <img src={form.img} alt="thumb" className="w-full h-full object-contain" />
                  <button type="button" onClick={() => set('img', '')}
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-black"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
              : <div className="w-full aspect-video rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-sm mb-2">미리보기 없음</div>
            }
            <label className="cursor-pointer block">
              <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
              <span className="block text-center border-2 border-dashed border-gray-200 rounded-xl py-2 text-xs text-gray-400 hover:border-[#0FCD60] hover:text-[#0FCD60] transition-colors cursor-pointer">
                {uploading ? '업로드 중…' : <span className="flex items-center justify-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>파일 선택</span>}
              </span>
            </label>
            <input type="text" value={form.img.startsWith('data:') ? '' : form.img} onChange={e => set('img', e.target.value)}
              placeholder="또는 URL 입력" className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-xs" />

            {/* 상세페이지 히어로 크롭 기준점 */}
            {form.img && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">사진 크롭 기준</label>
                <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 mb-2" style={{ aspectRatio: '21/9' }}>
                  <img src={form.img} alt="hero preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ objectPosition: HERO_FOCAL_OPTIONS.find(f => f.value === (form.hero_focal ?? 'center'))!.objectPosition }} />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {HERO_FOCAL_OPTIONS.map(opt => (
                    <button key={opt.value} type="button" onClick={() => set('hero_focal', opt.value)}
                      className={`text-xs font-medium py-1.5 rounded-lg border transition-colors ${
                        (form.hero_focal ?? 'center') === opt.value
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">상세페이지 상단 큰 이미지가 잘리는 기준점이에요. 인물이 위쪽에 있으면 "위쪽"을 선택하세요.</p>
              </div>
            )}
          </div>

          {/* Hover logo (PNG) */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">호버 로고 (PNG)</label>
            <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">Work 목록에서 마우스를 올리면 썸네일 가운데에 떠요. 투명 배경 PNG를 권장해요.</p>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-2 flex items-center justify-center" style={{ background: '#2E2E2C' }}>
              {form.hover_logo
                ? <>
                    <img src={form.hover_logo} alt="hover logo" style={{ width: '46%', maxHeight: '60%', objectFit: 'contain' }} />
                    <button type="button" onClick={() => set('hover_logo', '')}
                      className="absolute top-1.5 right-1.5 bg-white/80 text-black rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-white">✕</button>
                  </>
                : <span className="text-xs text-white/40">미리보기 없음</span>}
            </div>
            <label className="cursor-pointer block">
              <input type="file" accept="image/png,image/webp,image/svg+xml" className="hidden" onChange={handleHoverLogoUpload} />
              <span className="block text-center border-2 border-dashed border-gray-200 rounded-xl py-2 text-xs text-gray-400 hover:border-[#1C1C1C] hover:text-[#1C1C1C] transition-colors cursor-pointer">
                {logoUploading ? '업로드 중…' : 'PNG 선택'}
              </span>
            </label>
          </div>

          {/* Category + Year */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">카테고리</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                {['Web', 'Campaign', 'Film', 'Design'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">연도</label>
              <input type="text" value={form.year} onChange={e => set('year', e.target.value)}
                placeholder="2024" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
          </div>

          {/* Client / Brand / Credit — 상세페이지 정보 칸 */}
          {([['client', '클라이언트', '예: D-1 Academy'], ['brand', '브랜드', '예: 초록우산'], ['credit', '크레딧', 'IMBY. All rights reserved.']] as const).map(([k, label, ph]) => (
            <div key={k}>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</label>
              <input type="text" value={(form[k] as string) ?? ''} onChange={e => set(k, e.target.value)}
                placeholder={ph} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
          ))}

          {/* Web URL (Web 카테고리만) */}
          {form.category === 'Web' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">웹사이트 URL</label>
              <input
                type="url"
                value={form.website_url ?? ''}
                onChange={e => { set('website_url', e.target.value); }}
                placeholder="https://example.com"
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
              {form.website_url && (
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={`https://api.microlink.io/?url=${encodeURIComponent(form.website_url)}&screenshot=true&meta=false&embed=screenshot.url`}
                    alt="OG Preview"
                    className="w-full h-auto object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="px-3 py-2 flex items-center gap-2">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${form.website_url}&sz=16`}
                      alt="" className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-gray-500 truncate">{form.website_url}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detail Images */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">상세 이미지</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.detail_images.map((src, i) => (
                <div key={i} className="relative w-16 h-12 rounded-lg overflow-hidden bg-gray-100">
                  <img src={src} alt={`d${i}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => set('detail_images', form.detail_images.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center hover:bg-red-500"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
              ))}
              <label className="w-16 h-12 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#0FCD60] hover:text-[#0FCD60] transition-colors cursor-pointer text-lg">
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleDetailUpload} />
                {detailUploading ? '…' : '+'}
              </label>
            </div>
          </div>
        </div>

        {/* 왼쪽: 블로그형 글쓰기 */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="mx-auto px-8 pt-14 pb-24" style={{ maxWidth: 820 }}>
            {preview ? (
              <div>
                <p className="text-[13px] mb-3" style={{ color: '#6E6E6A' }}>{[form.category, form.year, form.client].filter(Boolean).join(' ／ ')}</p>
                <h1 style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, margin: '0 0 12px' }}>{form.title || '제목 없음'}</h1>
                {form.description && <p style={{ fontSize: 19, fontWeight: 300, color: '#5E5E5A', margin: '0 0 40px' }}>{form.description}</p>}
                <div className="project-content text-[17px] leading-[1.8]" style={{ color: '#3E3E3B' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeProjectHtml(normalizeLegacyContent(form.content)) }} />
              </div>
            ) : (
              <>
                <textarea value={form.title} onChange={e => set('title', e.target.value)} rows={1}
                  placeholder="제목을 입력하세요"
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                  className="w-full resize-none border-0 bg-transparent focus:outline-none"
                  style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, color: '#1C1C1C', boxShadow: 'none' }} />
                <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="부제목 (한 줄 설명)"
                  className="w-full border-0 bg-transparent focus:outline-none mt-3 mb-10"
                  style={{ fontSize: 19, fontWeight: 300, color: '#5E5E5A', boxShadow: 'none' }} />
                <InlineRichEditor value={form.content} onChange={v => set('content', v)} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Dashboard Page


// ═══════════════════════════════════════════════════════════════════════════════
// Messages Admin Section
// ═══════════════════════════════════════════════════════════════════════════════
interface Message { id: number; name: string; email: string; content: string; created_at: string; read: boolean; }

function MessagesAdminSection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    setMessages((data ?? []) as Message[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id: number) => {
    await supabase.from('messages').update({ read: true }).eq('id', id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제할까요?')) return;
    await supabase.from('messages').delete().eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold tracking-tight">수신된 메시지</h2>
        {unreadCount > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FF3B30] text-white">{unreadCount} 새 메시지</span>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-300 text-sm">불러오는 중…</div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center text-gray-300 text-sm">수신된 메시지가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {messages.map(msg => (
              <div key={msg.id} className="p-5">
                <div className="flex items-start justify-between gap-4 cursor-pointer"
                  onClick={() => { setExpandedId(expandedId === msg.id ? null : msg.id); if (!msg.read) markRead(msg.id); }}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {!msg.read && <span className="w-2 h-2 rounded-full bg-[#FF3B30] shrink-0 mt-1.5" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-gray-900">{msg.name}</span>
                        <span className="text-xs text-gray-400">{msg.email}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{msg.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-300">{new Date(msg.created_at).toLocaleDateString('ko-KR')}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ transform: expandedId === msg.id ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
                {expandedId === msg.id && (
                  <div className="mt-4 pl-5 border-l-2 border-gray-100">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <a href={`mailto:${msg.email}`}
                        className="text-xs font-medium text-[#0FCD60] border border-[#0FCD60] px-3 py-1.5 rounded-lg hover:bg-[#0FCD60] hover:text-white transition-colors cursor-pointer">
                        답장하기
                      </a>
                      <button onClick={() => handleDelete(msg.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 border border-gray-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer">
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
const ADMIN_CSS = `
        .adm-nav { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border-radius: 10px; font-size: 14px; font-weight: 500; color: #6E6E6A; transition: background .4s, color .4s; }
        .adm-nav:hover { background: #F4F4F2; color: #1C1C1C; }
        .adm-nav.on { background: #1C1C1C; color: #FFFFFF; }
        .adm-nav .n { font-size: 12px; color: inherit; opacity: .6; font-variant-numeric: tabular-nums; }
        .adm-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid #DADAD6; background: #FFFFFF; font-size: 12px; font-weight: 500; color: #1C1C1C; transition: background .4s, border-color .4s, color .4s; white-space: nowrap; }
        .adm-btn:hover { border-color: #1C1C1C; }
        .adm-btn.pri { background: #1C1C1C; color: #FFFFFF; border-color: #1C1C1C; }
        .adm-btn.pri:hover { background: #05D560; border-color: #05D560; color: #1C1C1C; }
        .adm-btn.danger:hover { border-color: #E5484D; color: #E5484D; }
        .adm-chip { height: 32px; padding: 0 14px; border-radius: 999px; font-size: 12px; font-weight: 500; color: #6E6E6A; transition: background .4s, color .4s; }
        .adm-chip:hover { color: #1C1C1C; }
        .adm-chip.on { background: #1C1C1C; color: #FFFFFF; }
        .adm-row { display: grid; grid-template-columns: 28px 96px minmax(0, 1fr) 120px 72px auto; align-items: center; gap: 16px; padding: 14px 20px; border-top: 1px solid #EDEDEA; transition: background .3s; }
        .adm-row:hover { background: #FAFAF9; }
        .adm-row .acts { opacity: .35; transition: opacity .3s; }
        .adm-row:hover .acts { opacity: 1; }
        @media (max-width: 900px) {
          .adm-side { display: none !important; }
          .adm-mtabs { display: flex !important; }
          .adm-row { grid-template-columns: 72px minmax(0, 1fr); }
          .adm-row .c-cat, .adm-row .c-year, .adm-row .c-drag { display: none; }
          .adm-row .acts { grid-column: 1 / -1; opacity: 1; justify-content: flex-start !important; }
        }
        .adm-prow { display: flex; align-items: center; gap: 16px; padding: 14px 20px; transition: background .3s; }
        .adm-prow:hover { background: #FAFAF9; }
        .adm-prow .acts { opacity: .35; transition: opacity .3s; }
        .adm-prow:hover .acts { opacity: 1; }
        @media (max-width: 900px) { .adm-prow { flex-wrap: wrap; } .adm-prow .acts { opacity: 1; width: 100%; } }
`;

function AdminDashboard({
  projects,
  onEdit,
  onDelete,
  onNew,
  onClose,
  userEmail,
  onLogout,
  onReorder,
  onToggleHidden,
}: {
  projects: Project[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => Promise<void>;
  onNew: () => void;
  onClose: () => void;
  userEmail: string;
  onLogout: () => void;
  onReorder: (reordered: Project[]) => Promise<void>;
  onToggleHidden: (p: Project) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('전체');
  const [adminSubTab, setAdminSubTab] = useState<'projects' | 'press' | 'messages'>('projects');
  const dragRowIndex = useRef<number | null>(null);


  const handleDelete = async (id: string) => {
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
    setConfirmId(null);
  };

  const cats = ['전체', 'Web', 'Campaign', 'Film', 'Design'];
  const filtered = filterCat === '전체' ? projects : projects.filter(p => p.category === filterCat);

  const stats = [
    { label: '전체', value: projects.length, color: '#111' },
    { label: 'Web', value: projects.filter(p => p.category === 'Web').length, color: '#0FCD60' },
    { label: 'Campaign', value: projects.filter(p => p.category === 'Campaign').length, color: '#0FCD60' },
    { label: 'Design / Film', value: projects.filter(p => p.category === 'Design' || p.category === 'Film').length, color: '#0FCD60' },
  ];

  const [q, setQ] = useState('');
  const shownRows = q.trim() ? filtered.filter(p => (p.title + ' ' + (p.client ?? '') + ' ' + p.description).toLowerCase().includes(q.trim().toLowerCase())) : filtered;
  const G = '#05D560';
  const navItems: [string, string, number | null][] = [['projects', 'Work', projects.length], ['press', 'Press', null], ['messages', '문의함', null]];
  const titles: Record<string, [string, string]> = {
    projects: ['Work', '프로젝트를 추가·수정하고, 끌어서 순서를 바꿔요.'],
    press: ['Press', '기사와 공지를 추가하고 정리해요.'],
    messages: ['문의함', 'Contact 페이지로 들어온 메시지예요.'],
  };

  return (
    <div className="fixed inset-0 z-[400] flex overflow-hidden" style={{ backgroundColor: '#FFFFFF', color: '#1C1C1C' }}>
      <style>{ADMIN_CSS}</style>


      {/* ── Sidebar ── */}
      <aside className="adm-side" style={{ width: 248, flexShrink: 0, borderRight: '1px solid #EDEDEA', display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 28px' }}>
          <img src="/logo.png" alt="IMBY" style={{ height: 20, width: 'auto' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6E6E6A' }}>관리자</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(([key, label, n]) => (
            <button key={key} type="button"
              className={`adm-nav ${adminSubTab === key ? 'on' : ''}`}
              onClick={() => setAdminSubTab(key as 'projects' | 'press' | 'messages')}>
              <span>{label}</span>{n !== null && <span className="n">{n}</span>}
            </button>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '0 6px' }}>
          <span style={{ fontSize: 12, color: '#6E6E6A', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: G, flexShrink: 0 }} />{userEmail}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="adm-btn" onClick={onClose}>사이트 보기</button>
            <button type="button" className="adm-btn danger" onClick={onLogout}>로그아웃</button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        {/* mobile tabs */}
        <div className="adm-mtabs" style={{ display: 'none', alignItems: 'center', gap: 4, padding: '12px 16px', borderBottom: '1px solid #EDEDEA', overflowX: 'auto' }}>
          {navItems.map(([key, label]) => (
            <button key={key} type="button" className={`adm-chip ${adminSubTab === key ? 'on' : ''}`}
              onClick={() => setAdminSubTab(key as 'projects' | 'press' | 'messages')}>{label}</button>
          ))}
          <button type="button" className="adm-chip" style={{ marginLeft: 'auto' }} onClick={onClose}>사이트</button>
        </div>

        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 40px 80px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 36, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>{titles[adminSubTab][0]}</h1>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6E6E6A' }}>{titles[adminSubTab][1]}</p>
            </div>
            {adminSubTab === 'projects' && (
              <button type="button" className="adm-btn pri" style={{ height: 40, padding: '0 20px', fontSize: 13 }} onClick={onNew}>+ 새 프로젝트</button>
            )}
          </header>

          {adminSubTab === 'press' ? (
            <PressAdminSection embedded onClose={() => setAdminSubTab('projects')} />
          ) : adminSubTab === 'messages' ? (
            <MessagesAdminSection />
          ) : (
          <>
            {/* summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 28 }}>
              {[['전체', projects.length], ['공개 중', projects.filter(p => !p.hidden).length], ['숨김', projects.filter(p => p.hidden).length], ['호버 로고 없음', projects.filter(p => !p.hover_logo).length]].map(([k, v]) => (
                <div key={k as string} style={{ background: '#F4F4F2', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 12, color: '#6E6E6A' }}>{k}</div>
                  <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 2, background: '#F4F4F2', borderRadius: 999, padding: 3 }}>
                {cats.map(c => (
                  <button key={c} type="button" className={`adm-chip ${filterCat === c ? 'on' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
                ))}
              </div>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="제목·클라이언트 검색"
                style={{ height: 38, width: 240, border: '1px solid #DADAD6', borderRadius: 999, padding: '0 16px', fontSize: 13 }} />
            </div>

            {/* list */}
            <div style={{ border: '1px solid #EDEDEA', borderRadius: 14, overflow: 'hidden' }}>
              {shownRows.length === 0 ? (
                <div style={{ padding: '72px 0', textAlign: 'center', color: '#A3A39F', fontSize: 14 }}>
                  {q ? '검색 결과가 없어요.' : '등록된 프로젝트가 없어요.'}
                </div>
              ) : shownRows.map((p, i) => (
                <div key={p.id} className="adm-row" style={{ borderTop: i === 0 ? 0 : undefined, opacity: p.hidden ? 0.55 : 1 }}
                  draggable={!q}
                  onDragStart={() => { dragRowIndex.current = i; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    const from = dragRowIndex.current; dragRowIndex.current = null;
                    if (from === null || from === i) return;
                    const next = [...filtered]; const [moved] = next.splice(from, 1); next.splice(i, 0, moved); onReorder(next);
                  }}>
                  <span className="c-drag" title="끌어서 순서 변경" style={{ color: '#BDBDB8', cursor: q ? 'default' : 'grab' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
                  </span>
                  <div style={{ position: 'relative', aspectRatio: '16 / 11', background: '#F4F4F2', borderRadius: 8, overflow: 'hidden' }}>
                    {p.img && <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    {p.hover_logo && <span title="호버 로고 있음" style={{ position: 'absolute', right: 5, bottom: 5, width: 8, height: 8, borderRadius: 999, background: G, boxShadow: '0 0 0 2px #fff' }} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || '(제목 없음)'}</span>
                      {p.hidden && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#EDEDEA', color: '#6E6E6A', flexShrink: 0 }}>숨김</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6E6E6A', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[p.client, p.description].filter(Boolean).join(' — ') || '설명 없음'}</div>
                  </div>
                  <span className="c-cat" style={{ fontSize: 12, color: '#3E3E3B' }}>{p.category}</span>
                  <span className="c-year" style={{ fontSize: 12, color: '#6E6E6A', fontVariantNumeric: 'tabular-nums' }}>{p.year}</span>
                  <div className="acts" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {confirmId === p.id ? (
                      <>
                        <span style={{ fontSize: 12, color: '#E5484D', alignSelf: 'center' }}>삭제할까요?</span>
                        <button type="button" className="adm-btn" style={{ background: '#E5484D', borderColor: '#E5484D', color: '#fff' }} disabled={deleting === p.id} onClick={() => handleDelete(p.id)}>{deleting === p.id ? '…' : '삭제'}</button>
                        <button type="button" className="adm-btn" onClick={() => setConfirmId(null)}>취소</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="adm-btn" onClick={() => onToggleHidden(p)}>{p.hidden ? '공개' : '숨기기'}</button>
                        <button type="button" className="adm-btn pri" onClick={() => onEdit(p)}>편집</button>
                        <button type="button" className="adm-btn danger" onClick={() => setConfirmId(p.id)}>삭제</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#A3A39F', marginTop: 12 }}>썸네일 오른쪽 아래 초록 점은 호버 로고가 등록된 프로젝트예요.{q && ' 검색 중에는 순서를 바꿀 수 없어요.'}</p>
          </>
          )}
        </div>
      </main>
    </div>
  );
}





// ═══════════════════════════════════════════════════════════════════════════════
// Press Types & DB helpers
// ═══════════════════════════════════════════════════════════════════════════════
interface PressItem {
  id: number;
  title: string;
  description: string;
  image_url: string;
  source_url: string;
  source_name: string;
  category: string;
  published_at: string;
  sort_order: number;
}

async function dbFetchPress(): Promise<PressItem[]> {
  const { data, error } = await supabase.from('press').select('*').order('sort_order', { ascending: true });
  if (error) { console.error(error); return []; }
  return (data ?? []) as PressItem[];
}
// id가 없는 새 항목을 upsert로 보내면 PK 충돌 판정/기본값 처리에서 실패하는 경우가 있어
// insert / update를 명확히 분리한다. 또한 에러를 삼키지 않고 던져서 UI가 알릴 수 있게 한다.
async function dbUpsertPress(p: Partial<PressItem>): Promise<void> {
  // DB에 없는 키가 섞여 들어가면 통째로 실패하므로 허용된 컬럼만 추린다
  const allowed = ['title', 'description', 'image_url', 'source_url', 'source_name', 'category', 'published_at', 'sort_order'] as const;
  const payload: Record<string, unknown> = {};
  for (const k of allowed) if (p[k] !== undefined) payload[k] = p[k];

  if (p.id) {
    const { error } = await supabase.from('press').update(payload).eq('id', p.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('press').insert(payload);
    if (error) throw new Error(error.message);
  }
}
async function dbDeletePress(id: number): Promise<void> {
  const { error } = await supabase.from('press').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// URL에서 OG 메타데이터 가져오기 — 여러 API 순차 시도
// URL에서 OG 메타데이터 가져오기.
// 브라우저에서 뉴스 사이트를 직접 fetch하면 CORS로 막히므로, 반드시 프록시/스크래퍼를 거쳐야 한다.
// 기존 구현은 API 키가 필요한 서비스(jsonlink, opengraph.io)를 키 없이 호출해 사실상 항상 실패했다.
// → 키 없이 동작하는 CORS 프록시들로 원본 HTML을 직접 받아 메타태그를 파싱하는 방식을 주력으로 사용.
async function fetchOGData(url: string): Promise<{ title: string; description: string; image: string; source: string }> {
  const source = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } })();
  const empty = { title: '', description: '', image: '', source };

  const fetchWithTimeout = async (u: string, ms = 9000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(u, { signal: ctrl.signal }); }
    finally { clearTimeout(t); }
  };

  // HTML 바이트를 문자셋에 맞게 디코딩 — 일부 국내 언론사는 아직 EUC-KR/CP949를 쓴다.
  // UTF-8로 강제 디코딩하면 제목이 깨져서 들어가므로 meta charset을 먼저 확인한다.
  const decodeHtml = (buf: ArrayBuffer): string => {
    const head = new TextDecoder('utf-8').decode(buf.slice(0, 4096));
    const m = head.match(/charset\s*=\s*["']?\s*([\w-]+)/i);
    const cs = (m?.[1] ?? 'utf-8').toLowerCase();
    const label = (cs === 'euc-kr' || cs === 'ks_c_5601-1987' || cs === 'cp949') ? 'euc-kr' : cs;
    try { return new TextDecoder(label).decode(buf); }
    catch { return new TextDecoder('utf-8').decode(buf); }
  };

  const decodeEntities = (t: string) =>
    t.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
     .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
     .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

  // DOMParser로 파싱 (정규식보다 훨씬 안정적 — 속성 순서/따옴표 종류에 영향받지 않음)
  const parseMeta = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pick = (sel: string) =>
      doc.querySelector(sel)?.getAttribute('content')?.trim() ?? '';
    const title =
      pick('meta[property="og:title"]') || pick('meta[name="og:title"]') ||
      pick('meta[name="twitter:title"]') || pick('meta[name="title"]') ||
      doc.querySelector('title')?.textContent?.trim() || '';
    const description =
      pick('meta[property="og:description"]') || pick('meta[name="og:description"]') ||
      pick('meta[name="twitter:description"]') || pick('meta[name="description"]') || '';
    let image =
      pick('meta[property="og:image"]') || pick('meta[name="og:image"]') ||
      pick('meta[property="og:image:url"]') ||
      pick('meta[name="twitter:image"]') || pick('meta[name="twitter:image:src"]') || '';
    // og:image가 /path 형태의 상대경로면 절대경로로 변환 (안 하면 이미지가 깨져 보임)
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, url).href; } catch { image = ''; }
    }
    return {
      title: decodeEntities(title),
      description: decodeEntities(description),
      image,
      source,
    };
  };

  // 1차: 키 없이 쓸 수 있는 CORS 프록시들로 원본 HTML을 받아 직접 파싱
  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];
  for (const build of proxies) {
    try {
      const res = await fetchWithTimeout(build(url), 12000);
      if (!res.ok) continue;
      const html = decodeHtml(await res.arrayBuffer());
      if (!html || html.length < 200) continue;
      const meta = parseMeta(html);
      if (meta.title) return meta;
    } catch {}
  }

  // 2차: microlink (프록시가 모두 막혔을 때의 백업)
  try {
    const res = await fetchWithTimeout(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, 12000);
    const data = await res.json();
    if (data?.status === 'success' && data.data?.title) {
      return {
        title: data.data.title ?? '',
        description: data.data.description ?? '',
        image: data.data.image?.url ?? data.data.logo?.url ?? '',
        source,
      };
    }
  } catch {}

  // 3차: r.jina.ai — 페이지를 읽기 쉬운 텍스트로 변환해주는 서비스. 헤더에서 제목/설명을 추출.
  try {
    const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, 12000);
    if (res.ok) {
      const text = await res.text();
      const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? '';
      const image = text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)?.[1] ?? '';
      // 본문 앞부분을 요약처럼 사용
      const body = text.split(/Markdown Content:\s*/)[1] ?? '';
      const description = body
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[#*>`_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);
      if (title) return { title, description, image, source };
    }
  } catch {}

  return empty;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Press Detail Page
// ═══════════════════════════════════════════════════════════════════════════════
function PressDetailPage({ item, onClose }: { item: PressItem; onClose: () => void }) {
  useEffect(() => {
    window.history.pushState({}, '', `/press/${item.id}`);
    trackPageView(`/press/${item.id}`, `${item.title} — Press | IMBY`);
    return () => { window.history.pushState({}, '', '/press'); };
  }, [item.id]);

  return (
    <div className="fixed inset-0 z-[600] flex flex-col md:flex-row bg-white" style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* 왼쪽: 정보 */}
      <div className="w-full md:w-1/2 h-full p-8 md:p-12 flex flex-col justify-between overflow-y-auto">
        <div>
          <button onClick={onClose} className="mb-10 flex items-center gap-2 text-sm hover:opacity-50 transition-opacity cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Index
          </button>
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-3">
            <span>{item.category === 'news' ? 'Press' : 'Notice'}</span>
            <span>·</span>
            <span>{item.source_name}</span>
            <span>·</span>
            <span>{item.published_at ? new Date(item.published_at).getFullYear() : ''}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-normal tracking-tight leading-tight mb-12"
            style={{ fontFamily: 'Pretendard, -apple-system, sans-serif', fontWeight: 700 }}>
            {item.title}
          </h1>
          <div className="border-t border-black pt-6">
            {item.description && (
              <p className="text-lg leading-relaxed text-gray-700 font-light">{item.description}</p>
            )}
          </div>
        </div>
        {item.source_url && (
          <div className="mt-10">
            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm border border-black px-5 py-3 hover:bg-black hover:text-white transition-all w-fit cursor-pointer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              원문 보기 — {item.source_name}
            </a>
          </div>
        )}
      </div>
      {/* 오른쪽: 이미지 (검정 배경) */}
      <div className="w-full md:w-1/2 h-64 md:h-full bg-black flex items-center justify-center relative overflow-hidden">
        {item.image_url
          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover opacity-80" />
          : <div className="text-white/20 text-xs uppercase tracking-widest">No Image</div>
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Press Admin Section
// ═══════════════════════════════════════════════════════════════════════════════
function PressAdminSection({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
  const [items, setItems] = useState<PressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<'news' | 'notice'>('news');
  const [fetching, setFetching] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<PressItem>>({});

  const load = () => dbFetchPress().then(d => { setItems(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const [pendingItem, setPendingItem] = useState<Partial<PressItem> | null>(null);

  const handleAdd = async () => {
    const raw = url.trim();
    if (!raw) return;
    // 프로토콜 없이 붙여넣는 경우가 많아 자동 보정 (new URL()이 실패해 source_name이 비던 원인)
    const finalUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let host = '';
    try { host = new URL(finalUrl).hostname.replace('www.', ''); }
    catch { alert('올바른 URL 형식이 아닙니다.'); return; }

    setFetching(true);
    let og = { title: '', description: '', image: '', source: host };
    // OG 추출이 실패해도 추가 자체는 막지 않는다 (외부 API 장애가 등록을 막던 문제)
    try { og = await fetchOGData(finalUrl); } catch (err) { console.error('OG fetch failed', err); }
    setFetching(false);

    const newItem: Partial<PressItem> = {
      title: og.title || '',
      description: og.description || '',
      image_url: og.image || '',
      source_url: finalUrl,
      source_name: og.source || host,
      category,
      published_at: new Date().toISOString().split('T')[0],
      sort_order: items.length,
    };

    if (newItem.title) {
      try {
        await dbUpsertPress(newItem);
        setUrl('');
        await load();
      } catch (err: any) {
        alert(`저장 실패: ${err?.message ?? '알 수 없는 오류'}`);
      }
    } else {
      // 제목 자동 추출 실패 — 수동 입력 폼으로. 제목 칸을 출처명으로 미리 채워 바로 저장 가능하게 함
      setPendingItem({ ...newItem, title: host });
    }
  };

  const handlePendingSave = async () => {
    if (!pendingItem) return;
    try {
      await dbUpsertPress(pendingItem);
      setPendingItem(null);
      setUrl('');
      await load();
    } catch (err: any) {
      alert(`저장 실패: ${err?.message ?? '알 수 없는 오류'}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제할까요?')) return;
    setDeleting(id);
    try { await dbDeletePress(id); await load(); }
    catch (err: any) { alert(`삭제 실패: ${err?.message ?? '알 수 없는 오류'}`); }
    setDeleting(null);
  };

  const handleEdit = (item: PressItem) => { setEditingId(item.id); setEditForm(item); };
  const handleEditSave = async () => {
    try {
      await dbUpsertPress(editForm);
      setEditingId(null);
      await load();
    } catch (err: any) {
      alert(`저장 실패: ${err?.message ?? '알 수 없는 오류'}`);
    }
  };

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'news' | 'notice'>('all');
  const shown = items.filter(it => (typeFilter === 'all' || it.category === typeFilter) && (!q.trim() || (it.title + ' ' + it.source_name).toLowerCase().includes(q.trim().toLowerCase())));
  const inp = { height: 40, border: '1px solid #DADAD6', borderRadius: 10, padding: '0 14px', fontSize: 13, background: '#FFFFFF', width: '100%' } as React.CSSProperties;
  const ta = { ...inp, height: 'auto', padding: '10px 14px', resize: 'none' as const, lineHeight: 1.6 };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6E6E6A', marginBottom: 6 } as React.CSSProperties;

  const body = (
    <>
      {/* 기사 추가 */}
      <div style={{ background: '#F4F4F2', borderRadius: 14, padding: 24, marginBottom: 28 }}>
        <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600 }}>기사 URL로 추가</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <label style={lbl}>기사 URL</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="https://example.com/news/123" style={{ ...inp, height: 42 }} />
          </div>
          <div>
            <label style={lbl}>구분</label>
            <div style={{ display: 'flex', gap: 2, background: '#FFFFFF', borderRadius: 999, padding: 3, border: '1px solid #DADAD6' }}>
              {(['news', 'notice'] as const).map(c => (
                <button key={c} type="button" className={`adm-chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>{c === 'news' ? '뉴스' : '공지'}</button>
              ))}
            </div>
          </div>
          <button type="button" className="adm-btn pri" style={{ height: 42, padding: '0 20px', fontSize: 13 }} onClick={handleAdd} disabled={fetching || !url.trim()}>
            {fetching ? '가져오는 중…' : '+ 추가'}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6E6E6A' }}>URL을 넣으면 제목·설명·이미지를 자동으로 가져와요. 못 가져오면 직접 입력할 수 있어요.</p>
        {pendingItem !== null && (
          <div style={{ marginTop: 16, padding: 20, background: '#FFFFFF', borderRadius: 12, border: '1px solid #DADAD6', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>자동으로 가져오지 못했어요. 직접 입력해 주세요.</p>
            <input value={pendingItem.title ?? ''} onChange={e => setPendingItem(p => p ? { ...p, title: e.target.value } : p)} style={inp} placeholder="기사 제목 *" />
            <textarea value={pendingItem.description ?? ''} onChange={e => setPendingItem(p => p ? { ...p, description: e.target.value } : p)} style={ta} rows={3} placeholder="내용 요약" />
            <input value={pendingItem.image_url ?? ''} onChange={e => setPendingItem(p => p ? { ...p, image_url: e.target.value } : p)} style={inp} placeholder="이미지 URL (선택)" />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="adm-btn pri" onClick={handlePendingSave} disabled={!pendingItem.title?.trim()}>저장</button>
              <button type="button" className="adm-btn" onClick={() => setPendingItem(null)}>취소</button>
            </div>
          </div>
        )}
      </div>

      {/* 툴바 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, background: '#F4F4F2', borderRadius: 999, padding: 3 }}>
          {([['all', '전체'], ['news', '뉴스'], ['notice', '공지']] as const).map(([k, l]) => (
            <button key={k} type="button" className={`adm-chip ${typeFilter === k ? 'on' : ''}`} onClick={() => setTypeFilter(k)}>{l}</button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="제목·매체 검색" style={{ height: 38, width: 240, border: '1px solid #DADAD6', borderRadius: 999, padding: '0 16px', fontSize: 13 }} />
      </div>

      {/* 목록 */}
      <div style={{ border: '1px solid #EDEDEA', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '72px 0', textAlign: 'center', color: '#A3A39F', fontSize: 14 }}>불러오는 중…</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: '72px 0', textAlign: 'center', color: '#A3A39F', fontSize: 14 }}>{items.length ? '조건에 맞는 기사가 없어요.' : '등록된 기사가 없어요.'}</div>
        ) : shown.map((item, i) => (
          <div key={item.id} style={{ borderTop: i === 0 ? 0 : '1px solid #EDEDEA' }}>
            {editingId === item.id ? (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFAF9' }}>
                <div><label style={lbl}>제목</label><input value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inp} /></div>
                <div><label style={lbl}>설명</label><textarea value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={ta} rows={3} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 10 }}>
                  <div><label style={lbl}>이미지 URL</label><input value={editForm.image_url ?? ''} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} style={inp} /></div>
                  <div><label style={lbl}>매체</label><input value={editForm.source_name ?? ''} onChange={e => setEditForm(f => ({ ...f, source_name: e.target.value }))} style={inp} /></div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="adm-btn pri" onClick={handleEditSave}>저장</button>
                  <button type="button" className="adm-btn" onClick={() => setEditingId(null)}>취소</button>
                </div>
              </div>
            ) : (
              <div className="adm-prow">
                <div style={{ width: 96, aspectRatio: '16 / 11', background: '#F4F4F2', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  {item.image_url && <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: item.category === 'news' ? '#1C1C1C' : '#EDEDEA', color: item.category === 'news' ? '#FFFFFF' : '#6E6E6A' }}>{item.category === 'news' ? '뉴스' : '공지'}</span>
                    <span style={{ fontSize: 12, color: '#6E6E6A' }}>{item.source_name}</span>
                    {item.published_at && <span style={{ fontSize: 12, color: '#A3A39F' }}>{new Date(item.published_at).toLocaleDateString('ko-KR')}</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6E6E6A', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                </div>
                <div className="acts" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {item.source_url && <a className="adm-btn" href={item.source_url} target="_blank" rel="noopener noreferrer">원문</a>}
                  <button type="button" className="adm-btn pri" onClick={() => handleEdit(item)}>편집</button>
                  <button type="button" className="adm-btn danger" onClick={() => handleDelete(item.id)} disabled={deleting === item.id}>{deleting === item.id ? '…' : '삭제'}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) return body;
  return (
    <div className="fixed inset-0 z-[500] bg-white overflow-y-auto">
      <style>{ADMIN_CSS}</style>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 40px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em' }}>Press</h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6E6E6A' }}>기사와 공지를 추가하고 정리해요.</p>
          </div>
          <button type="button" className="adm-btn" onClick={onClose}>닫기</button>
        </div>
        {body}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Press Page
// ═══════════════════════════════════════════════════════════════════════════════
function PressPage({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<PressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PressItem | null>(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    dbFetchPress().then(d => { setItems(d); setLoading(false); });
  }, []);

  // 4초마다 슬라이더 자동 전환
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setSliderIndex(i => items.length > 0 ? (i + 1) % items.length : 0);
    }, 4000);
    return () => clearInterval(timer);
  }, [items.length]);

  // 슬라이더: 최신 3개
  const sliderItems = items.slice(0, Math.min(3, items.length));
  const safeSliderIndex = sliderItems.length > 0 ? sliderIndex % sliderItems.length : 0;
  const currentSlide = sliderItems[safeSliderIndex];

  return (
    <>
      {showAdmin && <PressAdminSection onClose={() => { setShowAdmin(false); dbFetchPress().then(setItems); }} />}
      {selected && <PressDetailPage item={selected} onClose={() => setSelected(null)} />}

      <div className="relative w-full min-h-screen bg-white text-black" style={{ fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, sans-serif", scrollbarWidth: 'none' as const }}>
        <style>{`
          .press-scroll::-webkit-scrollbar { display: none; }
          .press-row { border-bottom: 1px solid var(--line); }
          .press-row:hover { background: #FAFAF9; }
          @keyframes pressFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {/* 상단 */}
        <div className="flex flex-col md:flex-row w-full px-5 md:px-10 pt-[132px] pb-20 gap-10">
          {/* 왼쪽: 소개 */}
          <div className="w-full md:w-1/2 flex flex-col justify-between" style={{ minHeight: 180 }}>
            {/* 4초마다 기사 제목 자동 전환 */}
            <div className="flex-1 flex flex-col items-start gap-6">
              <h1 className="mask" style={{ fontSize: 30, fontWeight: 300, margin: 0 }}><span>Press</span></h1>
              {items.length > 0 ? (
                <p
                  key={sliderIndex}
                  className="cursor-pointer hover:opacity-60 transition-opacity"
                  style={{ fontSize: 'clamp(22px, 2.2vw, 30px)', lineHeight: 1.5, fontWeight: 300, letterSpacing: '-0.01em', maxWidth: 560, animation: 'pressFadeIn 0.6s ease' }}
                  onClick={() => items[safeSliderIndex]?.source_url && window.open(items[safeSliderIndex].source_url, '_blank')}
                >
                  {items[safeSliderIndex]?.title}
                </p>
              ) : (
                <p style={{ fontSize: 'clamp(22px, 2.2vw, 30px)', lineHeight: 1.5, fontWeight: 300, color: 'var(--faint)' }}>
                  IMBY의 소식을 전합니다.
                </p>
              )}
            </div>
            <div className="flex gap-6 text-lg font-normal mt-6">
              {isAdmin && (
                <button onClick={() => setShowAdmin(true)}
                  className="pillbtn ghost" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Press 관리
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: 슬라이더 */}
          <div className="w-full md:w-1/2 transition-opacity duration-300">
            {loading ? (
              <div className="w-full aspect-video animate-pulse" style={{ background: 'var(--surface)' }} />
            ) : (sliderItems.length > 0 && currentSlide) ? (
              <>
                <div
                  className="w-full aspect-video overflow-hidden relative cursor-pointer" style={{ background: 'var(--surface)' }}
                  onClick={() => currentSlide.source_url ? window.open(currentSlide.source_url, '_blank') : null}
                >
                  {currentSlide.image_url
                    ? <img src={currentSlide.image_url} alt={currentSlide.title} className="w-full h-full object-cover transition-opacity duration-500" />
                    : <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white/30 text-xs uppercase tracking-widest">No Image</div>
                  }
                </div>
                <div className="flex justify-between items-start text-sm mt-4">
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--mute)', fontVariantNumeric: 'tabular-nums' }}>{safeSliderIndex + 1} / {sliderItems.length}</span>
                    <span className="flex gap-2">
                      <button onClick={() => setSliderIndex(i => (i - 1 + sliderItems.length) % sliderItems.length)} className="hover:opacity-50 cursor-pointer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      </button>
                      <button onClick={() => setSliderIndex(i => (i + 1) % sliderItems.length)} className="hover:opacity-50 cursor-pointer rotate-180">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                      </button>
                    </span>
                  </div>
                  <div className="text-right max-w-[60%]">
                    <p className="font-medium leading-snug line-clamp-2">{currentSlide.title}</p>
                    <button
                      className="text-xs text-gray-400 hover:text-black mt-1 cursor-pointer flex items-center gap-1 ml-auto"
                      onClick={() => currentSlide.source_url && window.open(currentSlide.source_url, '_blank')}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" transform="rotate(180 12 12)"/></svg>
                      자세히 보기
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* 카드 그리드 */}
        <div className="w-full px-5 md:px-10 pb-16">
          {!loading && items.length > 0 && (
            <>
              <div className="flex justify-between items-baseline pb-3 mb-8" style={{ borderBottom: '1px solid var(--ink)' }}>
                <span className="eb" style={{ color: 'var(--ink)' }}>최근 소식</span>
                <span className="eb">{items.length}건</span>
              </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 mb-20">
              {items.map(item => (
                <div key={item.id} className="flex flex-col cursor-pointer group"
                  onClick={() => item.source_url && window.open(item.source_url, '_blank')}>
                  {/* 이미지 */}
                  <div className="w-full aspect-video overflow-hidden mb-4" style={{ background: 'var(--surface)' }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-[1400ms] ease-[cubic-bezier(.19,1,.22,1)]" />
                      : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-300 text-xs">No Image</div>
                    }
                  </div>
                  {/* 제목 */}
                  <p className="text-[15px] font-medium leading-[1.5] mb-1.5 line-clamp-2 transition-transform duration-700 group-hover:translate-x-1.5" style={{ color: 'var(--ink)' }}>
                    {item.title}
                  </p>
                  {/* 날짜 */}
                  <p className="text-xs" style={{ color: 'var(--mute)' }}>
                    {item.published_at ? new Date(item.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                  </p>
                </div>
              ))}
            </div>
            </>
          )}
        </div>

        {/* 테이블 리스트 */}
        <div className="w-full px-5 md:px-10 pb-24 mt-4">
          {/* 헤더 (데스크탑 전용 — 모바일은 카드형으로 표시) */}
          <div className="hidden md:flex pb-3 text-[12px] font-medium mb-1" style={{ borderBottom: '1px solid var(--ink)', color: 'var(--mute)' }}>
            <div className="w-[50%]">제목</div>
            <div className="w-[20%]">구분</div>
            <div className="w-[20%]">매체</div>
            <div className="w-[10%] text-right">연도</div>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-300 text-sm">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-gray-300 text-sm">등록된 press가 없습니다.</div>
          ) : (
            <div className="flex flex-col">
              {items.map(item => (
                <React.Fragment key={item.id}>
                  {/* 행 — 모바일: 제목 위 / 메타 아래로 스택, 데스크탑: 4열 테이블 */}
                  <div
                    className="press-row rowline flex flex-col gap-1.5 py-5 md:flex-row md:items-center md:gap-0 cursor-pointer transition-colors duration-150 group"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <span className="sweep" />
                    <div className="w-full md:w-[50%] pr-0 md:pr-4 md:truncate font-medium text-[15px] leading-snug" style={{ color: 'var(--ink)' }}>{item.title}</div>
                    <div className="flex items-center gap-3 text-xs md:hidden" style={{ color: 'var(--mute)' }}>
                      <span className="shrink-0">{item.category === 'news' ? 'Press' : 'Notice'}</span>
                      <span className="truncate">{item.source_name}</span>
                      <span className="shrink-0">{item.published_at ? new Date(item.published_at).getFullYear() : ''}</span>
                    </div>
                    <div className="hidden md:block w-[20%] pr-4 text-sm" style={{ color: 'var(--sub)' }}>{item.category === 'news' ? 'Press' : 'Notice'}</div>
                    <div className="hidden md:block w-[20%] pr-4 text-sm truncate" style={{ color: 'var(--sub)' }}>{item.source_name}</div>
                    <div className="hidden md:block w-[10%] text-right text-sm" style={{ color: 'var(--sub)', fontVariantNumeric: 'tabular-nums' }}>
                      {item.published_at ? new Date(item.published_at).getFullYear() : ''}
                    </div>
                  </div>
                  {/* 펼쳐지는 상세 */}
                  {expandedId === item.id && (
                    <div className="px-6 py-6 flex flex-col md:flex-row gap-6" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', animation: 'pressFadeIn 0.3s ease' }}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title}
                          className="w-full md:w-56 h-36 object-cover shrink-0" />
                      )}
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <p className="font-medium text-[17px] mb-2 leading-snug" style={{ color: 'var(--ink)' }}>{item.title}</p>
                          {item.description && (
                            <p className="text-sm leading-[1.7] line-clamp-3" style={{ color: 'var(--sub)' }}>{item.description}</p>
                          )}
                        </div>
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                            className="pillbtn ghost mt-5 w-fit" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            {item.source_name}에서 읽기
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>


      </div>
    </>
  );
}

// ─── Mail Icon with Notification Badge ───────────────────────────────────────
function MailIconWithBadge({ active }: { active: boolean }) {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      setCount(0); setVisible(false); setBadgeVisible(false); setHovered(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const t1 = setTimeout(() => setVisible(true), 150);
    const t2 = setTimeout(() => {
      setBadgeVisible(true);
      setCount(1);
      intervalRef.current = setInterval(() => {
        setCount(prev => {
          if (prev >= 9) { if (intervalRef.current) clearInterval(intervalRef.current); return 9; }
          return prev + 1;
        });
      }, 1300);
    }, 950);
    return () => { clearTimeout(t1); clearTimeout(t2); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const scrollToForm = () => {
    const modal = document.querySelector('.contact-scroll-inner') as HTMLElement;
    if (modal) {
      modal.style.overflowY = 'auto';
      modal.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <div
      onClick={scrollToForm}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 'clamp(90px, 15vw, 150px)',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        marginTop: visible ? '0px' : '30px',
        transition: 'opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1), margin-top 0.75s cubic-bezier(0.16,1,0.3,1)',
        position: 'relative',
      }}
    >
      <img src="/mail.svg" alt="contact" style={{ width: '100%', display: 'block' }} />
      {badgeVisible && count > 0 && (
        <div style={{
          position: 'absolute', top: '-6%', right: '-6%',
          width: '30px', height: '30px',
          background: '#FF3B30', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(255,59,48,0.4)',
          transformOrigin: 'center',
          transform: 'scale(1)',
          opacity: 1,
        }}>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', lineHeight: 1 }}>{count}</span>
        </div>
      )}

    </div>
  );
}


// ─── Contact Form ─────────────────────────────────────────────────────────────
function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.from('messages').insert({ name, email, content: message });
    setSending(false);
    if (error) { alert('전송 중 오류가 발생했습니다. 다시 시도해 주세요.'); return; }
    setSent(true);
    setName(''); setEmail(''); setMessage('');
    setTimeout(() => setSent(false), 4000);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--ink)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p className="text-lg font-medium" style={{ color: 'var(--ink)' }}>메시지가 전송되었습니다.</p>
        <p className="text-sm" style={{ color: 'var(--mute)' }}>곧 답변 드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <div className="field">
        <label>이름 / 회사명</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)}
           placeholder="John Doe" />
      </div>
      <div className="field">
        <label>회신받을 이메일</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
           placeholder="john@example.com" />
      </div>
      <div className="field">
        <label>문의 내용</label>
        <textarea required rows={4} value={message} onChange={e => setMessage(e.target.value)}
          className="resize-none"
          placeholder="프로젝트 내용이나 궁금하신 점을 자유롭게 적어주세요." />
      </div>
      <button type="submit" disabled={sending}
        className="pillbtn self-start mt-2 disabled:opacity-50" style={{ padding: '14px 28px', fontSize: 13 }}>
        {sending ? '전송 중…' : '메시지 보내기'}
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Login Modal
// ═══════════════════════════════════════════════════════════════════════════════
function AdminLoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (u: User) => void }) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr('이메일 또는 비밀번호가 올바르지 않습니다.'); return; }
    if (data.user) { onLogin(data.user); onClose(); }
  };

  return (
    <>
      <style>{`
        @keyframes adminModalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .admin-modal-card {
          animation: adminModalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .admin-input {
          width: 100%;
          background: #f7f7f7;
          border: 1.5px solid transparent;
          border-radius: 10px;
          padding: 14px 16px;
          font-size: 13px;
          color: #111;
          outline: none;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .admin-input:focus {
          background: #fff;
          border-color: #0FCD60;
          box-shadow: 0 0 0 3px rgba(15,205,96,0.12);
        }
        .admin-input.error {
          border-color: #f87171;
          background: #fff5f5;
        }
        .admin-submit {
          width: 100%;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 14px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          font-size: 1rem;
        }
        .admin-submit:hover:not(:disabled) {
          background: #0FCD60;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(15,205,96,0.3);
        }
        .admin-submit:active:not(:disabled) { transform: translateY(0); }
        .admin-submit:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
      <div className="fixed inset-0 z-[500] flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
        <div
          className="admin-modal-card relative w-[90vw] max-w-[360px] overflow-hidden"
          style={{ background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* 상단 그린 액센트 바 */}
          <div style={{ height: 3, background: '#0FCD60', width: '100%' }} />

          <div style={{ padding: '32px 32px 36px' }}>
            {/* 헤더 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <img src="/logo.png" alt="IMBY" style={{ height: 16, filter: 'brightness(0)', objectFit: 'contain' }} />
              </div>
              <h2 style={{ fontFamily: "inherit", fontSize: '1.7rem', letterSpacing: '0.1em', fontWeight: 400, lineHeight: 1, color: '#111', margin: 0 }}>
                ADMIN
              </h2>
              <p style={{ fontSize: 12, color: '#aaa', marginTop: 4, letterSpacing: '0.02em' }}>
                관리자 전용 — 승인된 계정만 접근 가능
              </p>
            </div>

            {/* 폼 */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="admin-input"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErr(''); }}
                  required
                  className={`admin-input${err ? ' error' : ''}`}
                  placeholder="••••••••"
                />
                {err && (
                  <p style={{ fontSize: 11, color: '#f87171', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> {err}
                  </p>
                )}
              </div>
              <button type="submit" disabled={loading} className="admin-submit" style={{ marginTop: 8 }}>
                {loading ? '확인 중…' : 'LOGIN'}
              </button>
            </form>
          </div>

          {/* 닫기 */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: '#f5f5f5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 14, transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#eee'; (e.currentTarget as HTMLButtonElement).style.color = '#111'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5'; (e.currentTarget as HTMLButtonElement).style.color = '#999'; }}
          ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════════════════════════════════════
type AppView = 'site' | 'editor' | 'admin';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // URL 기반 초기 탭 설정
  const getInitialTab = (): 'about' | 'projects' | 'press' | 'contact' => {
    const path = window.location.pathname;
    if (path.startsWith('/press')) return 'press';
    if (path.startsWith('/contact')) return 'contact';
    if (path.startsWith('/about')) return 'about';
    return 'projects';
  };
  const [activeTab, setActiveTab] = useState<'about' | 'projects' | 'press' | 'contact' | null>(getInitialTab());
  const [selectedProjectIndex, setSelectedProjectIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // View routing
  const [view, setView] = useState<AppView>('site');
  const prevTabRef = useRef<'about' | 'projects' | 'press' | 'contact'>('projects'); // admin 진입 전 탭 기억
  const [editingProject, setEditingProject] = useState<Project | null>(null); // null = new
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const filterPrevRef = useRef(0);
  const dragProjectIndex = useRef<number | null>(null);

  // Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session?.user) setUser(data.session.user); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Load projects from DB
  useEffect(() => {
    dbFetchProjects().then(p => { setProjects(p); setLoading(false); });
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); returnToSite(prevTabRef.current); };

  const handleSaveProject = async (p: Project) => {
    await dbUpsertProject(p);
    setProjects(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
      return [...prev, p];
    });
  };

  const handleDeleteProject = async (id: string) => {
    await dbDeleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setSelectedProjectIndex(null);
  };

  const handleToggleHidden = async (p: Project) => {
    const nextHidden = !p.hidden;
    await dbSetProjectHidden(p.id, nextHidden);
    setProjects(prev => prev.map(x => x.id === p.id ? { ...x, hidden: nextHidden } : x));
  };

  // 관리자 드래그 순서 변경: visibleProjects(현재 필터 기준) 내에서 옮긴 뒤,
  // 그 순서를 반영해 전체 projects 배열의 order_index를 다시 매긴다.
  const handleReorderProjects = async (reorderedVisible: Project[]) => {
    const visibleIds = new Set(reorderedVisible.map(p => p.id));
    const rest = projects.filter(p => !visibleIds.has(p.id));
    // 필터가 'All'이면 rest는 비어있고, 특정 카테고리 필터 중이면 나머지는 뒤에 그대로 붙인다.
    const next = [...reorderedVisible, ...rest];
    setProjects(next);
    await dbReorderProjects(next.map(p => p.id));
  };

  const openEditor = (p: Project | null) => { setEditingProject(p); setView('editor'); };
  const closeEditor = () => { if (user) { setView('admin'); } else { returnToSite(); } setEditingProject(null); };

  const isAdmin = !!user;
  const categoryFiltered = activeFilter === 'All' ? projects : projects.filter(p => p.category === activeFilter);
  // 일반 사용자에게는 숨김 처리된 프로젝트를 아예 노출하지 않는다. 관리자는 전부 보되 흐리게 표시.
  const filteredProjects = isAdmin ? categoryFiltered : categoryFiltered.filter(p => !p.hidden);
  const selectedProject = selectedProjectIndex !== null ? filteredProjects[selectedProjectIndex] ?? null : null;

  // ── Animation refs ─────────────────────────────────────────────────────────
  const introScreenRef = useRef<HTMLDivElement>(null);
  const step1ContainerRef = useRef<HTMLDivElement>(null);
  const introTextRef = useRef<HTMLHeadingElement>(null);
  const introImgContainerRef = useRef<HTMLDivElement>(null);
  const introImgRef = useRef<HTMLImageElement>(null);
  const step2ContainerRef = useRef<HTMLDivElement>(null);
  const typo1Ref = useRef<HTMLParagraphElement>(null);
  const typo2Ref = useRef<HTMLParagraphElement>(null);
  const step4ContainerRef = useRef<HTMLDivElement>(null);
  const typo3Ref = useRef<HTMLParagraphElement>(null);
  const cornersRef = useRef<(HTMLDivElement | null)[]>([]);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const glassNavRef = useRef<HTMLDivElement>(null);
  const siteLogoRef = useRef<HTMLDivElement>(null);
  const galleryWrapperRef = useRef<HTMLDivElement>(null);
  const galleryTrackRef = useRef<HTMLDivElement>(null);

  // / (루트) 접속일 때만 인트로 표시, 나머지는 즉시 스킵
  const shouldShowIntro = window.location.pathname === '/' || window.location.pathname === '/intro';
  const introCompletedRef = useRef(!shouldShowIntro); // 루트 외 접속 시 이미 완료 처리
  const stateRef = useRef({
    isIntroActive: shouldShowIntro, targetIntroProgress: 0, currentIntroProgress: 0,
    isGalleryActive: false, mouseX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    currentScroll: 0, targetScroll: 0, introAnimationId: 0, galleryAnimationId: 0
  });
  const uiStateRef = useRef({ activeTab, selectedProjectIndex });

  const returnToSite = (tab: 'about' | 'projects' | 'press' | 'contact' = 'projects') => {
    // intro 완전 차단 — DOM 직접 접근
    introCompletedRef.current = true;
    stateRef.current.isIntroActive = false;
    stateRef.current.currentIntroProgress = 100;
    stateRef.current.targetIntroProgress = 100;
    cancelAnimationFrame(stateRef.current.introAnimationId);
    const introEl = document.getElementById('intro-screen');
    if (introEl) introEl.style.display = 'none';
    const glassEl = document.getElementById('glass-nav');
    if (glassEl) glassEl.classList.add('visible');
    const logoEl = document.getElementById('site-logo');
    if (logoEl) logoEl.classList.add('visible');
    const adminEl = document.getElementById('admin-btn-wrapper');
    if (adminEl) adminEl.classList.add('visible');
    if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '1';
    // gallery wrapper 미리 보이게 설정 (흰 화면 방지)
    if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '1';
    setActiveTab(tab);
    setView('site');
    const paths: Record<string, string> = { about: '/about', projects: '/work', press: '/press', contact: '/contact' };
    window.history.pushState({}, '', paths[tab] || '/projects');
  };
  useEffect(() => { uiStateRef.current = { activeTab, selectedProjectIndex }; }, [activeTab, selectedProjectIndex]);

  // 페이지별 동적 title/description (SEO — 사이트링크 노출 가능성 향상) + GA4 개별 페이지뷰
  const isFirstSeoRunRef = useRef(true); // 최초 로드는 gtag('config', ...)가 이미 자동으로 잡으므로 중복 방지
  useEffect(() => {
    const seoMap: Record<string, { title: string; description: string }> = {
      projects: {
        title: 'Work — IMBY',
        description: 'IMBY의 캠페인과 프로젝트를 소개합니다. 브랜드 문화를 만드는 인사이트 에이전시 IMBY의 작업물을 확인하세요.',
      },
      press: {
        title: 'Press — IMBY',
        description: 'IMBY의 이야기가 담긴 뉴스와 공지를 확인하세요. 인사이트 에이전시 IMBY의 활동 소식을 전합니다.',
      },
      about: {
        title: 'About — IMBY',
        description: '소비자와 기업 모두가 즐거운 광고 문화, 사회적 임팩트가 있는 단 하나의 크리에이티브 솔루션. 인사이트 에이전시 IMBY를 소개합니다.',
      },

      contact: {
        title: 'Contact — IMBY',
        description: '새로운 프로젝트나 협업 제안이 있으신가요? IMBY에 문의해 주세요.',
      },
    };

    const path = window.location.pathname;
    const isRoot = path === '/' || path === '/intro';
    const seo = isRoot
      ? { title: 'Insight Agency, IMBY', description: '소비자와 기업 모두가 즐거운 광고 문화, 사회적 임팩트가 있는 단 하나의 크리에이티브 솔루션' }
      : seoMap[activeTab ?? 'projects'];

    if (!seo) return;
    document.title = seo.title;

    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', seo.description);
    setMeta('meta[property="og:title"]', 'content', seo.title);
    setMeta('meta[property="og:description"]', 'content', seo.description);
    setMeta('meta[name="twitter:title"]', 'content', seo.title);
    setMeta('meta[name="twitter:description"]', 'content', seo.description);

    // GA4 — 탭 전환마다 개별 페이지뷰 전송 (최초 로드 1회는 gtag config 자동 히트와 중복되므로 제외)
    if (isFirstSeoRunRef.current) { isFirstSeoRunRef.current = false; }
    else { trackPageView(window.location.pathname, seo.title); }
  }, [activeTab]);

  // 인트로 스킵 시 nav/logo/gallery 즉시 표시
  useEffect(() => {
    if (!shouldShowIntro) {
      setTimeout(() => {
        const glassEl = document.getElementById('glass-nav');
        if (glassEl) glassEl.classList.add('visible');
        const logoEl = document.getElementById('site-logo');
        if (logoEl) logoEl.classList.add('visible');
        const adminEl = document.getElementById('admin-btn-wrapper');
        if (adminEl) adminEl.classList.add('visible');
        if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '1';
      }, 100);
    }
  }, []);

  // 브라우저 뒤로가기/앞으로가기 처리
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/project/')) {
        const id = path.replace('/project/', '');
        const idx = filteredProjects.findIndex(p => String(p.id) === id);
        if (idx >= 0) { setSelectedProjectIndex(idx); setActiveTab('projects'); return; }
      }
      setSelectedProjectIndex(null);
      if (path.startsWith('/press')) setActiveTab('press');
      else if (path.startsWith('/contact')) setActiveTab('contact');
      else if (path.startsWith('/about')) setActiveTab('about');
      else setActiveTab('projects');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [filteredProjects]);

  // ── Intro animation ────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    function mapRange(val: number, inMin: number, inMax: number, outMin: number, outMax: number) {
      if (val <= inMin) return outMin; if (val >= inMax) return outMax;
      return (val - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
    }
    function renderIntroSequence() {
      // 인트로가 한번이라도 완료됐으면 절대 재실행 안 함
      if (introCompletedRef.current) {
        s.isIntroActive = false;
        const introEl = document.getElementById('intro-screen');
        if (introEl) introEl.style.display = 'none';
        const glassEl = document.getElementById('glass-nav');
        if (glassEl) glassEl.classList.add('visible');
        const logoEl = document.getElementById('site-logo');
        if (logoEl) logoEl.classList.add('visible');
        const adminEl = document.getElementById('admin-btn-wrapper');
        if (adminEl) adminEl.classList.add('visible');
        if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '1';
        return;
      }
      if (!s.isIntroActive) return;
      s.currentIntroProgress += (s.targetIntroProgress - s.currentIntroProgress) * 0.08;
      if (scrollIndicatorRef.current) scrollIndicatorRef.current.style.opacity = s.currentIntroProgress > 2 ? '0' : '1';
      const isMobile = window.innerWidth <= 768;
      // 이미지: progress 0→5 에서 0→중간크기, 5→100에서 중간→전체화면
      const imgAppear = mapRange(s.currentIntroProgress, 0, 8, 0, 1); // 처음 등장
      const p1 = mapRange(s.currentIntroProgress, 0, 15, 0, 1);       // 전체화면 확장
      const midW = isMobile ? 55 : 30, midH = isMobile ? 35 : 40;
      const curW = midW * imgAppear + (100 - midW) * p1;
      const curH = midH * imgAppear + (100 - midH) * p1;
      if (introImgContainerRef.current) {
        // 원형 유지: width=height 동일하게 vmin 기준으로 확장
        const circleSize = Math.max(curW, curH * (window.innerWidth / window.innerHeight));
        introImgContainerRef.current.style.width = `${curW}vw`;
        introImgContainerRef.current.style.height = `${curW}vw`;
        introImgContainerRef.current.style.opacity = String(imgAppear);
        // 원형 유지하다가 전체화면 직전에 사각형으로 전환
        const radiusVal = Math.max(0, 50 - p1 * 50);
        introImgContainerRef.current.style.borderRadius = `${radiusVal}%`;
      }
      if (introImgRef.current) introImgRef.current.style.transform = `scale(${1.3 - 0.3 * p1})`;
      if (introTextRef.current) introTextRef.current.style.opacity = String(1 - p1 * 2);
      if (step1ContainerRef.current) {
        step1ContainerRef.current.style.opacity = String(mapRange(s.currentIntroProgress, 13, 17, 1, 0));
      }
      // intro-screen 배경: step1 끝나면서 #22CD6D로 전환, step5 올라오면 다시 흰색
      if (introScreenRef.current) {
        const toGreen = mapRange(s.currentIntroProgress, 13, 17, 0, 1);
        if (toGreen > 0 && s.currentIntroProgress < 55) {
          introScreenRef.current.style.backgroundColor = '#000000';
        if (introScreenRef.current) introScreenRef.current.style.color = '#ffffff';
        } else if (s.currentIntroProgress >= 55) {
          introScreenRef.current.style.backgroundColor = '#000000';
        if (introScreenRef.current) introScreenRef.current.style.color = '#ffffff';
        } else {
          introScreenRef.current.style.backgroundColor = '#ffffff';
        }
      }
      // slide1: info1 먼저(16~22), ment1 연이어(20~26), 둘 다 퇴장(28~34)
      const info1El2 = document.getElementById('slide1-info');
      const ment1El = document.getElementById('slide1-ment');
      const fadeOut1 = mapRange(s.currentIntroProgress, 28, 34, 0, 1);
      if (info1El2) info1El2.style.opacity = String(Math.max(0, mapRange(s.currentIntroProgress, 16, 22, 0, 1) - fadeOut1));
      if (ment1El) ment1El.style.opacity = String(Math.max(0, mapRange(s.currentIntroProgress, 20, 26, 0, 1) - fadeOut1));
      // slide2: info2 먼저(34~40), ment2 연이어(38~44), 둘 다 퇴장(50~56)
      const info2El2 = document.getElementById('slide2-info');
      const ment2El = document.getElementById('slide2-ment');
      const fadeOut2 = mapRange(s.currentIntroProgress, 50, 56, 0, 1);
      if (info2El2) info2El2.style.opacity = String(Math.max(0, mapRange(s.currentIntroProgress, 34, 40, 0, 1) - fadeOut2));
      if (ment2El) ment2El.style.opacity = String(Math.max(0, mapRange(s.currentIntroProgress, 38, 44, 0, 1) - fadeOut2));
      // slide3: info3-1 → info3-2 크로스페이드 → ment3
      const info31 = document.getElementById('info3-1-img');
      const info32 = document.getElementById('info3-2-img');
      const ment3wrap = document.getElementById('ment3-wrap');
      if (info31) info31.style.opacity = String(Math.max(0, mapRange(s.currentIntroProgress, 56, 62, 0, 1) - mapRange(s.currentIntroProgress, 64, 68, 0, 1)));
      if (info32) info32.style.opacity = String(Math.max(0, mapRange(s.currentIntroProgress, 64, 68, 0, 1) - mapRange(s.currentIntroProgress, 80, 86, 0, 1)));
      if (ment3wrap) ment3wrap.style.opacity = String(Math.max(0, mapRange(s.currentIntroProgress, 70, 76, 0, 1) - mapRange(s.currentIntroProgress, 80, 86, 0, 1)));
      if (typo3Ref.current) {} // ref 유지용
      // step2/step4 컨테이너는 항상 표시
      if (step2ContainerRef.current) step2ContainerRef.current.style.opacity = '1';
      if (step4ContainerRef.current) { step4ContainerRef.current.style.opacity = '1'; step4ContainerRef.current.style.transform = 'none'; }
      cornersRef.current.forEach((corner, i) => {
        if (!corner) return;
        const ds = 45 + i * 1.5, dir = corner.classList.contains('left-corner') ? -50 : 50;
        corner.style.opacity = String(mapRange(s.currentIntroProgress, ds, ds + 5, 0, 1));
        corner.style.transform = `translateX(${mapRange(s.currentIntroProgress, ds, ds + 5, dir, 0)}px)`;
      });
      // progress bar
      const progressBar = document.getElementById('intro-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${Math.min(s.currentIntroProgress, 100)}%`;
        // 초록 배경 구간(progress 13~)에서 흰색으로 전환
        progressBar.style.backgroundColor = s.currentIntroProgress > 13 ? '#22CD6D' : '#22CD6D';
      }
      if (introScreenRef.current) introScreenRef.current.style.opacity = String(mapRange(s.currentIntroProgress, 96, 100, 1, 0));
      if (s.currentIntroProgress > 99.6 && s.targetIntroProgress === 100) {
        s.isIntroActive = false; s.currentIntroProgress = 100;
        if (introScreenRef.current) introScreenRef.current.style.display = 'none';
        if (glassNavRef.current) glassNavRef.current.classList.add('visible');
        if (siteLogoRef.current) siteLogoRef.current.classList.add('visible');
        const adminBtnWrapper = document.getElementById('admin-btn-wrapper');
        if (adminBtnWrapper) adminBtnWrapper.classList.add('visible');
        if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '1';
        setActiveTab('projects');
      } else { s.introAnimationId = requestAnimationFrame(renderIntroSequence); }
    }
    s.introAnimationId = requestAnimationFrame(renderIntroSequence);

    function checkAndReactivateIntro(_deltaY: number) {
      void _deltaY; // 인트로 재활성화 영구 비활성화
    }
    function handleWheel(e: WheelEvent) {
      if (s.isIntroActive) e.preventDefault();
      checkAndReactivateIntro(e.deltaY);
      if (!s.isIntroActive) return;
      s.targetIntroProgress += e.deltaY * 0.04;
      s.targetIntroProgress = Math.max(0, Math.min(100, s.targetIntroProgress));
    }
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const handleTouchMove = (e: TouchEvent) => {
      if (s.isIntroActive) e.preventDefault();
      const deltaY = touchStartY - e.touches[0].clientY;
      checkAndReactivateIntro(deltaY);
      if (s.isIntroActive) { s.targetIntroProgress += deltaY * 0.08; s.targetIntroProgress = Math.max(0, Math.min(100, s.targetIntroProgress)); }
      touchStartY = e.touches[0].clientY;
    };
    const handleMouseMove = (e: MouseEvent) => { if (s.isGalleryActive) s.mouseX = e.clientX; };
    const handleTouchMoveGallery = (e: TouchEvent) => { if (s.isGalleryActive && e.touches.length > 0) s.mouseX = e.touches[0].clientX; };
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMoveGallery, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMoveGallery);
      cancelAnimationFrame(s.introAnimationId);
    };
  }, []);

  // ── Work: 세로 3열 그리드(스크롤) — 예전 가로 마우스 갤러리 루프는 사용하지 않음
  useEffect(() => {
    stateRef.current.isGalleryActive = false;
    if (galleryTrackRef.current) galleryTrackRef.current.style.transform = 'none';
  }, [activeTab, selectedProjectIndex]);

  const handleTabClick = (tab: 'about' | 'projects' | 'press' | 'contact') => {
    setActiveTab(tab);
    setSelectedProjectIndex(null);
    setMenuOpen(false);
    const paths: Record<string, string> = { about: '/about', projects: '/work', press: '/press', contact: '/contact' };
    window.history.pushState({}, '', paths[tab] || '/work');
  };

  // ── Render overlay views ───────────────────────────────────────────────────
  if (view === 'editor') {
    return (
      <ProjectEditorPage
        project={editingProject}
        onSave={handleSaveProject}
        onDelete={handleDeleteProject}
        onClose={closeEditor}
      />
    );
  }

  if (view === 'admin') {
    return (
      <AdminDashboard
        projects={projects}
        onEdit={p => openEditor(p)}
        onDelete={handleDeleteProject}
        onNew={() => openEditor(null)}
        onClose={() => returnToSite(prevTabRef.current)}
        userEmail={user?.email ?? ''}
        onLogout={handleLogout}
        onReorder={handleReorderProjects}
        onToggleHidden={handleToggleHidden}
      />
    );
  }

  // ── Main site ──────────────────────────────────────────────────────────────
  const WORK_FILTERS = ['All', 'Campaign', 'Design', 'Film', 'Web'];
  const workDark = false; // 호버 시 배경 검정 전환은 사용하지 않음
  // 젤리 필터: 이동 방향의 앞쪽 끝이 먼저, 뒤쪽 끝이 늦게 따라오며 늘어났다 튕긴다
  const segIdx = Math.max(0, WORK_FILTERS.indexOf(activeFilter));
  const segPrev = filterPrevRef.current;
  const segN = WORK_FILTERS.length;
  const segRight = segIdx > segPrev;
  const segLead = 0.5 + Math.abs(segIdx - segPrev) * 0.06, segLag = segLead + 0.18;
  const segInd: React.CSSProperties = {
    left: `calc(4px + ${segIdx} * (100% - 8px) / ${segN})`,
    right: `calc(4px + ${segN - 1 - segIdx} * (100% - 8px) / ${segN})`,
    transitionDuration: `${segRight ? segLag : segLead}s, ${segRight ? segLead : segLag}s, .6s`,
    transitionDelay: segRight ? '60ms, 0ms, 0ms' : '0ms, 60ms, 0ms',
  };
  // 헤더의 'visible' 클래스는 인트로 코드가 직접 붙이므로, 어두운 모드도 classList로만 토글해서 지워지지 않게 한다
  // (useEffect는 조건문 뒤에 둘 수 없어서 ref 콜백 대신 매 렌더 후 동기화)
  queueMicrotask(() => { glassNavRef.current?.classList.toggle('dk', workDark); glassNavRef.current?.classList.toggle('mo', menuOpen); });
  return (
    <>
      <style>{`
        :root { --ink: #1C1C1C; --sub: #5E5E5A; --mute: #7A7A76; --faint: #A3A39F; --line: #EDEDEA; --line2: #DADAD6; --surface: #F4F4F2; --ease-out: cubic-bezier(.19,1,.22,1); --ease-io: cubic-bezier(.77,0,.18,1); --hdr: 68px; }
        body { font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif; background-color: #ffffff; color: var(--ink); overflow: hidden; overscroll-behavior: none; word-break: keep-all; -webkit-font-smoothing: antialiased; }
        .no-select { user-select: none; -webkit-user-select: none; }

        /* ── Header ── */
        .glass-nav { position: fixed; top: 0; left: 0; right: 0; height: var(--hdr); z-index: 250; background: rgba(255,255,255,0.94); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); align-items: center; gap: 24px; padding: 0 40px; opacity: 0; pointer-events: none; transition: opacity 0.8s var(--ease-out), background .9s var(--ease-out); }
        .glass-nav.visible { opacity: 1; pointer-events: auto; }
        .glass-nav::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--line); transition: background .9s; }
        .hdr-logo { height: 28px; width: auto; display: block; transition: filter .6s; }
        .glass-nav.dk { background: rgba(14,14,14,0.92); }
        .glass-nav.dk::after { background: #2A2A29; }
        .glass-nav.dk .hdr-logo { filter: invert(1); }
        .glass-nav.mo { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; transition: background .3s; }
        .glass-nav.mo::after { background: transparent; }
        .navwrap { display: flex; gap: 120px; align-items: center; }
        .navl { position: relative; background: none; border: 0; cursor: pointer; padding: 10px 0; font-family: inherit; font-size: 13px; font-weight: 500; letter-spacing: .02em; white-space: nowrap; color: var(--mute); transition: color .4s; }
        .navl:hover, .navl.on { color: var(--ink); }
        .navl::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--ink); transform: scaleX(0); transform-origin: 100% 50%; transition: transform .8s var(--ease-io); }
        .navl:hover::after, .navl.on::after { transform: scaleX(1); transform-origin: 0 50%; }
        .glass-nav.dk .navl { color: #8A8A86; } .glass-nav.dk .navl.on, .glass-nav.dk .navl:hover { color: #F2F2EF; } .glass-nav.dk .navl::after { background: #F2F2EF; }
        .hdr-r { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
        .wbtn { background: #FFFFFF; color: var(--ink); border: 1px solid var(--line2); border-radius: 999px; padding: 11px 18px; font-family: inherit; font-size: 12px; font-weight: 500; line-height: 1; cursor: pointer; white-space: nowrap; transition: background .5s, color .5s, border-color .5s, transform .5s cubic-bezier(.34,1.75,.5,1); }
        .wbtn:hover { background: #05D560; border-color: #05D560; color: var(--ink); }
        .wbtn:active { transform: scale(.95); }
        .wbtn.pri { background: var(--ink); color: #fff; border-color: var(--ink); }
        .wbtn.pri:hover { background: #05D560; border-color: #05D560; color: var(--ink); }
        .glass-nav.dk .wbtn { background: transparent; color: #F2F2EF; border-color: #3A3A38; }
        .site-logo { opacity: 0; pointer-events: none; transition: opacity 0.5s ease; justify-self: start; position: relative; z-index: 2; }
        .site-logo.visible { opacity: 1; pointer-events: auto; }
        #admin-btn-wrapper { opacity: 0; pointer-events: none; transition: opacity .5s; }
        #admin-btn-wrapper.visible { opacity: 1; pointer-events: auto; }
        .mb { display: none; position: relative; width: 44px; height: 44px; border: 0; background: none; cursor: pointer; padding: 0; z-index: 2; }
        .mb i { position: absolute; left: 12px; right: 12px; height: 1.5px; background: var(--ink); transition: transform .6s cubic-bezier(.34,1.56,.64,1), background .4s; }
        .mb i:first-child { top: 17px; } .mb i:last-child { top: 26px; }
        .mb.open i { background: #F2F2EF; }
        .mb.open i:first-child { transform: translateY(4.5px) rotate(45deg); }
        .mb.open i:last-child { transform: translateY(-4.5px) rotate(-45deg); }
        .mmenu { position: fixed; inset: 0; z-index: 245; background: #0E0E0E; clip-path: circle(0px at calc(100% - 38px) 30px); transition: clip-path .9s var(--ease-io); pointer-events: none; padding: 120px 24px 40px; box-sizing: border-box; display: flex; flex-direction: column; }
        .mmenu.open { clip-path: circle(150% at calc(100% - 38px) 30px); pointer-events: auto; }
        .mmenu a { display: flex; justify-content: space-between; align-items: baseline; color: #F2F2EF; font-size: 40px; font-weight: 500; letter-spacing: -.03em; padding: 14px 0; border-bottom: 1px solid #2A2A29; opacity: 0; transform: translateY(24px); transition: opacity .6s, transform .9s var(--ease-out), color .4s; }
        .mmenu a span { font-size: 13px; font-weight: 500; color: #8A8A86; letter-spacing: 0; }
        .mmenu.open a { opacity: 1; transform: none; }
        .mmenu a.on { color: #05D560; }
        .mmenu a.mail { margin-top: auto; font-size: 13px; border: 0; color: #8A8A86; }

        /* ── Work ── */
        #gallery-wrapper { position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden; background: #FFFFFF; opacity: 0; pointer-events: none; transition: opacity 0.8s ease-in-out, background .9s var(--ease-out); z-index: 10; padding-top: var(--hdr); box-sizing: border-box; scrollbar-width: none; }
        #gallery-wrapper::-webkit-scrollbar { display: none; }
        #gallery-wrapper.active { pointer-events: auto; }
        #gallery-wrapper.dk { background: #0E0E0E; }
        .work-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 64px 40px 48px; }
        .cnt { font-size: 13px; color: var(--mute); transition: color .8s; }
        .dk .cnt { color: #8A8A86; }
        .seg { position: relative; display: inline-flex; background: var(--surface); border-radius: 999px; padding: 4px; transition: background .8s; }
        .seg .ind { position: absolute; top: 4px; bottom: 4px; border-radius: 999px; background: var(--ink); transition-property: left, right, background; transition-timing-function: cubic-bezier(.34,1.75,.5,1), cubic-bezier(.34,1.75,.5,1), ease; }
        .sb { position: relative; z-index: 1; width: 104px; height: 42px; background: none; border: 0; border-radius: 999px; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--mute); cursor: pointer; transition: color .45s, transform .5s cubic-bezier(.34,1.75,.5,1); }
        .sb:hover { color: var(--ink); } .sb:active { transform: scale(.92); } .sb.on { color: #FFFFFF; }
        .dk .seg { background: #1E1E1D; } .dk .seg .ind { background: #F2F2EF; }
        .dk .sb { color: #8A8A86; } .dk .sb:hover { color: #F2F2EF; } .dk .sb.on, .dk .sb.on:hover { color: #0E0E0E; }
        #gallery-track { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 24px; row-gap: 64px; padding: 0 40px 120px; }
        .work-empty { grid-column: 1 / -1; padding: 80px 0; text-align: center; color: var(--faint); font-size: 14px; }
        @keyframes rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
        .wk-in { animation: rise 1.1s var(--ease-out) both; }
        .wk { display: flex; flex-direction: column; color: var(--ink); transition: transform .9s var(--ease-out), opacity .9s; }
        .wk .im { position: relative; aspect-ratio: 16 / 11; background: var(--surface); overflow: hidden; }
        .wk .im-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .wk .im::after { content: ''; position: absolute; inset: 0; background: rgba(14,14,14,0); transition: background .8s var(--ease-out); pointer-events: none; z-index: 1; }
        .wk.hot .im:has(.hv)::after { background: rgba(14,14,14,.38); }
        .wk .hv { position: absolute; left: 50%; top: 50%; width: 42%; max-height: 46%; object-fit: contain; z-index: 2; pointer-events: none; opacity: 0; transform: translate(-50%,-50%) translateY(14px) scale(.96); filter: blur(4px); transition: opacity .9s cubic-bezier(.22,1,.36,1), transform 1.2s cubic-bezier(.22,1,.36,1), filter .9s cubic-bezier(.22,1,.36,1); }
        .wk.hot .hv { opacity: 1; transform: translate(-50%,-50%); filter: blur(0); transition-delay: .12s; }
        .wk.hot { transform: scale(1.045); position: relative; z-index: 2; }
        .wk.dim { transform: scale(.955); opacity: .45; }
        .wk-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-top: 16px; }
        .wk-row .t { margin: 0; font-size: 18px; font-weight: 500; letter-spacing: -.01em; transition: color .8s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wk-row .c { font-size: 12px; color: var(--mute); white-space: nowrap; transition: color .8s; }
        .dk .wk-row .t { color: #F2F2EF; } .dk .wk-row .c { color: #8A8A86; }
        .wk-new { width: 100%; aspect-ratio: 16 / 11; border: 1px dashed var(--line2); background: var(--surface); font-family: inherit; font-size: 14px; font-weight: 500; color: var(--ink); cursor: pointer; }

        /* ── 상세 ── */
        @keyframes kb { from { transform: scale(1.12); } to { transform: scale(1); } }
        .pd-hero { position: relative; height: clamp(360px, 62vh, 640px); overflow: hidden; background: #2E2E2C; }
        .pd-hero .kb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation: kb 2.6s var(--ease-out) both; }
        .pd-panel { position: relative; margin: -180px 40px 0 auto; width: min(920px, calc(100% - 80px)); background: #FFFFFF; padding: 48px 56px 52px; box-sizing: border-box; animation: rise 1.3s var(--ease-out) .35s both; }
        .pd-bar { position: absolute; left: 0; top: 0; width: 72px; height: 6px; background: #05D560; }
        .pd-kicker { margin: 0 0 14px; font-size: 13px; color: var(--mute); }
        .pd-panel h1 { margin: 0 0 16px; font-size: clamp(30px, 3.4vw, 48px); font-weight: 600; letter-spacing: -.035em; line-height: 1.15; }
        .pd-panel h1 > span { animation-delay: .5s; }
        .pd-sub { margin: 0 0 36px; font-size: 18px; font-weight: 300; line-height: 1.6; color: var(--sub); }
        .pd-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; }
        .pd-meta > div { display: flex; flex-direction: column; gap: 6px; padding-top: 14px; border-top: 1px solid var(--line2); }
        .pd-meta span { font-size: 12px; color: var(--mute); } .pd-meta strong { font-size: 15px; font-weight: 400; }
        .pd-body { max-width: 1120px; margin: 0 auto; padding: 96px 40px 120px; }
        .pd-body .project-content { max-width: 760px; margin-left: auto; margin-right: auto; }
        .pd-imgs { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 24px; margin-top: 96px; align-items: start; }
        .pd-imgs img { width: 100%; height: auto; background: var(--surface); }
        .pd-imgs .w8 { grid-column: span 8; } .pd-imgs .w4 { grid-column: span 4; margin-top: 80px; } .pd-imgs .w12 { grid-column: span 12; }

        /* ── About ── */
        .about-rows { margin-top: 80px; border-top: 1px solid var(--ink); }
        .about-row { width: 100%; display: grid; grid-template-columns: 200px minmax(0,1fr) auto; align-items: baseline; gap: 24px; padding: 26px 0; border: 0; border-bottom: 1px solid var(--line2); background: none; font-family: inherit; text-align: left; cursor: pointer; color: var(--ink); }
        .about-row .k { font-size: 22px; font-weight: 600; letter-spacing: -.02em; transition: transform .8s var(--ease-out); }
        .about-row .v { font-size: 16px; color: var(--sub); }
        .about-row .go { font-size: 13px; color: var(--mute); opacity: 0; transform: translateX(-8px); transition: opacity .5s, transform .8s var(--ease-out); }
        .about-row:hover .k { transform: translateX(8px); } .about-row:hover .go { opacity: 1; transform: none; color: var(--ink); }

        /* ── 모달 공통: 헤더 아래에서 열림 ── */
        .modal-inner { padding-top: var(--hdr); }
        .wrap { max-width: 1360px; margin: 0 auto; padding: 0 40px; }
        .eb { font-size: 13px; color: var(--mute); font-weight: 500; }
        .ul { position: relative; display: inline-block; }
        .ul::after { content: ''; position: absolute; left: 0; right: 0; bottom: -4px; height: 1px; background: currentColor; transform: scaleX(1); transform-origin: 0 50%; }
        .ul:hover::after { animation: reline 1s var(--ease-io); }
        @keyframes reline { 0%{transform:scaleX(1);transform-origin:100% 50%} 49%{transform:scaleX(0);transform-origin:100% 50%} 50%{transform-origin:0 50%} 100%{transform:scaleX(1);transform-origin:0 50%} }
        .rowline { position: relative; }
        .rowline .sweep { position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--ink); transform: scaleX(0); transform-origin: 100% 50%; transition: transform .9s var(--ease-io); }
        .rowline:hover .sweep { transform: scaleX(1); transform-origin: 0 50%; }
        .mask { display: block; overflow: hidden; padding-bottom: .08em; }
        .mask > span { display: block; animation: heroIn 1.6s var(--ease-out) both; }
        @keyframes heroIn { from { transform: translateY(108%); } to { transform: none; } }
        .fade-up { animation: fadeUp 1.4s var(--ease-out) both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .closebtn { position: fixed; top: calc(var(--hdr) + 20px); right: 40px; z-index: 10; }

        /* Contact form: 밑줄 입력 */
        .field label { display: block; font-size: 12px; color: var(--mute); margin-bottom: 6px; }
        .field input, .field textarea { width: 100%; background: transparent; border: 0; border-bottom: 1px solid var(--line2); border-radius: 0; padding: 10px 0 12px; font-family: inherit; font-size: 16px; color: var(--ink); transition: border-color .5s; }
        .field input::placeholder, .field textarea::placeholder { color: #BDBDB8; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--ink) !important; box-shadow: none !important; }

        .edit-btn { position: absolute; top: 8px; right: 8px; background: rgba(28,28,28,0.85); color: white; border-radius: 999px; padding: 5px 11px; font-size: 11px; font-weight: 600; opacity: 0; transition: opacity 0.2s; cursor: pointer; z-index: 10; display: inline-flex; gap: 5px; align-items: center; }
        .gallery-item:hover .edit-btn { opacity: 1; }
        .project-content, .rte-editor { font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif; }
        .project-content img { max-width: 100%; height: auto; }
        .project-content ul { list-style: disc; padding-left: 1.5em; }
        .project-content ol { list-style: decimal; padding-left: 1.5em; }
        .project-content h2 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.35; margin: 48px 0 14px; color: var(--ink); }
        .project-content h3 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.4; margin: 36px 0 10px; color: var(--ink); }
        .project-content h4 { font-size: 17px; font-weight: 600; margin: 28px 0 8px; color: var(--ink); }
        .project-content blockquote { margin: 28px 0; padding: 4px 0 4px 20px; border-left: 3px solid #05D560; font-size: 19px; font-weight: 300; color: var(--sub); }
        .project-content hr { border: 0; height: 1px; background: var(--line2); margin: 48px 0; }
        .fullscreen-modal { scrollbar-width: none; }
        .fullscreen-modal[aria-hidden="true"] { visibility: hidden; transition: transform 0.8s cubic-bezier(0.16,1,0.3,1), visibility 0s 0.8s; }
        .fullscreen-modal[aria-hidden="false"] { visibility: visible; }
        .fullscreen-modal::-webkit-scrollbar { display: none; }

        /* ── 인트로 (원본 유지) ── */
        .intro-layer { position: absolute; inset: 0; will-change: transform, opacity; }
        .intro-typo { font-family: inherit; font-size: clamp(1.6rem, 3.5vw, 3rem); font-weight: 500; line-height: 1.45; letter-spacing: -0.02em; color: inherit; }
        #intro-img-container { width: 0vw; height: 0vh; will-change: width, height; overflow: hidden; border-radius: 50%; }
        #intro-img { transform: scale(1.3); will-change: transform; }

        @media (min-width: 901px) and (max-width: 1200px) { .navwrap { gap: 56px; } #gallery-track { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 900px) {
          :root { --hdr: 60px; }
          .glass-nav { grid-template-columns: auto minmax(0,1fr); padding: 0 8px 0 20px; gap: 12px; }
          .hdr-logo { height: 22px; }
          .navwrap { display: none; }
          .mb { display: block; }
          .hide-m { display: none; }
          .wrap { padding: 0 20px; }
          .closebtn { right: 16px; top: calc(var(--hdr) + 12px); }
          .work-top { flex-direction: column; align-items: stretch; padding: 24px 20px 28px; }
          .seg { display: flex; width: 100%; box-sizing: border-box; }
          .sb { flex: 1; width: auto; min-width: 0; height: 44px; font-size: 12px; }
          #gallery-track { grid-template-columns: minmax(0, 1fr); row-gap: 40px; padding: 0 20px 96px; }
          .wk.hot { transform: scale(1.02); } .wk.dim { transform: scale(.98); }
          .wk-row { flex-direction: column; gap: 4px; padding-top: 14px; }
          .wk-row .t { white-space: normal; }
          .pd-panel { margin: -72px 16px 0; width: auto; padding: 32px 24px 36px; }
          .pd-body { padding: 56px 20px 96px; }
          .pd-imgs { grid-template-columns: minmax(0, 1fr); gap: 16px; margin-top: 56px; }
          .pd-imgs .w8, .pd-imgs .w4, .pd-imgs .w12 { grid-column: auto; margin-top: 0; }
          .about-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
          .about-row .go { display: none; }

          /* ── 인트로 모바일 (원본 유지) ── */
          #intro-img-container { width: 0vw; height: 0vh; }
          .boy-img { width: clamp(70px, 28vw, 140px); }
          #intro-progress-bar { height: 2px; }

          /* ── Intro slide1: ment1 아래로 + 1.2배 ── */
          #slide1-ment {
            top: 22vh !important;
            width: clamp(300px, 108vw, 900px) !important;
            max-width: calc(100vw - 1rem) !important;
          }
          #slide1-info {
            height: clamp(200px, 48vh, 600px) !important;
            max-width: 95vw !important;
          }

          /* ── Intro slide2: ment2 상단, info2 하단 ── */
          .mobile-slide2-ment {
            top: 8vh !important; left: 0 !important;
            width: 100% !important; height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            align-items: center !important;
            padding: 0 5vw !important;
            z-index: 3 !important;
          }
          .mobile-slide2-ment img { width: 92vw !important; }
          .mobile-slide2-info {
            top: auto !important; bottom: 0 !important;
            left: 50% !important; right: auto !important;
            transform: translateX(-50%) !important;
            width: auto !important; height: auto !important;
            display: flex !important;
            align-items: flex-end !important;
            justify-content: center !important;
            z-index: 2 !important;
            overflow: visible !important;
          }
          .mobile-slide2-info img {
            height: clamp(280px, 55vh, 600px) !important;
            width: auto !important;
            max-width: 90vw !important;
            object-fit: contain !important;
          }

          /* ── Intro slide3: ment3 상단, info3 하단 (slide2와 동일 패턴) ──
             ment3.svg는 세로로 긴 비율(739:647, 거의 정사각형)이라 slide1의 ment1.svg(1105:227, 가로로 넓고 낮음)와
             같은 폭으로 키우면 훨씬 커 보이고 아래 이미지와 겹침. → 폭을 줄여 slide1과 비슷한 체감 크기로,
             이미지도 slide1(info1)과 같은 높이로 줄여서 자연히 더 아래에서 시작하도록 함 */
          #ment3-wrap {
            top: 8vh !important;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: 66vw !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            align-items: center !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #ment3-wrap img { width: 66vw !important; }
          #info3-1-img, #info3-2-img {
            top: auto !important;
            bottom: 0 !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            height: clamp(200px, 48vh, 600px) !important;
            width: auto !important;
            max-width: 90vw !important;
            object-fit: contain !important;
          }
        }
        #intro-progress-bar {
          position: fixed;
          top: 0; left: 0;
          height: 3px;
          width: 0%;
          background-color: #22CD6D;
          z-index: 400;
          transition: width 0.1s linear;
          pointer-events: none;
        }
        @keyframes boyFall {
          0%   { transform: translate(-50%, -220px); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translate(-50%, 0px); opacity: 1; }
        }
        .boy-img {
          position: absolute;
          bottom: 100%;
          left: 50%;
          margin-bottom: -10px;
          transform: translate(-50%, -220px);
          width: clamp(96px, 17.6vw, 208px);
          pointer-events: none;
          z-index: 20;
          opacity: 0;
          animation: boyFall 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards;
        }
      `}</style>

      {showLogin && <AdminLoginModal onClose={() => setShowLogin(false)} onLogin={u => { setUser(u); }} />}

      {/* Intro */}
      <div ref={introScreenRef} id="intro-screen" className="fixed inset-0 bg-white z-[300] overflow-hidden no-select" style={{ display: shouldShowIntro ? 'block' : 'none' }}>
        <div id="intro-progress-bar" />
        <div ref={step1ContainerRef} className="intro-layer flex items-center justify-center">
          <div style={{ position: 'absolute', top: '47%', left: '50%', transform: 'translate(-50%, -50%)', width: 'clamp(300px, 65vw, 700px)' }}>
            {/* boy.png — imby.png 바로 위에 떨어짐 */}
            <img
              id="boy-img"
              src="/boy.png"
              alt=""
              className="boy-img"
            />
            <img ref={introTextRef as any} src="/imby.png" alt="IMBY"
              className="w-full object-contain"
              style={{ userSelect: 'none', filter: 'none', display: 'block' }} />
          </div>
          <div ref={introImgContainerRef} id="intro-img-container" className="relative overflow-hidden z-10">
            <div id="intro-img" className="w-full h-full" style={{ backgroundColor: "#000000" }} />
          </div>
        </div>
        {/* ment + info 레이어 */}
        <div ref={step2ContainerRef} className="intro-layer" style={{ pointerEvents: 'none' }}>
          {/* ── slide 1: info1 먼저, ment1 연이어 ── */}
          {/* info1 — 하단 중앙 */}
          <img id="slide1-info" src="/info1.png" alt="info1"
            style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              height: 'clamp(336px, 66vh, 780px)', width: 'auto', objectFit: 'contain',
              opacity: 0, pointerEvents: 'none' }} />
          {/* ment1 — 상단 중앙 */}
          <img id="slide1-ment" src="/ment1.svg" alt="ment1"
            style={{ position: 'absolute', top: '7vh', left: '50%', transform: 'translateX(-50%)',
              width: 'clamp(291px, 66vw, 819px)',
              maxWidth: 'calc(100vw - 2rem)',
              objectFit: 'contain',
              filter: 'invert(1)', opacity: 0, pointerEvents: 'none' }} />

          {/* ── slide 2: info2 오른쪽 먼저, ment2 왼쪽 연이어 ── */}
          {/* info2 — 데스크탑: 오른쪽 / 모바일: 하단 */}
          <div id="slide2-info" style={{ position: 'absolute', top: 0, right: '3%', width: '50%', height: '100%',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
            className="mobile-slide2-info">
            <img src="/info2.png" alt="info2"
              style={{ height: '100vh', width: 'auto', objectFit: 'contain', objectPosition: 'bottom' }} />
          </div>
          {/* ment2 — 데스크탑: 왼쪽 / 모바일: 상단 */}
          <div id="slide2-ment" style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 4vw',
            opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
            className="mobile-slide2-ment">
            <img ref={typo2Ref} src="/ment2.svg" alt="ment2"
              style={{ width: '101%', objectFit: 'contain', objectPosition: 'left center', filter: 'invert(1)' }} />
          </div>
        </div>

        <div ref={step4ContainerRef} className="intro-layer" style={{ pointerEvents: 'none' }}>
          {/* ── slide 3: info3-1 → info3-2 교체 → ment3 오른쪽 ── */}

          {/* info3-1 (사람) — 왼쪽, 먼저 등장 */}
          <img id="info3-1-img" src="/info3-1.png" alt="info3-1"
            style={{ position: 'absolute', bottom: 0, left: '3%',
              height: 'clamp(320px, 85vh, 900px)', width: 'auto', objectFit: 'contain',
              opacity: 0, pointerEvents: 'none' }} />

          {/* info3-2 (로봇) — info3-1과 정확히 같은 위치/크기, 교체 효과 */}
          <img id="info3-2-img" src="/info3-2.png" alt="info3-2"
            style={{ position: 'absolute', bottom: 0, left: '3%',
              height: 'clamp(320px, 85vh, 900px)', width: 'auto', objectFit: 'contain',
              opacity: 0, pointerEvents: 'none' }} />

          {/* ment3 — 오른쪽, 마지막 등장 */}
          <div id="ment3-wrap" style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 4vw',
            opacity: 0, pointerEvents: 'none' }}>
            <img ref={typo3Ref} src="/ment3.svg" alt="ment3"
              style={{ width: '83%', objectFit: 'contain', objectPosition: 'left center', filter: 'invert(1)' }} />
          </div>
        </div>

        <div ref={scrollIndicatorRef} className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-xs md:text-sm font-bold tracking-widest text-black flex flex-col items-center gap-2 opacity-100 transition-opacity duration-300 z-50">
          <span>SCROLL DOWN</span>
          <div className="w-[1px] h-6 bg-black" />
        </div>
      </div>

      {/* Header */}
      <header ref={glassNavRef as any} id="glass-nav" className="glass-nav no-select">
        <div ref={siteLogoRef} id="site-logo" className="site-logo">
          <a href="/intro" aria-label="IMBY 홈" style={{ display: 'flex' }}>
            <img src="/logo.png" alt="IMBY" className="hdr-logo" style={menuOpen ? { filter: 'invert(1)' } : undefined} />
          </a>
        </div>
        <nav className="navwrap">
          {([['about', 'About'], ['projects', 'Work'], ['press', 'Press'], ['contact', 'Contact']] as const).map(([key, label]) => (
            <button key={key} className={`navl ${activeTab === key ? 'on' : ''}`} onClick={() => handleTabClick(key)}>{label}</button>
          ))}
        </nav>
        <div id="admin-btn-wrapper" className="hdr-r">
          {isAdmin && (
            <button className="wbtn" onClick={() => { prevTabRef.current = activeTab ?? 'projects'; setView('admin'); }}>관리자</button>
          )}
          <button className="wbtn hide-m" onClick={() => handleTabClick('contact')}>문의하기</button>
          <button type="button" className={`mb ${menuOpen ? 'open' : ''}`} aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'} onClick={() => setMenuOpen(v => !v)}><i /><i /></button>
        </div>
      </header>

      {/* 모바일 메뉴 */}
      <nav className={`mmenu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        {([['about', 'About'], ['projects', 'Work'], ['press', 'Press'], ['contact', 'Contact']] as const).map(([key, label], i) => (
          <a key={key} href="#" className={activeTab === key ? 'on' : ''} style={{ transitionDelay: menuOpen ? `${250 + i * 70}ms` : '0ms' }}
            onClick={e => { e.preventDefault(); handleTabClick(key); }}>{label}<span>0{i + 1}</span></a>
        ))}
        <a className="mail" href="mailto:support@inmybackyard.kr">support@inmybackyard.kr</a>
      </nav>

      {/* Work */}
      <div ref={galleryWrapperRef} id="gallery-wrapper" className={`${activeTab === 'projects' && selectedProjectIndex === null ? 'active' : ''} ${workDark ? 'dk' : ''}`}>
        <div className="work-top">
          <div className="seg" role="tablist" aria-label="카테고리">
            <span className="ind" style={segInd} />
            {WORK_FILTERS.map(f => (
              <button key={f} type="button" role="tab" aria-selected={activeFilter === f} className={`sb ${activeFilter === f ? 'on' : ''}`}
                onClick={() => { filterPrevRef.current = WORK_FILTERS.indexOf(activeFilter); setActiveFilter(f); setHoverId(null); }}>{f}</button>
            ))}
          </div>
          {!loading && <span className="cnt">{filteredProjects.length}개의 프로젝트</span>}
        </div>
        <div ref={galleryTrackRef} id="gallery-track" className="no-select" onMouseLeave={() => setHoverId(null)}>
          {loading ? (
            <div className="work-empty">불러오는 중…</div>
          ) : (
            <>
              {filteredProjects.map((proj, index) => (
                <div key={`${activeFilter}-${proj.id}`} className="wk-in" style={{ animationDelay: `${Math.min(index, 8) * 90}ms` }}>
                <div className={`wk ${hoverId === null ? '' : hoverId === proj.id ? 'hot' : 'dim'}`}
                  onMouseEnter={() => setHoverId(proj.id)}
                  onClick={() => setSelectedProjectIndex(index)}
                  draggable={isAdmin}
                  onDragStart={() => { dragProjectIndex.current = index; }}
                  onDragOver={e => { if (isAdmin) e.preventDefault(); }}
                  onDrop={e => {
                    if (!isAdmin) return;
                    e.preventDefault();
                    const from = dragProjectIndex.current;
                    dragProjectIndex.current = null;
                    if (from === null || from === index) return;
                    const next = [...filteredProjects];
                    const [moved] = next.splice(from, 1);
                    next.splice(index, 0, moved);
                    handleReorderProjects(next);
                  }}
                  style={{ cursor: isAdmin ? 'grab' : 'pointer' }}
                >
                  <div className="im" style={proj.hidden ? { opacity: 0.4 } : undefined}>
                    {proj.img && <img src={proj.img} alt={proj.title} className="im-img" draggable="false" />}
                    {proj.hover_logo && <img src={proj.hover_logo} alt="" className="hv" draggable="false" />}
                    {isAdmin && (
                      <button className="edit-btn" onClick={e => { e.stopPropagation(); openEditor(proj); }}>편집</button>
                    )}
                    {proj.hidden && isAdmin && (
                      <span className="absolute top-2 left-2 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(28,28,28,0.85)', zIndex: 3 }}>숨김</span>
                    )}
                  </div>
                  <div className="wk-row">
                    <h3 className="t">{proj.title}</h3>
                    <span className="c">{proj.category}</span>
                  </div>
                </div>
                </div>
              ))}
              {isAdmin && (
                <div className="wk-in"><button type="button" className="wk-new" onClick={() => openEditor(null)}>+ 새 프로젝트</button></div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Project Detail Modal */}
      <div aria-hidden={selectedProjectIndex === null} className={`fullscreen-modal fixed inset-0 z-[200] bg-white transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto modal-inner ${selectedProjectIndex !== null ? 'translate-y-0' : 'translate-y-full'}`}>
        <button onClick={() => { setSelectedProjectIndex(null); setActiveTab('projects'); window.history.pushState({}, '', '/work'); }} className="wbtn closebtn">닫기</button>
        {isAdmin && selectedProject && (
          <button onClick={() => openEditor(selectedProject)} className="wbtn closebtn" style={{ right: 'calc(40px + 72px)', display: 'inline-flex', gap: 6, alignItems: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 편집</button>
        )}
        {selectedProject && (
          <>
            {/* Hero: 대표 이미지를 화면에 꽉 채우고, 밝기에 따라 그라데이션/제목 색이 자동으로 바뀜 */}
            <ProjectHero project={selectedProject} />
          <div className="pd-body">
            {/* max-w-3xl(768px) 때문에 PC에서 본문이 왼쪽으로 쏠리고 오른쪽이 비던 문제 →
                컨테이너 전체 폭을 쓰고, 좌우 padding(px-12)만 대칭으로 남김 */}
            <div className="mb-16 w-full project-detail-header">
              {/* 부제목은 히어로(제목 바로 아래)로 이동 */}
              {/* 본문 (텍스트/사진/동영상/링크임베드), XSS 방지 sanitize 적용 */}
              <div className="project-content text-[17px] leading-[1.8] font-normal" style={{ color: '#3E3E3B', maxWidth: 860 }}
                dangerouslySetInnerHTML={{ __html: sanitizeProjectHtml(normalizeLegacyContent(selectedProject.content)) }} />
              {selectedProject.category === 'Web' && selectedProject.website_url && (
                <div className="mt-10">
                  <div className="overflow-hidden mb-4" style={{ border: '1px solid var(--line2)' }}>
                    <img
                      src={`https://api.microlink.io/?url=${encodeURIComponent(selectedProject.website_url)}&screenshot=true&meta=false&embed=screenshot.url`}
                      alt="Website Preview"
                      className="w-full h-auto object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={`https://www.google.com/s2/favicons?domain=${selectedProject.website_url}&sz=32`} alt="" className="w-5 h-5 rounded shrink-0" />
                        <span className="text-sm text-gray-500 truncate">{selectedProject.website_url}</span>
                      </div>
                      <a
                        href={selectedProject.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pillbtn shrink-0 ml-4" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
                      >
                        사이트 방문
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="pd-imgs">
              {selectedProject.detail_images?.map((src, i) => (
                <img key={i} src={src} alt="Detail" className={i % 3 === 0 ? 'w8' : i % 3 === 1 ? 'w4' : 'w12'} />
              ))}
            </div>
          </div>
          </>
        )}
      </div>

      {/* Press Modal */}
      <div aria-hidden={activeTab !== 'press'} className={`fullscreen-modal fixed inset-0 z-[150] bg-white transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto ${activeTab === 'press' ? 'translate-y-0' : 'translate-y-full'}`}>

        <PressPage isAdmin={isAdmin} />
      </div>



      {/* About Modal */}
      <div aria-hidden={activeTab !== 'about'} className={`fullscreen-modal fixed inset-0 z-[150] bg-white transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto modal-inner ${activeTab === 'about' ? 'translate-y-0' : 'translate-y-full'}`}>
        <section className="wrap" style={{ paddingTop: 120, paddingBottom: 120 }}>
          <p className="eb fade-up">About IMBY</p>
          <h1 className="mk" style={{ fontSize: 'clamp(34px, 5vw, 64px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.2, margin: '20px 0 0', maxWidth: 1000 }}>
            <span>소비자와 기업 모두가 즐거운 광고 문화를 만듭니다.</span>
          </h1>
          <p className="fade-up" style={{ fontSize: 'clamp(17px, 1.6vw, 21px)', fontWeight: 300, lineHeight: 1.75, color: 'var(--sub)', maxWidth: 680, marginTop: 36, animationDelay: '200ms' }}>
            IMBY(In My Backyard)는 사회적 임팩트가 있는 단 하나의 크리에이티브 솔루션을 찾는 인사이트 에이전시입니다. 우리 곁의 이야기에서 출발해 브랜드와 사람을 잇는 캠페인을 만듭니다.
          </p>
          <div className="about-rows">
            {([['Campaign', '브랜드의 메시지를 사회의 이야기로 확장하는 캠페인'], ['Design', '아이디어를 가장 정확한 모양으로 옮기는 디자인'], ['Film', '한 번 보면 기억에 남는 영상'], ['Web', '캠페인을 경험으로 바꾸는 웹사이트']] as const).map(([k, v], i) => (
              <button key={k} type="button" className="about-row fade-up" style={{ animationDelay: `${300 + i * 90}ms` }}
                onClick={() => { setActiveFilter(k); handleTabClick('projects'); }}>
                <span className="k">{k}</span><span className="v">{v}</span><span className="go">작업 보기</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 72 }}><button type="button" className="wbtn pri" onClick={() => handleTabClick('contact')}>함께 이야기하기</button></div>
        </section>
      </div>

      {/* Contact Modal */}
      <div aria-hidden={activeTab !== 'contact'} className={`fullscreen-modal fixed inset-0 z-[150] bg-[#F4F4F2] transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${activeTab === 'contact' ? 'translate-y-0' : 'translate-y-full'}`}>

        <div className="contact-scroll-inner" style={{ height: '100%', overflowY: 'auto' }}>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
            <MailIconWithBadge active={activeTab === 'contact'} />
            <p className="eb" style={{ textAlign: 'center' }}>아래로 내려 메시지를 남겨 주세요</p>
          </div>
          <section style={{ background: '#fff', paddingTop: 120, paddingBottom: 140 }}>
            <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 64 }} id="contact-grid">
              <div>
                <h2 className="mask" style={{ fontSize: 'clamp(34px, 4vw, 54px)', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}><span>Let&rsquo;s talk about it.</span></h2>
                <p style={{ fontSize: 18, lineHeight: 1.75, fontWeight: 300, color: 'var(--sub)', margin: '28px 0 72px', maxWidth: 440 }}>새로운 프로젝트, 협업 제안 등<br />어떤 이야기든 환영합니다.</p>
                <div style={{ borderTop: '1px solid var(--ink)' }}>
                  <a href="mailto:support@inmybackyard.kr" className="rowline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '22px 0', borderBottom: '1px solid var(--line2)' }}>
                    <span className="eb">이메일</span><span style={{ fontSize: 16 }}>support@inmybackyard.kr</span><span className="sweep" />
                  </a>
                  <a href="https://www.instagram.com/imbykorea" target="_blank" rel="noopener noreferrer" className="rowline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '22px 0', borderBottom: '1px solid var(--line2)' }}>
                    <span className="eb">인스타그램</span><span style={{ fontSize: 16 }}>@imbykorea</span><span className="sweep" />
                  </a>
                </div>
              </div>
              <div style={{ background: 'var(--surface)', padding: 'clamp(28px, 3vw, 44px)' }}>
                <ContactForm />
              </div>
            </div>
          </section>
          <footer style={{ background: '#fff', padding: '64px 0 28px', borderTop: '1px solid var(--line)' }}>
            <div className="wrap" style={{ maxWidth: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                {([['about', 'About'], ['projects', 'Work'], ['press', 'Press'], ['contact', 'Contact']] as const).map(([key, label]) => (
                  <button key={key} className="navl" style={{ padding: '5px 0' }} onClick={() => handleTabClick(key)}>{label}<span className="bar" /></button>
                ))}
              </div>
              <img src="/logo.png" alt="IMBY" style={{ height: 34, width: 'auto' }} />
            </div>
            <div className="wrap" style={{ maxWidth: 'none', marginTop: 72, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--mute)' }}>
              <span>© IMBY — In My Backyard</span>
              {!isAdmin && (
                <button onClick={() => setShowLogin(true)} style={{ background: 'none', border: 0, padding: 0, fontSize: 11, color: 'var(--faint)', cursor: 'pointer', fontFamily: 'inherit' }}>관리자로 로그인</button>
              )}
            </div>
          </footer>
        </div>
      </div>
      <style>{`@media (max-width: 900px) { #contact-grid { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </>
  );
}
