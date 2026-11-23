import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useDocTitle } from '../lib/useDocTitle';

/* ------------------------------------------------------------------ */
/* 스키마 기반 CRUD — 테이블마다 필드 정의만 하면 목록/편집 화면이 생긴다   */
/* ------------------------------------------------------------------ */
type FieldType = 'text' | 'textarea' | 'number' | 'bool' | 'list' | 'image' | 'images' | 'metrics' | 'select' | 'date' | 'sections' | 'group';
type Field = { key: string; label: string; type: FieldType; options?: string[]; required?: boolean; hint?: string };
type Schema = { table: string; title: string; order: string; listCols: string[]; fields: Field[]; defaults?: Record<string, unknown>; scrape?: boolean };

const PROJECT: Schema = {
  table: 'projects',
  title: 'Work',
  order: 'sort_order',
  listCols: ['sort_order', 'title_en', 'title', 'category', 'published'],
  defaults: { category: 'OOH', year: new Date().getFullYear(), published: false, featured: false, sort_order: 99 },
  fields: [
    { key: '_g1', label: '기본 정보', type: 'group' },
    { key: 'slug', label: 'Slug (URL)', type: 'text', required: true, hint: '영문 소문자·숫자·하이픈. 예: tiro-sagwan' },
    { key: 'title', label: '프로젝트명', type: 'text', required: true, hint: '목록 카드와 상세 제목에 쓰여요' },
    { key: 'title_en', label: '캠페인 카피 / 부제', type: 'text', hint: '상세 상단에 큰 제목과 함께 나와요 (선택)' },
    { key: 'client', label: '클라이언트', type: 'text' },
    { key: 'client_logo_url', label: '클라이언트 로고 (흰색)', type: 'image', hint: '목록에서 사진 위에 마우스를 올리면 뜨는 로고. 흰색 · 배경 투명 · SVG 권장' },
    { key: 'year', label: '연도', type: 'number' },
    { key: 'period', label: '진행 기간', type: 'text', hint: '예: 2026.09 – 2026.11' },
    { key: 'category', label: '카테고리', type: 'select', options: ['OOH', 'SNS', 'Film', 'Design', 'Offline', 'Web'] },
    { key: 'services', label: '서비스 태그 (쉼표로 구분)', type: 'list' },
    { key: 'role', label: 'IMBY 역할', type: 'text', hint: '예: 기획 · 카피라이팅 · 비주얼 · 매체 집행' },
    { key: 'summary', label: '한 줄 요약', type: 'textarea', hint: '상세 맨 위 리드 문장' },
    { key: '_g2', label: 'BACKGROUND', type: 'group' },
    { key: 'background_title', label: '헤드라인', type: 'text' },
    { key: 'background', label: '본문', type: 'textarea' },
    { key: '_g3', label: 'PROBLEM', type: 'group' },
    { key: 'problem_title', label: '헤드라인', type: 'text' },
    { key: 'problem', label: '본문', type: 'textarea' },
    { key: '_g4', label: 'INSIGHT', type: 'group' },
    { key: 'insight_title', label: '헤드라인', type: 'text' },
    { key: 'insight', label: '본문', type: 'textarea' },
    { key: '_g5', label: 'IDEA', type: 'group' },
    { key: 'idea_title', label: '헤드라인', type: 'text' },
    { key: 'idea', label: '본문', type: 'textarea' },
    { key: 'sections', label: '실행 섹션', type: 'sections', hint: 'VISUAL · COPY · CONTENTS · OFFLINE 처럼 라벨을 붙여 순서대로 쌓아요. 섹션마다 이미지를 넣을 수 있어요' },
    { key: '_g6', label: 'RESULT', type: 'group' },
    { key: 'result_title', label: '헤드라인', type: 'text' },
    { key: 'result', label: '본문', type: 'textarea' },
    { key: 'metrics', label: '성과 지표', type: 'metrics' },
    { key: '_g7', label: '이미지 · 공개', type: 'group' },
    { key: 'thumbnail_url', label: '목록 썸네일', type: 'image' },
    { key: 'cover_url', label: '상세 커버 이미지', type: 'image' },
    { key: 'gallery', label: '마지막 갤러리', type: 'images' },
    { key: 'external_url', label: '외부 링크', type: 'text' },
    { key: 'featured', label: '홈 Selected Work에 노출', type: 'bool' },
    { key: 'published', label: '공개', type: 'bool' },
    { key: 'sort_order', label: '정렬 순서', type: 'number', hint: '작을수록 앞' },
  ],
};

