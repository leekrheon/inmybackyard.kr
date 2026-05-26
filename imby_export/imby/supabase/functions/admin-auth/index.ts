import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'catchcopy_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, password, token, display_name, avatar_url } = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 로그인
    if (action === 'login') {
      if (!password) return new Response(JSON.stringify({ error: '비밀번호를 입력하세요.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

      const hashed = await hashPassword(password);
      const { data: account } = await supabase
        .from('admin_accounts')
        .select('id, display_name, avatar_url')
        .eq('password_hash', hashed)
        .single();

      if (!account) return new Response(JSON.stringify({ error: '비밀번호가 틀렸습니다.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('admin_sessions').insert({
        token: sessionToken, expires_at: expiresAt, is_active: true,
      });

      return new Response(JSON.stringify({
        success: true,
        token: sessionToken,
        profile: {
          name: account.display_name ?? '관리자',
          avatarUrl: account.avatar_url ?? null,
        }
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 토큰 검증 + 프로필 반환
    if (action === 'verify') {
      if (!token) return new Response(JSON.stringify({ valid: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

      const { data: session } = await supabase
        .from('admin_sessions').select('id, expires_at, is_active').eq('token', token).single();

      const valid = session && session.is_active && new Date(session.expires_at) > new Date();

      if (!valid) return new Response(JSON.stringify({ valid: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

      // 프로필도 함께 반환
      const { data: account } = await supabase
        .from('admin_accounts').select('display_name, avatar_url').single();

      return new Response(JSON.stringify({
        valid: true,
        profile: {
          name: account?.display_name ?? '관리자',
          avatarUrl: account?.avatar_url ?? null,
        }
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 프로필 업데이트
    if (action === 'update_profile') {
      if (!token) return new Response(JSON.stringify({ error: '인증 필요' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

      // 토큰 유효성 확인
      const { data: session } = await supabase
        .from('admin_sessions').select('is_active, expires_at').eq('token', token).single();

      if (!session?.is_active || new Date(session.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: '세션 만료' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabase.from('admin_accounts').update({
        ...(display_name ? { display_name } : {}),
        ...(avatar_url !== undefined ? { avatar_url } : {}),
      }).neq('id', '00000000-0000-0000-0000-000000000000');

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 로그아웃
    if (action === 'logout') {
      if (token) {
        await supabase.from('admin_sessions').update({ is_active: false }).eq('token', token);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: '잘못된 요청' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('admin-auth error:', err);
    return new Response(JSON.stringify({ error: '서버 오류' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
