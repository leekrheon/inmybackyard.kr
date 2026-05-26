/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, Users, ChevronRight, ThumbsUp, Search, Send,
  Building2, ArrowLeft, Clock, Eye, Edit3, X, ChevronDown,
  Megaphone, BarChart2, Zap, Star, Loader2, Menu, Trash2,
  Pencil, Check, TrendingUp, Clock3, Upload, ImageIcon,
  Moon, Sun, User, Settings, LogOut, Camera, ChevronLeft,
  Trophy, Pen
} from 'lucide-react';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
// @ts-ignore
import imageCompression from 'browser-image-compression';

// ── 전역 컨텍스트 ────────────────────────────────────────
interface UserProfile {
  id?: string;       // Supabase Auth user id
  email?: string;    // 이메일 (관리자)
  name: string;
  avatar: string;    // 이니셜 or URL
  avatarUrl?: string;
  isAdmin?: boolean; // 관리자 여부
}
interface AppContextType {
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  catches: number;
  setCatches: (n: number) => void;
  ads: Ad[];
  setAds: (a: Ad[]) => void;
}
const AppContext = createContext<AppContextType>({
  user: null, setUser: () => {}, darkMode: false, toggleDarkMode: () => {},
  catches: 0, setCatches: () => {}, ads: [], setAds: () => {},
});

// ── 타입 ──────────────────────────────────────────────────
interface Ad {
  id: string;
  image_url: string;
  link_url?: string;
  sort_order: number;
  is_active: boolean;
  position_x?: string; // left / center / right
  position_y?: string; // top / center / bottom
}

interface Brief {
  id: string; company_name: string; title: string; problem: string;
  target: string; campaign_info: string; reward: string; deadline: string;
  participants: number; status: 'IN PROGRESS' | 'CLOSED'; category: string;
  bg_color: string; image_url?: string; views?: number; external_url?: string;
  reward_amount?: number;
}
interface CopyEntry {
  id: string; brief_id: string; author: string; content: string;
  upvotes: number; created_at: string;
}
interface Reply {
  id: string; comment_id: string; author: string; avatar: string;
  content: string; likes: number; created_at: string;
}
interface Comment {
  id: string; post_id: string; author: string; avatar: string; avatar_url?: string;
  content: string; likes: number; created_at: string; replies: Reply[];
}
interface Post {
  id: string; category: string; title: string; content: string;
  author: string; avatar: string; views: number; likes: number; dislikes: number;
  created_at: string; is_pinned: boolean; comments: Comment[];
  avatar_url?: string;
}

const CATEGORIES = ['전체', 'FREE', 'TALK', 'NEWS'];
const BRIEF_CATS = ['전체', '식품', '뷰티', '패션', '테크·IT', '라이프스타일', '헬스케어', '교육', '기타'];
const KEY = '#22CD6D';

// 다크모드 색상
const D = {
  bg: '#17171C',        // 최외곽 배경
  card: '#2C2C35',      // 카드/패널
  border: '#3a3a45',    // 구분선
  text: '#f0f0f0',      // 기본 텍스트
  muted: '#8888a0',     // 보조 텍스트
  hover: '#35353f',     // 호버
};

// 사용자 고유 키 (localStorage fingerprint)
const getVoterKey = () => {
  let k = localStorage.getItem('cc_voter_key');
  if (!k) {
    // crypto.randomUUID() 사용 (Math.random보다 훨씬 안전)
    const uid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36));
    // 브라우저 fingerprint 요소 결합
    const fp = [
      navigator.language,
      navigator.platform,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
    ].join('|');
    const fpHash = btoa(fp).slice(0, 8);
    k = uid + '_' + fpHash;
    localStorage.setItem('cc_voter_key', k);
    // sessionStorage에도 백업 (탭 새로고침 시 검증용)
    sessionStorage.setItem('cc_vk_backup', k);
  }
  // voter_key 변조 감지: sessionStorage 백업과 다르면 복원
  const backup = sessionStorage.getItem('cc_vk_backup');
  if (backup && backup !== k) {
    // 변조 감지 - sessionStorage가 있으면 복원
    localStorage.setItem('cc_voter_key', backup);
    return backup;
  }
  return k;
};

// 마감일 실시간 계산 - 관리자가 선택한 날짜의 자정(00:00) 기준으로 CLOSED
const getDday = (deadlineStr: string): { label: string; isExpired: boolean; date: Date | null } => {
  const dateMatch = deadlineStr.match(/(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return { label: deadlineStr, isExpired: false, date: null };
  // 해당 날짜 자정 00:00:00 = 그 날이 시작되는 순간부터 유효, 다음날 자정부터 CLOSED
  const deadline = new Date(dateMatch[1] + 'T00:00:00');
  // 다음날 00:00:00이 되면 CLOSED (= 선택한 날이 끝나는 자정)
  const expiry = new Date(deadline);
  expiry.setDate(expiry.getDate() + 1); // 선택 날짜 +1일 자정
  const now = new Date();
  if (now >= expiry) return { label: '마감', isExpired: true, date: expiry };
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: '오늘 마감', isExpired: false, date: expiry };
  if (diffDays === 1) return { label: '내일 마감', isExpired: false, date: expiry };
  return { label: 'D-' + diffDays, isExpired: false, date: expiry };
};


// Edge Function 호출 헬퍼 (서버사이드 캐치/투표 처리)
const callEdgeFunction = async (fnName: string, body: object) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const url = supabaseUrl + '/functions/v1/' + fnName;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '서버 오류');
  return data;
};

const timeAgo = (ts: string) => {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
};
const PALETTE = ['bg-slate-500', 'bg-zinc-600', 'bg-stone-500', 'bg-neutral-600', 'bg-gray-600'];
const getAvatarColor = (s: string) => PALETTE[s.charCodeAt(0) % PALETTE.length];

// ── 공통 ──────────────────────────────────────────────────
function Avatar({ name, size = 8, imageUrl }: { name: string; size?: number; imageUrl?: string }) {
  return (
    <div style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      className={cn('rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden', !imageUrl && getAvatarColor(name))}>
      {imageUrl
        ? <img src={imageUrl} className="w-full h-full object-cover" />
        : name.slice(0, 2).toUpperCase()
      }
    </div>
  );
}
function Spinner() {
  return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>;
}

// ── 로그인 페이지 ─────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const { setUser, darkMode: dm } = useContext(AppContext);
  const [showAdminInput, setShowAdminInput] = React.useState(false);
  const [adminEmail, setAdminEmail] = React.useState('');
  const [adminPw, setAdminPw] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const ADMIN_EMAIL = 'admin@inmybackyard.kr'; // 관리자 이메일

  // 소셜 로그인 (임시 - 나중에 OAuth 연동)
  const handleLogin = (provider: 'naver' | 'kakao') => {
    const profile: UserProfile = {
      name: provider === 'naver' ? '네이버유저' : '카카오유저',
      avatar: provider === 'naver' ? 'NV' : 'KK',
      isAdmin: false,
    };
    setUser(profile);
    localStorage.setItem('cc_user', JSON.stringify(profile));
    navigate(-1);
  };

  // 관리자 로그인 - Supabase Auth 이메일 로그인
  const handleAdminLogin = async () => {
    if (!adminPw) return;
    setLoading(true);
    try {
      const email = adminEmail || ADMIN_EMAIL;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: adminPw });
      if (error || !data.user) {
        alert('비밀번호가 틀렸습니다.');
        setLoading(false);
        return;
      }
      // DB에서 프로필 로드 (없으면 기본값)
      const { data: profile } = await supabase
        .from('user_profiles').select('*').eq('id', data.user.id).single();
      const userProfile: UserProfile = {
        id: data.user.id,
        email: data.user.email,
        name: profile?.name ?? '관리자',
        avatar: 'AD',
        avatarUrl: profile?.avatar_url ?? undefined,
        isAdmin: true,
      };
      setUser(userProfile);
      localStorage.setItem('cc_user', JSON.stringify(userProfile));
      navigate('/catchcopy/mypage');
    } catch {
      alert('로그인 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  return (
    <DarkWrapper className="min-h-screen flex items-center justify-center px-4 pt-12 pb-24 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs mb-8 transition-colors" style={{ color: D.muted }}>
          <ArrowLeft size={14} /> 돌아가기
        </button>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'inherit' }}>로그인</h1>
        <p className="text-sm mb-8" style={{ color: D.muted }}>소셜 계정으로 간편하게 시작하세요.</p>

        <div className="space-y-3">
          {/* 네이버 */}
          <button onClick={() => handleLogin('naver')}
            className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-98"
            style={{ backgroundColor: '#03C75A' }}>
            <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center shrink-0">
              <span className="text-[#03C75A] font-black text-xs leading-none">N</span>
            </div>
            Naver로 로그인
          </button>
          {/* 카카오 */}
          <button onClick={() => handleLogin('kakao')}
            className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-98"
            style={{ backgroundColor: '#FEE500', color: '#191919' }}>
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#191919">
                <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.663 1.713 5.001 4.31 6.376L5.23 21l5.21-3.136c.5.07 1.01.106 1.56.106 5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/>
              </svg>
            </div>
            Kakao로 로그인
          </button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: D.muted }}>
          로그인 시 <span style={{ color: KEY }}>이용약관</span>과 <span style={{ color: KEY }}>개인정보처리방침</span>에 동의합니다.
        </p>

        {/* 관리자 로그인 */}
        <div className="text-center mt-4">
          {!showAdminInput ? (
            <button onClick={() => setShowAdminInput(true)}
              className="text-xs underline transition-colors" style={{ color: D.muted }}>
              관리자 로그인
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                type="email" value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder={ADMIN_EMAIL}
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-[#22CD6D] transition-colors"
                style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }}
              />
              <input
                type="password" value={adminPw}
                onChange={e => setAdminPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                placeholder="비밀번호"
                autoFocus
                className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-[#22CD6D] transition-colors"
                style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }}
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowAdminInput(false); setAdminPw(''); }}
                  className="flex-1 py-2 rounded-lg text-xs font-medium border transition-colors"
                  style={{ borderColor: D.border, color: D.muted }}>
                  취소
                </button>
                <button onClick={handleAdminLogin} disabled={loading}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                  style={{ backgroundColor: KEY }}>
                  {loading ? '로그인 중...' : '확인'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </DarkWrapper>
  );
}

// ── My Page 활동 내역 ────────────────────────────────────
function ActivitySection({ dm }: { dm: boolean }) {
  const { user } = useContext(AppContext);
  const vk = getVoterKey();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'posts' | 'comments' | 'liked'>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [liked, setLiked] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.name) return;
    setLoading(true);
    Promise.all([
      supabase.from('posts').select('id, title, category, likes, created_at').eq('author', user.name).order('created_at', { ascending: false }).limit(20),
      supabase.from('comments').select('id, content, post_id, created_at').eq('author', user.name).order('created_at', { ascending: false }).limit(20),
      supabase.from('posts').select('id, title, category, likes, created_at').gt('likes', 0).order('created_at', { ascending: false }).limit(20),
    ]).then(([p, c, l]) => {
      setPosts(p.data ?? []);
      setComments(c.data ?? []);
      setLiked(l.data ?? []);
      setLoading(false);
    });
  }, [user?.name]);

  const tabs = [
    { id: 'posts', label: '내 글', count: posts.length },
    { id: 'comments', label: '내 댓글', count: comments.length },
    { id: 'liked', label: '좋아요', count: liked.length },
  ];

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: D.card, borderColor: D.border }}>
      <div className="px-5 pt-5 pb-3">
        <p className="text-sm font-bold" style={{ color: D.text }}>내 활동</p>
      </div>
      {/* 탭 */}
      <div className="flex border-b" style={{ borderColor: D.border }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className="flex-1 py-2.5 text-xs font-semibold transition-all border-b-2"
            style={{
              borderColor: tab === t.id ? KEY : 'transparent',
              color: tab === t.id ? KEY : D.muted,
            }}>
            {t.label} {t.count > 0 && <span className="ml-0.5 opacity-60">{t.count}</span>}
          </button>
        ))}
      </div>
      {/* 내용 */}
      <div className="divide-y" style={{ borderColor: D.border }}>
        {loading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : tab === 'posts' ? (
          posts.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: D.muted }}>작성한 글이 없어요.</p>
          ) : posts.map(p => (
            <button key={p.id} onClick={() => navigate('/catchcopy/community/post/' + p.id)}
              className="w-full text-left px-5 py-3 flex items-start justify-between gap-3 hover:opacity-80 transition-opacity">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: D.text }}>{p.title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{p.category} · {timeAgo(p.created_at)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-[11px]" style={{ color: D.muted }}>
                <ThumbsUp size={10} /> {p.likes}
              </div>
            </button>
          ))
        ) : tab === 'comments' ? (
          comments.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: D.muted }}>작성한 댓글이 없어요.</p>
          ) : comments.map(c => (
            <button key={c.id} onClick={() => navigate('/catchcopy/community/post/' + c.post_id)}
              className="w-full text-left px-5 py-3 hover:opacity-80 transition-opacity">
              <p className="text-xs truncate" style={{ color: D.text }}>{c.content}</p>
              <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{timeAgo(c.created_at)}</p>
            </button>
          ))
        ) : (
          liked.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: D.muted }}>좋아요한 글이 없어요.</p>
          ) : liked.map(p => (
            <button key={p.id} onClick={() => navigate('/catchcopy/community/post/' + p.id)}
              className="w-full text-left px-5 py-3 flex items-start justify-between gap-3 hover:opacity-80 transition-opacity">
              <p className="text-xs font-medium truncate" style={{ color: D.text }}>{p.title}</p>
              <span className="text-[11px] shrink-0" style={{ color: D.muted }}>{timeAgo(p.created_at)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── My Page ────────────────────────────────────────────
function MyPage() {
  const navigate = useNavigate();
  const { user, setUser, darkMode, toggleDarkMode, catches } = useContext(AppContext);
  const [editName, setEditName] = useState(user?.name ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <DarkWrapper className="min-h-screen flex flex-col items-center justify-center px-4 pt-12 gap-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(5,213,96,0.1)' }}>
          <User size={28} style={{ color: KEY }} />
        </div>
        <div className="text-center">
          <p className="text-base font-bold mb-1">로그인이 필요합니다</p>
          <p className="text-sm" style={{ color: D.muted }}>My Page를 이용하려면 로그인하세요.</p>
        </div>
        <button onClick={() => navigate('/catchcopy/login')}
          className="text-sm font-semibold text-white px-8 py-3 rounded-xl hover:opacity-90 transition-all active:scale-95"
          style={{ backgroundColor: KEY }}>
          로그인
        </button>
        <button onClick={() => navigate(-1)}
          className="text-xs transition-colors" style={{ color: D.muted }}>
          돌아가기
        </button>
      </DarkWrapper>
    );
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      // 압축 후 base64로 변환 → localStorage 저장 (Storage 버킷 불필요)
      const compressed = await imageCompression(file, { maxSizeMB: 0.1, maxWidthOrHeight: 300, useWebWorker: true });
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setAvatarPreview(base64);
        const updated = { ...user!, avatarUrl: base64 };
        setUser(updated);
        localStorage.setItem('cc_user', JSON.stringify(updated));
        // user_profiles + 기존 글/댓글 avatar_url 일괄 업데이트
        if (updated.id) {
          supabase.from('user_profiles')
            .upsert({ id: updated.id, avatar_url: base64 }, { onConflict: 'id' })
            .then(() => {});
        }
        // 기존 글/댓글 프로필 사진 일괄 업데이트
        Promise.all([
          supabase.from('posts').update({ avatar_url: base64 }).eq('author', updated.name),
          supabase.from('comments').update({ avatar_url: base64 }).eq('author', updated.name),
        ]).then(() => {});
        setSaving(false);
      };
      reader.onerror = () => { alert('이미지 읽기 실패'); setSaving(false); };
      reader.readAsDataURL(compressed);
    } catch (err) {
      alert('이미지 처리 실패: ' + String(err));
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const newName = editName.trim() || user.name;
    const oldName = user.name;
    const updated = { ...user, name: newName };
    // 1. 전역 state 즉시 업데이트
    setUser(updated);
    localStorage.setItem('cc_user', JSON.stringify(updated));
    // 2. user_profiles 저장
    if (updated.id) {
      await supabase.from('user_profiles')
        .upsert({ id: updated.id, name: newName, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    }
    // 3. 기존 글/댓글 이름 일괄 업데이트 (이름이 바뀐 경우만)
    if (newName !== oldName) {
      await Promise.all([
        supabase.from('posts').update({ author: newName }).eq('author', oldName),
        supabase.from('comments').update({ author: newName }).eq('author', oldName),
      ]);
    }
    setIsEditing(false);
  };

  const handleLogout = async () => {
    // Supabase Auth 로그아웃
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('cc_user');
    navigate('/catchcopy');
  };

  const dm = darkMode;

  return (
    <DarkWrapper className="min-h-screen pt-12 pb-24 lg:pb-0">
      <div className="sticky top-12 z-40 border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: D.muted }}>
            <ArrowLeft size={14} /> 뒤로
          </button>
          <span className="text-sm font-semibold">My Page</span>
          <button onClick={handleSave}
            className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-all"
            style={{ backgroundColor: KEY }}>
            저장
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* 프로필 */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: D.card, border: '1px solid ' + D.border }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: D.muted }}>프로필</p>
          {/* 아바타 */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: avatarPreview ? 'transparent' : KEY }}>
                {avatarPreview
                  ? <img src={avatarPreview} className="w-full h-full object-cover" />
                  : user.avatar
                }
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={saving}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: KEY }}>
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>
            <div>
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs mt-0.5" style={{ color: D.muted }}>프로필 사진을 변경하려면 카메라를 클릭하세요.</p>
            </div>
          </div>
          {/* 닉네임 */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>닉네임</label>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-colors border"
              style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }} />
          </div>
        </div>

        {/* 설정 */}
        <div className="rounded-2xl" style={{ backgroundColor: D.card, border: '1px solid ' + D.border }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-5 pt-5 pb-3" style={{ color: D.muted }}>설정</p>
          {[
            { label: '이메일 수신 동의', sub: '프로젝트 업데이트 알림' },
            { label: '마케팅 정보 수신', sub: '새로운 프로젝트 소식' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5 border-t" style={{ borderColor: D.border }}>
              <div>
                <p className="text-sm font-medium" style={{ color: D.text }}>{item.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{item.sub}</p>
              </div>
              <div className="w-10 h-5 rounded-full relative cursor-pointer" style={{ backgroundColor: KEY }}>
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          ))}
        </div>

        {/* 디스플레이 */}
        <div className="rounded-2xl" style={{ backgroundColor: D.card, border: '1px solid ' + D.border }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-5 pt-5 pb-3" style={{ color: D.muted }}>디스플레이</p>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon size={16} style={{ color: KEY }} /> : <Sun size={16} className="text-amber-400" />}
              <div>
                <p className="text-sm font-medium" style={{ color: D.text }}>다크모드</p>
                <p className="text-[11px]" style={{ color: D.muted }}>{darkMode ? '어두운 테마 사용 중' : '밝은 테마 사용 중'}</p>
              </div>
            </div>
            <button onClick={toggleDarkMode}
              className="w-11 h-6 rounded-full relative transition-all duration-300"
              style={{ backgroundColor: darkMode ? KEY : '#e5e7eb' }}>
              <motion.div animate={{ x: darkMode ? 22 : 2 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
            </button>
          </div>
        </div>

        {/* 내 캐치 - 관리자는 표시 안 함 */}
        {!isAdminMode() && (
        <div className="rounded-2xl" style={{ backgroundColor: D.card, border: '1px solid ' + D.border }}>
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: 'rgba(5,213,96,0.1)' }}>💰</div>
              <div>
                <p className="text-sm font-medium" style={{ color: D.text }}>내 캐치</p>
                <p className="text-[11px]" style={{ color: D.muted }}>{catches.toLocaleString()} CATCH · {(catches / 10).toLocaleString()}원 상당</p>
              </div>
            </div>
            <button onClick={() => navigate('/catchcopy/wallet')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ color: KEY, backgroundColor: 'rgba(5,213,96,0.1)' }}>
              지갑 보기
            </button>
          </div>
        </div>
        )}

        {isAdminMode() && (
          <div className="rounded-2xl" style={{ backgroundColor: D.card, border: '1px solid ' + D.border }}>
            <button onClick={() => navigate('/catchcopy/admin')}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
              style={{ color: D.text }}>
              <div>
                <p className="text-sm font-semibold">Admin</p>
                <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>프로젝트 · 광고 · 분석 통합 관리</p>
              </div>
              <ChevronRight size={16} style={{ color: D.muted }} />
            </button>
          </div>
        )}

        {/* 내 활동 내역 */}
        <ActivitySection dm={dm} />

        {/* 로그아웃 */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all border"
          style={{ color: '#ef4444', borderColor: D.border, backgroundColor: D.card }}>
          <LogOut size={15} /> 로그아웃
        </button>
      </div>
    </DarkWrapper>
  );
}

// ── 다크모드 래퍼 ─────────────────────────────────────────
function DarkWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  const { darkMode } = useContext(AppContext);
  return (
    <div className={className} style={{ backgroundColor: D.bg, color: D.text }}>
      {children}
    </div>
  );
}