const TEAM: Schema = {
  table: 'team_members',
  title: 'Team',
  order: 'sort_order',
  listCols: ['sort_order', 'name', 'role', 'team', 'published'],
  defaults: { published: true, sort_order: 99 },
  fields: [
    { key: 'name', label: '이름', type: 'text', required: true },
    { key: 'name_en', label: '영문 이름', type: 'text' },
    { key: 'role', label: '직함', type: 'text', required: true },
    { key: 'team', label: '팀', type: 'select', options: ['Creative', 'Account', 'Design', 'Community', 'Strategy', 'Production'] },
    { key: 'one_liner', label: '한 줄 (카드 뒷면)', type: 'textarea' },
    { key: 'career', label: '커리어 (줄마다 하나)', type: 'list', hint: '줄바꿈으로 구분' },
    { key: 'education', label: '학력', type: 'text' },
    { key: 'photo_url', label: '사진', type: 'image' },
    { key: 'link_url', label: '링크 (mailto: 또는 URL)', type: 'text' },
    { key: 'published', label: '공개', type: 'bool' },
    { key: 'sort_order', label: '정렬 순서', type: 'number' },
  ],
};

const PRESS: Schema = {
  table: 'news_articles',
  title: 'Press',
  order: 'published_at',
  listCols: ['published_at', 'title', 'source', 'published'],
  defaults: { published: true, category: 'press' },
  scrape: true,
  fields: [
    { key: 'url', label: '기사 URL', type: 'text', required: true, hint: '붙여넣으면 제목·요약·대표 사진·매체·게재일을 자동으로 불러와요' },
    { key: 'title', label: '헤드라인', type: 'text', required: true, hint: '불러온 제목을 그대로 쓰거나 고쳐 쓰세요' },
    { key: 'source', label: '매체', type: 'text' },
    { key: 'description', label: '요약', type: 'textarea' },
    { key: 'image_url', label: '대표 사진', type: 'image', hint: '못 불러왔거나 마음에 안 들면 직접 올리세요' },
    { key: 'published_at', label: '게재일', type: 'date' },
    { key: 'category', label: '분류', type: 'select', options: ['press', 'news', 'notice'] },
    { key: 'published', label: '공개', type: 'bool' },
  ],
};

const CLIENTS: Schema = {
  table: 'clients',
  title: 'Clients',
  order: 'sort_order',
  listCols: ['sort_order', 'name', 'link', 'published'],
  defaults: { published: true, sort_order: 99 },
  fields: [
    { key: 'name', label: '클라이언트 이름', type: 'text', required: true },
    { key: 'logo_url', label: '로고', type: 'image', required: true, hint: '흰색 로고 · 배경 투명 · SVG 권장(PNG도 가능). Work 상단 3D 픽셀 로고와 홈 클라이언트 섹션에 바로 반영돼요' },
    { key: 'link', label: '연결 링크', type: 'text', hint: '작업 페이지 /work/slug 또는 외부 URL' },
    { key: 'sort_order', label: '정렬 순서', type: 'number', hint: '작을수록 왼쪽' },
    { key: 'published', label: '공개', type: 'bool' },
  ],
};

const OPENINGS: Schema = {
  table: 'openings',
  title: 'Careers',
  order: 'sort_order',
  listCols: ['sort_order', 'title', 'team', 'is_open'],
  defaults: { is_open: true, sort_order: 99, type: '정규직' },
  fields: [
    { key: 'title', label: '포지션', type: 'text', required: true },
    { key: 'team', label: '팀', type: 'text' },
    { key: 'type', label: '고용 형태', type: 'select', options: ['정규직', '계약직', '인턴', '프리랜서'] },
    { key: 'experience', label: '경력', type: 'text', hint: '예: 1-3년, 신입' },
    { key: 'description', label: '상세', type: 'textarea' },
    { key: 'apply_url', label: '지원 링크 (비우면 메일)', type: 'text' },
    { key: 'is_open', label: '모집 중', type: 'bool' },
    { key: 'sort_order', label: '정렬 순서', type: 'number' },
  ],
};

