import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { voter_key, copy_id, action } = await req.json(); // action: 'vote' | 'unvote'

    if (!voter_key || !copy_id || !action) {
      return new Response(JSON.stringify({ error: '필수 값 누락' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. 카피 존재 확인
    const { data: copy } = await supabase
      .from('copies')
      .select('id, voter_key, upvotes, brief_id')
      .eq('id', copy_id)
      .single();

    if (!copy) {
      return new Response(JSON.stringify({ error: '존재하지 않는 카피입니다.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. 자기 카피 투표 방지
    if (copy.voter_key === voter_key) {
      return new Response(JSON.stringify({ error: '자신의 카피에는 투표할 수 없습니다.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. 브리프 마감 여부 확인
    const { data: brief } = await supabase
      .from('briefs')
      .select('status')
      .eq('id', copy.brief_id)
      .single();

    if (brief?.status === '종료') {
      return new Response(JSON.stringify({ error: '마감된 브리프에는 투표할 수 없습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. 기존 투표 여부 확인
    const { data: existingVote } = await supabase
      .from('copy_votes')
      .select('id')
      .eq('copy_id', copy_id)
      .eq('voter_key', voter_key)
      .single();

    let newUpvotes: number;

    if (action === 'vote') {
      if (existingVote) {
        return new Response(JSON.stringify({ error: '이미 투표했습니다.', upvotes: copy.upvotes }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // 투표 추가
      await supabase.from('copy_votes').insert({ copy_id, voter_key });
      newUpvotes = copy.upvotes + 1;
      await supabase.from('copies').update({ upvotes: newUpvotes }).eq('id', copy_id);

    } else { // unvote
      if (!existingVote) {
        return new Response(JSON.stringify({ error: '투표 기록이 없습니다.', upvotes: copy.upvotes }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      await supabase.from('copy_votes').delete().eq('copy_id', copy_id).eq('voter_key', voter_key);
      newUpvotes = Math.max(0, copy.upvotes - 1);
      await supabase.from('copies').update({ upvotes: newUpvotes }).eq('id', copy_id);
    }

    return new Response(JSON.stringify({ success: true, upvotes: newUpvotes }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('vote-copy error:', err);
    return new Response(JSON.stringify({ error: '서버 오류' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
