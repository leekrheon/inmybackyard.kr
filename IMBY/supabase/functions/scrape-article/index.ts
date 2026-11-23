// scrape-article — 기사 URL을 받아 제목·요약·대표 이미지·매체·게재일을 뽑아 준다.
// 관리자(admins 표에 등록된 이메일)만 호출할 수 있고, 내부망 주소는 막는다(SSRF 방지).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const MAX_BYTES = 1_500_000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ---------- 내부망 차단 ---------- */
function isPrivateIp(ip: string) {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v === '::' || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
async function assertPublicUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('올바른 URL이 아닙니다.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('http(s) 주소만 가능합니다.');
  if (u.port && !['80', '443', ''].includes(u.port)) throw new Error('허용되지 않는 포트입니다.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('내부 주소는 불러올 수 없습니다.');
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new Error('내부 주소는 불러올 수 없습니다.');
  } else {
    const ips: string[] = [];
    try { ips.push(...(await Deno.resolveDns(host, 'A'))); } catch { /* noop */ }
    try { ips.push(...(await Deno.resolveDns(host, 'AAAA'))); } catch { /* noop */ }
    if (!ips.length) throw new Error('주소를 찾을 수 없습니다.');
    if (ips.some(isPrivateIp)) throw new Error('내부 주소는 불러올 수 없습니다.');
  }
  return u;
}

/* ---------- 가져오기 (리다이렉트는 한 단계씩 검사) ---------- */
async function fetchHtml(start: URL) {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, {
      redirect: 'manual', signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
    }).finally(() => clearTimeout(t));
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`기사 페이지를 열 수 없습니다 (${res.status}).`);
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); size += value.length;
      }
      try { await reader.cancel(); } catch { /* noop */ }
    }
    const buf = new Uint8Array(size);
    let o = 0; for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.length, size - o)), o); o += c.length; if (o >= size) break; }
    // 문자 인코딩: 헤더 → <meta charset> → utf-8 (한국 언론사는 euc-kr 인 곳이 있다)
    let charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1];
    if (!charset) {
      const head = new TextDecoder('ascii').decode(buf.subarray(0, 4096));
      charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
    }
    let html: string;
    try { html = new TextDecoder((charset || 'utf-8').toLowerCase()).decode(buf); } catch { html = new TextDecoder('utf-8').decode(buf); }
    return { html, finalUrl: url };
  }
  throw new Error('리다이렉트가 너무 많습니다.');
}

/* ---------- 파싱 ---------- */
const decode = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();

function metaMap(html: string) {
  const map = new Map<string, string>();
  const head = html.slice(0, 400_000);
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const val = /content\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /content\s*=\s*'([^']*)'/i.exec(tag)?.[1];
    if (key && val && !map.has(key)) map.set(key, decode(val));
  }
  return map;
}

function jsonLdDate(html: string) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const d = /"datePublished"\s*:\s*"([^"]+)"/.exec(m[1])?.[1];
    if (d) return d;
  }
  return null;
}

function toDate(s: string | null | undefined) {
  if (!s) return null;
  const m = /(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function firstImage(html: string, base: URL) {
  const body = html.slice(html.search(/<body/i) >= 0 ? html.search(/<body/i) : 0);
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = /\b(?:data-src|data-original|src)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src || src.startsWith('data:') || /\.svg(\?|$)|logo|icon|sprite|blank|pixel|banner_|btn_/i.test(src)) continue;
    const w = Number(/\bwidth\s*=\s*["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    if (w && w < 200) continue;
    try { return new URL(decode(src), base).toString(); } catch { /* noop */ }
  }
  return null;
}

const SOURCE_BY_HOST: Record<string, string> = {
  'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보', 'donga.com': '동아일보', 'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문',
  'mk.co.kr': '매일경제', 'hankyung.com': '한국경제', 'sedaily.com': '서울경제', 'yna.co.kr': '연합뉴스', 'news1.kr': '뉴스1',
  'newsis.com': '뉴시스', 'edaily.co.kr': '이데일리', 'mt.co.kr': '머니투데이', 'zdnet.co.kr': '지디넷코리아', 'etnews.com': '전자신문',
  'platum.kr': '플래텀', 'venturesquare.net': '벤처스퀘어', 'besuccess.com': '비석세스', 'wowtale.net': '와우테일', 'n.news.naver.com': '네이버 뉴스',
  'brunch.co.kr': '브런치', 'eopla.net': 'EO', 'adic.co.kr': '광고정보센터', 'the-pr.co.kr': 'The PR', 'adweek.com': 'Adweek',
};
function sourceFor(host: string, siteName?: string) {
  if (siteName) return siteName;
  const h = host.replace(/^www\.|^m\./, '');
  for (const [k, v] of Object.entries(SOURCE_BY_HOST)) if (h === k || h.endsWith(`.${k}`)) return v;
  return h;
}

/* ---------- 핸들러 ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST만 가능합니다.' }, 405);

  // 관리자만
  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: authErr } = await sb.rpc('is_admin');
  if (authErr || !isAdmin) return json({ error: '관리자만 사용할 수 있습니다.' }, 403);

  let url = '';
  try { url = String((await req.json())?.url ?? '').trim(); } catch { /* noop */ }
  if (!url) return json({ error: 'url 이 필요합니다.' }, 400);

  try {
    const start = await assertPublicUrl(url);
    const { html, finalUrl } = await fetchHtml(start);
    const meta = metaMap(html);
    const tagTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];

    const title = meta.get('og:title') || meta.get('twitter:title') || (tagTitle ? decode(tagTitle) : null);
    const description = meta.get('og:description') || meta.get('twitter:description') || meta.get('description') || null;
    let image = meta.get('og:image:secure_url') || meta.get('og:image') || meta.get('og:image:url') || meta.get('twitter:image') || meta.get('twitter:image:src') || null;
    if (image) { try { image = new URL(image, finalUrl).toString(); } catch { image = null; } }
    if (!image) image = firstImage(html, finalUrl);
    const published = toDate(
      meta.get('article:published_time') || meta.get('og:article:published_time') || meta.get('datepublished') ||
      meta.get('pubdate') || meta.get('publish-date') || meta.get('date') || meta.get('dc.date') || jsonLdDate(html),
    );

    return json({
      url: start.toString(),
      final_url: finalUrl.toString(),
      title: title ? title.slice(0, 300) : null,
      description: description ? description.slice(0, 600) : null,
      image_url: image,
      source: sourceFor(finalUrl.hostname, meta.get('og:site_name')),
      published_at: published,
    });
  } catch (e) {
    return json({ error: (e as Error).message || '불러오지 못했습니다.' }, 422);
  }
});