type Row = Record<string, unknown> & { id: string };

async function upload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('site-media').upload(path, file, { cacheControl: '31536000', contentType: file.type });
  if (error) throw error;
  return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

type Section = { label: string; title?: string; body?: string; images?: string[] };

/** 실행 섹션 편집기: 라벨 / 헤드라인 / 본문 / 이미지 — 추가 · 삭제 · 순서 바꾸기 */
function SectionsInput({ value, onChange }: { value: Section[]; onChange: (v: unknown) => void }) {
  const [busy, setBusy] = useState(-1);
  const set = (i: number, patch: Partial<Section>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const next = [...value]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div className="adm-secs">
      {value.map((s, i) => (
        <div key={i} className="adm-sec">
          <div className="adm-sec__bar">
            <strong>섹션 {i + 1}</strong>
            <span>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</button>
              <button type="button" className="adm-btn adm-btn--danger" onClick={() => onChange(value.filter((_, j) => j !== i))}>삭제</button>
            </span>
          </div>
          <input placeholder="라벨 (예: VISUAL, COPY, CONTENTS, OFFLINE)" value={s.label ?? ''} onChange={(e) => set(i, { label: e.target.value })} />
          <input placeholder="헤드라인" value={s.title ?? ''} onChange={(e) => set(i, { title: e.target.value })} />
          <textarea rows={4} placeholder="본문" value={s.body ?? ''} onChange={(e) => set(i, { body: e.target.value })} />
          <div className="adm-imgs">
            {(s.images ?? []).map((u, k) => (
              <div key={u + k} className="adm-imgs__item">
                <img src={u} alt="" />
                <button type="button" onClick={() => set(i, { images: (s.images ?? []).filter((_, q) => q !== k) })}>삭제</button>
              </div>
            ))}
            <label className="adm-btn adm-btn--ghost">
              {busy === i ? '업로드 중…' : '+ 이미지'}
              <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (!files.length) return;
                setBusy(i);
                try { const urls = await Promise.all(files.map(upload)); set(i, { images: [...(s.images ?? []), ...urls] }); } catch (er) { alert(`업로드 실패: ${(er as Error).message}`); }
                setBusy(-1);
              }} />
            </label>
          </div>
        </div>
      ))}
      <button type="button" className="adm-btn adm-btn--ghost" onClick={() => onChange([...value, { label: '', title: '', body: '', images: [] }])}>+ 섹션 추가</button>
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  const [busy, setBusy] = useState(false);
  switch (f.type) {
    case 'textarea':
      return <textarea rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'number':
      return <input type="number" value={(value as number) ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'date':
      return <input type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
    case 'bool':
      return (
        <label className="adm-switch">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span>{value ? 'ON' : 'OFF'}</span>
        </label>
      );
    case 'select':
      return (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {f.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case 'list': {
      const arr = (value as string[]) ?? [];
      const sep = f.key === 'career' ? '\n' : ', ';
      return <textarea rows={f.key === 'career' ? 4 : 2} value={arr.join(sep)} onChange={(e) => onChange(e.target.value.split(f.key === 'career' ? '\n' : ',').map((s) => s.trim()).filter(Boolean))} />;
    }
    case 'metrics': {
      const arr = (value as { label: string; value: string }[]) ?? [];
      return (
        <textarea
          rows={3}
          placeholder="라벨 | 값 (줄마다 하나)"
          value={arr.map((m) => `${m.label} | ${m.value}`).join('\n')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split('\n')
                .map((l) => l.split('|').map((s) => s.trim()))
                .filter((p) => p[0])
                .map(([label, v]) => ({ label, value: v ?? '' })),
            )
          }
        />
      );
    }
    case 'image':
      return (
        <div className="adm-img">
          {typeof value === 'string' && value && <img src={value} alt="" />}
          <input type="text" value={(value as string) ?? ''} placeholder="URL 또는 파일 업로드" onChange={(e) => onChange(e.target.value || null)} />
          <label className="adm-btn adm-btn--ghost">
            {busy ? '업로드 중…' : '파일 선택'}
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try { onChange(await upload(file)); } catch (er) { alert(`업로드 실패: ${(er as Error).message}`); }
              setBusy(false);
            }} />
          </label>
        </div>
      );
    case 'images': {
      const arr = (value as string[]) ?? [];
      return (
        <div className="adm-imgs">
          {arr.map((u, i) => (
            <div key={u + i} className="adm-imgs__item">
              <img src={u} alt="" />
              <button type="button" onClick={() => onChange(arr.filter((_, j) => j !== i))}>삭제</button>
            </div>
          ))}
          <label className="adm-btn adm-btn--ghost">
            {busy ? '업로드 중…' : '+ 이미지 추가'}
            <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              setBusy(true);
              try { const urls = await Promise.all(files.map(upload)); onChange([...arr, ...urls]); } catch (er) { alert(`업로드 실패: ${(er as Error).message}`); }
              setBusy(false);
            }} />
          </label>
        </div>
      );
    }
    case 'sections':
      return <SectionsInput value={(value as Section[]) ?? []} onChange={onChange} />;
    default:
      return <input type="text" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
  }
}