// ── 광고 배너 ────────────────────────────────────────────
// ── 광고 배너 ────────────────────────────────────────────
function AdBanner() {
  const { ads } = useContext(AppContext);
  const activeAds = ads.filter(a => a.is_active);
  const [current, setCurrent] = useState(0);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (activeAds.length <= 1) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => setCurrent(p => (p + 1) % activeAds.length), 4000);
    return () => clearInterval(timer.current);
  }, [activeAds.length]);

  if (activeAds.length === 0) return null;
  const ad = activeAds[current];

  const getObjPos = (a: Ad) => `${a.position_x ?? 'center'} ${a.position_y ?? 'center'}`;

  return (
    <div className="w-full relative overflow-hidden"
      style={{ aspectRatio: '24 / 5', cursor: ad.link_url ? 'pointer' : 'default' }}
      onClick={() => { if (ad.link_url) window.open(ad.link_url, '_blank', 'noopener,noreferrer'); }}>
      {activeAds.map((a, idx) => (
        <motion.div key={a.id} className="absolute inset-0"
          initial={false}
          animate={{ opacity: idx === current ? 1 : 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}>
          <img src={a.image_url} alt="광고"
            className="w-full h-full"
            style={{ objectFit: 'cover', objectPosition: getObjPos(a) }}
            draggable={false} />
        </motion.div>
      ))}
      {activeAds.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {activeAds.map((_, idx) => (
            <button key={idx}
              onClick={e => { e.stopPropagation(); setCurrent(idx); clearInterval(timer.current); }}
              className="rounded-full transition-all"
              style={{ width: idx === current ? 16 : 6, height: 6, backgroundColor: idx === current ? 'white' : 'rgba(255,255,255,0.5)' }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 모바일 하단 탭바 ─────────────────────────────────────
function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode: dm } = useContext(AppContext);
  const path = location.pathname;
  const activeTab = path.startsWith('/catchcopy/brief') && !path.includes('/admin') ? 'brief'
    : path.startsWith('/catchcopy/community') ? 'community'
    : path.startsWith('/catchcopy/media') ? 'media'
    : path.startsWith('/catchcopy/contact') ? 'contact'
    : path.startsWith('/catchcopy/mypage') ? 'mypage'
    : 'home';

  const tabs = [
    { id: 'home', label: '홈', path: '/catchcopy',
      icon: (a: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill={a ? KEY : (dm ? D.muted : '#9ca3af')}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
    { id: 'brief', label: 'WORK', path: '/catchcopy/brief',
      icon: (a: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill={a ? KEY : (dm ? D.muted : '#9ca3af')}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg> },
    { id: 'community', label: 'COMMUNITY', path: '/catchcopy/community',
      icon: (a: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill={a ? KEY : (dm ? D.muted : '#9ca3af')}><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg> },
    { id: 'media', label: 'MEDIA', path: '/catchcopy/media',
      icon: (a: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill={a ? KEY : (dm ? D.muted : '#9ca3af')}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg> },
    { id: 'mypage', label: 'MY', path: '/catchcopy/mypage',
      icon: (a: boolean) => <svg width="26" height="26" viewBox="0 0 24 24" fill={a ? KEY : (dm ? D.muted : '#9ca3af')}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden border-t z-50"
      style={{ backgroundColor: D.card, borderColor: D.border }}>
      <div className="grid grid-cols-5 h-16">
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => navigate(t.path)}
              className="flex flex-col items-center justify-center gap-1 transition-colors">
              {t.icon(active)}
              <span className="text-[10px] font-medium" style={{ color: active ? KEY : (dm ? D.muted : '#9ca3af') }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── 헤더 ──────────────────────────────────────────────────
function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, darkMode } = useContext(AppContext);
  const dm = darkMode;
  const activeTab = location.pathname.startsWith('/catchcopy/brief') ? 'brief'
    : location.pathname.startsWith('/catchcopy/community') ? 'community'
    : location.pathname.startsWith('/catchcopy/media') ? 'media'
    : location.pathname.startsWith('/catchcopy/contact') ? 'contact' : 'home';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b transition-colors"
      style={{ backgroundColor: D.card, borderColor: D.border }}>
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <button onClick={() => navigate('/catchcopy')} className="flex items-center">
            <img src="/logo2.png" alt="imby" className="h-5 w-auto object-contain" />
          </button>
          <nav className="hidden md:flex items-center gap-0.5">
            {[{ id: 'brief', label: 'WORK' }, { id: 'community', label: 'COMMUNITY' }, { id: 'media', label: 'MEDIA' }, { id: 'contact', label: 'CONTACT' }].map(t => (
              <button key={t.id} onClick={() => navigate(`/catchcopy/${t.id}`)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ color: activeTab === t.id ? KEY : dm ? D.muted : '#6b7280', backgroundColor: activeTab === t.id ? 'rgba(5, 213, 96, 0.08)' : 'transparent' }}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Admin 버튼 - 관리자 이메일 로그인 시에만 표시 */}
          {user?.isAdmin && (
            <button onClick={() => navigate('/catchcopy/admin')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              Admin
            </button>
          )}
          {user ? (
            <button onClick={() => navigate('/catchcopy/mypage')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all border"
              style={{ color: D.text, borderColor: user?.isAdmin ? KEY : (dm ? D.border : '#e5e7eb'), backgroundColor: D.hover }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} className="w-4 h-4 rounded-full object-cover" />
                : <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-black" style={{ backgroundColor: isAdminMode() ? '#f59e0b' : KEY }}>{user.avatar}</div>
              }
              {user.name}
            </button>
          ) : (
            <button onClick={() => navigate('/catchcopy/login')}
              className="hidden sm:block text-xs font-medium px-3 py-1.5 transition-colors"
              style={{ color: D.muted }}>
              로그인
            </button>
          )}

        </div>
      </div>

    </header>
  );
}

// ── 브리프 카드 ──────────────────────────────────────────
function BriefCard({ brief, onClick, large }: { brief: Brief; onClick: () => void; large?: boolean }) {
  const { darkMode: dm } = useContext(AppContext);
  const dday = getDday(brief.deadline);
  const isExpired = brief.status === 'CLOSED' || dday.isExpired;

  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={onClick}
      className="cursor-pointer group rounded-2xl overflow-hidden transition-all"
      style={{ backgroundColor: D.card, border: '1px solid ' + D.border,
        opacity: isExpired ? 0.6 : 1, filter: isExpired ? 'grayscale(0.7)' : 'none' }}>
      {/* 이미지 영역 */}
      <div className={cn("relative overflow-hidden", large ? "h-52 sm:h-64" : "h-40 sm:h-48",
        !brief.image_url && brief.bg_color)}>
        {brief.image_url ? (
          <img src={brief.image_url} alt={brief.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Megaphone size={large ? 40 : 28} className="text-white/40" />
          </div>
        )}
        {/* 그라디언트 오버레이 */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />
        {/* CLOSED 오버레이 */}
        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-white text-sm font-bold px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">브리프 CLOSED</span>
          </div>
        )}
        {/* 뱃지들 */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
            isExpired ? "bg-white/60 text-gray-500" : "bg-[#22CD6D] text-white")}>
            {isExpired ? 'CLOSED' : 'IN PROGRESS'}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">{brief.reward}</span>
        </div>
        {/* 하단 정보 */}
        <div className="absolute bottom-3 left-3 right-12">
          <p className="text-[10px] text-white/70 font-medium mb-0.5">{brief.company_name}</p>
          <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">{brief.title}</h4>
        </div>
        {!isExpired && (
          <div className="absolute bottom-3 right-3">
            <div className="bg-white text-[10px] font-bold px-2.5 py-1 rounded-full text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
              참여 →
            </div>
          </div>
        )}
      </div>
      {/* 하단 메타 - 고정 높이 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ height: 52 }}>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: D.muted }}>
          <span className="flex items-center gap-1"><Users size={10} /> {brief.participants.toLocaleString()}명</span>
          {!isExpired && <span className="flex items-center gap-1"><Clock size={10} /> {dday.label}</span>}
          {isExpired && <span className="text-[11px]" style={{ color: D.muted }}>마감</span>}
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: D.muted, backgroundColor: D.hover }}>{brief.category}</span>
      </div>
    </motion.div>
  );
}

// ── 브리프 상세 ──────────────────────────────────────────
function BriefPage() {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { user, darkMode: dm, catches, setCatches } = useContext(AppContext);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [mode, setMode] = useState<'read' | 'participate'>('read');
  const [copies, setCopies] = useState<CopyEntry[]>([]);
  const [newCopy, setNewCopy] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [hasRead, setHasRead] = useState(false);
  const [hasCopy, setHasCopy] = useState(false);
  const [hasVisitedUrl, setHasVisitedUrl] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [readProgress, setReadProgress] = useState(0);
  const lockTimer = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const vk = getVoterKey();

  useEffect(() => {
    if (!briefId) return;
    supabase.from('briefs').select('*').eq('id', briefId).single().then(async ({ data }) => {
      if (data) {
        await supabase.from('briefs').update({ views: (data.views ?? 0) + 1 }).eq('id', briefId);
        setBrief({ ...data, views: (data.views ?? 0) + 1 });
      }
      setBriefLoading(false);
    });
    // 이미 읽은 기록 확인 → 있으면 바로 참여 모드로
    supabase.from('brief_reads').select('id').eq('brief_id', briefId).eq('voter_key', vk).single()
      .then(({ data }) => {
        if (data) {
          setHasRead(true);
          setHasVisitedUrl(true); // 이미 읽은 사람은 URL도 방문한 것으로 처리
          setMode('participate'); // 바로 참여 모드
        }
      });
  }, [briefId]);

  useEffect(() => {
    if (!briefId) return;
    setLoading(true);
    supabase.from('copies').select('*').eq('brief_id', briefId).order('upvotes', { ascending: false })
      .then(({ data }) => { setCopies(data ?? []); setLoading(false); });
    supabase.from('copies').select('id').eq('brief_id', briefId).eq('voter_key', vk).single()
      .then(({ data }) => { if (data) setHasCopy(true); });
    supabase.from('copy_votes').select('copy_id').eq('voter_key', vk)
      .then(({ data }) => {
        const dbVoted = new Set((data ?? []).map((r: any) => r.copy_id));
        const lsVoted = new Set<string>();
        Object.keys(localStorage).forEach(k => {
          const m = k.match(/^copy_voted_([^_]+)_/);
          if (m) lsVoted.add(m[1]);
        });
        setMyVotes(new Set([...dbVoted, ...lsVoted]));
      });
    const ch = supabase.channel('copies-' + briefId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'copies', filter: 'brief_id=eq.' + briefId },
        ({ eventType, new: nr, old: or }) => {
          if (eventType === 'INSERT') setCopies(p => [...p, nr as CopyEntry].sort((a, b) => b.upvotes - a.upvotes));
          else if (eventType === 'UPDATE') setCopies(p => [...p.map(c => c.id === (nr as CopyEntry).id ? nr as CopyEntry : c)].sort((a, b) => b.upvotes - a.upvotes));
          else if (eventType === 'DELETE') setCopies(p => p.filter(c => c.id !== (or as CopyEntry).id));
        }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [briefId]);

  // 읽기 타이머 시작
  const startReadLock = () => {
    if (hasRead) { setMode('participate'); return; }
    const textLen = (brief?.problem ?? '').length + (brief?.target ?? '').length + (brief?.campaign_info ?? '').length;
    const secs = Math.min(20, Math.max(5, Math.floor(textLen / 50)));
    setLockSeconds(secs);
    setReadProgress(0);
    clearInterval(lockTimer.current);
    let elapsed = 0;
    lockTimer.current = setInterval(async () => {
      elapsed += 1;
      setReadProgress(Math.round((elapsed / secs) * 100));
      setLockSeconds(secs - elapsed);
      if (elapsed >= secs) {
        clearInterval(lockTimer.current);
        setLockSeconds(0);
        setHasRead(true);
        // DB에 읽음 기록 저장 (await로 확실히 처리)
        await supabase.from('brief_reads').insert({ brief_id: briefId, voter_key: vk });
      }
    }, 1000);
  };

  // 조건 충족 여부 계산
  const canParticipate = hasRead && (!(brief?.external_url) || hasVisitedUrl);

  const handleGoParticipate = () => {
    if (!hasRead) { alert('브리프를 먼저 충분히 읽어주세요.'); return; }
    if (brief?.external_url && !hasVisitedUrl) { alert('더 알아보기 버튼을 눌러 상세 내용을 확인해주세요.'); return; }
    setMode('participate');
  };

  const handleSubmitCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCopy.trim() || submitting) return;
    if (hasCopy) return alert('이 브리프에는 이미 카피를 작성하셨습니다.');
    // 내용 검증: 너무 짧거나 의미없는 내용 차단
    if (newCopy.trim().length < 4) return alert('카피는 4자 이상 입력해주세요.');
    if (newCopy.trim().length > 100) return alert('카피는 100자 이내로 입력해주세요.');
    setSubmitting(true);
    try {
      // Edge Function 시도
      let newCatches = catches + 400;
      try {
        const result = await callEdgeFunction('submit-copy', {
          voter_key: vk, brief_id: briefId,
          content: newCopy.trim(), author: user?.name ?? '익명',
        });
        newCatches = result.catches;
      } catch {
        // Edge Function 실패 시 직접 Supabase로 처리
        const { error: copyErr } = await supabase.from('copies').insert({
          brief_id: briefId, voter_key: vk,
          author: user?.name ?? '익명', content: newCopy.trim(), upvotes: 0,
        });
        if (copyErr) {
          if (copyErr.code === '23505') throw new Error('이미 카피를 작성하셨습니다.');
          throw new Error('카피 등록에 실패했습니다.');
        }
        // 캐치 적립
        const { data: uc } = await supabase.from('user_catches').select('catches').eq('voter_key', vk).single();
        if (uc) {
          newCatches = uc.catches + 400;
          await supabase.from('user_catches').update({ catches: newCatches }).eq('voter_key', vk);
        } else {
          newCatches = 400;
          await supabase.from('user_catches').insert({ voter_key: vk, catches: 400 });
        }
      }
      setCatches(newCatches);
      localStorage.setItem('cc_catches', String(newCatches));
      setHasCopy(true);
      setNewCopy('');
      alert('카피가 등록되었습니다! 400 캐치가 적립되었어요.');
    } catch (err: any) {
      alert(err.message ?? '등록 중 오류가 발생했습니다.');
    }
    setSubmitting(false);
  };

  const handleVote = async (copyId: string) => {
    const alreadyVoted = myVotes.has(copyId);
    const action = alreadyVoted ? 'unvote' : 'vote';
    // 낙관적 UI 업데이트 (즉시 반영)
    setMyVotes(p => {
      const n = new Set(p);
      alreadyVoted ? n.delete(copyId) : n.add(copyId);
      return n;
    });
    try {
      // Edge Function으로 서버사이드 투표 처리
      await callEdgeFunction('vote-copy', { voter_key: vk, copy_id: copyId, action });
    } catch (err: any) {
      // 실패 시 롤백
      setMyVotes(p => {
        const n = new Set(p);
        alreadyVoted ? n.add(copyId) : n.delete(copyId);
        return n;
      });
      if (err.message !== '자신의 카피에는 투표할 수 없습니다.') {
        console.error('Vote error:', err.message);
      }
    }
  };

  if (briefLoading) return <div className="min-h-screen flex items-center justify-center pt-12"><Spinner /></div>;
  if (!brief) return <div className="min-h-screen flex items-center justify-center pt-12 text-sm" style={{ color: D.muted }}>브리프를 찾을 수 없습니다.</div>;

  // ── WORK(브리프) 상세 - 카피 제출 없이 내용 + PDF 다운로드만 ──
  return (
    <div className="min-h-screen pt-12 pb-16" style={{ backgroundColor: D.bg }}>
      {/* 풀스크린 헤더 이미지 */}
      <div className={cn("relative w-full", !brief.image_url && brief.bg_color)} style={{ height: '40vh', minHeight: 220 }}>
        {brief.image_url
          ? <img src={brief.image_url} alt={brief.title} className="w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center"><Megaphone size={80} className="text-white/20" /></div>
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.1))' }} />
        <button onClick={() => navigate('/catchcopy/brief')}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-full hover:bg-white/20 transition-all backdrop-blur-sm bg-white/10">
          <ArrowLeft size={13} /> 목록
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full",
              getDday(brief.deadline).isExpired || brief.status === 'CLOSED' ? "bg-white/20 text-white" : "bg-[#22CD6D] text-white")}>
              {getDday(brief.deadline).isExpired || brief.status === 'CLOSED' ? 'CLOSED' : 'IN PROGRESS'}
            </span>
            <span className="text-[10px] text-white/60">{brief.category}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-1">{brief.title}</h1>
          <p className="text-xs text-white/60">{brief.company_name}</p>
        </div>
      </div>

      {/* 브리프 내용 */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {[
          { label: 'OVERVIEW', content: brief.problem },
          { label: 'TARGET', content: brief.target },
          { label: 'DIRECTION', content: brief.campaign_info },
        ].map(({ label, content }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: KEY }}>{label}</p>
            <div className="text-sm leading-relaxed" style={{ color: D.text }}
              dangerouslySetInnerHTML={{ __html: content ?? '' }} />
          </div>
        ))}

        {/* 메타 정보 */}
        <div className="rounded-2xl p-5 border" style={{ backgroundColor: D.card, borderColor: D.border }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: D.muted }}>마감</p>
              <p className="text-sm font-semibold" style={{ color: D.text }}>
                {getDday(brief.deadline).isExpired ? '마감' : getDday(brief.deadline).label + ' (' + (brief.deadline.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '') + ')'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: D.muted }}>카테고리</p>
              <p className="text-sm font-semibold" style={{ color: D.text }}>{brief.category}</p>
            </div>
          </div>
        </div>

        {/* PDF 다운로드 */}
        {(brief as any).pdf_url && (
          <a href={(brief as any).pdf_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between w-full rounded-xl p-4 border transition-all hover:opacity-80"
            style={{ backgroundColor: D.card, borderColor: D.border }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(5,213,96,0.1)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={KEY}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 17v-1h8v1H8zm0-3v-1h8v1H8zm0-3V10h5v1H8z"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: D.text }}>자료 다운로드</p>
                <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>PDF 파일</p>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: D.muted }} />
          </a>
        )}

        {/* 외부 URL */}
        {brief.external_url && (
          <a href={brief.external_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between w-full rounded-xl p-4 border transition-all hover:opacity-80"
            style={{ backgroundColor: D.card, borderColor: D.border }}>
            <p className="text-sm font-semibold" style={{ color: D.text }}>더 알아보기</p>
            <ChevronRight size={16} style={{ color: D.muted }} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── 프로젝트 관리자 작성 ──────────────────────────────────
// ── 마감일 캘린더 피커 ────────────────────────────────────
function DeadlinePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { darkMode: dm } = useContext(AppContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // value를 날짜로 파싱 (YYYY-MM-DD 또는 기존 텍스트)
  const parseDate = (v: string) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  const selectedDate = parseDate(value);

  // 캘린더 상태
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // 바깥 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handleSelect = (day: number) => {
    const picked = new Date(viewYear, viewMonth, day);
    picked.setHours(0, 0, 0, 0);
    const diff = Math.ceil((picked.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    // "D-7", "D-30" 형태로 저장
    const label = diff <= 0 ? '마감' : diff === 1 ? '내일 마감' : `D-${diff}`;
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} (${label})`);
    setOpen(false);
  };

  const displayValue = value
    ? value.split(' ')[0] + (value.includes('(') ? ' ' + value.split(' ').slice(1).join(' ') : '')
    : '';

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:border-[#22CD6D] transition-colors flex items-center justify-between border" style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }}>
        <span style={{ color: value ? (dm ? D.text : '#111') : D.muted }}>
          {displayValue || '마감일 선택'}
        </span>
        <Clock size={13} className="shrink-0" style={{ color: D.muted }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 top-full mt-1.5 left-0 rounded-xl shadow-lg overflow-hidden border" style={{ backgroundColor: D.card, borderColor: D.border }}
            style={{ width: 260 }}>
            {/* 월 네비게이션 */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: D.border }}>
              <button type="button" onClick={() => {
                if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
                else setViewMonth(m => m - 1);
              }} className="w-6 h-6 flex items-center justify-center rounded-md transition-colors" style={{ color: D.muted }}>
                <ChevronDown size={13} className="rotate-90" />
              </button>
              <span className="text-xs font-semibold" style={{ color: D.text }}>{viewYear}년 {MONTHS[viewMonth]}</span>
              <button type="button" onClick={() => {
                if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
                else setViewMonth(m => m + 1);
              }} className="w-6 h-6 flex items-center justify-center rounded-md transition-colors" style={{ color: D.muted }}>
                <ChevronDown size={13} className="-rotate-90" />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 px-2 pt-2">
              {DAYS.map((d, i) => (
                <div key={d} className={cn("text-center text-[10px] font-semibold py-1",
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400")}>
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 px-2 pb-3 gap-y-0.5">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const thisDate = new Date(viewYear, viewMonth, day);
                thisDate.setHours(0, 0, 0, 0);
                const isPast = thisDate < today;
                const isToday = thisDate.getTime() === today.getTime();
                const isSelected = selectedDate && thisDate.getTime() === selectedDate.getTime();
                const dow = thisDate.getDay();
                return (
                  <button key={day} type="button" disabled={isPast} onClick={() => handleSelect(day)}
                    className={cn("w-full aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all",
                      isSelected ? "text-white" : isPast ? "text-gray-300 cursor-not-allowed"
                        : isToday ? "font-bold"
                          : dow === 0 ? "text-red-400 hover:bg-red-50"
                            : dow === 6 ? "text-blue-400 hover:bg-blue-50"
                              : dm ? `hover:bg-[${D.hover}] text-gray-300` : "text-gray-700 hover:bg-gray-100")}
                    style={isSelected ? { backgroundColor: KEY } : isToday && !isSelected ? { color: KEY } : {}}>
                    {day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ── 브리프 필터 드롭다운 ──────────────────────────────────
function BriefDropdown({ value, options, onChange, dm }: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
  dm: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
        style={{
          backgroundColor: value !== options[0].id ? KEY : (dm ? D.card : 'white'),
          color: value !== options[0].id ? 'white' : (dm ? D.muted : '#6b7280'),
          borderColor: value !== options[0].id ? KEY : (dm ? D.border : '#e5e7eb'),
        }}>
        {selected?.label ?? options[0].label}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 rounded-xl border shadow-lg overflow-hidden min-w-[120px]"
          style={{ backgroundColor: D.card, borderColor: D.border }}>
          {options.map(o => (
            <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:opacity-80"
              style={{
                color: value === o.id ? KEY : (dm ? D.text : '#374151'),
                backgroundColor: value === o.id ? (dm ? 'rgba(5,213,96,0.08)' : 'rgba(5,213,96,0.05)') : 'transparent',
                fontWeight: value === o.id ? 600 : 400,
              }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 브리프용 리치 텍스트 필드 ──────────────────────────────
function BriefRichField({ value, onChange, placeholder, dm }: {
  value: string; onChange: (v: string) => void; placeholder: string; dm: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, []);

  const execCmd = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const toggleHighlight = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const el = sel.getRangeAt(0).commonAncestorContainer;
      const parent = el.nodeType === 3 ? (el as Text).parentElement : el as HTMLElement;
      const bg = parent ? window.getComputedStyle(parent).backgroundColor : '';
      document.execCommand('hiliteColor', false, bg === 'rgb(254, 255, 156)' ? 'transparent' : '#FEFF9C');
    }
  };

  const btnStyle = (active?: boolean) => ({
    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: '1px solid ' + (dm ? '#3a3a45' : '#e5e7eb'),
    backgroundColor: active ? '#22CD6D' : (dm ? '#2C2C35' : 'white'),
    color: active ? 'white' : (dm ? '#ccc' : '#374151'),
  });

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#3a3a45' }}>
      {/* 서식 툴바 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b" style={{ backgroundColor: '#2C2C35', borderColor: '#3a3a45' }}>
        <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('bold'); }} style={btnStyle()}>
          <span style={{ fontWeight: 'bold' }}>B</span>
        </button>
        <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('underline'); }} style={btnStyle()}>
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button type="button" onMouseDown={e => { e.preventDefault(); toggleHighlight(); }} style={btnStyle()}>
          <span style={{ background: '#FEFF9C', padding: '0 3px', borderRadius: 2, color: '#111' }}>A</span>
        </button>
      </div>
      {/* 편집 영역 */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => { if (!isComposing.current) onChange(ref.current?.innerHTML ?? ''); }}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; onChange(ref.current?.innerHTML ?? ''); }}
        className="outline-none text-sm leading-relaxed px-3 py-2.5"
        style={{
          minHeight: 80, color: '#e5e7eb',
          backgroundColor: '#17171C',
        }}
      />
    </div>
  );
}

function BriefWritePage() {
  const navigate = useNavigate();
  const { darkMode: dm } = useContext(AppContext);
  const [form, setForm] = useState({
    company_name: '', title: '', problem: '', target: '', campaign_info: '',
    reward: '-', deadline: '', category: '식품', status: 'IN PROGRESS' as 'IN PROGRESS' | 'CLOSED',
    external_url: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setPdfName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required = ['company_name', 'title', 'problem', 'target', 'campaign_info', 'deadline'];
    if (required.some(k => !(form as any)[k].trim())) return alert('모든 항목을 입력해주세요.');
    setSubmitting(true);

    let image_url = '';
    if (imageFile) {
      const compressed = await imageCompression(imageFile, { maxSizeMB: 2, maxWidthOrHeight: 2400, initialQuality: 0.95, useWebWorker: true });
      const ext = imageFile.name.split('.').pop();
      const path = 'briefs/' + Date.now() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('brief-images').upload(path, compressed, { upsert: true });
      if (!uploadError) {
        const { data } = supabase.storage.from('brief-images').getPublicUrl(path);
        image_url = data.publicUrl;
      }
    }

    let pdf_url = '';
    if (pdfFile) {
      const pdfPath = 'pdfs/' + Date.now() + '_' + pdfFile.name;
      const { error: pdfErr } = await supabase.storage.from('brief-images').upload(pdfPath, pdfFile, { upsert: true });
      if (!pdfErr) {
        const { data } = supabase.storage.from('brief-images').getPublicUrl(pdfPath);
        pdf_url = data.publicUrl;
      }
    }

    const { error } = await supabase.from('briefs').insert({
      ...form, participants: 0, bg_color: 'bg-gray-200',
      image_url: image_url || null,
      external_url: form.external_url || null,
      ...(pdf_url ? { pdf_url } : {}),
    } as any);
    setSubmitting(false);
    if (!error) navigate('/catchcopy/brief');
    else alert('저장 중 오류: ' + error.message);
  };

  const inputClass = "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#22CD6D] transition-colors border";
  const inputStyle = { backgroundColor: D.bg, borderColor: dm ? D.border : "#e5e7eb", color: dm ? D.text : "#111" };

  return (
    <div className="min-h-screen pt-12" style={{ backgroundColor: D.bg }}>
      <div className="sticky top-12 z-40 border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: D.muted }}>
            <ArrowLeft size={14} /> 취소
          </button>
          <span className="text-sm font-semibold" style={{ color: D.text }}>프로젝트 등록</span>
          <button onClick={handleSubmit} disabled={submitting}
            className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: KEY }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : '등록'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이미지 업로드 */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: D.muted }}>프로젝트 이미지 <span className="normal-case font-normal">(권장: 800×500px, PNG/JPG)</span></p>
            <div onClick={() => fileRef.current?.click()}
              className={cn("relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed transition-all",
                imagePreview ? "border-transparent" : "border-gray-200 hover:border-[#22CD6D]/50")}
              style={{ height: 200 }}>
              {imagePreview
                ? <img src={imagePreview} className="w-full h-full object-cover" />
                : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Upload size={24} />
                  <p className="text-xs font-medium">클릭해서 이미지 업로드</p>
                  <p className="text-[11px]">800 × 500px PNG 권장</p>
                </div>
              }
              {imagePreview && (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all flex items-center justify-center">
                  <p className="text-white text-xs font-medium opacity-0 hover:opacity-100">클릭해서 변경</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>상태</label>
              <div className="flex p-0.5 rounded-lg gap-0.5" style={{ backgroundColor: D.hover }}>
                {(['IN PROGRESS', 'CLOSED'] as const).map(s => (
                  <button key={s} type="button" onClick={() => set('status', s)}
                    className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={{ backgroundColor: form.status === s ? (dm ? D.card : 'white') : 'transparent', color: form.status === s ? (dm ? D.text : '#111') : D.muted }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>카테고리</label>
              <div className="flex flex-wrap gap-1.5">
                {BRIEF_CATS.filter(c => c !== '전체').map(c => (
                  <button key={c} type="button" onClick={() => set('category', c)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                    style={{
                      backgroundColor: form.category === c ? KEY : 'transparent',
                      color: form.category === c ? 'white' : D.muted,
                      borderColor: form.category === c ? KEY : (dm ? '#3a3a45' : '#e5e7eb'),
                    }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {[
            { key: 'company_name', label: '회사명', placeholder: '카페인 (Cafe-In)' },
            { key: 'title', label: '프로젝트 제목', placeholder: 'MZ세대를 위한 새로운 디카페인 커피 브랜드 런칭' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{label}</label>
              <input type="text" value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} className={inputClass} style={inputStyle} />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">OVERVIEW</label>
            <BriefRichField value={form.problem} onChange={v => set('problem', v)} placeholder="기존 디카페인 커피는 맛이 없다는 편견이 강해 젊은 층의 유입이 적음." dm={dm} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">타겟</label>
            <BriefRichField value={form.target} onChange={v => set('target', v)} placeholder="커피를 좋아하지만 카페인 민감도가 높은 2030 직장인" dm={dm} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">DIRECTION</label>
            <BriefRichField value={form.campaign_info} onChange={v => set('campaign_info', v)} placeholder="맛과 향을 모두 잡은 스위스 워터 프로세스 공법 강조" dm={dm} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">마감일</label>
              <DeadlinePicker value={form.deadline} onChange={v => set('deadline', v)} />
            </div>
          </div>
          {/* PDF 업로드 */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>PDF 첨부 <span className="font-normal normal-case">(선택)</span></label>
            <div onClick={() => pdfRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 flex items-center gap-3 transition-all hover:border-[#22CD6D]/50"
              style={{ borderColor: pdfName ? KEY : (dm ? D.border : '#e5e7eb'), backgroundColor: D.bg }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: pdfName ? 'rgba(5,213,96,0.1)' : (dm ? D.hover : '#f3f4f6') }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={pdfName ? KEY : D.muted}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 17v-1h8v1H8zm0-3v-1h8v1H8zm0-3V10h5v1H8z"/></svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: pdfName ? (dm ? D.text : '#111') : D.muted }}>{pdfName || 'PDF 파일 클릭해서 업로드'}</p>
                {!pdfName && <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>상세 자료, 제안서 등</p>}
              </div>
            </div>
            <input ref={pdfRef} type="file" accept="application/pdf" onChange={handlePdfChange} className="hidden" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>더 알아보기 URL <span className="font-normal normal-case">(선택)</span></label>
            <input type="url" value={(form as any).external_url ?? ''} onChange={e => set('external_url', e.target.value)}
              placeholder="https://example.com/brief-detail"
              className={inputClass} style={inputStyle} />
          </div>
        </form>
      </div>
    </div>
  );
}
// ── 내 지갑 ────────────────────────────────────────────────
function WalletPage() {
  const navigate = useNavigate();
  const { darkMode: dm, catches } = useContext(AppContext);
  const [history, setHistory] = useState<any[]>([]);
  const [copyHistory, setCopyHistory] = useState<any[]>([]);
  const vk = getVoterKey();

  useEffect(() => {
    supabase.from('catch_payouts').select('*, briefs(title)').eq('voter_key', vk)
      .order('created_at', { ascending: false }).then(({ data }) => setHistory(data ?? []));
    supabase.from('copies').select('id, content, created_at, brief_id, briefs(title)').eq('voter_key', vk)
      .order('created_at', { ascending: false }).then(({ data }) => setCopyHistory(data ?? []));
  }, []);

  const totalEarned = (copyHistory.length * 400) + history.filter(h => h.status === 'paid').reduce((s: number, h: any) => s + h.catch_amount, 0);

  const allHistory = [
    ...copyHistory.map((c: any) => ({ id: 'copy_' + c.id, type: 'copy', title: c.briefs?.title ?? '브리프', content: c.content, amount: 400, date: c.created_at, status: 'done' })),
    ...history.map((h: any) => ({ id: 'pay_' + h.id, type: 'payout', title: h.briefs?.title ?? '브리프', rank: h.rank, amount: h.catch_amount, date: h.created_at, status: h.status })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen pt-12 pb-24 lg:pb-0" style={{ backgroundColor: D.bg }}>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* 잔액 카드 */}
        <div className="rounded-2xl p-6 mb-4 text-white" style={{ backgroundColor: KEY }}>
          <p className="text-xs font-semibold opacity-80 mb-1">내 캐치 잔액</p>
          <p className="text-4xl font-bold mb-1">{catches.toLocaleString()}</p>
          <p className="text-xs opacity-70">CATCH · {(catches / 10).toLocaleString()}원 상당</p>
          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-lg font-bold">{copyHistory.length}</p><p className="text-[11px] opacity-70">카피 작성</p></div>
            <div><p className="text-lg font-bold">{history.filter(h => h.status === 'paid').length}</p><p className="text-[11px] opacity-70">TOP4 수상</p></div>
            <div><p className="text-lg font-bold">{totalEarned.toLocaleString()}</p><p className="text-[11px] opacity-70">총 적립</p></div>
          </div>
        </div>

        {/* 캐치마켓 배너 */}
        <button onClick={() => navigate('/catchcopy/market')}
          className="w-full rounded-xl p-4 mb-4 flex items-center justify-between border transition-all hover:opacity-80"
          style={{ backgroundColor: D.card, borderColor: D.border }}>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: D.text }}>캐치마켓</p>
            <p className="text-xs mt-0.5" style={{ color: D.muted }}>캐치로 기프티콘을 구매하세요</p>
          </div>
          <ChevronRight size={16} style={{ color: D.muted }} />
        </button>

        {/* 적립 내역 */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: D.card, borderColor: D.border }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: D.border }}>
            <p className="text-sm font-semibold" style={{ color: D.text }}>적립 내역</p>
          </div>
          {allHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-medium mb-1" style={{ color: D.muted }}>아직 내역이 없어요</p>
              <p className="text-xs" style={{ color: D.muted }}>브리프에 카피를 작성하면 400 캐치가 적립됩니다.</p>
            </div>
          ) : allHistory.map(item => (
            <div key={item.id} className="px-4 py-3.5 border-b flex items-center gap-3"
              style={{ borderColor: D.border }}>
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: item.type === 'payout' ? 'rgba(251,191,36,0.1)' : 'rgba(5,213,96,0.08)' }}>
                {item.type === 'payout'
                  ? <Trophy size={14} style={{ color: '#f59e0b' }} />
                  : <Pen size={14} style={{ color: KEY }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: D.text }}>
                  {item.type === 'copy' ? '카피 작성' : (item as any).rank + '등 수상'}
                </p>
                <p className="text-[11px] truncate mt-0.5" style={{ color: D.muted }}>
                  {item.title}{item.type === 'copy' && (item as any).content ? ' · "' + (item as any).content + '"' : ''}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: D.muted }}>
                  {new Date(item.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} {new Date(item.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold mb-1" style={{ color: KEY }}>+{item.amount.toLocaleString()}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: item.status === 'paid' || item.status === 'done' ? 'rgba(5,213,96,0.1)' : 'rgba(251,191,36,0.1)',
                    color: item.status === 'paid' || item.status === 'done' ? KEY : '#f59e0b'
                  }}>
                  {item.status === 'paid' ? '지급완료' : item.status === 'done' ? '적립완료' : '지급대기'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 캐치마켓 ────────────────────────────────────────────────
function MarketPage() {
  const navigate = useNavigate();
  const { darkMode: dm } = useContext(AppContext);

  return (
    <div className="min-h-screen pt-12 pb-24 lg:pb-0 flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: D.bg }}>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: 'rgba(5,213,96,0.1)' }}>
          <span className="text-4xl">🎁</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: D.text }}>캐치마켓</h2>
        <p className="text-sm mb-1" style={{ color: D.muted }}>캐치로 모바일 기프티콘을 구매하는 곳이에요.</p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-4 mb-6"
          style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#f59e0b' }}>
          <span className="text-xs font-semibold">🔒 오픈 예정</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {['스타벅스 아메리카노', '카카오페이 포인트', '배달의민족 쿠폰', 'GS25 모바일상품권'].map((item, i) => (
            <div key={i} className="rounded-xl p-3 text-center border opacity-40"
              style={{ backgroundColor: D.card, borderColor: D.border }}>
              <p className="text-xl mb-1">☕</p>
              <p className="text-[11px] font-medium" style={{ color: D.text }}>{item}</p>
              <p className="text-[10px] mt-0.5" style={{ color: D.muted }}>준비중</p>
            </div>
          ))}
        </div>
        <button onClick={() => navigate(-1)} className="mt-6 text-xs transition-colors" style={{ color: D.muted }}>
          돌아가기
        </button>
      </div>
    </div>
  );
}

// ── 관리자 대시보드 ──────────────────────────────────────
function AdminPage() {
  const navigate = useNavigate();
  const { darkMode: dm } = useContext(AppContext);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(() => localStorage.getItem('cc_admin') === '1');
  const [payouts, setPayouts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'briefs' | 'payouts' | 'ads' | 'analytics'>('briefs');
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    const { data: briefList } = await supabase.from('briefs').select('*').order('created_at', { ascending: false });
    if (!briefList) { setAnalyticsLoading(false); return; }
    const results = await Promise.all(briefList.map(async (b: Brief) => {
      const [{ count: totalReads }, { count: uniqueReads }, { count: copyCount }, { data: copyData }] = await Promise.all([
        supabase.from('brief_reads').select('*', { count: 'exact', head: true }).eq('brief_id', b.id),
        supabase.from('brief_reads').select('voter_key', { count: 'exact', head: true }).eq('brief_id', b.id),
        supabase.from('copies').select('*', { count: 'exact', head: true }).eq('brief_id', b.id),
        supabase.from('copies').select('upvotes').eq('brief_id', b.id),
      ]);
      const totalVotes = (copyData ?? []).reduce((s: number, c: any) => s + (c.upvotes ?? 0), 0);
      const views = b.views ?? 0;
      const adFee = views * 50; // 조회수 × 50원
      return {
        ...b,
        totalReads: totalReads ?? 0,
        uniqueReads: uniqueReads ?? 0,
        duplicateReads: Math.max(0, (totalReads ?? 0) - (uniqueReads ?? 0)),
        copyCount: copyCount ?? 0,
        totalVotes,
        adFee,
      };
    }));
    setAnalytics(results);
    setAnalyticsLoading(false);
  };
  const { ads, setAds } = useContext(AppContext);
  const [adUploading, setAdUploading] = useState(false);
  const adFileRef = useRef<HTMLInputElement>(null);

  const loadAds = () => {
    supabase.from('ads').select('*').order('sort_order').then(({ data }) => setAds(data ?? []));
  };

  const handleAdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (ads.length >= 5) return alert('광고는 최대 5개까지 등록 가능합니다.');
    setAdUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = 'ads/' + Date.now() + '.' + ext;
      const { error: uploadErr } = await supabase.storage.from('ad-images').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('ad-images').getPublicUrl(path);
      await supabase.from('ads').insert({ image_url: data.publicUrl, sort_order: ads.length, is_active: true });
      loadAds();
    } catch { alert('업로드 실패'); }
    setAdUploading(false);
    if (adFileRef.current) adFileRef.current.value = '';
  };

  const handleAdDelete = async (id: string, imageUrl: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    const path = imageUrl.split('/ad-images/')[1];
    if (path) await supabase.storage.from('ad-images').remove([path]);
    await supabase.from('ads').delete().eq('id', id);
    loadAds();
  };

  const handleAdUrlUpdate = async (id: string, url: string) => {
    await supabase.from('ads').update({ link_url: url }).eq('id', id);
    loadAds();
  };

  const handleAdToggle = async (id: string, current: boolean) => {
    await supabase.from('ads').update({ is_active: !current }).eq('id', id);
    loadAds();
  };

  const handleAdImageUpdate = async (id: string, file: File) => {
    try {
      const ext = file.name.split('.').pop();
      const path = 'ads/' + Date.now() + '.' + ext;
      const { error: uploadErr } = await supabase.storage.from('ad-images').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('ad-images').getPublicUrl(path);
      await supabase.from('ads').update({ image_url: data.publicUrl }).eq('id', id);
      loadAds();
    } catch { alert('이미지 교체 실패'); }
  };

  const handleAdPositionUpdate = async (id: string, field: 'position_x' | 'position_y', value: string) => {
    await supabase.from('ads').update({ [field]: value }).eq('id', id);
    loadAds();
  };

  const handleAdOrder = async (id: string, dir: 'up' | 'down') => {
    const idx = ads.findIndex(a => a.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === ads.length - 1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    const a = ads[idx], b = ads[swapIdx];
    await supabase.from('ads').update({ sort_order: b.sort_order }).eq('id', a.id);
    await supabase.from('ads').update({ sort_order: a.sort_order }).eq('id', b.id);
    loadAds();
  };

  const toggleAdminMode = () => {
    const next = !adminMode;
    setAdminMode(next);
    localStorage.setItem('cc_admin', next ? '1' : '0');
  };

  const loadPayouts = () => {
    supabase.from('catch_payouts').select('*, briefs(title), copies(content)')
      .order('created_at', { ascending: false }).then(({ data }) => setPayouts(data ?? []));
  };

  const handlePayout = async (id: string, voterKey: string, amount: number) => {
    // 실제 지급 처리
    const { data: uc } = await supabase.from('user_catches').select('catches').eq('voter_key', voterKey).single();
    if (uc) await supabase.from('user_catches').update({ catches: uc.catches + amount }).eq('voter_key', voterKey);
    else await supabase.from('user_catches').insert({ voter_key: voterKey, catches: amount });
    await supabase.from('catch_payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    loadPayouts();
  };

  useEffect(() => {
    supabase.from('briefs').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setBriefs(data ?? []); setLoading(false);
    });
    loadPayouts();
    loadAds();
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('briefs').delete().eq('id', id);
    if (!error) setBriefs(p => p.filter(b => b.id !== id));
    else alert('삭제 오류: ' + error.message);
    setDeletingId(null); setConfirmId(null);
  };

  const toggleStatus = async (brief: Brief) => {
    const newStatus = brief.status === 'IN PROGRESS' ? 'CLOSED' : 'IN PROGRESS';
    const { error } = await supabase.from('briefs').update({ status: newStatus }).eq('id', brief.id);
    if (!error) {
      setBriefs(p => p.map(b => b.id === brief.id ? { ...b, status: newStatus } : b));
      // CLOSED 시 TOP4 자동 지급대기 생성
      if (newStatus === 'CLOSED') {
        const { data: copies } = await supabase
          .from('copies').select('*').eq('brief_id', brief.id)
          .order('upvotes', { ascending: false }).limit(4);
        if (copies && copies.length > 0) {
          const rewardAmount = brief.reward_amount ?? (parseInt((brief.reward ?? '').replace(/[^0-9]/g, '')) || 0);
          const ratios = [0.4, 0.3, 0.2, 0.1];
          // 기존 지급대기 있는지 확인
          const { data: existing } = await supabase
            .from('catch_payouts').select('id').eq('brief_id', brief.id);
          if (!existing || existing.length === 0) {
            const payoutRows = copies.map((c: any, i: number) => ({
              brief_id: brief.id,
              copy_id: c.id,
              voter_key: c.voter_key ?? '',
              author: c.author,
              rank: i + 1,
              // 상금(원) × 비율 × 10 = 캐치 (ex: 100,000원 × 40% × 10 = 400,000캐치)
              catch_amount: Math.floor(rewardAmount * ratios[i] * 10),
              status: 'pending',
            }));
            await supabase.from('catch_payouts').insert(payoutRows);
            loadPayouts();
          }
        }
      }
    }
  };

  const inputClass = "w-full  border border-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#22CD6D] transition-colors";

  return (
    <div className="min-h-screen pt-12" style={{ backgroundColor: D.bg }}>
      <div className="sticky top-12 z-40 border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={14} /> 뒤로
          </button>
          <span className="text-sm font-semibold">Admin</span>
          <button onClick={() => navigate('/catchcopy/admin/brief/write')}
            className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-all"
            style={{ backgroundColor: KEY }}>
            <Edit3 size={11} /> 새 프로젝트
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 탭 */}
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ backgroundColor: D.card }}>
          {[{ id: 'briefs', label: '프로젝트 관리' }, { id: 'payouts', label: '지급대기 ' + payouts.filter(p => p.status === 'pending').length }, { id: 'ads', label: '광고 관리' }, { id: 'news', label: '뉴스 관리' }, { id: 'analytics', label: '분석' }].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id as any); if (t.id === 'analytics') loadAnalytics(); }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ backgroundColor: activeTab === t.id ? (dm ? D.hover : 'white') : 'transparent', color: activeTab === t.id ? (dm ? D.text : '#111') : D.muted }}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'briefs' && (<>
        {/* 요약 통계 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: '전체 프로젝트', value: briefs.length },
            { label: 'IN PROGRESS', value: briefs.filter(b => b.status === 'IN PROGRESS').length },
            { label: 'CLOSED', value: briefs.filter(b => b.status === 'CLOSED').length },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border px-4 py-3 text-center" style={{ backgroundColor: D.card, borderColor: D.border }}>
              <p className="text-xl font-bold" style={{ color: D.text }}>{s.value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{s.label}</p>
            </div>
          ))}
        </div>
        {loading ? <Spinner /> : briefs.length === 0 ? (
          <div className="text-center py-20 text-gray-300">
            <Megaphone size={32} className="mx-auto mb-3" />
            <p className="text-xs">등록된 브리프가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {briefs.map(brief => (
              <div key={brief.id} className="rounded-xl border transition-all overflow-hidden" style={{ backgroundColor: D.card, borderColor: D.border }}>
                <div className="flex items-center gap-3 p-4">
                  {/* 썸네일 */}
                  <div className={cn("w-14 h-14 rounded-lg shrink-0 overflow-hidden", !brief.image_url && brief.bg_color)}>
                    {brief.image_url
                      ? <img src={brief.image_url} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Megaphone size={20} className="text-white/40" /></div>
                    }
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        brief.status === 'IN PROGRESS' ? "bg-[#22CD6D]/10 text-[#22CD6D]" : "bg-gray-100 text-gray-400")}>
                        {brief.status}
                      </span>
                      <span className="text-[10px] text-gray-400">{brief.category}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{brief.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{brief.company_name} · {brief.reward} · {brief.participants.toLocaleString()}명 참여</p>
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* 상태 토글 */}
                    <button onClick={() => toggleStatus(brief)}
                      className={cn("text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all",
                        brief.status === 'IN PROGRESS'
                          ? "border-gray-200 text-gray-500 hover:border-gray-300"
                          : "border-[#22CD6D]/30 text-[#22CD6D] hover:bg-[#22CD6D]/5")}>
                      {brief.status === 'IN PROGRESS' ? 'CLOSED 처리' : '재개'}
                    </button>
                    {/* 수정 */}
                    <button onClick={() => navigate(`/catchcopy/admin/brief/edit/${brief.id}`)}
                      className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-all">
                      <Pencil size={11} /> 수정
                    </button>
                    {/* 삭제 */}
                    {confirmId === brief.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-red-400 font-medium">삭제?</span>
                        <button onClick={() => handleDelete(brief.id)}
                          disabled={deletingId === brief.id}
                          className="text-[11px] font-semibold text-red-500 hover:text-red-700 px-2 py-1.5 transition-colors disabled:opacity-40">
                          {deletingId === brief.id ? <Loader2 size={11} className="animate-spin" /> : '확인'}
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1.5 transition-colors">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(brief.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-red-500 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 transition-all">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </>)}

        {/* 지급대기 탭 */}
        {activeTab === 'payouts' && (
          <div>
            {payouts.length === 0 ? (
              <div className="text-center py-16" style={{ color: D.muted }}>
                <p className="text-2xl mb-2">📋</p>
                <p className="text-xs">지급 대기 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payouts.map(p => (
                  <div key={p.id} className="rounded-xl border p-4" style={{ backgroundColor: D.card, borderColor: D.border }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold" style={{ color: KEY }}>{p.rank}등</span>
                          <span className="text-[11px]" style={{ color: D.muted }}>{p.briefs?.title ?? '브리프'}</span>
                        </div>
                        <p className="text-sm font-medium mb-1" style={{ color: D.text }}>"{p.copies?.content}"</p>
                        <p className="text-[11px]" style={{ color: D.muted }}>{p.author} · {new Date(p.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold mb-2" style={{ color: KEY }}>+{p.catch_amount.toLocaleString()} 캐치</p>
                        {p.status === 'pending' ? (
                          <button onClick={() => handlePayout(p.id, p.voter_key, p.catch_amount)}
                            className="text-[11px] font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-all"
                            style={{ backgroundColor: KEY }}>
                            지급하기
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(5,213,96,0.1)', color: KEY }}>지급완료</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* 뉴스 관리 탭 */}
        {activeTab === 'news' && (
          <NewsAdminTab dm={dm} />
        )}
        {/* 분석 탭 */}
        {activeTab === 'analytics' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: D.text }}>분석 대시보드</p>
              <button onClick={() => {
                // CSV Export
                const headers = ['브리프명', '상태', '조회수', '순 방문자', '중복조회', '카피수', '총추천수', '광고비(원)'];
                const rows = analytics.map(a => [
                  a.title, a.status, a.views ?? 0, a.uniqueReads, a.duplicateReads,
                  a.copyCount, a.totalVotes, a.adFee
                ]);
                const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'imby_report_' + new Date().toISOString().slice(0,10) + '.csv';
                a.click(); URL.revokeObjectURL(url);
              }}
                className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-all"
                style={{ backgroundColor: KEY }}>
                CSV 보고서 내보내기
              </button>
            </div>

            {analyticsLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : analytics.length === 0 ? (
              <div className="text-center py-12" style={{ color: D.muted }}>
                <p className="text-xs">분석 탭을 클릭하면 데이터를 불러옵니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 전체 요약 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                  {[
                    { label: '총 조회수', value: analytics.reduce((s,a) => s + (a.views ?? 0), 0).toLocaleString() },
                    { label: '총 참여수', value: analytics.reduce((s,a) => s + a.copyCount, 0).toLocaleString() },
                    { label: '총 추천수', value: analytics.reduce((s,a) => s + a.totalVotes, 0).toLocaleString() },
                    { label: '총 광고비', value: analytics.reduce((s,a) => s + a.adFee, 0).toLocaleString() + '원' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl border p-3 text-center" style={{ backgroundColor: D.card, borderColor: D.border }}>
                      <p className="text-lg font-bold" style={{ color: D.text }}>{s.value}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* 프로젝트별 상세 */}
                {analytics.map((a) => (
                  <div key={a.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: D.card, borderColor: D.border }}>
                    <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: D.border }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: D.text }}>{a.title}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>{a.company_name} · {a.category}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: a.status === 'IN PROGRESS' ? 'rgba(5,213,96,0.1)' : 'rgba(156,163,175,0.15)', color: a.status === 'IN PROGRESS' ? KEY : D.muted }}>
                          {a.status}
                        </span>
                        <span className="text-sm font-bold" style={{ color: KEY }}>{a.adFee.toLocaleString()}원</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 divide-x" style={{ borderColor: D.border }}>
                      {[
                        { label: '총 조회', value: (a.views ?? 0).toLocaleString() },
                        { label: '순 방문자', value: a.uniqueReads.toLocaleString() },
                        { label: '중복 조회', value: a.duplicateReads.toLocaleString() },
                        { label: '참여수', value: a.copyCount.toLocaleString() },
                        { label: '총 추천', value: a.totalVotes.toLocaleString() },
                      ].map((s, i) => (
                        <div key={i} className="px-3 py-2.5 text-center">
                          <p className="text-sm font-bold" style={{ color: D.text }}>{s.value}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: D.muted }}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 border-t flex items-center justify-between" style={{ borderColor: D.border, backgroundColor: D.hover }}>
                      <p className="text-[11px]" style={{ color: D.muted }}>광고비 산정: 조회수 {(a.views ?? 0).toLocaleString()} × 50원</p>
                      <p className="text-xs font-bold" style={{ color: D.text }}>{a.adFee.toLocaleString()}원</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'ads' && (
          <div className="space-y-4">
            {/* 업로드 버튼 */}
            <div className="rounded-xl border p-4 flex items-center justify-between"
              style={{ backgroundColor: D.card, borderColor: D.border }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: D.text }}>광고 배너 ({ads.length}/5)</p>
                <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>비율 24:5 (2400×500px 권장) · 4초 자동전환</p>
              </div>
              <div>
                <input ref={adFileRef} type="file" accept="image/*" onChange={handleAdUpload} className="hidden" />
                <button onClick={() => adFileRef.current?.click()} disabled={adUploading || ads.length >= 5}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: KEY }}>
                  {adUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  이미지 추가
                </button>
              </div>
            </div>

            {/* 실제 미리보기 */}
            {ads.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: D.muted }}>실제 화면 미리보기</p>
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: D.border }}>
                  <AdBanner />
                </div>
              </div>
            )}

            {/* 광고 목록 */}
            {ads.length === 0 ? (
              <div className="text-center py-12" style={{ color: D.muted }}>
                <p className="text-xs">등록된 광고가 없습니다. 이미지를 추가해주세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ads.map((ad, idx) => {
                  const replaceRef = React.createRef<HTMLInputElement>();
                  return (
                    <div key={ad.id} className="rounded-xl border overflow-hidden"
                      style={{ backgroundColor: D.card, borderColor: D.border }}>
                      {/* 썸네일 + 기본 정보 */}
                      <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: D.border }}>
                        <div className="relative shrink-0 group">
                          <img src={ad.image_url} alt="" className="w-24 h-12 object-cover rounded-lg" style={{ objectPosition: (ad.position_x ?? 'center') + ' ' + (ad.position_y ?? 'center') }} />
                          {/* 이미지 교체 버튼 */}
                          <button onClick={() => replaceRef.current?.click()}
                            className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all text-white text-[10px] font-semibold"
                            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                            교체
                          </button>
                          <input ref={replaceRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleAdImageUpdate(ad.id, f); }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[11px] font-semibold" style={{ color: D.muted }}>{idx + 1}번째 광고</span>
                            <button onClick={() => handleAdToggle(ad.id, ad.is_active)}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: ad.is_active ? 'rgba(5,213,96,0.1)' : 'rgba(156,163,175,0.15)', color: ad.is_active ? KEY : D.muted }}>
                              {ad.is_active ? '노출중' : '숨김'}
                            </button>
                          </div>
                          {/* URL 입력 */}
                          <input type="url" defaultValue={ad.link_url ?? ''}
                            placeholder="클릭 시 이동할 URL"
                            onBlur={e => handleAdUrlUpdate(ad.id, e.target.value)}
                            className="w-full text-xs rounded-lg px-2.5 py-1.5 border focus:outline-none focus:border-[#22CD6D]"
                            style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }} />
                        </div>
                        {/* 순서 + 삭제 */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => handleAdOrder(ad.id, 'up')} disabled={idx === 0}
                            className="w-7 h-7 rounded-lg flex items-center justify-center border disabled:opacity-30"
                            style={{ borderColor: D.border, color: D.muted }}>
                            <ChevronLeft size={14} style={{ transform: 'rotate(90deg)' }} />
                          </button>
                          <button onClick={() => handleAdOrder(ad.id, 'down')} disabled={idx === ads.length - 1}
                            className="w-7 h-7 rounded-lg flex items-center justify-center border disabled:opacity-30"
                            style={{ borderColor: D.border, color: D.muted }}>
                            <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} />
                          </button>
                          <button onClick={() => handleAdDelete(ad.id, ad.image_url)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: '#fff5f5', color: '#ef4444', border: '1px solid #fee2e2' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 프로젝트 수정 페이지 ────────────────────────────────────
function BriefEditPage() {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { darkMode: dm } = useContext(AppContext);
  const [form, setForm] = useState({
    company_name: '', title: '', problem: '', target: '', campaign_info: '',
    reward: '-', deadline: '', category: '식품', status: 'IN PROGRESS' as 'IN PROGRESS' | 'CLOSED',
    image_url: '', external_url: '', pdf_url: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!briefId) return;
    supabase.from('briefs').select('*').eq('id', briefId).single().then(({ data }) => {
      if (data) {
        setForm({
          company_name: data.company_name, title: data.title, problem: data.problem,
          target: data.target, campaign_info: data.campaign_info, reward: data.reward ?? '-',
          deadline: data.deadline, category: data.category, status: data.status,
          image_url: data.image_url ?? '',
          external_url: data.external_url ?? '',
          pdf_url: (data as any).pdf_url ?? '',
        });
        if (data.image_url) setImagePreview(data.image_url);
        if ((data as any).pdf_url) setPdfName('기존 PDF 파일');
      }
      setLoading(false);
    });
  }, [briefId]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setPdfName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const required = ['company_name', 'title', 'problem', 'target', 'campaign_info', 'deadline'];
    if (required.some(k => !(form as any)[k].trim())) return alert('모든 항목을 입력해주세요.');
    setSubmitting(true);

    let image_url = form.image_url;
    if (imageFile) {
      const compressed = await imageCompression(imageFile, { maxSizeMB: 2, maxWidthOrHeight: 2400, initialQuality: 0.95, useWebWorker: true });
      const ext = imageFile.name.split('.').pop();
      const path = 'briefs/' + Date.now() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('brief-images').upload(path, compressed, { upsert: true });
      if (!uploadError) {
        const { data } = supabase.storage.from('brief-images').getPublicUrl(path);
        image_url = data.publicUrl;
      }
    }

    let pdf_url = form.pdf_url;
    if (pdfFile) {
      const pdfPath = 'pdfs/' + Date.now() + '_' + pdfFile.name;
      const { error: pdfErr } = await supabase.storage.from('brief-images').upload(pdfPath, pdfFile, { upsert: true });
      if (!pdfErr) {
        const { data } = supabase.storage.from('brief-images').getPublicUrl(pdfPath);
        pdf_url = data.publicUrl;
      }
    }

    const { error } = await supabase.from('briefs').update({
      company_name: form.company_name, title: form.title, problem: form.problem,
      target: form.target, campaign_info: form.campaign_info, reward: form.reward || '-',
      deadline: form.deadline, category: form.category, status: form.status,
      image_url: image_url || null,
      ...(pdf_url ? { pdf_url } : {}),
    } as any).eq('id', briefId!);

    setSubmitting(false);
    if (!error) navigate('/catchcopy/admin');
    else alert('수정 오류: ' + error.message);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center pt-12"><Spinner /></div>;

  const inputClass = "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#22CD6D] transition-colors border";
  const inputStyle = { backgroundColor: D.bg, borderColor: D.border, color: D.text };

  return (
    <div className="min-h-screen pt-12" style={{ backgroundColor: D.bg }}>
      <div className="sticky top-12 z-40 border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <button onClick={() => navigate('/catchcopy/admin')} className="flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: D.muted }}>
            <ArrowLeft size={14} /> 관리자
          </button>
          <span className="text-sm font-semibold" style={{ color: D.text }}>프로젝트 수정</span>
          <button onClick={handleSubmit} disabled={submitting}
            className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
            style={{ backgroundColor: KEY }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : '저장'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이미지 */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              프로젝트 이미지 <span className="text-gray-400 normal-case font-normal">(권장: 800×500px)</span>
            </p>
            <div onClick={() => fileRef.current?.click()}
              className={cn("relative cursor-pointer rounded-xl overflow-hidden border border-dashed transition-all",
                imagePreview ? "border-transparent" : "border-gray-200 hover:border-[#22CD6D]/50")}
              style={{ height: 180 }}>
              {imagePreview
                ? <img src={imagePreview} className="w-full h-full object-cover" />
                : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Upload size={20} />
                  <p className="text-xs">클릭해서 이미지 업로드</p>
                </div>
              }
              {imagePreview && (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center">
                  <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full opacity-0 hover:opacity-100 transition-opacity">변경</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>상태</label>
              <div className="flex p-0.5 rounded-lg gap-0.5" style={{ backgroundColor: D.hover }}>
                {(['IN PROGRESS', 'CLOSED'] as const).map(s => (
                  <button key={s} type="button" onClick={() => set('status', s)}
                    className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={{ backgroundColor: form.status === s ? (dm ? D.card : 'white') : 'transparent', color: form.status === s ? (dm ? D.text : '#111') : D.muted }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>카테고리</label>
              <div className="flex flex-wrap gap-1.5">
                {BRIEF_CATS.filter(c => c !== '전체').map(c => (
                  <button key={c} type="button" onClick={() => set('category', c)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                    style={{
                      backgroundColor: form.category === c ? KEY : 'transparent',
                      color: form.category === c ? 'white' : D.muted,
                      borderColor: form.category === c ? KEY : (dm ? '#3a3a45' : '#e5e7eb'),
                    }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {[
            { key: 'company_name', label: '회사명', placeholder: '카페인 (Cafe-In)' },
            { key: 'title', label: '프로젝트 제목', placeholder: 'MZ세대를 위한 새로운 디카페인 커피 브랜드 런칭' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">{label}</label>
              <input type="text" value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} className={inputClass} style={inputStyle} />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">OVERVIEW</label>
            <BriefRichField value={form.problem} onChange={v => set('problem', v)} placeholder="기존 디카페인 커피는 맛이 없다는 편견이 강해 젊은 층의 유입이 적음." dm={dm} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">타겟</label>
            <BriefRichField value={form.target} onChange={v => set('target', v)} placeholder="커피를 좋아하지만 카페인 민감도가 높은 2030 직장인" dm={dm} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">DIRECTION</label>
            <BriefRichField value={form.campaign_info} onChange={v => set('campaign_info', v)} placeholder="맛과 향을 모두 잡은 스위스 워터 프로세스 공법 강조" dm={dm} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">마감일</label>
              <DeadlinePicker value={form.deadline} onChange={v => set('deadline', v)} />
            </div>
          </div>
          {/* PDF 업로드 */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>PDF 첨부 <span className="font-normal normal-case">(선택)</span></label>
            <div onClick={() => pdfRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 flex items-center gap-3 transition-all hover:border-[#22CD6D]/50"
              style={{ borderColor: pdfName ? KEY : (dm ? D.border : '#e5e7eb'), backgroundColor: D.bg }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: pdfName ? 'rgba(5,213,96,0.1)' : (dm ? D.hover : '#f3f4f6') }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={pdfName ? KEY : D.muted}><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 17v-1h8v1H8zm0-3v-1h8v1H8zm0-3V10h5v1H8z"/></svg>
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: pdfName ? (dm ? D.text : '#111') : D.muted }}>{pdfName || 'PDF 파일 클릭해서 업로드'}</p>
                {!pdfName && <p className="text-[11px] mt-0.5" style={{ color: D.muted }}>상세 자료, 제안서 등</p>}
              </div>
            </div>
            <input ref={pdfRef} type="file" accept="application/pdf" onChange={handlePdfChange} className="hidden" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>더 알아보기 URL <span className="font-normal normal-case">(선택)</span></label>
            <input type="url" value={(form as any).external_url ?? ''} onChange={e => set('external_url', e.target.value)}
              placeholder="https://example.com/brief-detail"
              className={inputClass} style={inputStyle} />
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 글쓰기/수정 ───────────────────────────────────────────
function WritePage() {
  const navigate = useNavigate();
  const { postId } = useParams<{ postId?: string }>();
  const { user, darkMode: dm } = useContext(AppContext);
  const isEdit = !!postId;
  const autoSaveKey = 'cc_draft_' + (postId ?? 'new');
  const [form, setForm] = useState({ title: '', category: 'FREE' });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const contentLoaded = useRef(false);
  const autoSaveTimer = useRef<any>(null);

  // 자동저장 (새 글 작성 시만)
  const triggerAutoSave = () => {
    if (isEdit) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const content = editorRef.current?.innerHTML ?? '';
      if (form.title || content) {
        localStorage.setItem(autoSaveKey, JSON.stringify({ title: form.title, category: form.category, content }));
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 2000);
      }
    }, 2000);
  };

  // 자동저장 내용 복원
  useEffect(() => {
    if (isEdit) return;
    const saved = localStorage.getItem(autoSaveKey);
    if (saved) {
      try {
        const { title, category, content } = JSON.parse(saved);
        if (title || content) {
          setForm({ title: title ?? '', category: category ?? 'FREE' });
          const trySet = () => {
            if (editorRef.current && !contentLoaded.current && content) {
              editorRef.current.innerHTML = content;
              contentLoaded.current = true;
            } else if (!contentLoaded.current) setTimeout(trySet, 50);
          };
          trySet();
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    supabase.from('posts').select('*').eq('id', postId).single().then(({ data }) => {
      if (data) {
        setForm({ title: data.title, category: data.category });
        // editorRef가 마운트된 후 바로 삽입
        const trySet = () => {
          if (editorRef.current && !contentLoaded.current) {
            editorRef.current.innerHTML = data.content ?? '';
            contentLoaded.current = true;
          } else if (!contentLoaded.current) {
            setTimeout(trySet, 50);
          }
        };
        trySet();
      }
      setLoading(false);
    });
  }, [postId, isEdit]);

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true });
      const ext = file.name.split('.').pop();
      const path = 'posts/' + Date.now() + '.' + ext;
      const { error } = await supabase.storage.from('post-images').upload(path, compressed, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('post-images').getPublicUrl(path);
        const imgTag = '<img src="' + data.publicUrl + '" style="max-width:100%;border-radius:8px;margin:8px 0;" />';
        execCmd('insertHTML', imgTag);
      }
    } catch { alert('이미지 업로드 실패'); }
    setUploadingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    const content = editorRef.current?.innerHTML ?? '';
    const textContent = editorRef.current?.innerText?.trim() ?? '';
    if (!form.title.trim() || !textContent || submitting) return;
    setSubmitting(true);
    if (isEdit) {
      await supabase.from('posts').update({ title: form.title.trim(), content, category: form.category }).eq('id', postId);
      navigate('/catchcopy/community/post/' + postId);
    } else {
      const { data, error } = await supabase.from('posts').insert({
        category: form.category, title: form.title.trim(), content,
        author: user?.name ?? '익명', avatar: user?.avatar ?? 'AN',
        avatar_url: user?.avatarUrl ?? null,
        views: 0, likes: 0, dislikes: 0, is_pinned: false,
      }).select().single();
      if (!error) {
        localStorage.removeItem(autoSaveKey); // 자동저장 삭제
        navigate(data ? '/catchcopy/community/post/' + data.id : '/catchcopy/community');
      } else {
        alert('등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen pt-12 flex flex-col" style={{ backgroundColor: D.bg }}>
      <div className="sticky top-12 z-40 border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: D.muted }}>
            <ArrowLeft size={14} /> 취소
          </button>
          <span className="text-sm font-semibold" style={{ color: D.text }}>{isEdit ? '글 수정' : '새 글 작성'}</span>
          <div className="w-12" />
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
      ) : (
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
          <div className="relative mb-4">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-[#22CD6D] transition-colors border"
              style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }}>
              {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: D.muted }} />
          </div>
          <input type="text" value={form.title}
            onChange={e => { setForm(f => ({ ...f, title: e.target.value })); triggerAutoSave(); }}
            placeholder="제목"
            className="w-full bg-transparent border-0 border-b py-3 text-xl font-bold focus:outline-none transition-colors mb-4"
            style={{ borderColor: D.border, color: D.text }} />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="내용을 작성하세요."
            onInput={triggerAutoSave}
            className="flex-1 outline-none text-sm leading-relaxed pb-32 lg:pb-4"
            style={{ minHeight: 'calc(100vh - 380px)', color: D.text }}
          />
        </div>
      )}

      {/* PC: sticky bottom / 모바일: write-bar 클래스로 fixed bottom:64px */}
      <div className="write-bar sticky bottom-0 border-t z-40"
        style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-1">
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('bold'); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-black transition-colors"
            style={{ color: D.muted }}>B</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); execCmd('underline'); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm underline transition-colors"
            style={{ color: D.muted }}>U</button>
          <button type="button" onMouseDown={e => {
              e.preventDefault();
              editorRef.current?.focus();
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const el = container.nodeType === 3 ? container.parentElement : container as HTMLElement;
                const bg = el ? window.getComputedStyle(el).backgroundColor : '';
                // rgb(254, 255, 156) = #FEFF9C
                const isHighlighted = bg === 'rgb(254, 255, 156)' || bg === 'rgb(255, 255, 0)';
                document.execCommand('hiliteColor', false, isHighlighted ? 'transparent' : '#FEFF9C');
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: D.muted }}>
            <span className="text-sm font-bold" style={{ background: '#FEFF9C', padding: '0 3px', borderRadius: 2, color: '#111' }}>A</span>
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
            style={{ color: D.muted }}>
            {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <div className="flex-1" />
          {autoSaved && !isEdit && (
            <span className="text-[10px] px-2 transition-opacity whitespace-nowrap" style={{ color: KEY }}>✓ 자동저장됨</span>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-30 transition-all"
            style={{ backgroundColor: KEY }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : isEdit ? '저장' : '등록'}
          </button>
        </div>
      </div>
      {/* 모바일에서 툴바가 탭바 위에 fixed로 뜨므로 동일 높이 여백 확보 */}
      <div className="lg:hidden" style={{ height: 48 }} />
      <style>{`[contenteditable][data-placeholder]:empty:before{content:attr(data-placeholder);color:#d1d5db;pointer-events:none}
      @media(max-width:1023px){.write-bar{position:fixed;bottom:64px;left:0;right:0;z-index:45;border-top:1px solid ${dm ? D.border : '#f3f4f6'};background:${dm ? D.card : 'white'};}}`}</style>
    </div>
  );
}


// ── 게시글 상세 ───────────────────────────────────────────
// 관리자 모드: user.name === '관리자' AND localStorage cc_admin='1' 둘 다 일치해야 함
const isAdminMode = () => {
  // Supabase Auth 기반: user.isAdmin 플래그
  try {
    const userStr = localStorage.getItem('cc_user');
    if (!userStr) return false;
    const u = JSON.parse(userStr);
    return u?.isAdmin === true;
  } catch { return false; }
};

function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user, darkMode: dm } = useContext(AppContext);
  const [post, setPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const voteKey = `vote_post_${postId}`;
  const [voted, setVoted] = useState<'like' | null>(() => {
    try { return localStorage.getItem(voteKey) === 'like' ? 'like' : null; } catch { return null; }
  });

  const fetchPost = useCallback(async () => {
    const { data } = await supabase.from('posts').select('*, comments(*, replies(*))').eq('id', postId).single();
    if (data) setPost(data);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    // 조회수 +1 후 fetchPost
    const incrementAndFetch = async () => {
      const { data } = await supabase.from('posts').select('views').eq('id', postId).single();
      if (data) await supabase.from('posts').update({ views: data.views + 1 }).eq('id', postId);
      await fetchPost();
    };
    incrementAndFetch();
    const ch = supabase.channel(`post-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` }, fetchPost)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replies' }, fetchPost)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, fetchPost]);

  // 삭제
  const handleDeletePost = async () => {
    const { error } = await supabase.from('posts').delete().eq('id', postId!);
    if (!error) navigate('/catchcopy/community');
    else { alert('삭제 오류: ' + error.message); setConfirmDelete(false); }
  };

  // 추천 토글
  const handlePostVote = async (type: 'like') => {
    if (!post) return;
    if (voted === type) {
      await supabase.from('posts').update({ likes: Math.max(0, post.likes - 1) }).eq('id', postId);
      setVoted(null); try { localStorage.removeItem(voteKey); } catch {}
    } else {
      await supabase.from('posts').update({ likes: post.likes + 1 }).eq('id', postId);
      setVoted(type); try { localStorage.setItem(voteKey, type); } catch {}
    }
    fetchPost();
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await supabase.from('comments').insert({ post_id: postId, author: user?.name ?? '익명', avatar: user?.avatar ?? 'AN', avatar_url: user?.avatarUrl ?? null, content: newComment.trim(), likes: 0 });
    setNewComment('');
  };
  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;
    await supabase.from('comments').update({ content: editCommentContent.trim() }).eq('id', commentId);
    setEditingCommentId(null); setEditCommentContent('');
  };
  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) alert('댓글 삭제 오류: ' + error.message);
  };
  const handleReply = async (commentId: string) => {
    if (!replyContent.trim()) return;
    await supabase.from('replies').insert({ comment_id: commentId, author: user?.name ?? '익명', avatar: user?.avatar ?? 'AN', content: replyContent.trim(), likes: 0 });
    setReplyTo(null); setReplyContent('');
  };

  if (loading) return <div className="pt-12"><Spinner /></div>;
  if (!post) return <div className="pt-12 text-center py-20 text-sm text-gray-400">게시글을 찾을 수 없습니다.</div>;

  const sortedComments = [...(post.comments ?? [])].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="min-h-screen pt-12" style={{ backgroundColor: D.bg }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/catchcopy/community')}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors mb-5">
          <ArrowLeft size={13} /> 목록
        </button>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-3">
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              {post.is_pinned && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">공지</span>}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{post.category}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 leading-snug">{post.title}</h1>
            <div className="flex items-center justify-between pb-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <Avatar name={post.avatar} size={8} imageUrl={user?.name === post.author ? (user?.avatarUrl ?? post.avatar_url ?? undefined) : (post.avatar_url ?? undefined)} />
                <div>
                  <p className="text-xs font-semibold text-gray-700">{post.author}</p>
                  <p className="text-[11px] text-gray-400">{timeAgo(post.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-gray-400 flex items-center gap-1"><Eye size={11} /> {post.views.toLocaleString()}</span>
                {/* 본인 글이거나 관리자만 수정/삭제 표시 */}
                {((user && user.name === post.author) || isAdminMode()) && (<>
                  <button onClick={() => navigate(`/catchcopy/community/edit/${post.id}`)}
                    className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                    <Pencil size={11} /> 수정
                  </button>
                  {confirmDelete ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-red-400">삭제할까요?</span>
                      <button onClick={handleDeletePost} className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors">확인</button>
                      <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)}
                      className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                      <Trash2 size={11} /> 삭제
                    </button>
                  )}
                </>)}
              </div>
            </div>

            <div
                className="py-5 text-sm leading-relaxed text-gray-700"
                dangerouslySetInnerHTML={{ __html: post.content }}
                style={{ wordBreak: 'break-word' }}
              />

            {/* 추천 */}
            <div className="flex items-center justify-center pt-4 border-t border-gray-50">
              <button onClick={() => handlePostVote('like')}
                className={cn("flex items-center gap-1.5 px-6 py-2 rounded-lg text-xs font-semibold border transition-all",
                  voted === 'like' ? "border-[#22CD6D] text-[#22CD6D] bg-[#22CD6D]/5" : "border-gray-200 text-gray-500 hover:border-gray-300")}>
                <ThumbsUp size={13} /> 추천 {post.likes}
              </button>
            </div>
          </div>
        </div>

        {/* 댓글 */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: D.card, borderColor: D.border }}>
          <div className="px-5 py-3 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-800">댓글 {sortedComments.length}</span>
          </div>

          <div className="p-5">
            <form onSubmit={handleComment} className="flex gap-3 mb-6">
              <Avatar name={user?.avatar ?? "ME"} size={8} imageUrl={user?.avatarUrl} />
              <div className="flex-1">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="댓글을 입력하세요." rows={2}
                  className="w-full  border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#22CD6D] transition-colors" />
                <div className="flex justify-start mt-1.5">
                  <button type="submit" disabled={!newComment.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-30 transition-all"
                    style={{ backgroundColor: KEY }}>등록</button>
                </div>
              </div>
            </form>

            <div className="space-y-5">
              {sortedComments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar name={comment.avatar} size={8} imageUrl={user?.name === comment.author ? (user?.avatarUrl ?? comment.avatar_url ?? undefined) : (comment.avatar_url ?? undefined)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">{comment.author}</span>
                        <span className="text-[11px] text-gray-400">{timeAgo(comment.created_at)}</span>
                      </div>
                      {/* 본인 댓글이거나 관리자만 수정/삭제 */}
                      {((user && user.name === comment.author) || isAdminMode()) && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content); }}
                            className="text-gray-300 hover:text-gray-500 transition-colors"><Pencil size={11} /></button>
                          <button onClick={() => handleDeleteComment(comment.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="mb-2">
                        <textarea value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} rows={2}
                          className="w-full  border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#22CD6D] transition-colors" />
                        <div className="flex justify-end gap-2 mt-1.5">
                          <button onClick={() => setEditingCommentId(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">취소</button>
                          <button onClick={() => handleEditComment(comment.id)}
                            className="flex items-center gap-1 text-xs font-semibold text-white px-2.5 py-1 rounded-md"
                            style={{ backgroundColor: KEY }}>
                            <Check size={10} /> 저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 leading-relaxed break-words mb-2">{comment.content}</p>
                    )}
                    <button onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                      className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors">답글</button>
                    {replyTo === comment.id && (
                      <div className="flex gap-2 mt-3">
                        <Avatar name={user?.avatar ?? "ME"} size={7} imageUrl={user?.avatarUrl} />
                        <div className="flex-1">
                          <textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="답글을 입력하세요." rows={2}
                            className="w-full  border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#22CD6D] transition-colors" />
                          <div className="flex justify-end gap-2 mt-1.5">
                            <button onClick={() => setReplyTo(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">취소</button>
                            <button onClick={() => handleReply(comment.id)} disabled={!replyContent.trim()}
                              className="text-xs font-semibold text-white px-2.5 py-1 rounded-md disabled:opacity-30"
                              style={{ backgroundColor: KEY }}>등록</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {(comment.replies ?? []).length > 0 && (
                      <div className="mt-3 space-y-3 pl-3 border-l border-gray-100">
                        {[...(comment.replies ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(reply => (
                          <div key={reply.id} className="flex gap-2">
                            <Avatar name={reply.avatar} size={7} imageUrl={user?.name === reply.author ? user?.avatarUrl : undefined} />
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-gray-700">{reply.author}</span>
                                <span className="text-[11px] text-gray-400">{timeAgo(reply.created_at)}</span>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed break-words">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main AppInner ──────────────────────────────────────────
function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, darkMode: darkMode2 } = useContext(AppContext);
  const activeTab = location.pathname.startsWith('/catchcopy/brief') ? 'brief'
    : location.pathname.startsWith('/catchcopy/community') ? 'community'
    : location.pathname.startsWith('/catchcopy/wallet') ? 'wallet'
    : location.pathname === '/catchcopy/mypage' ? 'mypage' : 'home';

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [activeBriefCat, setActiveBriefCat] = useState('전체');
  const [briefStatusFilter, setBriefStatusFilter] = useState<'전체' | 'IN PROGRESS' | 'CLOSED'>('전체');
  const [briefSortOrder, setBriefSortOrder] = useState<'latest' | 'reward_high' | 'reward_low'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'popular'>('latest');
  const [briefsLoading, setBriefsLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [stats, setStats] = useState({ activeBriefs: 0, monthlyUsers: 0 });
  const [hotPosts, setHotPosts] = useState<Post[]>([]);

  useEffect(() => {
    supabase.from('briefs').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      const d = data ?? []; setBriefs(d); setBriefsLoading(false);
      setStats({ activeBriefs: d.filter(b => b.status === 'IN PROGRESS').length, monthlyUsers: d.reduce((s, b) => s + b.participants, 0) });
    });
    const ch = supabase.channel('briefs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefs' }, ({ eventType, new: nr, old: or }) => {
        if (eventType === 'INSERT') setBriefs(p => [nr as Brief, ...p]);
        else if (eventType === 'UPDATE') setBriefs(p => p.map(b => b.id === (nr as Brief).id ? nr as Brief : b));
        else if (eventType === 'DELETE') setBriefs(p => p.filter(b => b.id !== (or as Brief).id));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    supabase.from('posts').select('*, comments(*, replies(*))').order('created_at', { ascending: false }).then(({ data }) => {
      const d = data ?? [];
      setPosts(d); setPostsLoading(false);
      // 5시간 이내 게시글 중 점수(조회수 30% + 좋아요 70%) 상위 5개
      const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const score = (p: Post) => (p.views ?? 0) * 0.3 + (p.likes ?? 0) * 0.7;
      const hot = [...d]
        .filter(p => new Date(p.created_at) >= fiveHoursAgo)
        .sort((a, b) => score(b) - score(a))
        .slice(0, 5);
      // 5시간 내 글이 5개 미만이면 전체에서 채우기
      if (hot.length < 5) {
        const extra = [...d]
          .filter(p => !hot.find(h => h.id === p.id))
          .sort((a, b) => score(b) - score(a))
          .slice(0, 5 - hot.length);
        setHotPosts([...hot, ...extra]);
      } else {
        setHotPosts(hot);
      }
    });
    const ch = supabase.channel('posts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, async () => {
        const { data } = await supabase.from('posts').select('*, comments(*, replies(*))').order('created_at', { ascending: false });
        const d = data ?? [];
        setPosts(d);
        const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
        const score2 = (p: Post) => (p.views ?? 0) * 0.3 + (p.likes ?? 0) * 0.7;
        const hot = [...d].filter(p => new Date(p.created_at) >= fiveHoursAgo).sort((a, b) => score2(b) - score2(a)).slice(0, 5);
        if (hot.length < 5) {
          const extra = [...d].filter(p => !hot.find(h => h.id === p.id)).sort((a, b) => score2(b) - score2(a)).slice(0, 5 - hot.length);
          setHotPosts([...hot, ...extra]);
        } else setHotPosts(hot);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredBriefs = useMemo(() => {
    const filtered = briefs.filter(b =>
      (briefStatusFilter === '전체' || b.status === briefStatusFilter) &&
      (activeBriefCat === '전체' || b.category === activeBriefCat)
    );
    if (briefSortOrder === 'reward_high') {
      return [...filtered].sort((a, b) =>
        (parseInt((b.reward ?? '').replace(/[^0-9]/g, '')) || 0) - (parseInt((a.reward ?? '').replace(/[^0-9]/g, '')) || 0)
      );
    }
    if (briefSortOrder === 'reward_low') {
      return [...filtered].sort((a, b) =>
        (parseInt((a.reward ?? '').replace(/[^0-9]/g, '')) || 0) - (parseInt((b.reward ?? '').replace(/[^0-9]/g, '')) || 0)
      );
    }
    return filtered; // latest (기본 - DB 최신순)
  }, [briefs, briefStatusFilter, activeBriefCat, briefSortOrder]);

  const filteredPosts = useMemo(() => {
    const f = posts.filter(p =>
      (activeCategory === '전체' || p.category === activeCategory) &&
      (!searchQuery || p.title.includes(searchQuery) || p.author.includes(searchQuery))
    );
    return [...f].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return sortOrder === 'popular'
        ? (b.likes ?? 0) - (a.likes ?? 0)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [posts, activeCategory, searchQuery, sortOrder]);

  const homeBriefs = useMemo(() => briefs.filter(b => b.status === 'IN PROGRESS').slice(0, 4), [briefs]);
  const dm = darkMode2;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: D.bg, color: D.text }}>
      <main className="pt-12 flex-1">

        {/* ── HOME ── */}
        {activeTab === 'home' && (
          <div className="overflow-y-scroll" style={{ height: 'calc(100vh - 48px)', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth' }}>
            {/* 히어로 */}
            <section className="border-b transition-colors overflow-hidden" style={{ minHeight: 'calc(100vh - 48px)', scrollSnapAlign: 'start', scrollSnapStop: 'always', backgroundColor: D.card, borderColor: D.border }}>

              {/* 모바일: 기존 중앙 레이아웃 */}
              <div className="flex lg:hidden flex-col items-center justify-center text-center px-4 h-full" style={{ minHeight: 'calc(100vh - 48px)' }}>
                <div className="flex flex-col items-center gap-2 mb-5">
                  <img src="/ment1.svg" alt="돈이 되는 한 줄의 문장,"
                    className="w-full max-w-xs sm:max-w-sm"
                    style={{ aspectRatio: '4905 / 721', filter: 'invert(1)' }} />
                  <img src="/ment2.svg" alt="캐치카피"
                    className="w-full max-w-[220px] sm:max-w-xs"
                    style={{ aspectRatio: '3983 / 717', filter: 'invert(1)' }} />
                </div>
                <p className="text-sm mb-8 leading-relaxed" style={{ color: D.muted }}>브랜드의 이야기를 담은 공간,<br />imby가 함께합니다.</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => navigate('/catchcopy/brief')}
                    className="text-sm font-semibold text-white px-6 py-3 rounded-lg hover:opacity-90 transition-all active:scale-95"
                    style={{ backgroundColor: KEY }}>
                    WORK 보기
                  </button>
                  <a href="/company.pdf" target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium px-6 py-3 rounded-lg border hover: transition-all"
                    style={{ color: D.text, borderColor: D.border }}>
                    소개서 다운로드
                  </a>
                </div>
                <div className="mt-12 flex flex-col items-center gap-1.5 animate-bounce" style={{ color: D.muted }}>
                  <ChevronDown size={18} />
                  <span className="text-[11px]">스크롤해서 WORK 보기</span>
                </div>
              </div>

              {/* PC: 왼쪽 인물사진 + 오른쪽 텍스트 */}
              <div className="hidden lg:flex items-stretch" style={{ minHeight: 'calc(100vh - 48px)' }}>
                {/* 왼쪽: 인물 이미지 */}
                <div className="flex-1 relative flex items-end justify-center overflow-visible">
                  <img
                    src="/girl.png"
                    alt=""
                    fetchPriority="high"
                    decoding="async"
                    style={{
                      height: 'calc(100vh - 48px)',
                      maxHeight: 860,
                      width: 'auto',
                      objectFit: 'contain',
                      objectPosition: 'bottom center',
                      transform: 'translateX(40px)',
                      mixBlendMode: 'multiply',
                    }}
                  />
                </div>

                {/* 오른쪽: 텍스트 */}
                <div className="flex-1 flex flex-col items-end justify-center pr-16 xl:pr-24 text-right">
                  <div className="flex flex-col items-end gap-3 mb-6">
                    <img src="/ment1.svg" alt="돈이 되는 한 줄의 문장,"
                      className="w-full"
                      style={{ maxWidth: 480, aspectRatio: '4905 / 721', filter: 'invert(1)' }} />
                    <img src="/ment2.svg" alt="캐치카피"
                      className="w-full"
                      style={{ maxWidth: 380, aspectRatio: '3983 / 717', filter: 'invert(1)' }} />
                  </div>
                  <p className="text-base mb-8 leading-relaxed" style={{ color: D.muted }}>
                    브랜드의 이야기를 담은 공간,<br />imby가 함께합니다.
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/catchcopy/brief')}
                      className="text-sm font-semibold text-white px-7 py-3 rounded-lg hover:opacity-90 transition-all active:scale-95"
                      style={{ backgroundColor: KEY }}>
                      WORK 보기
                    </button>
                    <a href="/company.pdf" target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium px-7 py-3 rounded-lg border hover: transition-all"
                      style={{ color: D.text, borderColor: D.border }}>
                      소개서 다운로드
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* 통계 + 브리프 그리드 — 두 번째 스냅 포인트 */}
            <div style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
            {/* 통계 */}
            <section className="border-b transition-colors" style={{ backgroundColor: D.card, borderColor: D.border }}>
              <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-3" style={{ divideColor: dm ? D.border : '#f3f4f6' }}>
                {[
                  { label: 'IN PROGRESS인 프로젝트', value: `${stats.activeBriefs}개`, icon: <Zap size={13} /> },
                  { label: '함께한 브랜드', value: `${stats.monthlyUsers.toLocaleString()}명`, icon: <Users size={13} /> },
                  { label: '누적 프로젝트', value: '48+', icon: <Star size={13} /> },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 sm:px-8">
                    <div className="w-7 h-7 rounded-lg  flex items-center justify-center text-gray-400 shrink-0">{s.icon}</div>
                    <div>
                      <p className="text-sm sm:text-base font-bold">{s.value}</p>
                      <p className="text-[10px] sm:text-xs text-gray-400">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 브리프 그리드 */}
            <section className="max-w-6xl mx-auto px-4 py-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold" style={{ color: D.text }}>IN PROGRESS인 프로젝트</h3>
                <button onClick={() => navigate('/catchcopy/brief')}
                  className="text-xs font-medium text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                  전체보기 <ChevronRight size={12} />
                </button>
              </div>
              {briefsLoading ? <Spinner /> : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {homeBriefs.map((brief, i) => (
                    <BriefCard key={brief.id} brief={brief} large={i === 0} onClick={() => navigate(`/catchcopy/brief/${brief.id}`)} />
                  ))}
                </div>
              )}
            </section>
            </div> {/* 두 번째 스냅 섹션 끝 */}
          </div>
        )}

        {/* ── BRIEF ── */}
        {activeTab === 'brief' && (
          <div className="max-w-6xl mx-auto px-4 py-6 pb-24 lg:pb-6">
            {/* 광고 배너 */}
            <div className="mb-5 rounded-xl overflow-hidden">
              <AdBanner />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold mb-0.5">브리프 아카이브</h2>
                <p className="text-xs text-gray-400">진행 중인 카피 공모전에 참여하세요.</p>
              </div>
              {/* 한 줄 필터 바 */}
              <div className="flex items-center gap-2">
                {/* 상태 필터 */}
                <div className="flex bg-gray-100 p-0.5 rounded-lg gap-0.5 shrink-0">
                  {(['전체', 'IN PROGRESS', 'CLOSED'] as const).map(f => (
                    <button key={f} onClick={() => setBriefStatusFilter(f)}
                      className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                        briefStatusFilter === f ? "bg-white shadow-sm text-gray-800" : "text-gray-400")}>
                      {f}
                    </button>
                  ))}
                </div>
                {/* 카테고리 드롭다운 */}
                <BriefDropdown
                  value={activeBriefCat}
                  options={BRIEF_CATS.map(c => ({ id: c, label: c }))}
                  onChange={v => setActiveBriefCat(v)}
                  dm={dm}
                />
                {/* 정렬 드롭다운 */}
                <BriefDropdown
                  value={briefSortOrder}
                  options={[
                    { id: 'latest', label: '최신순' },
                    { id: 'reward_high', label: '상금 높은순' },
                    { id: 'reward_low', label: '상금 낮은순' },
                  ]}
                  onChange={v => setBriefSortOrder(v as any)}
                  dm={dm}
                />
              </div>
            </div>
            {briefsLoading ? <Spinner /> : filteredBriefs.length === 0 ? (
              <div className="text-center py-20 text-gray-300">
                <Megaphone size={32} className="mx-auto mb-3" />
                <p className="text-xs">해당하는 브리프가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 상위 2개 대형 */}
                {filteredBriefs.length >= 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredBriefs.slice(0, 2).map(brief => (
                      <BriefCard key={brief.id} large brief={brief} onClick={() => navigate(`/catchcopy/brief/${brief.id}`)} />
                    ))}
                  </div>
                )}
                {filteredBriefs.length > 2 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredBriefs.slice(2).map(brief => (
                      <BriefCard key={brief.id} brief={brief} onClick={() => navigate(`/catchcopy/brief/${brief.id}`)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── COMMUNITY ── */}
        {activeTab === 'community' && (
          <div className="pb-24 lg:pb-0">

            {/* 모바일 상단 컨트롤 */}
            <div className="lg:hidden sticky top-12 z-30 border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
              <div className="flex overflow-x-auto scrollbar-hide px-4 pt-3 gap-0">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className="whitespace-nowrap px-3 pb-2.5 text-xs font-semibold transition-all shrink-0 border-b-2"
                    style={{ color: activeCategory === cat ? KEY : dm ? D.muted : '#9ca3af', borderBottomColor: activeCategory === cat ? KEY : 'transparent' }}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between px-4 py-2 gap-2">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSortOrder('latest')} className="text-xs font-semibold flex items-center gap-1 transition-colors"
                    style={{ color: sortOrder === 'latest' ? (dm ? D.text : '#111') : D.muted }}>
                    최신순 {sortOrder === 'latest' && <span style={{ color: KEY }}>↓</span>}
                  </button>
                  <button onClick={() => setSortOrder('popular')} className="text-xs font-semibold flex items-center gap-1 transition-colors"
                    style={{ color: sortOrder === 'popular' ? (dm ? D.text : '#111') : D.muted }}>
                    인기순 {sortOrder === 'popular' && <span style={{ color: KEY }}>↓</span>}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="검색"
                      className="rounded-full px-3 py-1.5 text-xs w-24 focus:outline-none transition-colors pr-6 border"
                      style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }} />
                    <Search className="absolute right-2 top-1/2 -translate-y-1/2" size={11} style={{ color: D.muted }} />
                  </div>
                  <button onClick={() => navigate('/catchcopy/community/write')}
                    className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-full hover:opacity-90 transition-colors"
                    style={{ backgroundColor: KEY }}>
                    <Edit3 size={11} /> 글쓰기
                  </button>
                </div>
              </div>
            </div>

            {/* PC 레이아웃 */}
            <div className="hidden lg:block max-w-4xl mx-auto px-4 py-6">
              <div className="grid grid-cols-4 gap-5">
                {/* PC 사이드바 */}
                <aside className="col-span-1">
                  <div className="rounded-xl p-4 sticky top-16 border" style={{ backgroundColor: D.card, borderColor: D.border }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: D.muted }}>게시판</p>
                    <div className="space-y-0.5">
                      {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={{ color: activeCategory === cat ? KEY : dm ? D.muted : '#6b7280', backgroundColor: activeCategory === cat ? 'rgba(5, 213, 96, 0.08)' : 'transparent' }}>
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 pt-5 border-t" style={{ borderColor: D.border }}>
                      <div className="flex items-center gap-1.5 mb-3">
                        <TrendingUp size={11} style={{ color: KEY }} />
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: D.muted }}>인기글 TOP 5</p>
                        <span className="text-[9px] ml-auto" style={{ color: D.muted }}>5시간 내</span>
                      </div>
                      {hotPosts.length === 0 ? (
                        <p className="text-[11px] text-center py-3" style={{ color: D.muted }}>아직 인기글이 없어요.</p>
                      ) : (
                        <div className="space-y-2">
                          <AnimatePresence mode="popLayout">
                          {hotPosts.map((post, idx) => (
                            <motion.button
                              key={post.id}
                              layout
                              initial={{ opacity: 0, rotateX: -90 }}
                              animate={{ opacity: 1, rotateX: 0 }}
                              exit={{ opacity: 0, rotateX: 90 }}
                              transition={{ duration: 0.35, ease: 'easeOut', delay: idx * 0.05 }}
                              onClick={() => navigate('/catchcopy/community/post/' + post.id)}
                              className="w-full text-left flex items-start gap-2 group"
                              style={{ transformOrigin: 'top center', perspective: 400 }}>
                              <span className="text-[11px] font-bold shrink-0 w-4 mt-0.5"
                                style={{ color: KEY }}>
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] leading-snug line-clamp-2 transition-colors" style={{ color: D.text }}>{post.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] flex items-center gap-0.5" style={{ color: D.muted }}><ThumbsUp size={9} /> {post.likes}</span>
                                  <span className="text-[10px]" style={{ color: D.muted }}>{post.category}</span>
                                </div>
                              </div>
                            </motion.button>
                          ))}
                        </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                </aside>

                {/* PC 게시글 목록 */}
                <div className="col-span-3">
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <h2 className="text-base font-bold shrink-0" style={{ color: D.text }}>{activeCategory}</h2>
                    <div className="flex items-center gap-2">
                      <div className="flex p-0.5 rounded-lg gap-0.5" style={{ backgroundColor: D.card }}>
                        <button onClick={() => setSortOrder('latest')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                          style={{ backgroundColor: sortOrder === 'latest' ? (dm ? D.hover : 'white') : 'transparent', color: sortOrder === 'latest' ? (dm ? D.text : '#111') : D.muted }}>
                          <Clock3 size={10} /> 최신
                        </button>
                        <button onClick={() => setSortOrder('popular')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                          style={{ backgroundColor: sortOrder === 'popular' ? (dm ? D.hover : 'white') : 'transparent', color: sortOrder === 'popular' ? (dm ? D.text : '#111') : D.muted }}>
                          <TrendingUp size={10} /> 인기
                        </button>
                      </div>
                      <div className="relative">
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="검색"
                          className="rounded-lg px-3 py-1.5 text-xs w-32 focus:outline-none transition-colors pr-6 border"
                          style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }} />
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2" size={11} style={{ color: D.muted }} />
                      </div>
                      <button onClick={() => navigate('/catchcopy/community/write')}
                        className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-colors"
                        style={{ backgroundColor: KEY }}>
                        <Edit3 size={11} /> 글쓰기
                      </button>
                    </div>
                  </div>
                  {postsLoading ? <Spinner /> : (
                    <div className="space-y-2">
                      {filteredPosts.length === 0 ? (
                        <div className="text-center py-16" style={{ color: D.muted }}>
                          <MessageSquare size={28} className="mx-auto mb-3 opacity-30" />
                          <p className="text-xs">게시글이 없습니다.</p>
                        </div>
                      ) : filteredPosts.map(post => (
                        <motion.div key={post.id} whileTap={{ scale: 0.995 }}
                          onClick={() => navigate(`/catchcopy/community/post/${post.id}`)}
                          className="rounded-xl px-4 py-3.5 cursor-pointer transition-all border"
                          style={{ backgroundColor: D.card, borderColor: D.border }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {post.is_pinned && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-900 text-white">공지</span>}
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: D.muted, backgroundColor: D.hover }}>{post.category}</span>
                              </div>
                              <h4 className="text-sm font-semibold mb-1.5 leading-snug" style={{ color: D.text }}>{post.title}</h4>
                              <div className="flex items-center gap-2 text-[11px]" style={{ color: D.muted }}>
                                <span>{post.author}</span><span>·</span>
                                <span>{timeAgo(post.created_at)}</span><span>·</span>
                                <span className="flex items-center gap-0.5"><Eye size={10} /> {post.views.toLocaleString()}</span>
                                <span className="flex items-center gap-0.5"><MessageSquare size={10} /> {(post.comments ?? []).length}</span>
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-center gap-0.5 text-[11px] min-w-[36px] text-center" style={{ color: D.muted }}>
                              <ThumbsUp size={11} />
                              <span className="font-semibold" style={{ color: D.text }}>{post.likes}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 모바일 게시글 피드 */}
            <div className="lg:hidden">
              {postsLoading ? <div className="pt-8"><Spinner /></div> : (
                <div>
                  {filteredPosts.length === 0 ? (
                    <div className="text-center py-20" style={{ color: D.muted }}>
                      <MessageSquare size={28} className="mx-auto mb-3 opacity-30" />
                      <p className="text-xs">게시글이 없습니다.</p>
                    </div>
                  ) : filteredPosts.map(post => (
                    <motion.div key={post.id} whileTap={{ scale: 0.99 }}
                      onClick={() => navigate(`/catchcopy/community/post/${post.id}`)}
                      className="cursor-pointer border-b"
                      style={{ borderColor: D.border, backgroundColor: D.bg }}>
                      <div className="px-4 py-4">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <Avatar name={post.avatar} size={8} imageUrl={user?.name === post.author ? (user?.avatarUrl ?? post.avatar_url ?? undefined) : (post.avatar_url ?? undefined)} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold" style={{ color: D.text }}>{post.author}</span>
                              {post.is_pinned && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: KEY, color: 'white' }}>공지</span>}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: D.muted }}>
                              <span>{timeAgo(post.created_at)}</span>
                              <span>·</span>
                              <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: D.card }}>{post.category}</span>
                            </div>
                          </div>
                        </div>
                        <h4 className="text-sm font-semibold mb-1 leading-snug" style={{ color: D.text }}>{post.title}</h4>
                        {post.content && (
                          <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: D.muted }}
                            dangerouslySetInnerHTML={{ __html: post.content.replace(/<[^>]+>/g, ' ').slice(0, 120) + (post.content.replace(/<[^>]+>/g, '').length > 120 ? '...' : '') }} />
                        )}
                        <div className="flex items-center gap-4" style={{ color: D.muted }}>
                          <span className="flex items-center gap-1 text-[11px]"><ThumbsUp size={12} /> {post.likes}</span>
                          <span className="flex items-center gap-1 text-[11px]"><MessageSquare size={12} /> {(post.comments ?? []).length}</span>
                          <span className="flex items-center gap-1 text-[11px]"><Eye size={12} /> {post.views.toLocaleString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>


      <footer className="hidden lg:block border-t py-6 mt-8 transition-colors" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <img src="/logo2.png" alt="imby" className="h-4 w-auto object-contain" />
          <p className="text-[11px] text-gray-400">© 2026 IMBY. All rights reserved.</p>
          <div className="flex gap-4 text-[11px] text-gray-400">
            <span className="hover:text-gray-600 cursor-pointer transition-colors">개인정보처리방침</span>
            <span className="hover:text-gray-600 cursor-pointer transition-colors">이용약관</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── 뉴스 관리 탭 (관리자) ─────────────────────────────────
function NewsAdminTab({ dm }: { dm: boolean }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadArticles = () => {
    supabase.from('news_articles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setArticles(data ?? []);
    });
  };

  useEffect(() => { loadArticles(); }, []);

  const handleAdd = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) return alert('올바른 URL을 입력하세요.');
    setAdding(true);
    // Open Graph 메타 정보 fetch (CORS 우회용 프록시)
    let title = '', description = '', image = '', source = '';
    try {
      const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
      const res = await fetch(proxyUrl);
      const data = await res.json();
      const html = data.contents ?? '';
      const getMetaContent = (tag: string) => {
        const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${tag}["'][^>]+content=["']([^"']+)["']`, 'i'))
          || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${tag}["']`, 'i'));
        return m ? m[1] : '';
      };
      title = getMetaContent('og:title') || getMetaContent('twitter:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '');
      description = getMetaContent('og:description') || getMetaContent('twitter:description') || getMetaContent('description');
      image = getMetaContent('og:image') || getMetaContent('twitter:image');
      source = new URL(url).hostname.replace('www.', '');
    } catch {}

    const { error } = await supabase.from('news_articles').insert({
      url, title: title || url, description, image_url: image || null, source: source || url,
    } as any);
    if (!error) { setUrlInput(''); loadArticles(); }
    else alert('등록 오류: ' + error.message);
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('news_articles').delete().eq('id', id);
    setConfirmId(null);
    loadArticles();
  };

  return (
    <div className="space-y-4">
      {/* URL 입력 */}
      <div className="rounded-xl border p-4" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <p className="text-sm font-semibold mb-3" style={{ color: D.text }}>뉴스 기사 추가</p>
        <p className="text-[11px] mb-3" style={{ color: D.muted }}>기사 URL을 붙여넣으면 제목·이미지·설명이 자동으로 수집됩니다.</p>
        <div className="flex gap-2">
          <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="https://www.news.com/article/..."
            className="flex-1 rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:border-[#22CD6D] transition-colors"
            style={{ backgroundColor: D.bg, borderColor: D.border, color: D.text }} />
          <button onClick={handleAdd} disabled={adding || !urlInput.trim()}
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-40 hover:opacity-90 transition-all"
            style={{ backgroundColor: KEY }}>
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            추가
          </button>
        </div>
      </div>

      {/* 기사 목록 */}
      {articles.length === 0 ? (
        <div className="text-center py-16" style={{ color: D.muted }}>
          <p className="text-2xl mb-2">📰</p>
          <p className="text-xs">등록된 뉴스 기사가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map(a => (
            <div key={a.id} className="rounded-xl border overflow-hidden flex items-center gap-3 p-3"
              style={{ backgroundColor: D.card, borderColor: D.border }}>
              {a.image_url && (
                <img src={a.image_url} alt="" className="w-16 h-12 object-cover rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: D.text }}>{a.title || a.url}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: D.muted }}>{a.source} · {timeAgo(a.created_at)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all"
                  style={{ borderColor: D.border, color: D.muted }}>
                  보기
                </a>
                {confirmId === a.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(a.id)}
                      className="text-[11px] font-semibold text-red-500 px-2 py-1.5">확인</button>
                    <button onClick={() => setConfirmId(null)} className="text-[11px] text-gray-400 px-2 py-1.5">취소</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(a.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ backgroundColor: '#fff5f5', color: '#ef4444', border: '1px solid #fee2e2' }}>
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MEDIA 페이지 ─────────────────────────────────────────
function MediaPage() {
  const { darkMode: dm } = useContext(AppContext);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('news_articles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setArticles(data ?? []); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen pt-12 pb-24 lg:pb-0" style={{ backgroundColor: D.bg }}>
      {/* 헤더 */}
      <div className="border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: KEY }}>Media</p>
          <h1 className="text-2xl font-bold" style={{ color: D.text }}>Press & News</h1>
          <p className="text-sm mt-1" style={{ color: D.muted }}>imby에 관한 최신 뉴스와 미디어 보도를 모아드립니다.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {loading ? <Spinner /> : articles.length === 0 ? (
          <div className="text-center py-24" style={{ color: D.muted }}>
            <p className="text-3xl mb-3">📰</p>
            <p className="text-sm">아직 등록된 뉴스가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map(a => (
              <motion.a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                className="rounded-2xl overflow-hidden border transition-all cursor-pointer"
                style={{ backgroundColor: D.card, borderColor: D.border }}>
                {/* 썸네일 */}
                <div className="relative overflow-hidden" style={{ height: 180 }}>
                  {a.image_url ? (
                    <img src={a.image_url} alt={a.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl"
                      style={{ backgroundColor: D.hover }}>
                      📰
                    </div>
                  )}
                  {/* 출처 배지 */}
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-black/60 text-white backdrop-blur-sm">
                      {a.source}
                    </span>
                  </div>
                </div>
                {/* 내용 */}
                <div className="p-4">
                  <h3 className="text-sm font-bold leading-snug mb-2 line-clamp-2" style={{ color: D.text }}>
                    {a.title || a.url}
                  </h3>
                  {a.description && (
                    <p className="text-[12px] leading-relaxed line-clamp-2 mb-3" style={{ color: D.muted }}>
                      {a.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: D.muted }}>{timeAgo(a.created_at)}</span>
                    <span className="text-[11px] font-semibold" style={{ color: KEY }}>읽기 →</span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CONTACT 페이지 ────────────────────────────────────────
function ContactPage() {
  const { darkMode: dm } = useContext(AppContext);
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return alert('이름, 이메일, 메시지를 입력해주세요.');
    setSending(true);
    // Supabase contact_messages 테이블에 저장
    const { error } = await supabase.from('contact_messages').insert({
      name: form.name.trim(), email: form.email.trim(),
      company: form.company.trim() || null, message: form.message.trim(),
    } as any);
    setSending(false);
    if (!error) { setSent(true); setForm({ name: '', email: '', company: '', message: '' }); }
    else alert('전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  };

  const inputClass = "w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:border-[#22CD6D] transition-colors";
  const inputStyle = { backgroundColor: D.bg, borderColor: D.border, color: D.text };

  return (
    <div className="min-h-screen pt-12 pb-24 lg:pb-0" style={{ backgroundColor: D.bg }}>
      {/* 헤더 */}
      <div className="border-b" style={{ backgroundColor: D.card, borderColor: D.border }}>
        <div className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: KEY }}>Contact</p>
          <h1 className="text-2xl font-bold mb-1" style={{ color: D.text }}>문의하기</h1>
          <p className="text-sm" style={{ color: D.muted }}>협업 제안, 서비스 문의 등 편하게 연락주세요.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {sent ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 rounded-2xl border"
            style={{ backgroundColor: D.card, borderColor: D.border }}>
            <p className="text-4xl mb-4">✅</p>
            <h2 className="text-lg font-bold mb-2" style={{ color: D.text }}>문의가 접수되었습니다!</h2>
            <p className="text-sm" style={{ color: D.muted }}>빠른 시일 내에 답변 드리겠습니다.</p>
            <button onClick={() => setSent(false)}
              className="mt-6 text-sm font-semibold px-6 py-2.5 rounded-xl text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: KEY }}>
              새 문의 작성
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* 연락처 정보 */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl p-6 border" style={{ backgroundColor: D.card, borderColor: D.border }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: D.muted }}>Contact Info</p>
                {[
                  { label: 'Email', value: 'hello@imby.kr' },
                  { label: 'Location', value: 'Seoul, Korea' },
                ].map(item => (
                  <div key={item.label} className="mb-3">
                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: D.muted }}>{item.label}</p>
                    <p className="text-sm font-medium" style={{ color: D.text }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 문의 폼 */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl p-6 border"
                style={{ backgroundColor: D.card, borderColor: D.border }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>이름 *</label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="홍길동" className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>회사명</label>
                    <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                      placeholder="imby Inc." className={inputClass} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>이메일 *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="hello@company.com" className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: D.muted }}>메시지 *</label>
                  <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="문의 내용을 입력해주세요." rows={5}
                    className={inputClass + ' resize-none'}
                    style={inputStyle} />
                </div>
                <button type="submit" disabled={sending}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: KEY }}>
                  {sending ? <Loader2 size={15} className="animate-spin" /> : '문의 보내기 →'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try { const s = localStorage.getItem('cc_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('cc_dark') !== '0');
  const [catches, setCatches] = useState<number>(0);
  const [ads, setAds] = useState<Ad[]>([]);

  // 광고 미리 로드 (앱 시작 즉시)
  useEffect(() => {
    supabase.from('ads').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        if (data) {
          // 이미지 프리로드
          data.forEach(ad => { const img = new Image(); img.src = ad.image_url; });
          setAds(data);
        }
      });
  }, []);

  // Supabase Auth 세션 복원 - 어느 기기서든 로그인 상태 유지
  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Auth 세션 있으면 DB에서 프로필 로드
        const { data: profile } = await supabase
          .from('user_profiles').select('*').eq('id', session.user.id).single();
        const ADMIN_EMAIL = 'admin@inmybackyard.kr';
        const isAdmin = session.user.email === ADMIN_EMAIL;
        const userProfile: UserProfile = {
          id: session.user.id,
          email: session.user.email,
          name: profile?.name ?? (isAdmin ? '관리자' : '유저'),
          avatar: isAdmin ? 'AD' : (profile?.name?.slice(0, 2) ?? 'ME'),
          avatarUrl: profile?.avatar_url ?? undefined,
          isAdmin,
        };
        setUser(userProfile);
        localStorage.setItem('cc_user', JSON.stringify(userProfile));
      }
    });

    // 로그인/로그아웃 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('cc_user');
      }
      // TOKEN_REFRESHED, SIGNED_IN 등은 무시 (user state 보존)
    });
    return () => subscription.unsubscribe();
  }, []);

  // DB에서 캐치 로드 (localStorage 변조 방지 - DB값이 항상 우선)
  useEffect(() => {
    const vk = getVoterKey();
    supabase.from('user_catches').select('catches').eq('voter_key', vk).single()
      .then(({ data }) => {
        if (data) {
          setCatches(data.catches);
          localStorage.setItem('cc_catches', String(data.catches));
        } else {
          setCatches(0);
          localStorage.setItem('cc_catches', '0');
        }
      });
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(d => {
      localStorage.setItem('cc_dark', d ? '0' : '1');
      return !d;
    });
  };

  return (
    <AppContext.Provider value={{ user, setUser, darkMode, toggleDarkMode, catches, setCatches, ads, setAds }}>
      <div style={{ minHeight: '100vh', backgroundColor: D.bg, color: D.text, transition: 'background-color 0.3s, color 0.3s' }}>
        <BrowserRouter>
          <Header />
          <MobileTabBar />
          <Routes>
            <Route path="/catchcopy/login" element={<LoginPage />} />
            <Route path="/catchcopy/mypage" element={<MyPage />} />
            <Route path="/catchcopy/wallet" element={<WalletPage />} />
            <Route path="/catchcopy/market" element={<MarketPage />} />
            <Route path="/catchcopy/admin" element={<AdminPage />} />
            <Route path="/catchcopy/admin/brief/write" element={<BriefWritePage />} />
            <Route path="/catchcopy/admin/brief/edit/:briefId" element={<BriefEditPage />} />
            <Route path="/catchcopy/brief/:briefId" element={<BriefPage />} />
            <Route path="/catchcopy/community/post/:postId" element={<PostDetail />} />
            <Route path="/catchcopy/community/write" element={<WritePage />} />
            <Route path="/catchcopy/community/edit/:postId" element={<WritePage />} />
            <Route path="/catchcopy/media" element={<MediaPage />} />
            <Route path="/catchcopy/contact" element={<ContactPage />} />
            <Route path="/catchcopy/*" element={<AppInner />} />
            <Route path="*" element={<AppInner />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AppContext.Provider>
  );
}
