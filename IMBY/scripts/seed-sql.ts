import { PROJECTS, TEAM } from '../src/data/content.ts';
const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return `array[${v.map((x) => q(x)).join(',')}]::text[]`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const pCols = ['slug','title','title_en','client','year','category','services','summary','problem','insight','idea','result','metrics','thumbnail_url','cover_url','gallery','featured','published','sort_order'];
const fixGallery = (p: any) => ({ ...p, gallery: p.gallery ?? [] });
let sql = '';
for (const p0 of PROJECTS) {
  const p: any = fixGallery(p0);
  const vals = pCols.map((c) => c === 'gallery' || c === 'metrics' ? `'${JSON.stringify(p[c] ?? []).replace(/'/g, "''")}'::jsonb` : c === 'services' && (!p[c] || p[c].length === 0) ? `'{}'::text[]` : q(p[c]));
  sql += `insert into public.projects (${pCols.join(',')}) values (${vals.join(',')}) on conflict (slug) do nothing;\n`;
}
const tCols = ['name','name_en','role','team','one_liner','career','education','photo_url','link_url','sort_order','published'];
sql += `delete from public.team_members;\n`;
for (const t of TEAM as any[]) {
  sql += `insert into public.team_members (${tCols.join(',')}) values (${tCols.map((c) => c === 'career' && (!t[c] || !t[c].length) ? `'{}'::text[]` : q(t[c])).join(',')});\n`;
}
console.log(sql);
