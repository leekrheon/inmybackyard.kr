import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

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
  created_at?: string;
}

const ADMIN_EMAIL = 'support@inmybackyard.kr';

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

// ═══════════════════════════════════════════════════════════════════════════════
// Supabase DB helpers
// ═══════════════════════════════════════════════════════════════════════════════
async function dbFetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
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
  });
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

function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [fontSize, setFontSize] = useState('16px');
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
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.style.fontSize = size;
    range.surroundContents(span);
    handleInput();
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

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Bold */}
        <button type="button" onClick={() => exec('bold')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-sm font-bold">B</button>
        {/* Italic */}
        <button type="button" onClick={() => exec('italic')}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors text-sm italic font-serif">I</button>
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
        style={{ minHeight: '300px', fontFamily: 'inherit', fontSize: '16px', lineHeight: 1.8 }}
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
  const [form, setForm] = useState<Project>(project ?? {
    id: Date.now().toString(),
    title: '', description: '', img: '', content: '',
    detail_images: [], category: 'Campaign', year: new Date().getFullYear().toString(),
  });
  const [uploading, setUploading] = useState(false);
  const [detailUploading, setDetailUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof Project, v: string | string[]) => setForm(prev => ({ ...prev, [k]: v }));

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { set('img', await uploadImage(file, 'projects/thumb')); }
    catch { alert('업로드 실패. 다시 시도해주세요.'); }
    setUploading(false);
  };

  const handleDetailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return;
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
    await onSave(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <span className="text-xs font-bold text-[#0FCD60] tracking-widest uppercase">{isNew ? 'NEW PROJECT' : 'EDIT PROJECT'}</span>
        <div className="flex-1" />
        {!isNew && onDelete && (
          <button onClick={async () => { if (confirm('삭제할까요?')) { await onDelete(form.id); onClose(); } }}
            className="text-sm text-red-400 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">삭제</button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-black text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
          {saving ? '저장 중…' : saved ? '✓ 저장됨' : '저장'}
        </button>
      </div>

      {/* Body: 2-column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Meta */}
        <div className="w-72 shrink-0 border-r border-gray-100 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Thumbnail */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">대표 이미지</label>
            {form.img
              ? <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 mb-2">
                  <img src={form.img} alt="thumb" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => set('img', '')}
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-black">✕</button>
                </div>
              : <div className="w-full aspect-video rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-sm mb-2">미리보기 없음</div>
            }
            <label className="cursor-pointer block">
              <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
              <span className="block text-center border-2 border-dashed border-gray-200 rounded-xl py-2 text-xs text-gray-400 hover:border-[#0FCD60] hover:text-[#0FCD60] transition-colors cursor-pointer">
                {uploading ? '업로드 중…' : '📁 파일 선택'}
              </span>
            </label>
            <input type="text" value={form.img.startsWith('data:') ? '' : form.img} onChange={e => set('img', e.target.value)}
              placeholder="또는 URL 입력" className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">제목 *</label>
            <input required type="text" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="프로젝트 제목" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">부제목</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="한 줄 설명" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
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

          {/* Detail Images */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">상세 이미지</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.detail_images.map((src, i) => (
                <div key={i} className="relative w-16 h-12 rounded-lg overflow-hidden bg-gray-100">
                  <img src={src} alt={`d${i}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => set('detail_images', form.detail_images.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center hover:bg-red-500">✕</button>
                </div>
              ))}
              <label className="w-16 h-12 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-[#0FCD60] hover:text-[#0FCD60] transition-colors cursor-pointer text-lg">
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleDetailUpload} />
                {detailUploading ? '…' : '+'}
              </label>
            </div>
          </div>
        </div>

        {/* Right: Rich Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 pt-6 pb-2 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">본문 내용</p>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <RichEditor value={form.content} onChange={v => set('content', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Dashboard Page
// ═══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({
  projects,
  onEdit,
  onDelete,
  onNew,
  onClose,
  userEmail,
  onLogout,
}: {
  projects: Project[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => Promise<void>;
  onNew: () => void;
  onClose: () => void;
  userEmail: string;
  onLogout: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('전체');

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

  return (
    <div className="fixed inset-0 z-[400] flex flex-col overflow-hidden" style={{ backgroundColor: '#f5f5f5' }}>

      {/* ── Top Bar ── */}
      <div className="flex items-center gap-4 px-6 h-12 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-black transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          사이트로
        </button>
        <span className="text-gray-200">|</span>
        <span style={{ fontFamily: "'League Gothic', sans-serif", fontSize: '1rem', letterSpacing: '0.1em', fontWeight: 400 }}>IMBY ADMIN</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-400 hidden md:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0FCD60] inline-block" />
          {userEmail}
        </span>
        <button onClick={onLogout}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors ml-2 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-red-200">
          로그아웃
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
                <div className="text-3xl font-black mb-1" style={{ color: s.label === '전체' ? '#111' : '#0FCD60' }}>{s.value}</div>
                <div className="text-[11px] text-gray-400 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Project List ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* List Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-xl">
                {cats.map(c => (
                  <button key={c} onClick={() => setFilterCat(c)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: filterCat === c ? 'white' : 'transparent',
                      color: filterCat === c ? '#111' : '#9ca3af',
                      boxShadow: filterCat === c ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={onNew}
                className="flex items-center gap-1.5 bg-[#0FCD60] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-green-500 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                새 프로젝트
              </button>
            </div>

            {/* Empty */}
            {filtered.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 text-gray-300">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                <p className="text-sm">등록된 프로젝트가 없습니다.</p>
              </div>
            ) : (
              /* Table */
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-6 py-3">썸네일</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">프로젝트</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden md:table-cell">카테고리</th>
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden md:table-cell">연도</th>
                    <th className="px-6 py-3 w-40" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id}
                      className="group transition-colors hover:bg-gray-50"
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      {/* Thumb */}
                      <td className="px-6 py-3.5">
                        {p.img
                          ? <img src={p.img} alt={p.title} className="w-16 h-11 object-cover rounded-xl bg-gray-100" />
                          : <div className="w-16 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-xs border-2 border-dashed border-gray-200">없음</div>
                        }
                      </td>
                      {/* Info */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-sm text-gray-900 leading-snug">{p.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</div>
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: 'rgba(15,205,96,0.1)', color: '#0FCD60' }}>
                          {p.category}
                        </span>
                      </td>
                      {/* Year */}
                      <td className="px-4 py-3.5 hidden md:table-cell text-sm text-gray-400 font-medium">{p.year}</td>
                      {/* Actions */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 justify-end">
                          {confirmId === p.id ? (
                            <>
                              <span className="text-[11px] text-red-400 font-medium">삭제할까요?</span>
                              <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                                className="text-[11px] font-bold text-white bg-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40">
                                {deleting === p.id ? '…' : '확인'}
                              </button>
                              <button onClick={() => setConfirmId(null)}
                                className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => onEdit(p)}
                                className="text-xs font-medium text-gray-500 hover:text-black px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-all">
                                편집
                              </button>
                              <button onClick={() => setConfirmId(p.id)}
                                className="text-xs font-medium text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 transition-all">
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Footer ── */}
          <p className="text-center text-xs text-gray-300 mt-6">IMBY Admin · {projects.length} projects total</p>
        </div>
      </div>
    </div>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr('');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr('이메일 또는 비밀번호가 올바르지 않습니다.'); return; }
    if (data.user) { onLogin(data.user); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="relative bg-white rounded-3xl p-10 w-[90vw] max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-[#0FCD60] rounded-full flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight leading-none" style={{ fontFamily: "'League Gothic', sans-serif", letterSpacing: '0.08em' }}>ADMIN LOGIN</h2>
            <p className="text-gray-400 text-xs mt-0.5">관리자 계정으로 로그인하세요</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm transition-all" placeholder="admin@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
            <input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className={`w-full border-2 rounded-xl px-4 py-3 text-sm transition-all ${err ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} placeholder="••••••••" />
            {err && <p className="text-red-500 text-xs mt-1.5">{err}</p>}
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-black text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-colors mt-1 disabled:opacity-50">
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-black hover:bg-gray-100 transition-colors text-lg">✕</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════════════════════════════════════
type AppView = 'site' | 'editor' | 'admin';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'press' | 'contact' | null>(null);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // View routing
  const [view, setView] = useState<AppView>('site');
  const [editingProject, setEditingProject] = useState<Project | null>(null); // null = new

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

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); returnToSite(); };

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

  const openEditor = (p: Project | null) => { setEditingProject(p); setView('editor'); };
  const closeEditor = () => { if (user) { setView('admin'); } else { returnToSite(); } setEditingProject(null); };

  const filteredProjects = activeFilter === 'All' ? projects : projects.filter(p => p.category === activeFilter);
  const selectedProject = selectedProjectIndex !== null ? filteredProjects[selectedProjectIndex] ?? null : null;
  const isAdmin = !!user;

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
  const step5ContainerRef = useRef<HTMLDivElement>(null);
  const typo4Ref = useRef<HTMLParagraphElement>(null);
  const floatingImgWrapperRef = useRef<HTMLDivElement>(null);
  const floatingImgRef = useRef<HTMLImageElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const glassNavRef = useRef<HTMLDivElement>(null);
  const siteLogoRef = useRef<HTMLDivElement>(null);
  const galleryWrapperRef = useRef<HTMLDivElement>(null);
  const galleryTrackRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef({
    isIntroActive: true, targetIntroProgress: 0, currentIntroProgress: 0,
    isGalleryActive: false, mouseX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    currentScroll: 0, targetScroll: 0, introAnimationId: 0, galleryAnimationId: 0
  });
  const uiStateRef = useRef({ activeTab, selectedProjectIndex });

  const returnToSite = useCallback(() => {
    setView('site');
    const s = stateRef.current;
    if (!s.isIntroActive) {
      setTimeout(() => {
        if (glassNavRef.current) glassNavRef.current.classList.add('visible');
        if (siteLogoRef.current) siteLogoRef.current.classList.add('visible');
        if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '1';
      }, 50);
    }
  }, []);
  useEffect(() => { uiStateRef.current = { activeTab, selectedProjectIndex }; }, [activeTab, selectedProjectIndex]);

  // ── Intro animation ────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    function mapRange(val: number, inMin: number, inMax: number, outMin: number, outMax: number) {
      if (val <= inMin) return outMin; if (val >= inMax) return outMax;
      return (val - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
    }
    function renderIntroSequence() {
      if (!s.isIntroActive) return;
      s.currentIntroProgress += (s.targetIntroProgress - s.currentIntroProgress) * 0.08;
      if (scrollIndicatorRef.current) scrollIndicatorRef.current.style.opacity = s.currentIntroProgress > 2 ? '0' : '1';
      const isMobile = window.innerWidth <= 768;
      const p1 = mapRange(s.currentIntroProgress, 0, 15, 0, 1);
      const startW = isMobile ? 60 : 35, startH = isMobile ? 40 : 45;
      if (introImgContainerRef.current) { introImgContainerRef.current.style.width = `${startW + (100 - startW) * p1}vw`; introImgContainerRef.current.style.height = `${startH + (100 - startH) * p1}vh`; }
      if (introImgRef.current) introImgRef.current.style.transform = `scale(${1.3 - 0.3 * p1})`;
      if (introTextRef.current) introTextRef.current.style.transform = `translateY(${p1 * -150}%)`;
      if (step1ContainerRef.current) step1ContainerRef.current.style.opacity = String(mapRange(s.currentIntroProgress, 13, 17, 1, 0));
      if (step2ContainerRef.current) step2ContainerRef.current.style.opacity = String(mapRange(s.currentIntroProgress, 16, 20, 0, 1) - mapRange(s.currentIntroProgress, 38, 42, 0, 1));
      if (typo1Ref.current) { typo1Ref.current.style.opacity = String(mapRange(s.currentIntroProgress, 18, 22, 0, 1) - mapRange(s.currentIntroProgress, 28, 32, 0, 1)); typo1Ref.current.style.transform = `translateY(${mapRange(s.currentIntroProgress, 18, 22, 40, 0)}px) translateY(${mapRange(s.currentIntroProgress, 28, 32, 0, -40)}px)`; }
      if (typo2Ref.current) { typo2Ref.current.style.opacity = String(mapRange(s.currentIntroProgress, 30, 34, 0, 1)); typo2Ref.current.style.transform = `translateY(${mapRange(s.currentIntroProgress, 30, 34, 40, 0)}px)`; }
      if (step4ContainerRef.current) { step4ContainerRef.current.style.opacity = String(mapRange(s.currentIntroProgress, 40, 45, 0, 1)); step4ContainerRef.current.style.transform = `translateY(${mapRange(s.currentIntroProgress, 55, 65, 0, -50)}vh)`; }
      if (typo3Ref.current) { typo3Ref.current.style.opacity = String(mapRange(s.currentIntroProgress, 42, 46, 0, 1)); typo3Ref.current.style.transform = `translateY(${mapRange(s.currentIntroProgress, 42, 46, 30, 0)}px)`; }
      cornersRef.current.forEach((corner, i) => {
        if (!corner) return;
        const ds = 45 + i * 1.5, dir = corner.classList.contains('left-corner') ? -50 : 50;
        corner.style.opacity = String(mapRange(s.currentIntroProgress, ds, ds + 5, 0, 1));
        corner.style.transform = `translateX(${mapRange(s.currentIntroProgress, ds, ds + 5, dir, 0)}px)`;
      });
      if (step5ContainerRef.current) step5ContainerRef.current.style.transform = `translateY(${mapRange(s.currentIntroProgress, 55, 65, 100, 0)}%)`;
      if (typo4Ref.current) { typo4Ref.current.style.opacity = String(mapRange(s.currentIntroProgress, 65, 75, 0, 1)); typo4Ref.current.style.transform = `translateY(${mapRange(s.currentIntroProgress, 65, 75, 40, 0)}px)`; }
      if (floatingImgWrapperRef.current) floatingImgWrapperRef.current.style.opacity = String(mapRange(s.currentIntroProgress, 72, 80, 0, 1));
      if (floatingImgRef.current) floatingImgRef.current.style.transform = `translateY(${mapRange(s.currentIntroProgress, 70, 95, 200, -80)}px) scale(${mapRange(s.currentIntroProgress, 70, 95, 0.9, 1.05)})`;
      if (introScreenRef.current) introScreenRef.current.style.opacity = String(mapRange(s.currentIntroProgress, 96, 100, 1, 0));
      if (s.currentIntroProgress > 99.6 && s.targetIntroProgress === 100) {
        s.isIntroActive = false; s.currentIntroProgress = 100;
        if (introScreenRef.current) introScreenRef.current.style.display = 'none';
        if (glassNavRef.current) glassNavRef.current.classList.add('visible');
        if (siteLogoRef.current) siteLogoRef.current.classList.add('visible');
        if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '1';
      } else { s.introAnimationId = requestAnimationFrame(renderIntroSequence); }
    }
    s.introAnimationId = requestAnimationFrame(renderIntroSequence);

    function checkAndReactivateIntro(deltaY: number) {
      const { activeTab, selectedProjectIndex } = uiStateRef.current;
      if (!s.isIntroActive && deltaY < -2 && s.currentScroll >= -50 && !selectedProjectIndex && activeTab !== 'press' && activeTab !== 'contact') {
        s.isIntroActive = true;
        if (introScreenRef.current) introScreenRef.current.style.display = 'block';
        if (glassNavRef.current) glassNavRef.current.classList.remove('visible');
        if (siteLogoRef.current) siteLogoRef.current.classList.remove('visible');
        if (galleryWrapperRef.current) galleryWrapperRef.current.style.opacity = '0';
        setActiveTab(null);
        s.targetIntroProgress = 95;
        s.introAnimationId = requestAnimationFrame(renderIntroSequence);
      }
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

  // ── Gallery loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    if (activeTab === 'projects' && selectedProjectIndex === null) {
      s.isGalleryActive = true; s.mouseX = window.innerWidth / 2;
      function renderGallery() {
        if (!s.isGalleryActive) return;
        const trackWidth = galleryTrackRef.current?.scrollWidth || 0;
        const ww = window.innerWidth;
        const maxScroll = Math.max(0, trackWidth - ww + ww * 0.4);
        const dz = ww * 0.1;
        let prog = (s.mouseX - dz) / (ww - dz * 2);
        prog = Math.max(0, Math.min(1, prog));
        s.targetScroll = -(prog * maxScroll);
        s.currentScroll += (s.targetScroll - s.currentScroll) * 0.06;
        if (galleryTrackRef.current) galleryTrackRef.current.style.transform = `translate3d(${s.currentScroll}px, 0, 0)`;
        s.galleryAnimationId = requestAnimationFrame(renderGallery);
      }
      s.galleryAnimationId = requestAnimationFrame(renderGallery);
    } else { s.isGalleryActive = false; }
    return () => { cancelAnimationFrame(s.galleryAnimationId); };
  }, [activeTab, selectedProjectIndex]);

  const handleTabClick = (tab: 'projects' | 'press' | 'contact') => {
    if (activeTab === tab) { setActiveTab(null); setSelectedProjectIndex(null); }
    else { setActiveTab(tab); setSelectedProjectIndex(null); }
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
        onClose={returnToSite}
        userEmail={user?.email ?? ''}
        onLogout={handleLogout}
      />
    );
  }

  // ── Main site ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #000000; overflow: hidden; overscroll-behavior: none; }
        .no-select { user-select: none; -webkit-user-select: none; }
        #gallery-wrapper { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.8s ease-in-out; z-index: 10; }
        #gallery-wrapper.active { pointer-events: auto; }
        #gallery-track { display: flex; gap: 6vw; padding: 0 30vw; will-change: transform; }
        .gallery-item { position: relative; flex-shrink: 0; cursor: pointer; }
        .gallery-img-container { overflow: hidden; background-color: #f3f4f6; }
        .gallery-img { height: 55vh; width: auto; max-width: 60vw; object-fit: cover; transform-origin: center; transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .gallery-item:hover .gallery-img { transform: scale(1.03); }
        .gallery-info { position: absolute; top: 100%; left: 0; margin-top: 1.5rem; width: 100%; opacity: 0; transform: translateY(15px); transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .gallery-item:hover .gallery-info { opacity: 1; transform: translateY(0); }
        #sub-menu { position: fixed; top: 6rem; left: 2.5rem; display: flex; flex-direction: column; gap: 0.25rem; opacity: 0; pointer-events: none; transform: translateY(-10px); transition: all 0.4s ease; z-index: 40; font-size: 1.15rem; font-family: 'League Gothic', sans-serif; letter-spacing: 0.05em; }
        #sub-menu.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
        #sub-menu a { position: relative; width: fit-content; transition: all 0.2s ease; transform-origin: left; color: inherit; }
        #sub-menu a::before { content: ''; position: absolute; left: -14px; top: 50%; transform: translateY(-50%); border-top: 4px solid transparent; border-bottom: 4px solid transparent; border-left: 6px solid #0FCD60; opacity: 0; transition: opacity 0.2s ease; }
        #sub-menu a.active::before { opacity: 1; }
        #sub-menu a:hover, #sub-menu a.active { transform: translateX(14px); font-style: italic; color: #0FCD60; }
        .glass-nav { position: fixed; top: 1.5rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.25rem; padding: 0.35rem; border-radius: 9999px; background: rgba(255,255,255,0.4); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.6); box-shadow: 0 4px 30px rgba(0,0,0,0.05); z-index: 250; opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
        .glass-nav.visible { opacity: 1; pointer-events: auto; }
        .glass-nav button { font-family: 'League Gothic', sans-serif; font-weight: 400; font-size: 1.05rem; letter-spacing: 0.06em; padding: 0.4rem 1.2rem; border-radius: 9999px; color: #000; background-color: transparent; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; }
        .glass-nav button:hover, .glass-nav button.active { background-color: #0FCD60; color: #fff; }
        .site-logo { position: fixed; top: 1.5rem; left: 2rem; z-index: 300; opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
        .site-logo.visible { opacity: 1; pointer-events: auto; }
        .intro-layer { position: absolute; inset: 0; will-change: transform, opacity; }
        #intro-img-container { width: 35vw; height: 45vh; will-change: width, height; }
        @media (max-width: 768px) { #intro-img-container { width: 60vw; height: 40vh; } .site-logo { top: 1.2rem; left: 1.2rem; } }
        #intro-img { transform: scale(1.3); will-change: transform; }
        .fullscreen-modal { scrollbar-width: none; }
        .fullscreen-modal::-webkit-scrollbar { display: none; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #0FCD60 !important; box-shadow: 0 0 0 1px #0FCD60 !important; }
        .edit-btn { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.75); color: white; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 600; opacity: 0; transition: opacity 0.2s; cursor: pointer; z-index: 10; }
        .gallery-item:hover .edit-btn { opacity: 1; }
        .project-content img { max-width: 100%; height: auto; }
        .project-content ul { list-style: disc; padding-left: 1.5em; }
      `}</style>

      {showLogin && <AdminLoginModal onClose={() => setShowLogin(false)} onLogin={u => { setUser(u); }} />}

      {/* Site Logo */}
      <div ref={siteLogoRef} className="site-logo">
        <img src="/logo.png" alt="IMBY" className="h-5 md:h-6 w-auto object-contain" style={{ filter: 'brightness(0)' }} />
      </div>

      {/* Intro */}
      <div ref={introScreenRef} id="intro-screen" className="fixed inset-0 bg-white z-[300] overflow-hidden no-select" style={{ display: 'block' }}>
        <div ref={step1ContainerRef} className="intro-layer flex items-center justify-center">
          <h1 ref={introTextRef} className="absolute text-[22vw] md:text-[18vw] font-black tracking-tighter leading-none whitespace-nowrap text-black" style={{ fontFamily: "'League Gothic', sans-serif" }}>IMBY</h1>
          <div ref={introImgContainerRef} id="intro-img-container" className="relative overflow-hidden z-10">
            <img ref={introImgRef} id="intro-img" src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=2000&q=80" alt="Intro" className="w-full h-full object-cover" />
          </div>
        </div>
        <div ref={step2ContainerRef} className="intro-layer flex flex-col items-center justify-center text-center px-6 opacity-0">
          <p ref={typo1Ref} className="text-3xl md:text-5xl font-medium tracking-tight leading-snug mb-8 opacity-0">문화적 영향력을 지닌 브랜드는<br />그 힘을 얻고 유지하는 방법을 압니다.</p>
          <p ref={typo2Ref} className="text-4xl md:text-7xl font-bold tracking-tighter uppercase opacity-0">우리의 모든 작업은 이를 최우선으로 합니다.</p>
        </div>
        <div ref={step4ContainerRef} className="intro-layer opacity-0">
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <p ref={typo3Ref} className="text-3xl md:text-6xl font-medium tracking-tight leading-snug opacity-0">당신의 브랜드도<br /><span className="font-bold">문화의 중심</span>이 될 수 있습니다.</p>
          </div>
        </div>
        <div ref={step5ContainerRef} className="intro-layer bg-black text-white flex flex-col items-center justify-center translate-y-full z-20">
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <p ref={typo4Ref} className="text-2xl md:text-5xl font-medium leading-relaxed z-10 opacity-0 relative">시대를 선도하는 인사이트,<br />트렌드 기획 및 창의적인 시각을 확인하세요.</p>
          </div>
          <div ref={floatingImgWrapperRef} className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0">
            <img ref={floatingImgRef} src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1000&q=80" alt="Floating" className="w-[80vw] md:w-[40vw] h-auto max-h-[60vh] object-cover shadow-2xl" />
          </div>
        </div>
        <div ref={scrollIndicatorRef} className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-xs md:text-sm font-bold tracking-widest text-black flex flex-col items-center gap-2 opacity-100 transition-opacity duration-300 z-50">
          <span>SCROLL DOWN</span>
          <div className="w-[1px] h-6 bg-black" />
        </div>
      </div>

      {/* Glass Nav */}
      <div ref={glassNavRef} id="glass-nav" className="glass-nav no-select">
        <button className={activeTab === 'projects' ? 'active' : ''} onClick={() => handleTabClick('projects')}>PROJECT</button>
        <button className={activeTab === 'press' ? 'active' : ''} onClick={() => handleTabClick('press')}>PRESS</button>
        <button className={activeTab === 'contact' ? 'active' : ''} onClick={() => handleTabClick('contact')}>CONTACT</button>
        {isAdmin ? (
          <button className="text-[#0FCD60]" onClick={() => setView('admin')}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0FCD60] animate-pulse inline-block" />
              ADMIN
            </span>
          </button>
        ) : (
          <button style={{ color: '#aaa' }} onClick={() => setShowLogin(true)}>ADMIN</button>
        )}
      </div>

      {/* Sub Menu */}
      <div id="sub-menu" className={`no-select ${activeTab === 'projects' && selectedProjectIndex === null ? 'open' : ''}`}>
        {['All', 'Web', 'Campaign', 'Film', 'Design'].map(f => (
          <a key={f} href="#" onClick={e => { e.preventDefault(); setActiveFilter(f); }} className={activeFilter === f ? 'active' : ''}>{f}</a>
        ))}
      </div>

      {/* Gallery */}
      <div ref={galleryWrapperRef} id="gallery-wrapper" className={activeTab === 'projects' && selectedProjectIndex === null ? 'active' : ''}>
        <div ref={galleryTrackRef} id="gallery-track" className="no-select">
          {loading ? (
            <div className="flex items-center justify-center w-screen text-gray-300 text-sm">불러오는 중…</div>
          ) : (
            <>
              {filteredProjects.map((proj, index) => (
                <div key={proj.id} className="gallery-item group" onClick={() => setSelectedProjectIndex(index)}>
                  <div className="gallery-img-container relative">
                    <img src={proj.img || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=60'}
                      alt={proj.title} className="gallery-img" draggable="false" />
                    {isAdmin && (
                      <button className="edit-btn" onClick={e => { e.stopPropagation(); openEditor(proj); }}>✏ 편집</button>
                    )}
                  </div>
                  <div className="gallery-info">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-[#0FCD60] uppercase tracking-widest">{proj.category}</span>
                      <span className="text-xs text-gray-400">{proj.year}</span>
                    </div>
                    <h3 className="font-medium text-xl md:text-2xl">{proj.title}</h3>
                    <p className="text-gray-500 mt-1 text-sm md:text-base">{proj.description}</p>
                  </div>
                </div>
              ))}
              {isAdmin && (
                <div className="gallery-item group" onClick={() => openEditor(null)} style={{ cursor: 'pointer' }}>
                  <div className="gallery-img-container flex items-center justify-center" style={{ height: '55vh', width: '22vw', background: '#f8f8f8', border: '2px dashed #0FCD60' }}>
                    <div className="text-center text-[#0FCD60]">
                      <div className="text-5xl mb-2">+</div>
                      <div className="text-sm font-bold tracking-widest uppercase">새 프로젝트</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Project Detail Modal */}
      <div className={`fullscreen-modal fixed inset-0 z-[200] bg-[#fafafa] transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto pt-24 ${selectedProjectIndex !== null ? 'translate-y-0' : 'translate-y-full'}`}>
        <button onClick={() => setSelectedProjectIndex(null)} className="fixed top-24 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors z-10 cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {isAdmin && selectedProject && (
          <button onClick={() => openEditor(selectedProject)} className="fixed top-24 right-24 flex items-center gap-2 px-4 py-3 rounded-full bg-[#0FCD60] text-white text-sm font-bold shadow-lg hover:bg-green-500 transition-colors z-10 cursor-pointer">✏ 편집</button>
        )}
        {selectedProject && (
          <div className="w-full max-w-6xl mx-auto py-12 px-6 md:px-12">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm font-bold text-[#0FCD60] uppercase tracking-widest">{selectedProject.category}</span>
              <span className="text-sm text-gray-400">{selectedProject.year}</span>
            </div>
            <div className="mb-16 max-w-3xl">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">{selectedProject.title}</h1>
              <p className="text-xl md:text-2xl text-gray-500 mb-8 font-medium">{selectedProject.description}</p>
              {/* Rich HTML content */}
              <div className="project-content text-lg text-gray-800 leading-relaxed font-light"
                dangerouslySetInnerHTML={{ __html: selectedProject.content }} />
            </div>
            <div className="flex flex-col gap-12 md:gap-24">
              {selectedProject.detail_images?.map((src, i) => (
                <img key={i} src={src} alt="Detail" className="w-full h-auto object-cover rounded-sm" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Press Modal */}
      <div className={`fullscreen-modal fixed inset-0 z-[150] bg-[#f0f0f0] transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center ${activeTab === 'press' ? 'translate-y-0' : 'translate-y-full'}`}>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-300 uppercase" style={{ fontFamily: "'League Gothic', sans-serif", letterSpacing: '0.08em' }}>COMING SOON</h2>
      </div>

      {/* Contact Modal */}
      <div className={`fullscreen-modal fixed inset-0 z-[150] bg-white transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto pt-32 pb-24 ${activeTab === 'contact' ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-full max-w-4xl mx-auto px-6 md:px-12 flex flex-col md:flex-row gap-16">
          <div className="flex-1">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight" style={{ fontFamily: "'League Gothic', sans-serif", letterSpacing: '0.06em' }}>Let's talk<br />about it.</h2>
            <p className="text-gray-500 mb-12 text-[15px]">새로운 프로젝트, 협업 제안 등 어떤 이야기든 환영합니다.</p>
            <div className="mb-12">
              <h4 className="text-sm text-gray-400 uppercase tracking-widest mb-2 font-normal" style={{ fontFamily: "'League Gothic', sans-serif" }}>Email</h4>
              <a href="mailto:support@inmybackyard.kr" className="font-medium hover:italic transition-all border-b-2 border-black pb-1 text-[15px]">support@inmybackyard.kr</a>
            </div>
            <div>
              <h4 className="text-sm text-gray-400 uppercase tracking-widest mb-2 font-normal" style={{ fontFamily: "'League Gothic', sans-serif" }}>Instagram</h4>
              <p className="text-[15px]">@imbykorea</p>
            </div>
          </div>
          <div className="flex-1 bg-gray-50 p-8 rounded-2xl">
            <form className="flex flex-col gap-6" onSubmit={e => { e.preventDefault(); alert('문의가 성공적으로 접수되었습니다.'); (e.target as HTMLFormElement).reset(); }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">이름 / 회사명</label>
                <input type="text" required className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">회신받을 이메일</label>
                <input type="email" required className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">문의 내용</label>
                <textarea required rows={4} className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm resize-none" placeholder="프로젝트 내용이나 궁금하신 점을 자유롭게 적어주세요." />
              </div>
              <button type="submit" className="w-full bg-black text-white font-medium py-4 rounded-lg mt-2 hover:bg-gray-800 transition-colors cursor-pointer">메시지 보내기</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
