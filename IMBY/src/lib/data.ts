import { useEffect, useState } from 'react';
import { supabase, type Opening, type PressItem, type Project, type TeamMember } from './supabase';
import { PROJECTS, TEAM } from '../data/content';
import { CLIENT_LOGOS } from './brand';

type State<T> = { data: T; loading: boolean };

function useQuery<T>(run: () => PromiseLike<{ data: T | null; error: unknown }>, fallback: T, deps: unknown[] = []): State<T> {
  const [state, setState] = useState<State<T>>({ data: fallback, loading: true });
  useEffect(() => {
    let alive = true;
    Promise.resolve(run()).then(
      ({ data, error }) => {
        if (!alive) return;
        const empty = !data || (Array.isArray(data) && data.length === 0);
        setState({ data: error || empty ? fallback : (data as T), loading: false });
      },
      () => alive && setState({ data: fallback, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const useProjects = () =>
  useQuery<Project[]>(
    () => supabase.from('projects').select('*').eq('published', true).order('sort_order').order('year', { ascending: false }),
    PROJECTS,
  );

export const useProject = (slug: string) => {
  const all = useProjects();
  const idx = all.data.findIndex((p) => p.slug === slug);
  return {
    loading: all.loading,
    project: idx >= 0 ? all.data[idx] : null,
    next: all.data.length ? all.data[(idx + 1) % all.data.length] : null,
  };
};

export const useTeam = () =>
  useQuery<TeamMember[]>(() => supabase.from('team_members').select('*').eq('published', true).order('sort_order'), TEAM);

export const usePress = () =>
  useQuery<PressItem[]>(
    () => supabase.from('news_articles').select('*').eq('published', true).order('published_at', { ascending: false }),
    [],
  );

export type Client = { id: string; name: string; logo_url: string; link: string | null; sort_order: number };
/** 클라이언트 로고 — DB(clients)에서, 없거나 실패하면 brand.ts 기본 4곳 */
export const useClients = () =>
  useQuery<Client[]>(
    () => supabase.from('clients').select('id,name,logo_url,link,sort_order').eq('published', true).order('sort_order'),
    CLIENT_LOGOS.map((c, i) => ({ id: c.name, name: c.name, logo_url: c.logo!, link: c.to, sort_order: i + 1 })),
  );

export const useOpenings = () =>
  useQuery<Opening[]>(() => supabase.from('openings').select('*').eq('is_open', true).order('sort_order'), []);
