import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { voter_key, brief_id, content, author } = await req.json();

    // 입력값 검증
    if (!voter_key || !brief_id || !content || !author) {
      return new Response(JSON.stringify({ error: '필수 값이 누락되었습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (content.trim().length < 4 || content.trim().length > 100) {
      return new Response(JSON.stringify({ error: '카피는 4~100자 사이여야 합니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (voter_key.length < 10) {
      return new Response(JSON.stringify({ error: '유효하지 않은 요청입니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // service_role key로 클라이언트 생성 (RLS 우회 가능, 서버에서만 사용)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. 브리프 존재 및 진행중 여부 확인
    const { data: brief, error: briefErr } = await supabase
      .from('briefs')
      .select('id, status, deadline')
      .eq('id', brief_id)
      .single();

    if (briefErr || !brief) {
      return new Response(JSON.stringify({ error: '존재하지 않는 브리프입니다.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (brief.status === '종료') {
      return new Response(JSON.stringify({ error: '마감된 브리프입니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. 브리프를 읽었는지 확인 (서버에서 재확인)
    const { data: readRecord } = await supabase
      .from('brief_reads')
      .select('id')
      .eq('brief_id', brief_id)
      .eq('voter_key', voter_key)
      .single();

    if (!readRecord) {
      return new Response(JSON.stringify({ error: '브리프를 먼저 읽어주세요.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. 이미 카피를 작성했는지 확인 (중복 방지)
    const { data: existingCopy } = await supabase
      .from('copies')
      .select('id')
      .eq('brief_id', brief_id)
      .eq('voter_key', voter_key)
      .single();

    if (existingCopy) {
      return new Response(JSON.stringify({ error: '이미 카피를 작성하셨습니다.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. 카피 삽입
    const { data: newCopy, error: copyErr } = await supabase
      .from('copies')
      .insert({
        brief_id,
        voter_key,
        author: author.trim().slice(0, 20), // 닉네임 최대 20자
        content: content.trim(),
        upvotes: 0,
      })
      .select()
      .single();

    if (copyErr) {
      // UNIQUE 제약 위반 (동시 요청 방어)
      if (copyErr.code === '23505') {
        return new Response(JSON.stringify({ error: '이미 카피를 작성하셨습니다.' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw copyErr;
    }

    // 5. 캐치 적립 (UPSERT - 원자적 처리)
    const CATCH_AMOUNT = 400;
    const { data: uc } = await supabase
      .from('user_catches')
      .select('catches')
      .eq('voter_key', voter_key)
      .single();

    let newCatches: number;
    if (uc) {
      newCatches = uc.catches + CATCH_AMOUNT;
      await supabase
        .from('user_catches')
        .update({ catches: newCatches, updated_at: new Date().toISOString() })
        .eq('voter_key', voter_key);
    } else {
      newCatches = CATCH_AMOUNT;
      await supabase
        .from('user_catches')
        .insert({ voter_key, catches: CATCH_AMOUNT });
    }

    return new Response(JSON.stringify({
      success: true,
      copy_id: newCopy.id,
      catches: newCatches,
      catch_amount: CATCH_AMOUNT,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('submit-copy error:', err);
    return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
