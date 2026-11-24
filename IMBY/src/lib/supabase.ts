import { createClient } from '@supabase/supabase-js';

// imbykorea 프로젝트. anon(공개) 키는 원래 브라우저에 노출되는 키이며, 데이터는 RLS로 보호된다.
// Vercel에 예전 프로젝트의 VITE_SUPABASE_* 값이 남아 있어도 이 사이트는 imbykorea 에 붙도록 별도 이름을 쓴다.
const url = (import.meta.env.VITE_IMBY_SUPABASE_URL as string | undefined) || 'https://hvscpwbzarweufskeupt.supabase.co';
const key = (import.meta.env.VITE_IMBY_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_PxVBw6gzMBrLVhimS3_5MQ_eTWGsIoB';

export const supabase = createClient(url, key);

export type Project = {
  /** 영어 덮어쓰기 (관리자에서 편집) */
  en?: Record<string, unknown> | null;
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  client: string | null;
  year: number | null;
  category: string;
  services: string[] | null;
  summary: string | null;
  problem: string | null;
  insight: string | null;
  idea: string | null;
  result: string | null;
  metrics: { label: string; value: string }[] | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  gallery: string[] | null;
  video_url: string | null;
  external_url: string | null;
  accent: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  // 케이스 스터디 (선택)
  period?: string | null;
  role?: string | null;
  client_logo_url?: string | null;
  background_title?: string | null;
  background?: string | null;
  problem_title?: string | null;
  insight_title?: string | null;
  idea_title?: string | null;
  result_title?: string | null;
  sections?: CaseSection[] | null;
};

/** 실행 섹션 하나 — 라벨(예: CONTENTS), 두 줄 헤드라인, 본문, 이미지들 */
export type CaseSection = { label: string; title?: string; body?: string; images?: string[] };

export type TeamMember = {
  id: string;
  name: string;
  name_en: string | null;
  role: string;
  team: string | null;
  one_liner: string | null;
  bio: string | null;
  career: string[] | null;
  education: string | null;
  photo_url: string | null;
  link_url: string | null;
  sort_order: number;
  published: boolean;
};

export type PressItem = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  source: string | null;
  category: string | null;
  published_at: string | null;
  published: boolean;
};

export type Opening = {
  en?: Record<string, unknown> | null;
  id: string;
  title: string;
  team: string | null;
  type: string | null;
  experience: string | null;
  description: string | null;
  apply_url: string | null;
  is_open: boolean;
  sort_order: number;
};
