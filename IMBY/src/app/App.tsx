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
  website_url?: string;
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
    website_url: p.website_url ?? null,
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
    website_url: '',
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
          {saving ? '저장 중…' : saved ? (
              <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>저장됨</span>
            ) : '저장'}
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
// Articles Admin Section
// ═══════════════════════════════════════════════════════════════════════════════
function ArticlesAdminSection({ onEdit, onNew }: { onEdit: (a: Article) => void; onNew: () => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => dbFetchArticles().then(d => { setArticles(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('삭제할까요?')) return;
    setDeleting(id);
    await dbDeleteArticle(id);
    await load();
    setDeleting(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight">아티클 관리</h2>
        <button onClick={onNew}
          className="flex items-center gap-2 bg-[#0FCD60] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-green-500 transition-colors cursor-pointer">
          + 새 아티클
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-300 text-sm">불러오는 중…</div>
        ) : articles.length === 0 ? (
          <div className="py-16 text-center text-gray-300 text-sm">등록된 아티클이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-6 py-3">#</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">썸네일</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">아티클</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden md:table-cell">슬러그</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden md:table-cell">공개</th>
                <th className="px-6 py-3 w-40" />
              </tr>
            </thead>
            <tbody>
              {articles.map((a, i) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors group"
                  style={{ borderBottom: i < articles.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                  <td className="px-6 py-3 text-xs font-mono text-gray-400">#{String(a.id).padStart(3, '0')}</td>
                  <td className="px-4 py-3">
                    {a.image_url
                      ? <img src={a.image_url} alt={a.title} className="w-14 h-10 object-cover rounded-xl bg-gray-100" />
                      : <div className="w-14 h-10 rounded-xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs">없음</div>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm text-gray-900">{a.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{a.author}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-mono text-gray-400">/article/{a.slug}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: a.published ? 'rgba(15,205,96,0.1)' : 'rgba(0,0,0,0.05)', color: a.published ? '#0FCD60' : '#999' }}>
                      {a.published ? '공개' : '비공개'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => onEdit(a)}
                        className="text-xs font-medium text-gray-500 hover:text-black px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-all cursor-pointer">편집</button>
                      <button onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
                        className="text-xs font-medium text-gray-400 hover:text-red-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 transition-all disabled:opacity-40 cursor-pointer">
                        {deleting === a.id ? '…' : '삭제'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({
  projects,
  onEdit,
  onDelete,
  onNew,
  onClose,
  userEmail,
  onLogout,
  onEditArticle,
}: {
  projects: Project[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => Promise<void>;
  onNew: () => void;
  onClose: () => void;
  userEmail: string;
  onLogout: () => void;
  onEditArticle: (a: Article | null) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('전체');
  const [adminSubTab, setAdminSubTab] = useState<'projects' | 'articles' | 'messages'>('projects');


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

          {/* ── Admin Tabs ── */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-8 w-fit">
            {([['projects', 'PROJECTS'], ['articles', 'ARTICLES'], ['messages', 'MESSAGES']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setAdminSubTab(key as 'projects' | 'articles' | 'messages')}
                className="px-5 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  backgroundColor: adminSubTab === key ? 'white' : 'transparent',
                  color: adminSubTab === key ? '#111' : '#9ca3af',
                  boxShadow: adminSubTab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: "'League Gothic', sans-serif",
                  letterSpacing: '0.06em', fontSize: '0.85rem',
                }}>
                {label}
              </button>
            ))}
          </div>

          {adminSubTab === 'messages' ? (
            <MessagesAdminSection />
          ) : adminSubTab === 'articles' ? (
            <ArticlesAdminSection onEdit={(a) => { onEditArticle(a); }} onNew={() => onEditArticle(null)} />
          ) : (
          <>
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

          </>
          )}

          {/* ── Footer ── */}
          <p className="text-center text-xs text-gray-300 mt-6">IMBY Admin · {projects.length} projects total</p>
        </div>
      </div>
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
async function dbUpsertPress(p: Partial<PressItem>): Promise<void> {
  const { error } = await supabase.from('press').upsert(p);
  if (error) console.error(error);
}
async function dbDeletePress(id: number): Promise<void> {
  await supabase.from('press').delete().eq('id', id);
}

// URL에서 OG 메타데이터 가져오기 — 여러 API 순차 시도
async function fetchOGData(url: string): Promise<{ title: string; description: string; image: string; source: string }> {
  const source = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } })();
  const empty = { title: '', description: '', image: '', source };

  // 1차: microlink.io
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&timeout=10000&retry=3`);
    const data = await res.json();
    if (data.status === 'success' && data.data.title) {
      return {
        title: data.data.title ?? '',
        description: data.data.description ?? '',
        image: data.data.image?.url ?? data.data.screenshot?.url ?? '',
        source,
      };
    }
  } catch {}

  // 2차: jsonlink.io (무료 OG 스크래퍼)
  try {
    const res = await fetch(`https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.title) {
      return {
        title: data.title ?? '',
        description: data.description ?? '',
        image: data.images?.[0] ?? '',
        source,
      };
    }
  } catch {}

  // 3차: opengraph.io (무료 플랜)
  try {
    const res = await fetch(`https://opengraph.io/api/1.1/site/${encodeURIComponent(url)}?app_id=unset`);
    const data = await res.json();
    if (data.openGraph?.title || data.htmlInferred?.title) {
      const og = data.openGraph ?? data.htmlInferred ?? {};
      return {
        title: og.title ?? data.htmlInferred?.title ?? '',
        description: og.description ?? data.htmlInferred?.description ?? '',
        image: og.image?.url ?? og.image ?? '',
        source,
      };
    }
  } catch {}

  // 4차: allorigins 프록시로 직접 HTML 파싱
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();
    if (data.contents) {
      const html = data.contents;
      const getTag = (prop: string) => {
        const m = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
          ?? html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
        return m?.[1] ?? '';
      };
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return {
        title: getTag('og:title') || getTag('twitter:title') || titleMatch?.[1]?.trim() || '',
        description: getTag('og:description') || getTag('twitter:description') || getTag('description') || '',
        image: getTag('og:image') || getTag('twitter:image') || '',
        source,
      };
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
function PressAdminSection({ onClose }: { onClose: () => void }) {
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
    if (!url.trim()) return;
    setFetching(true);
    const og = await fetchOGData(url.trim());
    const source = (() => { try { return new URL(url.trim()).hostname.replace('www.', ''); } catch { return ''; } })();
    const newItem: Partial<PressItem> = {
      title: og.title || '',
      description: og.description || '',
      image_url: og.image || '',
      source_url: url.trim(),
      source_name: og.source || source,
      category,
      published_at: new Date().toISOString().split('T')[0],
      sort_order: items.length,
    };
    setFetching(false);
    setUrl('');
    // 제목이 있으면 바로 저장, 없으면 편집 폼으로
    if (newItem.title) {
      await dbUpsertPress(newItem);
      await load();
    } else {
      setPendingItem(newItem);
    }
  };

  const handlePendingSave = async () => {
    if (!pendingItem) return;
    await dbUpsertPress(pendingItem);
    setPendingItem(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제할까요?')) return;
    setDeleting(id);
    await dbDeletePress(id);
    await load();
    setDeleting(null);
  };

  const handleEdit = (item: PressItem) => { setEditingId(item.id); setEditForm(item); };
  const handleEditSave = async () => {
    await dbUpsertPress(editForm);
    setEditingId(null);
    await load();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-white overflow-y-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-400 hover:text-black cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          뒤로
        </button>
        <span className="text-xs font-bold text-[#0FCD60] tracking-widest uppercase">PRESS 관리</span>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* URL 추가 */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-8">
          <h3 className="text-sm font-bold mb-4">기사 URL로 자동 추가</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">기사 URL</label>
              <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="https://example.com/news/article"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">타입</label>
              <div className="flex gap-1 p-0.5 bg-gray-200 rounded-xl">
                {(['news', 'notice'] as const).map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    style={{ backgroundColor: category === c ? 'white' : 'transparent', color: category === c ? '#111' : '#9ca3af' }}>
                    {c === 'news' ? '뉴스' : '공지'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAdd} disabled={fetching || !url.trim()}
              className="flex items-center gap-2 bg-[#0FCD60] text-white text-xs font-bold px-5 py-3 rounded-xl hover:bg-green-500 transition-colors disabled:opacity-40 cursor-pointer">
              {fetching ? '가져오는 중…' : '+ 추가'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">URL 입력 시 제목·설명·이미지를 자동으로 가져옵니다. 자동 추출 실패 시 직접 입력할 수 있어요.</p>
          {/* OG 추출 실패 시 수동 입력 폼 */}
          {pendingItem !== null && (
            <div className="mt-5 p-5 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs font-bold text-yellow-600 mb-3 uppercase tracking-widest">자동 추출 실패 — 직접 입력해 주세요</p>
              <div className="flex flex-col gap-3">
                <input value={pendingItem.title ?? ''} onChange={e => setPendingItem(p => p ? { ...p, title: e.target.value } : p)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium" placeholder="기사 제목 *" />
                <textarea value={pendingItem.description ?? ''} onChange={e => setPendingItem(p => p ? { ...p, description: e.target.value } : p)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={3} placeholder="내용 요약" />
                <input value={pendingItem.image_url ?? ''} onChange={e => setPendingItem(p => p ? { ...p, image_url: e.target.value } : p)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" placeholder="이미지 URL (선택)" />
                <div className="flex gap-2">
                  <button onClick={handlePendingSave} disabled={!pendingItem.title?.trim()}
                    className="bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer disabled:opacity-40">저장</button>
                  <button onClick={() => setPendingItem(null)} className="text-xs text-gray-400 px-4 py-2 rounded-lg hover:bg-gray-100 cursor-pointer">취소</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-300 text-sm">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-gray-300 text-sm">등록된 press가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <div key={item.id} className="p-5">
                  {editingId === item.id ? (
                    <div className="flex flex-col gap-3">
                      <input value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium" placeholder="제목" />
                      <textarea value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" rows={3} placeholder="설명" />
                      <div className="flex gap-2">
                        <input value={editForm.image_url ?? ''} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs" placeholder="이미지 URL" />
                        <input value={editForm.source_name ?? ''} onChange={e => setEditForm(f => ({ ...f, source_name: e.target.value }))}
                          className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-xs" placeholder="출처명" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleEditSave} className="bg-black text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer">저장</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 px-4 py-2 rounded-lg hover:bg-gray-100 cursor-pointer">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      {item.image_url && <img src={item.image_url} alt="" className="w-20 h-14 object-cover rounded-lg shrink-0 bg-gray-100" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: item.category === 'news' ? 'rgba(15,205,96,0.1)' : 'rgba(0,0,0,0.06)', color: item.category === 'news' ? '#0FCD60' : '#666' }}>
                            {item.category === 'news' ? 'NEWS' : 'NOTICE'}
                          </span>
                          <span className="text-xs text-gray-400">{item.source_name}</span>
                        </div>
                        <p className="font-semibold text-sm leading-snug truncate">{item.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => handleEdit(item)}
                          className="text-xs text-gray-400 hover:text-black px-3 py-1.5 border border-gray-200 rounded-lg cursor-pointer">편집</button>
                        <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                          className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 border border-gray-200 hover:border-red-200 rounded-lg disabled:opacity-40 cursor-pointer">
                          {deleting === item.id ? '…' : '삭제'}
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
          .press-row { border-bottom: 1px solid #e5e7eb; }
          .press-row:hover { background: #fafafa; }
          @keyframes pressFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {/* 상단 */}
        <div className="flex flex-col md:flex-row w-full px-6 md:px-12 pt-28 pb-14 gap-10">
          {/* 왼쪽: 소개 */}
          <div className="w-full md:w-1/2 flex flex-col justify-between" style={{ minHeight: 180 }}>
            {/* 4초마다 기사 제목 자동 전환 */}
            <div className="flex-1 flex items-start">
              {items.length > 0 ? (
                <p
                  key={sliderIndex}
                  className="text-2xl md:text-[2rem] leading-tight font-normal tracking-tight cursor-pointer hover:opacity-60 transition-opacity"
                  style={{ fontFamily: 'Pretendard, -apple-system, sans-serif', animation: 'pressFadeIn 0.6s ease' }}
                  onClick={() => items[safeSliderIndex]?.source_url && window.open(items[safeSliderIndex].source_url, '_blank')}
                >
                  {items[safeSliderIndex]?.title}
                </p>
              ) : (
                <p className="text-2xl md:text-[2rem] leading-tight font-normal tracking-tight text-gray-300"
                  style={{ fontFamily: 'Pretendard, -apple-system, sans-serif' }}>
                  IMBY Press
                </p>
              )}
            </div>
            <div className="flex gap-6 text-lg font-normal mt-6">
              {isAdmin && (
                <button onClick={() => setShowAdmin(true)}
                  className="flex items-center gap-1.5 hover:opacity-50 transition-opacity underline decoration-1 underline-offset-4 cursor-pointer text-[#0FCD60]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Press 관리
                </button>
              )}
            </div>
          </div>

          {/* 오른쪽: 슬라이더 */}
          <div className="w-full md:w-1/2 transition-opacity duration-300">
            {loading ? (
              <div className="w-full aspect-video bg-gray-100 animate-pulse rounded" />
            ) : (sliderItems.length > 0 && currentSlide) ? (
              <>
                <div
                  className="w-full aspect-video bg-gray-100 overflow-hidden relative cursor-pointer"
                  onClick={() => currentSlide.source_url ? window.open(currentSlide.source_url, '_blank') : null}
                >
                  {currentSlide.image_url
                    ? <img src={currentSlide.image_url} alt={currentSlide.title} className="w-full h-full object-cover transition-opacity duration-500" />
                    : <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white/30 text-xs uppercase tracking-widest">No Image</div>
                  }
                </div>
                <div className="flex justify-between items-start text-sm mt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{safeSliderIndex + 1} / {sliderItems.length}</span>
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
        <div className="w-full px-6 md:px-12 pb-16">
          {!loading && items.length > 0 && (
            <>
              <div className="flex border-b border-black pb-2 mb-6">
                <span className="text-[11px] font-bold text-black uppercase tracking-widest"
                  style={{ fontFamily: 'Pretendard, -apple-system, sans-serif' }}>NEWS</span>
              </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 mb-20">
              {items.map(item => (
                <div key={item.id} className="flex flex-col cursor-pointer group"
                  onClick={() => item.source_url && window.open(item.source_url, '_blank')}>
                  {/* 이미지 */}
                  <div className="w-full aspect-video bg-gray-100 overflow-hidden mb-3">
                    {item.image_url
                      ? <img src={item.image_url} alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-300 text-xs">No Image</div>
                    }
                  </div>
                  {/* 제목 */}
                  <p className="text-sm font-bold text-black leading-snug mb-1.5 group-hover:opacity-60 transition-opacity line-clamp-2"
                    style={{ fontFamily: 'Pretendard, -apple-system, sans-serif' }}>
                    {item.title}
                  </p>
                  {/* 날짜 */}
                  <p className="text-xs text-gray-400"
                    style={{ fontFamily: 'Pretendard, -apple-system, sans-serif' }}>
                    {item.published_at ? new Date(item.published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                  </p>
                </div>
              ))}
            </div>
            </>
          )}
        </div>

        {/* 테이블 리스트 */}
        <div className="w-full px-6 md:px-12 pb-24 mt-4">
          {/* 헤더 */}
          <div className="flex border-b border-black pb-2 text-[11px] font-semibold text-black uppercase tracking-widest mb-1">
            <div className="w-[50%]">Title</div>
            <div className="w-[20%]">Type</div>
            <div className="w-[20%]">Source</div>
            <div className="w-[10%] text-right">Year</div>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-300 text-sm">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-gray-300 text-sm">등록된 press가 없습니다.</div>
          ) : (
            <div className="flex flex-col">
              {items.map(item => (
                <React.Fragment key={item.id}>
                  {/* 행 */}
                  <div
                    className="press-row flex py-3.5 cursor-pointer transition-colors duration-150 group"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <div className="w-[50%] pr-4 truncate group-hover:underline decoration-1 underline-offset-4 font-bold text-sm text-black">{item.title}</div>
                    <div className="w-[20%] pr-4 text-sm font-semibold text-black">{item.category === 'news' ? 'Press' : 'Notice'}</div>
                    <div className="w-[20%] pr-4 text-sm font-semibold text-black truncate">{item.source_name}</div>
                    <div className="w-[10%] text-right text-sm font-semibold text-black">
                      {item.published_at ? new Date(item.published_at).getFullYear() : ''}
                    </div>
                  </div>
                  {/* 펼쳐지는 상세 */}
                  {expandedId === item.id && (
                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-5 flex flex-col md:flex-row gap-6 mb-1"
                      style={{ animation: 'pressFadeIn 0.3s ease' }}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title}
                          className="w-full md:w-48 h-32 object-cover rounded-lg shrink-0 bg-gray-100" />
                      )}
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <p className="font-bold text-base text-black mb-2 leading-snug">{item.title}</p>
                          {item.description && (
                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{item.description}</p>
                          )}
                        </div>
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                            className="mt-4 flex items-center gap-1.5 text-xs font-bold border border-black px-4 py-2 hover:bg-black hover:text-white transition-all w-fit cursor-pointer">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            자세히 보기 — {item.source_name}
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

// ═══════════════════════════════════════════════════════════════════════════════
// Article Types & DB helpers
// ═══════════════════════════════════════════════════════════════════════════════
interface Article {
  id: number;
  slug: string;
  title: string;
  author: string;
  country: string;
  image_url: string;
  content: string;
  bg_color: string;
  published: boolean;
  sort_order: number;
}

async function dbFetchArticles(): Promise<Article[]> {
  const { data, error } = await supabase.from('articles').select('*').order('sort_order', { ascending: true });
  if (error) { console.error(error); return []; }
  return (data ?? []) as Article[];
}
async function dbUpsertArticle(a: Partial<Article> & { id?: number }): Promise<Article | null> {
  const { data, error } = await supabase.from('articles').upsert(a).select().single();
  if (error) { console.error(error); return null; }
  return data as Article;
}
async function dbDeleteArticle(id: number): Promise<void> {
  await supabase.from('articles').delete().eq('id', id);
}

function ShareButton({ onClick, label, icon, successLabel }: {
  onClick: () => Promise<void>;
  label: string;
  icon: React.ReactNode;
  successLabel: string;
}) {
  const [success, setSuccess] = React.useState(false);
  const handle = async () => {
    await onClick();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border transition-all cursor-pointer"
      style={{
        borderColor: success ? '#0FCD60' : '#e5e7eb',
        color: success ? '#0FCD60' : '#4b5563',
        backgroundColor: success ? 'rgba(15,205,96,0.06)' : 'white',
      }}
    >
      {icon}
      {success ? successLabel : label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Article Detail Page (전체화면, URL 공유용)
// ═══════════════════════════════════════════════════════════════════════════════
function ArticleDetailPage({ article, onClose }: { article: Article; onClose: () => void }) {
  useEffect(() => {
    window.history.pushState({}, '', `/article/${article.slug}`);
    return () => { window.history.pushState({}, '', '/'); };
  }, [article.slug]);

  return (
    <div className="fixed inset-0 z-[600] bg-white overflow-y-auto" style={{ animation: 'fadeIn 0.4s ease', userSelect: 'text', cursor: 'auto' }}>

      <div className="flex flex-col md:flex-row min-h-screen">
        {/* 왼쪽: 이미지 */}
        <div className="w-full md:w-5/12 md:h-screen md:sticky md:top-0 relative flex flex-col justify-end p-10 text-white min-h-[50vh]"
          style={{ backgroundImage: `url(${article.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-bold text-white/60 uppercase tracking-widest">#{String(article.id).padStart(3, '0')}</span>
              <span className="text-xs text-white/40">·</span>
              <span className="text-xs text-white/60 uppercase tracking-widest">{article.country}</span>
            </div>
            <h1 className="text-3xl md:text-5xl mb-3 leading-tight" style={{ fontFamily: "Pretendard, -apple-system, sans-serif", fontWeight: 800 }}>{article.title}</h1>
            <p className="text-lg text-white/80 font-bold">by {article.author}</p>
          </div>
        </div>
        {/* 오른쪽: 본문 */}
        <div className="w-full md:w-7/12 flex flex-col bg-[#fafafa]">
          <div className="flex-1 px-10 py-16 md:py-24 max-w-2xl">
            {article.content
              ? <div className="project-content text-gray-800 text-lg leading-relaxed font-light"
                  dangerouslySetInnerHTML={{ __html: article.content }} />
              : <span className="text-gray-300 italic">아직 작성된 내용이 없습니다.</span>
            }
          </div>
          {/* 공유 */}
          <div className="px-10 py-8 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">공유하기</p>
            <div className="flex flex-wrap gap-3">
              {/* 링크 복사 */}
              <ShareButton
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                }}
                label="링크 복사"
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}
                successLabel="복사됨"
              />
              {/* 카카오톡 */}
              <a
                href={`https://story.kakao.com/share?url=${encodeURIComponent(window.location.href)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-gray-600 hover:text-yellow-700"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.68 5.07 4.2 6.48L5.4 21l4.2-2.4c.78.12 1.59.18 2.4.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/></svg>
                카카오
              </a>
              {/* X(트위터) */}
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(article.title + ' by ' + article.author)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-all text-gray-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                X
              </a>
              {/* 네이티브 공유 (모바일) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={() => navigator.share({ title: article.title, text: `${article.title} by ${article.author}`, url: window.location.href })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border border-gray-200 hover:border-gray-400 transition-all text-gray-600 cursor-pointer"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  더 보기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Article Editor (관리자용 — 프로젝트 에디터와 유사한 풀스크린)
// ═══════════════════════════════════════════════════════════════════════════════
function ArticleEditorPage({
  article,
  onSave,
  onDelete,
  onClose,
}: {
  article: Article | null;
  onSave: (a: Partial<Article>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const isNew = !article;
  const [form, setForm] = useState<Partial<Article>>(article ?? {
    slug: '', title: '', author: '', country: '', image_url: '', content: '', bg_color: '#e3d5ca', published: true,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof Article, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { set('image_url', await uploadImage(file, 'articles')); }
    catch { alert('업로드 실패'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) return alert('제목을 입력해주세요.');
    // 슬러그 자동 생성
    if (!form.slug?.trim()) {
      form.slug = form.title.toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now().toString(36);
    }
    setSaving(true);
    await onSave(form);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[400] bg-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-gray-100 bg-white shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-gray-400 hover:text-black transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          뒤로
        </button>
        <span className="text-gray-200">|</span>
        <span className="text-xs font-bold text-[#0FCD60] tracking-widest uppercase">{isNew ? 'NEW ARTICLE' : 'EDIT ARTICLE'}</span>
        <div className="flex-1" />
        {!isNew && onDelete && (
          <button onClick={async () => { if (confirm('삭제할까요?')) { await onDelete(article!.id); onClose(); } }}
            className="text-sm text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer">삭제</button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-black text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer">
          {saving ? '저장 중…' : saved ? (
              <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>저장됨</span>
            ) : '저장'}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Meta */}
        <div className="w-72 shrink-0 border-r border-gray-100 overflow-y-auto p-6 flex flex-col gap-5">
          {/* 이미지 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">대표 이미지</label>
            {form.image_url
              ? <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 mb-2">
                  <img src={form.image_url} alt="thumb" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => set('image_url', '')}
                    className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-black cursor-pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
              : <div className="w-full aspect-video rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-sm mb-2">미리보기 없음</div>
            }
            <label className="cursor-pointer block">
              <input type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
              <span className="block text-center border-2 border-dashed border-gray-200 rounded-xl py-2 text-xs text-gray-400 hover:border-[#0FCD60] hover:text-[#0FCD60] transition-colors cursor-pointer">
                {uploading ? '업로드 중…' : <span className="flex items-center justify-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>파일 선택</span>}
              </span>
            </label>
            <input type="text" value={form.image_url?.startsWith('data:') ? '' : (form.image_url ?? '')} onChange={e => set('image_url', e.target.value)}
              placeholder="또는 URL 입력" className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">제목 *</label>
            <input type="text" value={form.title ?? ''} onChange={e => set('title', e.target.value)}
              placeholder="아티클 제목" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium" />
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">작성자</label>
            <input type="text" value={form.author ?? ''} onChange={e => set('author', e.target.value)}
              placeholder="작성자 이름" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          </div>

          {/* BG Color */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">배경 색상</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={form.bg_color ?? '#e3d5ca'} onChange={e => set('bg_color', e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
              <input type="text" value={form.bg_color ?? ''} onChange={e => set('bg_color', e.target.value)}
                className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono" />
            </div>
          </div>


        </div>

        {/* Right: Rich Content Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 pt-6 pb-2 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">본문 내용</p>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <RichEditor value={form.content ?? ''} onChange={v => set('content', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Article Page — Interactive Gallery
// ═══════════════════════════════════════════════════════════════════════════════
function ArticlePage({ isAdmin, onOpenEditor }: { isAdmin: boolean; onOpenEditor: (a: Article | null) => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const [transform, setTransform] = useState({ x: 100, y: 100, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [isViewAll, setIsViewAll] = useState(false);
  const [prevTransform, setPrevTransform] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const CANVAS_WIDTH = 1472;
  const CANVAS_HEIGHT = 1152;

  useEffect(() => {
    dbFetchArticles().then(data => { setArticles(data); setLoading(false); });
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hoveredArticle = articles.find(a => a.id === hoveredId);
  const currentBgColor = hoveredArticle ? '#000000' : '#f9fafb';

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (selectedArticle) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setStartPan({ x: transform.x, y: transform.y });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setTransform(prev => ({ ...prev, x: startPan.x + clientX - dragStart.x, y: startPan.y + clientY - dragStart.y }));
  };

  const handlePointerUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (selectedArticle) return;
    const scaleFactor = Math.exp(-e.deltaY * 0.002);
    let newScale = Math.max(0.15, Math.min(3.5, transform.scale * scaleFactor));
    if (newScale === transform.scale) return;
    const mouseX = (e.clientX - transform.x) / transform.scale;
    const mouseY = (e.clientY - transform.y) / transform.scale;
    setTransform({ x: e.clientX - mouseX * newScale, y: e.clientY - mouseY * newScale, scale: newScale });
    setIsViewAll(false);
  };

  const handleItemClick = (e: React.MouseEvent | React.TouchEvent, article: Article) => {
    const clientX = 'clientX' in e ? e.clientX : e.changedTouches[0].clientX;
    const clientY = 'clientY' in e ? e.clientY : e.changedTouches[0].clientY;
    if (Math.hypot(clientX - dragStart.x, clientY - dragStart.y) > 5) return;
    setSelectedArticle(article);
  };

  const handleViewAllToggle = () => {
    if (isViewAll) {
      setIsViewAll(false);
      setTransform(prevTransform || { x: 100, y: 100, scale: 1 });
    } else {
      setIsViewAll(true);
      setPrevTransform({ ...transform });
      const padding = Math.min(windowSize.width * 0.08, 100);
      const cols = Math.ceil(Math.sqrt(articles.length));
      const cw = cols * 320 + (cols - 1) * 64;
      const rows = Math.ceil(articles.length / cols);
      const ch = rows * 320 + (rows - 1) * 96;
      const newScale = Math.min((windowSize.width - padding * 2) / Math.max(cw, 1), (windowSize.height - padding * 2) / Math.max(ch, 1), 1);
      setTransform({ x: (windowSize.width - Math.max(cw, CANVAS_WIDTH) * newScale) / 2, y: (windowSize.height - Math.max(ch, CANVAS_HEIGHT) * newScale) / 2, scale: newScale });
    }
  };

  // 전체 열 수 계산
  const colCount = Math.min(4, articles.length || 1);
  const isMobileView = windowSize.width <= 768;

  // 모바일: 드래그 없이 세로 그리드
  if (isMobileView) {
    return (
      <div className="w-screen min-h-screen bg-[#f9fafb] font-sans pb-24 pt-4 px-4">
        {selectedArticle && <ArticleDetailPage article={selectedArticle} onClose={() => setSelectedArticle(null)} />}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-300 text-sm">불러오는 중&#8230;</div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-300">
            <p className="text-sm">등록된 아티클이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {articles.map(article => (
              <div key={article.id} className="flex flex-col cursor-pointer"
                onClick={() => setSelectedArticle(article)}>
                <div className="w-full aspect-square overflow-hidden bg-white/10 rounded-lg shadow-sm">
                  <img src={article.image_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800"}
                    alt={article.title} className="w-full h-full object-cover" draggable={false} />
                </div>
                <div className="mt-2">
                  <h3 style={{ fontFamily: "Pretendard, -apple-system, sans-serif", fontWeight: 800, fontSize: "0.88rem", color: "#111", lineHeight: 1.3 }}>{article.title}</h3>
                  {article.author && <p className="text-gray-400 text-xs mt-0.5 font-semibold">by {article.author}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <button onClick={e => { e.stopPropagation(); onOpenEditor(null); }}
            className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 bg-[#0FCD60] text-white px-4 py-2.5 rounded-full text-sm font-medium shadow-lg cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            새 아티클
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-screen h-screen overflow-hidden relative font-sans select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ backgroundColor: currentBgColor, transition: "background-color 0.7s ease-in-out" }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* 하단 중앙 버튼 그룹 */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 p-1.5 article-bar-group"
        style={{
          borderRadius: '9999px',
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}>
        {/* 전체보기/캔버스뷰 토글 */}
        <button
          onClick={e => { e.stopPropagation(); handleViewAllToggle(); }}
          className="article-view-btn flex items-center px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 group"
          style={{ cursor: 'pointer' }}
        >
          <img
            src={isViewAll ? "/article-button2.png" : "/article-button1.png"}
            alt={isViewAll ? '캔버스 뷰' : '전체 보기'}
            className="article-view-img"
            style={{ height: 16, width: 'auto', objectFit: 'contain' }}
          />
        </button>
        {/* 관리자: 새 아티클 */}
        {isAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onOpenEditor(null); }}
            className="flex items-center gap-2 px-5 py-2 rounded-full font-medium transition-all hover:scale-105 active:scale-95 bg-[#0FCD60] text-white"
            style={{ cursor: 'pointer', fontSize: '0.88rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            새 아티클
          </button>
        )}
      </div>

      {/* 캔버스 */}
      {loading ? (
        <div className="flex items-center justify-center w-full h-full text-gray-300 text-sm">불러오는 중…</div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-gray-300">
          <p className="text-sm">등록된 아티클이 없습니다.</p>
          {isAdmin && <button onClick={() => onOpenEditor(null)} className="text-xs text-[#0FCD60] border border-[#0FCD60] px-4 py-2 rounded-full cursor-pointer">+ 첫 아티클 작성</button>}
        </div>
      ) : (
        <div
          className="absolute top-0 left-0"
          style={{
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div className={`grid gap-x-16 gap-y-24 w-full h-full`} style={{ gridTemplateColumns: `repeat(${colCount}, 320px)` }}>
            {articles.map(article => (
              <div
                key={article.id}
                className={`flex flex-col group transition-transform duration-300 ${!isDragging ? 'hover:-translate-y-2 cursor-pointer' : ''}`}
                onMouseEnter={() => !isDragging && setHoveredId(article.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={e => handleItemClick(e, article)}
              >
                <div className="relative overflow-hidden w-[320px] h-[320px] shadow-lg group-hover:shadow-2xl transition-shadow duration-300 bg-white/10">
                  <img src={article.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800'} alt={article.title}
                    className="w-full h-full object-cover pointer-events-none" draggable={false} />

                  {/* 관리자: 편집 버튼 */}
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); onOpenEditor(article); }}
                      className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    ><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 편집</button>
                  )}
                </div>
                {/* 이미지 바로 아래 info — 프로젝트 갤러리와 동일한 방식 */}
                <div className="mt-5 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-[320px]">
                  <h3 style={{ fontFamily: "Pretendard, -apple-system, sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "white" }}>{article.title}</h3>
                  <p className="text-gray-400 mt-1 text-sm font-semibold">by {article.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* 아티클 전체화면 뷰어 */}
      {selectedArticle && (
        <ArticleDetailPage article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
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
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 550, fontFamily: '-apple-system, sans-serif', lineHeight: 1 }}>{count}</span>
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
        <div className="w-12 h-12 rounded-full bg-[#0FCD60] flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p className="text-lg font-medium text-black">메시지가 전송되었습니다.</p>
        <p className="text-sm text-gray-400">곧 답변 드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">이름 / 회사명</label>
        <input type="text" required value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm" placeholder="John Doe" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">회신받을 이메일</label>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm" placeholder="john@example.com" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">문의 내용</label>
        <textarea required rows={4} value={message} onChange={e => setMessage(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm resize-none"
          placeholder="프로젝트 내용이나 궁금하신 점을 자유롭게 적어주세요." />
      </div>
      <button type="submit" disabled={sending}
        className="w-full bg-black text-white font-medium py-4 rounded-lg mt-2 hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50">
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
          font-family: 'League Gothic', sans-serif;
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
              <h2 style={{ fontFamily: "'League Gothic', sans-serif", fontSize: '1.7rem', letterSpacing: '0.1em', fontWeight: 400, lineHeight: 1, color: '#111', margin: 0 }}>
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
type AppView = 'site' | 'editor' | 'admin' | 'article-editor';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  // URL 기반 초기 탭 설정
  const getInitialTab = (): 'projects' | 'press' | 'contact' | 'article' => {
    const path = window.location.pathname;
    if (path.startsWith('/press')) return 'press';
    if (path.startsWith('/contact')) return 'contact';
    if (path.startsWith('/article')) return 'article';
    return 'projects';
  };
  const [activeTab, setActiveTab] = useState<'projects' | 'press' | 'contact' | 'article' | null>(getInitialTab());
  const [selectedProjectIndex, setSelectedProjectIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // View routing
  const [view, setView] = useState<AppView>('site');
  const prevTabRef = useRef<'projects' | 'press' | 'contact' | 'article'>('projects'); // admin 진입 전 탭 기억
  const [editingProject, setEditingProject] = useState<Project | null>(null); // null = new
  const [editingArticle, setEditingArticle] = useState<Article | null | undefined>(undefined); // undefined=closed, null=new

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

  const returnToSite = (tab: 'projects' | 'press' | 'contact' | 'article' = 'projects') => {
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
    const paths: Record<string, string> = { projects: '/projects', press: '/press', contact: '/contact', article: '/article' };
    window.history.pushState({}, '', paths[tab] || '/projects');
  };
  useEffect(() => { uiStateRef.current = { activeTab, selectedProjectIndex }; }, [activeTab, selectedProjectIndex]);

  // 페이지별 동적 title/description (SEO — 사이트링크 노출 가능성 향상)
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
      article: {
        title: 'Article — IMBY',
        description: 'IMBY가 전하는 인사이트와 아티클을 만나보세요. 브랜드와 광고, 캠페인에 대한 이야기를 다룹니다.',
      },
      contact: {
        title: 'Contact — IMBY',
        description: '새로운 프로젝트나 협업 제안이 있으신가요? IMBY에 문의해 주세요.',
      },
    };

    const path = window.location.pathname;
    const isRoot = path === '/' || path === '/intro';
    const seo = isRoot
      ? { title: 'IMBY — Insight Agency', description: '소비자와 기업 모두가 즐거운 광고 문화, 사회적 임팩트가 있는 단 하나의 크리에이티브 솔루션' }
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
      if (path.startsWith('/article/')) return; // ArticleDetailPage가 자체 처리
      setSelectedProjectIndex(null);
      if (path.startsWith('/press')) setActiveTab('press');
      else if (path.startsWith('/contact')) setActiveTab('contact');
      else if (path.startsWith('/article')) setActiveTab('article');
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

  // ── Gallery loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current;
    const isMobile = window.innerWidth <= 768;
    if (activeTab === 'projects' && selectedProjectIndex === null) {
      s.isGalleryActive = true; s.mouseX = window.innerWidth / 2;

      if (isMobile) {
        // 모바일: CSS 자연 스크롤로 위임 — JS 루프 불필요
        if (galleryTrackRef.current) {
          galleryTrackRef.current.style.transform = 'none';
        }
        if (galleryWrapperRef.current) {
          galleryWrapperRef.current.style.overflowY = 'auto';
          galleryWrapperRef.current.style.overflowX = 'hidden';
        }
      } else {
        // 데스크탑: 마우스 X 기반 가로 슬라이드
        if (galleryWrapperRef.current) {
          galleryWrapperRef.current.style.overflowY = '';
          galleryWrapperRef.current.style.overflowX = '';
        }
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
      }
    } else { s.isGalleryActive = false; }
    return () => { cancelAnimationFrame(s.galleryAnimationId); };
  }, [activeTab, selectedProjectIndex]);

  const handleTabClick = (tab: 'projects' | 'press' | 'contact' | 'article') => {
    setActiveTab(tab);
    setSelectedProjectIndex(null);
    const paths: Record<string, string> = {
      projects: '/projects',
      press: '/press',
      contact: '/contact',
      article: '/article',
    };
    window.history.pushState({}, '', paths[tab] || '/projects');
  };

  // ── Render overlay views ───────────────────────────────────────────────────
  if (view === 'article-editor') {
    return (
      <ArticleEditorPage
        article={editingArticle ?? null}
        onSave={async (a) => {
          const saved = await dbUpsertArticle(a);
          if (saved) setEditingArticle(undefined);
        }}
        onDelete={async (id) => { await dbDeleteArticle(id); }}
        onClose={() => { setEditingArticle(undefined); returnToSite('article'); }}
      />
    );
  }

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
        onEditArticle={(a) => { setEditingArticle(a); setView('article-editor'); }}
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
        #sub-menu { position: fixed; top: 8rem; left: 2.5rem; display: flex; flex-direction: column; gap: 0.25rem; opacity: 0; pointer-events: none; transform: translateY(-10px); transition: all 0.4s ease; z-index: 40; font-size: 1.15rem; font-family: 'League Gothic', sans-serif; letter-spacing: 0.05em; }
        #sub-menu.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
        #sub-menu a { position: relative; width: fit-content; transition: all 0.2s ease; transform-origin: left; color: inherit; }
        #sub-menu a::before { content: ''; position: absolute; left: -14px; top: 50%; transform: translateY(-50%); border-top: 4px solid transparent; border-bottom: 4px solid transparent; border-left: 6px solid #0FCD60; opacity: 0; transition: opacity 0.2s ease; }
        #sub-menu a.active::before { opacity: 1; }
        #sub-menu a:hover, #sub-menu a.active { transform: translateX(14px); }
        .filter-label { height: 28px; width: auto; object-fit: contain; display: block; filter: brightness(0); transition: filter 0.2s ease; }
        #sub-menu a:hover .filter-label, #sub-menu a.active .filter-label { filter: brightness(0) saturate(100%) invert(58%) sepia(97%) saturate(400%) hue-rotate(95deg) brightness(95%); }
        .glass-nav { position: fixed; top: 1.5rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.15rem; padding: 0.3rem; border-radius: 9999px; background: rgba(255,255,255,0.55); backdrop-filter: blur(28px) saturate(180%); -webkit-backdrop-filter: blur(28px) saturate(180%); border: 1px solid rgba(255,255,255,0.85); box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9); z-index: 250; opacity: 0; pointer-events: none; transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .glass-nav.visible { opacity: 1; pointer-events: auto; }
        .glass-nav button { font-family: 'League Gothic', sans-serif; font-weight: 400; font-size: 1.05rem; letter-spacing: 0.06em; padding: 0.42rem 1.3rem; border-radius: 9999px; color: #000; background-color: transparent; transition: background-color 0.35s cubic-bezier(0.16, 1, 0.3, 1), color 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; position: relative; }
        .glass-nav button:hover { transform: scale(1.04); }
        .glass-nav button.active { background-color: #0FCD60; color: #fff; box-shadow: 0 2px 12px rgba(15,205,96,0.35), inset 0 1px 0 rgba(255,255,255,0.2); transform: scale(1.0); }
        .glass-nav button:active { transform: scale(0.97); }
        .nav-label { height: 18px; width: auto; object-fit: contain; display: block; filter: brightness(0); transition: filter 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .glass-nav button.active .nav-label, .glass-nav button:hover .nav-label { filter: brightness(0) invert(1); }
        .site-logo { position: fixed; top: 2.875rem; left: 2rem; transform: translateY(-50%); z-index: 300; opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
        .site-logo.visible { opacity: 1; pointer-events: auto; }
        .intro-layer { position: absolute; inset: 0; will-change: transform, opacity; }
        .intro-typo { font-family: 'Inter', -apple-system, sans-serif; font-size: clamp(1.6rem, 3.5vw, 3rem); font-weight: 500; line-height: 1.45; letter-spacing: -0.02em; color: inherit; }
        #intro-img-container { width: 0vw; height: 0vh; will-change: width, height; overflow: hidden; border-radius: 50%; }
        @media (max-width: 768px) {
          /* ── 인트로 ── */
          #intro-img-container { width: 0vw; height: 0vh; }
          .boy-img { width: clamp(70px, 28vw, 140px); }
          #intro-progress-bar { height: 2px; }

          /* ── logo & admin ── */
          .site-logo { top: 1.4rem !important; left: 1.2rem !important; transform: none !important; }
          #admin-btn-wrapper { top: 1.4rem !important; right: 1.2rem !important; transform: none !important; }

          /* ── Glass nav: 하단 고정, 1.4배 ── */
          /* 모바일 nav: 데스크탑과 완전히 동일한 구조 그대로 하단 배치 */
          .glass-nav {
            top: auto !important;
            bottom: 1.4rem !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            /* 데스크탑과 동일한 내부 값 유지 */
            gap: 0.15rem !important;
            padding: 0.3rem !important;
            white-space: nowrap !important;
          }
          /* 버튼 padding 데스크탑과 동일 */
          .glass-nav button { padding: 0.42rem 1.3rem !important; }
          /* PNG 높이 데스크탑과 동일 */
          .nav-label { height: 18px !important; width: auto !important; object-fit: contain !important; display: block !important; }

          /* ── Projects: 필터 한 줄 (logo 아래) ── */
          #sub-menu {
            top: 3.8rem !important;
            bottom: auto !important;
            left: 0 !important;
            right: 0 !important;
            width: 100vw !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 1.2rem !important;
            padding: 0.9rem 1rem !important;
            background: rgba(255,255,255,0.92) !important;
            backdrop-filter: blur(12px) !important;
            -webkit-backdrop-filter: blur(12px) !important;
            z-index: 200 !important;
            transform: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          #sub-menu.open {
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          #sub-menu a { transform: none !important; font-style: normal !important; }
          .filter-label { height: 16px !important; }

          #gallery-wrapper {
            align-items: flex-start !important;
            padding-top: 12vw !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          #gallery-track {
            flex-direction: column !important;
            align-items: center !important;
            gap: 7vh !important;
            padding: 2vh 0 14vh 0 !important;
            width: 100vw !important;
          }
          .gallery-img { height: auto !important; width: 82vw !important; max-width: 82vw !important; aspect-ratio: 4/3 !important; object-fit: cover !important; }
          .gallery-info { opacity: 1 !important; transform: none !important; position: relative !important; margin-top: 0.8rem !important; }

          /* ── Project detail ── */
          .project-detail-header h1 { font-size: 2rem; }

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

          /* ── Intro slide3: ment3 상단, info3 하단 (slide2와 동일 패턴) ── */
          #ment3-wrap {
            top: 8vh !important;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: 92vw !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            align-items: center !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          #ment3-wrap img { width: 92vw !important; }
          #info3-1-img, #info3-2-img {
            top: auto !important;
            bottom: 0 !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            height: clamp(378px, 74vh, 810px) !important;
            width: auto !important;
            max-width: 90vw !important;
            object-fit: contain !important;
          }
        }
        #intro-img { transform: scale(1.3); will-change: transform; }
        .fullscreen-modal { scrollbar-width: none; }
        .fullscreen-modal[aria-hidden="true"] { visibility: hidden; transition: transform 0.8s cubic-bezier(0.16,1,0.3,1), visibility 0s 0.8s; }
        .fullscreen-modal[aria-hidden="false"] { visibility: visible; }
        @media (max-width: 768px) { .fullscreen-modal { padding-top: 0 !important; } }
        .fullscreen-modal::-webkit-scrollbar { display: none; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #0FCD60 !important; box-shadow: 0 0 0 1px #0FCD60 !important; }
        .edit-btn { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.75); color: white; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 600; opacity: 0; transition: opacity 0.2s; cursor: pointer; z-index: 10; }
        .gallery-item:hover .edit-btn { opacity: 1; }
        .project-content img { max-width: 100%; height: auto; }
        .project-content ul { list-style: disc; padding-left: 1.5em; }
        .article-view-img { transition: filter 0.2s ease; }
        .article-bar-group:hover { background: rgba(0,0,0,0.85) !important; border-color: rgba(0,0,0,0.2) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        .article-bar-group:hover .article-view-img { filter: invert(1); }
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

      {/* Site Logo */}
      <div ref={siteLogoRef} id="site-logo" className="site-logo">
        <a href="/intro" style={{ display: 'block', cursor: 'pointer' }}>
          <img src="/logo.png" alt="IMBY" className="h-5 md:h-6 w-auto object-contain" style={{ filter: 'brightness(0)' }} />
        </a>
      </div>

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

      {/* Glass Nav */}
      <div ref={glassNavRef} id="glass-nav" className="glass-nav no-select">
        <button className={activeTab === 'projects' ? 'active' : ''} onClick={() => handleTabClick('projects')}>
          <img src="/nav-project.png" alt="PROJECT" className="nav-label" />
        </button>
        <button className={activeTab === 'press' ? 'active' : ''} onClick={() => handleTabClick('press')}>
          <img src="/nav-press.png" alt="PRESS" className="nav-label" />
        </button>
        <button className={activeTab === 'article' ? 'active' : ''} onClick={() => handleTabClick('article')}>
          <img src="/nav-article.png" alt="ARTICLE" className="nav-label" />
        </button>
        <button className={activeTab === 'contact' ? 'active' : ''} onClick={() => handleTabClick('contact')}>
          <img src="/nav-contact.png" alt="CONTACT" className="nav-label" />
        </button>

      </div>

      {/* Admin Button — 우측 상단 고정 */}
      {/* Admin 버튼 — 로그인 상태일 때만 상단에 표시 */}
      <div id="admin-btn-wrapper" className="site-logo" style={{ left: 'auto', right: '1.8rem' }}>
        {isAdmin && (
          <button
            onClick={() => { prevTabRef.current = activeTab ?? 'projects'; setView('admin'); }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
            style={{ fontFamily: "'League Gothic', sans-serif", letterSpacing: '0.08em', fontSize: '0.85rem', color: '#0FCD60', background: 'rgba(15,205,96,0.08)', border: '1px solid rgba(15,205,96,0.25)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0FCD60] animate-pulse inline-block" />
            ADMIN
          </button>
        )}
      </div>

      {/* Sub Menu */}
      <div id="sub-menu" className={`no-select ${activeTab === 'projects' && selectedProjectIndex === null ? 'open' : ''}`}>
        {[
          { key: 'All', src: '/ALL.png' },
          { key: 'Web', src: '/WEB.png' },
          { key: 'Campaign', src: '/CAMPAIGN.png' },
          { key: 'Film', src: '/FILM.png' },
          { key: 'Design', src: '/DESIGN.png' },
        ].map(f => (
          <a key={f.key} href="#" onClick={e => { e.preventDefault(); setActiveFilter(f.key); }} className={activeFilter === f.key ? 'active' : ''}>
            <img src={f.src} alt={f.key} className="filter-label" />
          </a>
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
                      <button className="edit-btn" onClick={e => { e.stopPropagation(); openEditor(proj); }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 편집</button>
                    )}
                  </div>
                  <div className="gallery-info">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 uppercase tracking-widest">{proj.category}</span>
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
      <div aria-hidden={selectedProjectIndex === null} className={`fullscreen-modal fixed inset-0 z-[200] bg-[#fafafa] transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto pt-24 ${selectedProjectIndex !== null ? 'translate-y-0' : 'translate-y-full'}`}>
        <button onClick={() => { setSelectedProjectIndex(null); setActiveTab('projects'); window.history.pushState({}, '', '/projects'); }} className="fixed top-24 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-100 transition-colors z-10 cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {isAdmin && selectedProject && (
          <button onClick={() => openEditor(selectedProject)} className="fixed top-24 right-24 flex items-center gap-2 px-4 py-3 rounded-full bg-[#0FCD60] text-white text-sm font-bold shadow-lg hover:bg-green-500 transition-colors z-10 cursor-pointer"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 편집</button>
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
              {selectedProject.category === 'Web' && selectedProject.website_url && (
                <div className="mt-10">
                  <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm mb-4">
                    <img
                      src={`https://api.microlink.io/?url=${encodeURIComponent(selectedProject.website_url)}&screenshot=true&meta=false&embed=screenshot.url`}
                      alt="Website Preview"
                      className="w-full h-auto object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="px-5 py-4 flex items-center justify-between border-t border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={`https://www.google.com/s2/favicons?domain=${selectedProject.website_url}&sz=32`} alt="" className="w-5 h-5 rounded shrink-0" />
                        <span className="text-sm text-gray-500 truncate">{selectedProject.website_url}</span>
                      </div>
                      <a
                        href={selectedProject.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-black text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-800 transition-colors shrink-0 ml-4"
                        style={{ fontFamily: "'League Gothic', sans-serif", letterSpacing: '0.06em' }}
                      >
                        사이트 방문
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}
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
      <div aria-hidden={activeTab !== 'press'} className={`fullscreen-modal fixed inset-0 z-[150] bg-white transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] overflow-y-auto ${activeTab === 'press' ? 'translate-y-0' : 'translate-y-full'}`}>

        <PressPage isAdmin={isAdmin} />
      </div>



      {/* Article Modal */}
      <div aria-hidden={activeTab !== 'article'} className={`fullscreen-modal fixed inset-0 z-[150] transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${activeTab === 'article' ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* 닫기 버튼 — ArticlePage의 전체보기 버튼과 겹치지 않게 왼쪽에 배치 */}
        <ArticlePage isAdmin={isAdmin} onOpenEditor={(a) => { setEditingArticle(a); setView('article-editor'); }} />
      </div>

      {/* Contact Modal */}
      <div aria-hidden={activeTab !== 'contact'} className={`fullscreen-modal fixed inset-0 z-[150] bg-[#fafafa] transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${activeTab === 'contact' ? 'translate-y-0' : 'translate-y-full'}`}>

        <div className="contact-scroll-inner" style={{ height: '100%', overflowY: 'hidden' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MailIconWithBadge active={activeTab === 'contact'} />
          </div>
          <div className="pt-16 pb-24">
          <div className="w-full max-w-4xl mx-auto px-6 md:px-12 flex flex-col md:flex-row gap-16">
          <div className="flex-1">
            <img src="/contact.svg" alt="Let's talk about it." className="mb-6" style={{ width: 'clamp(200px, 40vw, 480px)', height: 'auto' }} />
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
<ContactForm />
          </div>
        </div>
        {!isAdmin && (
          <div className="flex justify-center pt-6 pb-2">
            <button
              onClick={() => setShowLogin(true)}
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
            >
              관리자로 로그인
            </button>
          </div>
        )}
          </div>
          </div>
        </div>
    </>
  );
}