type Scraped = { url?: string; title?: string | null; description?: string | null; image_url?: string | null; source?: string | null; published_at?: string | null; error?: string };

/** 기사 URL → Edge Function(scrape-article)으로 메타 정보를 읽어 온다. 관리자 로그인 토큰으로만 호출된다. */
async function scrapeArticle(url: string): Promise<Scraped> {
  const { data, error } = await supabase.functions.invoke<Scraped>('scrape-article', { body: { url } });
  if (error) {
    let msg = error.message;
    try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) msg = body.error; } catch { /* noop */ }
    return { error: msg };
  }
  return data ?? { error: '응답이 비어 있어요.' };
}

function Crud({ s }: { s: Schema }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [msg, setMsg] = useState('');
  const [scraping, setScraping] = useState(false);
  const [lastScraped, setLastScraped] = useState('');

  /** URL로 자동 채우기. force 가 아니면 이미 적어 둔 칸은 건드리지 않는다. */
  const runScrape = async (url: string, force: boolean) => {
    if (!s.scrape || !edit || !/^https?:\/\//i.test(url.trim())) return;
    setScraping(true); setMsg('기사를 불러오는 중…');
    const r = await scrapeArticle(url.trim());
    setScraping(false);
    setLastScraped(url.trim());
    if (r.error) { setMsg(`불러오지 못했어요: ${r.error} — 직접 입력해 주세요.`); return; }
    setEdit((cur) => {
      if (!cur) return cur;
      const next: Row = { ...cur, scraped_at: new Date().toISOString() };
      const put = (k: keyof Scraped) => { const v = r[k]; if (v && (force || !cur[k as string])) next[k as string] = v; };
      put('title'); put('description'); put('image_url'); put('source'); put('published_at');
      return next;
    });
    const miss = [!r.title && '헤드라인', !r.image_url && '대표 사진'].filter(Boolean);
    setMsg(miss.length ? `불러왔어요. ${miss.join('·')}은(는) 찾지 못했어요 — 직접 넣어 주세요.` : '불러왔어요. 내용을 확인하고 저장하세요.');
  };

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(s.table).select('*').order(s.order, { ascending: s.order !== 'published_at' });
    if (error) setMsg(error.message);
    setRows((data as Row[]) ?? []);
  }, [s]);
  useEffect(() => { load(); setEdit(null); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const missing = s.fields.filter((f) => f.required && !edit[f.key]);
    if (missing.length) return setMsg(`필수: ${missing.map((m) => m.label).join(', ')}`);
    const payload: Record<string, unknown> = {};
    s.fields.forEach((f) => { if (f.type !== 'group') payload[f.key] = edit[f.key] ?? (f.type === 'sections' ? [] : null); });
    if (s.scrape && edit.scraped_at) payload.scraped_at = edit.scraped_at;
    if (typeof payload.url === 'string') payload.url = payload.url.trim();
    const q = edit.id ? supabase.from(s.table).update(payload).eq('id', edit.id) : supabase.from(s.table).insert(payload);
    const { error } = await q;
    if (error) return setMsg(error.code === '23505' ? '이미 등록된 기사 URL이에요.' : error.message);
    setMsg('저장했어요.');
    setEdit(null);
    load();
  };

  const remove = async (r: Row) => {
    if (!confirm('정말 삭제할까요? 되돌릴 수 없어요.')) return;
    const { error } = await supabase.from(s.table).delete().eq('id', r.id);
    if (error) return setMsg(error.message);
    load();
  };

  if (edit) {
    return (
      <form className="adm-form" onSubmit={save}>
        <div className="adm-form__head">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setEdit(null)}>← 목록</button>
          <h2>{edit.id ? '수정' : '새로 만들기'} — {s.title}</h2>
        </div>
        {s.fields.map((f) => f.type === 'group' ? (
          <h3 key={f.key} className="adm-group">{f.label}</h3>
        ) : (
          <label key={f.key} className="adm-field">
            <span>{f.label}{f.required && ' *'}{f.hint && <em>{f.hint}</em>}</span>
            {s.scrape && f.key === 'url' ? (
              <div className="adm-scrape">
                <input
                  type="url" placeholder="https://" value={(edit.url as string) ?? ''}
                  onChange={(e) => setEdit({ ...edit, url: e.target.value || null })}
                  onPaste={(e) => { const v = e.clipboardData.getData('text'); window.setTimeout(() => runScrape(v, false), 0); }}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== lastScraped && !edit.title) runScrape(v, false); }}
                />
                <button type="button" className="adm-btn adm-btn--ghost" disabled={scraping || !edit.url} onClick={() => runScrape(String(edit.url ?? ''), true)}>
                  {scraping ? '불러오는 중…' : '다시 불러오기'}
                </button>
                {typeof edit.url === 'string' && /^https?:\/\//.test(edit.url) && <a className="adm-link" href={edit.url} target="_blank" rel="noreferrer">원문 열기 ↗</a>}
              </div>
            ) : (
              <FieldInput f={f} value={edit[f.key]} onChange={(v) => setEdit({ ...edit, [f.key]: v })} />
            )}
          </label>
        ))}
        <div className="adm-form__foot">
          {msg && <span className="adm-msg">{msg}</span>}
          <button className="adm-btn">저장</button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="adm-bar">
        <span>{rows.length}개</span>
        {msg && <span className="adm-msg">{msg}</span>}
        <button className="adm-btn" onClick={() => { setMsg(''); setEdit({ id: '', ...(s.defaults ?? {}) } as Row); }}>+ 새로 만들기</button>
      </div>
      <table className="adm-table">
        <thead><tr>{s.listCols.map((c) => <th key={c}>{c}</th>)}<th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {s.listCols.map((c) => <td key={c}>{typeof r[c] === 'boolean' ? (r[c] ? '●' : '○') : String(r[c] ?? '')}</td>)}
              <td className="adm-actions">
                <button className="adm-btn adm-btn--ghost" onClick={() => { setMsg(''); setEdit(r); }}>수정</button>
                <button className="adm-btn adm-btn--danger" onClick={() => remove(r)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inbox — 문의와 커피챗                                                   */
/* ------------------------------------------------------------------ */
const MENU_KR: Record<string, string> = { americano: '아메리카노 · 업계 이야기', latte: '라떼 · 협업 탐색', ade: '에이드 · 아이디어 잼', tea: '얼그레이 · 합류 고민' };

function Inbox({ kind }: { kind: 'contact' | 'coffee' }) {
  const table = kind === 'contact' ? 'contact_messages' : 'coffee_chats';
  const statuses = kind === 'contact' ? ['new', 'replied', 'closed'] : ['new', 'scheduled', 'done', 'declined'];
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('new');

  const load = useCallback(async () => {
    let q = supabase.from(table).select('*').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setRows((data as Row[]) ?? []);
  }, [table, filter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    await supabase.from(table).update({ status }).eq('id', id);
    load();
  };

  return (
    <div>
      <div className="adm-bar">
        {['all', ...statuses].map((s) => (
          <button key={s} className={`adm-chip ${filter === s ? 'is-on' : ''}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>
      {rows.length === 0 && <p className="adm-empty">비어 있어요.</p>}
      <ul className="adm-inbox">
        {rows.map((r) => (
          <li key={r.id} className="adm-mail">
            <div className="adm-mail__head">
              <strong>{String(r.name)}</strong>
              <span>{String(r.company ?? r.affiliation ?? '')}</span>
              <a href={`mailto:${r.email}`}>{String(r.email)}</a>
              {r.phone ? <span>{String(r.phone)}</span> : null}
              <time>{new Date(String(r.created_at)).toLocaleString('ko-KR')}</time>
            </div>
            {kind === 'coffee' && (
              <p className="adm-mail__meta">
                {MENU_KR[String(r.menu)]} · {r.mode === 'online' ? '온라인' : '오프라인'} · {(r.preferred_slots as string[])?.join(', ')}
              </p>
            )}
            {kind === 'contact' && (
              <p className="adm-mail__meta">
                {(r.services as string[])?.join(', ')} {r.budget ? `· ${r.budget}` : ''} {r.timeline ? `· ${r.timeline}` : ''}
              </p>
            )}
            {r.message ? <p className="adm-mail__body">{String(r.message)}</p> : null}
            <div className="adm-mail__foot">
              {statuses.map((s) => (
                <button key={s} className={`adm-chip ${r.status === s ? 'is-on' : ''}`} onClick={() => setStatus(r.id, s)}>{s}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
const TABS = [
  { k: 'contact', l: '문의' },
  { k: 'coffee', l: '커피챗' },
  { k: 'work', l: 'Work' },
  { k: 'team', l: 'Team' },
  { k: 'press', l: 'Press' },
  { k: 'clients', l: 'Clients' },
  { k: 'careers', l: 'Careers' },
] as const;

export default function Admin() {
  useDocTitle('Admin — IMBY');
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]['k']>('contact');
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setIsAdmin(null);
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) });
    setErr(error ? '이메일 또는 비밀번호가 올바르지 않아요.' : '');
  };

  if (!session) {
    return (
      <section className="adm adm--login">
        <form className="adm-login" onSubmit={login}>
          <p className="t-cap g2">IMBY Admin</p>
          <h1 className="page-title">Back<br />stage</h1>
          <label className="field"><span className="field__l">Email</span><input name="email" type="email" autoComplete="username" required /></label>
          <label className="field"><span className="field__l">Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
          {err && <p className="ct__err">{err}</p>}
          <button className="pill pill--lg pill--solid">로그인</button>
        </form>
      </section>
    );
  }

  if (isAdmin === false) {
    return (
      <section className="adm adm--login">
        <div className="adm-login">
          <h1 className="sec-title">권한이 없어요</h1>
          <p className="t-body">{session.user.email} 계정은 관리자 목록(admins 테이블)에 없습니다.</p>
          <button className="pill" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </div>
      </section>
    );
  }

  return (
    <section className="adm">
      <div className="adm-top">
        <nav className="adm-tabs">
          {TABS.map((t) => (
            <button key={t.k} className={tab === t.k ? 'is-on' : ''} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </nav>
        <div className="adm-user">
          <span>{session.user.email}</span>
          <button className="adm-btn adm-btn--ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </div>
      </div>
      <div className="adm-panel">
        {tab === 'contact' && <Inbox kind="contact" />}
        {tab === 'coffee' && <Inbox kind="coffee" />}
        {tab === 'work' && <Crud s={PROJECT} />}
        {tab === 'team' && <Crud s={TEAM} />}
        {tab === 'press' && <Crud s={PRESS} />}
        {tab === 'clients' && <Crud s={CLIENTS} />}
        {tab === 'careers' && <Crud s={OPENINGS} />}
      </div>
    </section>
  );
}
