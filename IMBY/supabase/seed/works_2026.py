"""
IMBY Work 9개 케이스 스터디 — DB(projects)에 넣을 SQL을 만든다.
내용·이미지 출처: IMBY Team Profile 2026 피그마 슬라이드 2종. 구조: ideot works 상세(PROBLEM / INSIGHT / IDEA / 실행 / RESULT)를 참고.
실행:  python supabase/seed/works_2026.py > supabase/seed/works_2026.sql
이후 수정은 관리자 › Work 에서 한다.
"""
import json

H = '/brand/clients/hackathon-white.svg'
W = '/media/works'

P = [
# 1 ─────────────────────────────────────────────────────────────
dict(
 slug='hackathon-keycap', sort_order=1, category='Web', year=2026,
 title='흑백개발자:THE해커톤 키캡 사이트',
 title_en='대딸깍의 시대, 이젠 ‘딸깍’도 대결로',
 client='THE HACK', client_logo_url=H,
 period='2026.07 – 2026.08', services=['Web', 'Event', 'SNS'],
 role='이벤트 기획 · 웹 개발 · 홍보 캐러셀 디자인',
 summary='개발자라면 누구나 아는 F12 키 하나를 30초짜리 클릭 대결로 바꿔, 본편 공개 전의 기다림을 참여로 채웠습니다.',
 background_title='30시간의 해커톤,\n공개까지 남은 시간을 어떻게 채울까',
 background='흑백개발자:THE해커톤은 국내 최고의 빌더들이 30시간 동안 서비스를 기획하고 완성하는 과정을 담은 웹예능입니다. 본편은 EO · BZCF · 더해커톤 유튜브에 동시 공개될 예정이었고, 공개일까지 프로그램을 향한 관심을 끊기지 않게 이어가야 했습니다.',
 problem_title='보는 콘텐츠만으로는\n기다림이 길게 느껴졌습니다',
 problem='라인업 소개와 예고편은 ‘보는 사람’에게만 닿습니다. 아직 해커톤을 모르는 사람에게는 클릭할 이유가, 이미 아는 사람에게는 공개일까지 다시 돌아올 이유가 필요했습니다. 짧고, 바로 할 수 있고, 결과를 남들과 비교하고 싶어지는 무언가가 필요했습니다.',
 insight_title='개발자에게 가장 익숙한 키는\nF12였습니다',
 insight='개발자 도구를 여는 F12는 개발자라면 하루에도 몇 번씩 누르는 키입니다. 동시에 커스텀 키캡은 키보드를 꾸미는 하나의 놀이 문화가 되어 있었습니다. ‘딸깍’ 한 번이면 시작할 수 있는 이 익숙한 동작을 경쟁으로 바꾸면, 설명 없이도 누구나 참여할 수 있다고 봤습니다.',
 idea_title='30초 동안 F12 키캡을\n가장 많이 누른 사람이 이깁니다',
 idea='제한 시간 30초 안에 화면 속 F12 키캡을 클릭한 횟수로 순위를 겨루는 이벤트 웹사이트를 기획하고 직접 개발했습니다. 점수는 실시간 리더보드에 즉시 반영되고, 상위 5명에게는 배달의민족 상품권을 선물로 걸었습니다. 순위를 확인한 다음에는 자연스럽게 본편 영상으로 넘어가도록 리디렉션을 설계했습니다.',
 sections=[
  dict(label='WEB', title='클릭 한 번으로 시작되는 경쟁', body='‘준비되셨다면 화면을 클릭하세요’ 한 줄로 시작해, 끝나는 순간 기록과 실시간 순위를 보여줍니다. 해커톤의 블랙 & 그린 톤과 픽셀 타이포를 그대로 가져와 사이트 자체가 프로그램의 연장선이 되도록 만들었습니다.', images=[f'{W}/keycap/site-phones.jpg', '/media/hackathon-keycap.jpg']),
  dict(label='SNS', title='‘딸깍’도 대결이 되는 시대', body='사이트 공개와 함께 홍보 캐러셀을 업로드했습니다. 댓글에 ‘키캡’을 남기면 링크를 보내주는 방식으로 참여 신호를 댓글로 모아, 게시물의 도달과 사이트 유입을 함께 끌어올렸습니다.', images=[f'{W}/keycap/carousel.jpg']),
 ],
 result_title='보는 콘텐츠를\n참여하는 콘텐츠로',
 result='개발자 문화의 가장 작은 동작을 게임으로 바꾸어, 본편 공개 전까지 프로그램을 ‘직접 해보는’ 경험을 만들었습니다. 리더보드와 본편 영상을 한 동선으로 이어 참여가 시청으로 넘어가도록 설계했습니다.',
 metrics=[dict(value='30초', label='한 판에 걸리는 시간 — 설명 없이 바로 참여'), dict(value='Top 5', label='실시간 리더보드 상위 5명 상품권 증정'), dict(value='1 Flow', label='순위 확인 → 본편 영상 리디렉션')],
 thumbnail_url=f'{W}/keycap/site-phones.jpg', cover_url=f'{W}/keycap/overview.jpg', gallery=[],
),
# 2 ─────────────────────────────────────────────────────────────
dict(
 slug='hackathon-screening', sort_order=2, category='Offline', year=2026,
 title='흑백개발자:THE해커톤 프라이빗 시사회',
 title_en='콘텐츠가 콘텐츠를 낳는 밤',
 client='THE HACK', client_logo_url=H,
 period='2026.08', services=['Offline', 'Influencer', 'PR'],
 role='행사 기획 · 참여자 모집 · 인플루언서 섭외 · 서포터즈 운영',
 summary='약 60명 규모의 프라이빗 시사회와 대학생 서포터즈로, 본편이 공개되기 전부터 프로그램을 이야기하는 사람들을 만들었습니다.',
 background_title='본편 공개 직전,\n이야기의 첫 확산이 필요했습니다',
 background='THE해커톤은 스타트업 문화의 대중화를 목표로 비영리로 운영되는 프로젝트입니다. 본편 공개를 앞두고, 프로그램을 먼저 본 사람들이 자신의 채널에서 자연스럽게 이야기를 꺼내 주는 첫 번째 확산이 필요했습니다.',
 problem_title='광고비 없이,\n영향력 있는 사람들을 모아야 했습니다',
 problem='비영리 프로젝트인 만큼 인플루언서에게 비용을 지불하는 방식은 선택지가 아니었습니다. 금전적 대가 없이도 크리에이터와 매체가 스스로 오고 싶어지는 이유를 만들어야 했고, 행사가 끝난 뒤에도 콘텐츠가 계속 만들어지는 구조가 필요했습니다.',
 insight_title='사람들은 광고를 올리지 않고,\n자랑하고 싶은 경험을 올립니다',
 insight='크리에이터에게 가장 강력한 보상은 ‘아직 아무도 못 본 것’을 먼저 보는 경험입니다. 초대받은 사람만 들어갈 수 있는 프라이빗한 자리, 빌더들과 직접 대화할 수 있는 현장은 그 자체로 콘텐츠가 됩니다. 섭외가 아니라 초대로 접근하기로 했습니다.',
 idea_title='초대받은 사람만 먼저 보는\n프라이빗 파티 시사회',
 idea='약 60명 규모의 오프라인 시사회를 기획하고 참여자 모집부터 현장 운영까지 전반을 맡았습니다. 타깃과 행사 콘셉트에 맞는 인플루언서와 매거진 채널을 리스트업하고, 한 명 한 명 개별 협의로 무가 참여를 이끌어냈습니다.',
 sections=[
  dict(label='OFFLINE', title='인플루언서 섭외부터\n오프라인 행사 기획까지', body='피의게임 X 출연자 강지후, 구독자 330만의 크리에이터 대생이, 크리에이터 퉁퉁칸 · 정문츄, AI 매거진 AI Freaks · 프롬프롬까지. 각자의 채널에서 행사를 소개하며 홍보와 콘텐츠 확산을 위한 협업 기반이 만들어졌습니다.', images=['/media/hackathon-screening-1.jpg', '/media/hackathon-screening-2.jpg', '/media/hackathon-screening-3.jpg', '/media/hackathon-screening-collage.jpg']),
  dict(label='SUPPORTERS', title='콘텐츠가 콘텐츠를 낳는\n대학생 서포터즈', body='대학생 공식 서포터즈를 모집해 타깃층이 스스로 홍보에 참여하도록 했습니다. 서포터즈 각자의 SNS 채널을 활용한 2차 콘텐츠 확산 구조를 만들어, 행사 인지도와 도달 범위를 한 번 더 넓혔습니다.', images=[f'{W}/screening/supporters-recruit.jpg', f'{W}/screening/supporters-feed.jpg']),
 ],
 result_title='돈으로 산 도달 대신,\n사람이 옮긴 이야기',
 result='모든 크리에이터와 매체가 비용 없이 참여했고, 현장의 경험은 참여자들의 채널을 통해 다시 콘텐츠가 되어 퍼졌습니다. 시사회와 서포터즈가 맞물리며 본편 공개 전부터 프로그램을 이야기하는 사람들이 생겨났습니다.',
 metrics=[dict(value='약 60명', label='프라이빗 시사회 참여 규모'), dict(value='330만', label='참여 크리에이터 최대 구독자 규모 — 전원 무가 참여'), dict(value='2차 확산', label='대학생 서포터즈 채널을 통한 콘텐츠 재확산')],
 thumbnail_url='/media/hackathon-screening-1.jpg', cover_url='/media/hackathon-screening-collage.jpg', gallery=[],
),
# 3 ─────────────────────────────────────────────────────────────
dict(
 slug='the-hackathon', sort_order=3, category='SNS', year=2026,
 title='흑백개발자:THE해커톤 후반 SNS 마케팅 총괄',
 title_en='8월 3일, 오직 시장에서 증명하라',
 client='THE HACK', client_logo_url=H,
 period='2026.07.09 – 2026.08.15', services=['SNS', 'Key Visual', 'Contents'],
 role='후반 마케팅 총괄 · 키 비주얼 · 캐러셀 · 릴스 · 참여 이벤트',
 summary='나무위키에 걸린 공식 포스터부터 우승팀 예측 이벤트까지, 공개 전과 후를 하나의 디자인 언어로 이었습니다.',
 background_title='EO · BZCF · WORKMORE가 함께 만든\n개발자 웹예능',
 background='흑백개발자:THE해커톤은 토스 공동창업자부터 실리콘밸리 출신 엔지니어까지, 각계의 빌더들이 흑과 백으로 나뉘어 30시간 동안 서비스를 만드는 웹예능입니다. IMBY는 공개 직전부터 공개 이후까지, 프로그램의 후반 마케팅 전체를 맡았습니다.',
 problem_title='공개 전엔 기대를,\n공개 후엔 머무를 이유를',
 problem='공개 전에는 아직 보지 않은 사람들의 기대와 관심을 모아야 했고, 공개 후에는 한 번 본 시청자가 다시 돌아와 이야기를 이어갈 장치가 필요했습니다. 두 시기의 목표가 다른 만큼, 콘텐츠의 역할도 달라야 했습니다.',
 insight_title='사람들이 궁금한 건\n‘해커톤’이 아니라 ‘사람’이었습니다',
 insight='해커톤이라는 형식은 낯설지만, 18살에 삼성전자에서 커리어를 시작한 개발자, 구글과 맥킨지를 거친 엔지니어, 토스를 만든 창업자의 이야기는 누구에게나 흥미롭습니다. 출연진의 서사를 앞세우면 형식의 낯섦을 넘을 수 있다고 봤습니다.',
 idea_title='출연진의 서사로 기대를 만들고,\n참여 이벤트로 공개 이후를 잇다',
 idea='공개 전에는 출연진 라인업과 이력을 하나씩 풀어내는 캐러셀, 후원사 모집과 스타트업 대중화라는 취지를 담은 콘텐츠로 기대감을 쌓았습니다. 공개 이후에는 주요 장면과 현장 분위기를 전하고, 우승팀 예측 이벤트로 시청자가 직접 의견을 남기며 오래 머물도록 설계했습니다. 캐러셀과 릴스, 두 포맷을 하나의 디자인 시스템으로 묶었습니다.',
 sections=[
  dict(label='KEY VISUAL', title='나무위키에 걸린\n공식 포스터', body='‘8월 3일, 오직 시장에서 증명하라.’ 흑과 백 두 팀의 빌더들을 한 장에 담은 메인 포스터는 프로그램의 공식 이미지가 되어 나무위키 문서에도 그대로 쓰였습니다. 블랙 & 그린 컬러와 픽셀 타이포는 이후 모든 콘텐츠의 기준이 되었습니다.', images=[f'{W}/sns/namu-poster.jpg', f'{W}/sns/namu-wiki.jpg']),
  dict(label='CONTENTS', title='라인업 공개부터\n우승팀 예측 이벤트까지', body='‘흑 개발자라더니 라인업 이거 진짜예요?’, ‘무슨 해커톤이길래 토스 창업자까지 나옴?’처럼 피드를 넘기던 손을 멈추게 하는 질문형 카피로 출연진을 소개했습니다. 본편 공개 D-10에는 우승 서비스를 맞히는 댓글 이벤트를 열어, 공개 이후의 대화를 미리 예약했습니다.', images=[f'{W}/sns/carousels.jpg', '/media/hackathon-phone.png']),
 ],
 result_title='하나의 디자인 언어로\n공개 전과 후를 잇다',
 result='포스터부터 캐러셀, 릴스, 참여 이벤트까지 일관된 비주얼 시스템으로 프로그램의 얼굴을 만들었고, 공식 포스터는 나무위키 대표 이미지로 쓰였습니다. 본편은 EO · BZCF · 더해커톤 유튜브에 동시 공개되었습니다.',
 metrics=[dict(value='5주', label='공개 전후 후반 마케팅 총괄 기간'), dict(value='2 Formats', label='캐러셀 · 릴스 통합 디자인 시스템'), dict(value='3 Channels', label='EO · BZCF · 더해커톤 유튜브 동시 공개')],
 thumbnail_url=f'{W}/sns/namu-poster.jpg', cover_url=f'{W}/sns/carousels.jpg', gallery=[],
),
# 4 ─────────────────────────────────────────────────────────────
dict(
 slug='lockin-coffee', sort_order=4, category='Design', year=2026,
 title='락인커피 캐릭터 브랜딩',
 title_en='노루궁뎅이버섯에서 태어난 캐릭터, 제갈궁뎅',
 client='락인커피', client_logo_url='/brand/clients/thezonebio-white.svg',
 period='2026.08', services=['Character', 'SNS Branding'],
 role='캐릭터 IP 기획 · 디자인 · SNS 콘텐츠 베리에이션',
 summary='원료의 이야기를 캐릭터로 바꿔, 설명하기 어려운 기능성 커피에 한눈에 기억되는 얼굴을 만들었습니다.',
 background_title='카페인 대신 몰입을 파는\n기능성 커피',
 background='락인커피는 노루궁뎅이버섯을 핵심 원료로 담아, 카페인에 기대지 않고 건강하게 집중하는 시간을 제안하는 커피 브랜드입니다. SNS를 중심으로 브랜드를 알려야 하는 시점이었습니다.',
 problem_title='좋은 원료일수록\n설명은 길어졌습니다',
 problem='노루궁뎅이버섯은 낯선 이름이고, 기능을 설명할수록 피드 위에서는 광고처럼 보였습니다. 성분표 대신, 사람들이 먼저 호감을 갖고 기억할 수 있는 브랜드의 얼굴이 필요했습니다.',
 insight_title='원료의 생김새가\n이미 캐릭터였습니다',
 insight='복슬복슬한 털처럼 보이는 노루궁뎅이버섯의 생김새는 그 자체로 귀여운 캐릭터의 실루엣이었습니다. 원료를 설명하는 대신 원료를 주인공으로 만들면, 브랜드 이야기를 자연스럽게 전할 수 있다고 봤습니다.',
 idea_title='노루궁뎅이버섯을\n‘제갈궁뎅’으로',
 idea='복슬복슬한 털과 주황빛 발을 가진 캐릭터 ‘제갈궁뎅’을 만들었습니다. 커피잔을 들거나 태블릿 앞에 앉는 등 몰입의 순간을 함께하는 포즈로 ‘카페인 중독 없이 건강하게 몰입한다’는 브랜드 메시지를 담았습니다.',
 sections=[
  dict(label='CHARACTER', title='몰입의 순간을 함께하는\n브랜드의 얼굴', body='이름에는 지략가의 상징인 ‘제갈’을 붙여 집중과 몰입의 이미지를 더했습니다. 단순한 실루엣과 선명한 컬러 포인트로 작은 프로필 이미지에서도 알아볼 수 있게 설계했습니다.', images=['/media/lockin-character.png', '/media/lockin-mock.jpg']),
  dict(label='SNS', title='콘텐츠마다 다른 표정,\n하나의 캐릭터', body='디저트 추천, 와인 페어링, 디카페인 이야기처럼 SNS 콘텐츠 주제에 맞춰 캐릭터의 베리에이션을 만들어 활용 가능성을 넓혔습니다. 캐릭터는 이후 SNS 캐러셀 전반에 쓰이며 브랜드의 얼굴이 되었습니다.', images=[f'{W}/lockin/variations.jpg', f'{W}/lockin/instagram.jpg']),
 ],
 result_title='설명보다 먼저\n기억되는 브랜드',
 result='낯선 원료가 친근한 캐릭터가 되면서, 브랜드의 SNS는 제품 설명이 아니라 캐릭터의 이야기로 채워지기 시작했습니다. 하나의 캐릭터가 이후 모든 콘텐츠를 이어주는 브랜드 자산이 되었습니다.',
 metrics=[dict(value='1 IP', label='브랜드 캐릭터 제갈궁뎅 구축'), dict(value='SNS', label='캐러셀 전반에 쓰이는 캐릭터 베리에이션 시스템')],
 thumbnail_url='/media/lockin-mock.jpg', cover_url='/media/lockin-mock.jpg', gallery=[],
),
# 5 ─────────────────────────────────────────────────────────────
dict(
 slug='narrative-club-content', sort_order=5, category='SNS', year=2026,
 title='Narrative Club 마케팅 총괄',
 title_en='와인을 만나고, 취향을 나누는 하루',
 client='내러티브 홀딩컴퍼니', client_logo_url='/brand/clients/narrative-white.svg',
 period='2026.09 – 2026.12', services=['SNS', 'Contents Design', 'Photo & Film', 'MD'],
 role='인스타그램 운영 · 행사 홍보물 디자인 · 현장 사진/영상 촬영 · 굿즈 기획',
 summary='공간에서 열리는 행사 하나하나를 온·오프라인 콘텐츠로 이어, 클럽하우스 자체가 기억되는 브랜드가 되도록 만들었습니다.',
 background_title='창업가들이 모이는\n성수의 클럽하우스',
 background='Narrative Club은 창업가와 비즈니스 리더들이 한 건물 안에서 일하고, 미팅하고, 일상을 나누는 성수의 멤버십 클럽하우스입니다. 와인 시음회, 밋업, 네트워킹 파티 등 다양한 행사가 꾸준히 열리고 있었습니다.',
 problem_title='좋은 행사는 열리는데,\n그 경험이 남지 않았습니다',
 problem='행사는 그날 참석한 사람들의 기억으로만 남고, 공간을 처음 보는 사람에게는 클럽의 분위기가 전해지지 않았습니다. 행사마다 홍보물의 톤도 제각각이어서 클럽의 정체성으로 쌓이지 못하고 있었습니다.',
 insight_title='행사 한 번이\n다음 행사의 홍보가 될 수 있다',
 insight='현장의 공기를 제대로 기록하면, 그 장면은 다음 행사를 여는 가장 설득력 있는 홍보물이 됩니다. 행사 전의 홍보물, 행사 중의 현장, 행사 후의 콘텐츠를 하나의 흐름으로 묶으면 공간의 인지도가 쌓인다고 봤습니다.',
 idea_title='오프라인부터 온라인까지,\n한 번에 설계하다',
 idea='행사 콘셉트와 키 비주얼을 정하고, 현장에 쓰이는 배너·현수막·포토월부터 SNS 콘텐츠까지 같은 언어로 만들었습니다. 행사 당일에는 직접 현장 사진과 영상을 촬영해 SNS 홍보 콘텐츠로 이어가고, 후속 행사를 위한 홍보 자산으로 쌓았습니다.',
 sections=[
  dict(label='VISUAL', title='행사의 통일감을 높이는\n온·오프라인 홍보물', body='런칭 와인 통합 시음회 ‘Wine Tasting’의 키 비주얼을 중심으로 배너, 현수막, 포토월, SNS 포스터를 제작했습니다. 설치 위치와 동선까지 고려해 현장 어디에서 사진을 찍어도 같은 행사로 보이도록 설계했습니다.', images=[f'{W}/narrative/collateral.jpg', '/media/narrative-collateral.jpg']),
  dict(label='PHOTO & FILM', title='현장의 공기를\n그대로 기록하다', body='와인 시음회와 Grok Bot Seoul Meetup 등 Narrative에서 열린 행사에 함께하며 현장 사진과 영상을 촬영했습니다. 촬영한 장면은 SNS 콘텐츠로 바로 활용해 공간 자체의 인지도를 높이고, 다음 행사를 위한 홍보 자산을 확보했습니다.', images=[f'{W}/narrative/event-02.jpg', f'{W}/narrative/event-03.jpg', f'{W}/narrative/event-05.jpg', f'{W}/narrative/event-09.jpg', f'{W}/narrative/event-01.jpg', f'{W}/narrative/event-11.jpg']),
  dict(label='MD', title='클럽의 소속감을 담은\n어패럴', body='지퍼를 가로지르는 와이드 워드마크의 후디드 집업, 아치형 슬랩 레터링과 EST. 2018 오벌 배지를 단 컬리지 후디처럼, 멤버들이 일상에서 클럽을 입을 수 있는 이벤트 MD를 기획했습니다.', images=['/media/narrative-apparel.jpg']),
 ],
 result_title='행사가 끝나도\n남는 브랜드',
 result='행사마다 흩어져 있던 홍보물과 기록이 하나의 톤으로 정리되며, Narrative Club의 SNS는 공간의 분위기를 보여주는 아카이브가 되었습니다. 현장에서 찍은 사진과 영상은 다음 행사를 여는 홍보물로 다시 쓰이고 있습니다.',
 metrics=[dict(value='On · Off', label='배너 · 현수막 · 포토월 · SNS 통합 디자인'), dict(value='Photo & Film', label='행사 현장 직접 촬영 · 콘텐츠화'), dict(value='MD', label='멤버십 어패럴 기획')],
 thumbnail_url=f'{W}/narrative/event-02.jpg', cover_url=f'{W}/narrative/event-03.jpg', gallery=[],
),
# 6 ─────────────────────────────────────────────────────────────
dict(
 slug='narrative-seongsu-ooh', sort_order=6, category='OOH', year=2026,
 title='명함으로는 닿지 못할 사이가 있습니다',
 title_en='Narrative Club 성수 클럽하우스 외벽 OOH',
 client='내러티브 홀딩컴퍼니', client_logo_url='/brand/clients/narrative-white.svg',
 period='2026.09.18 – 2026.11.03', services=['OOH', 'Visual Design', 'Copywriting'],
 role='캠페인 기획 · 카피라이팅 · 비주얼 디렉션 · 외벽 매체 설계',
 summary='폭 3.5m의 좁은 보도에서 고개를 70도 넘게 들어야 완성되는 광고. 올려다보는 시선까지 설계해, 사람들이 찍어 올리고 싶은 외벽을 만들었습니다.',
 background_title='멤버십 클럽하우스의 가치를\n건물 외벽에 담다',
 background='Narrative Club 멤버십 IMC 캠페인의 하나로, 성수 클럽하우스 건물 외벽에 5,350 × 5,750mm 크기의 대형 배너를 설치하는 프로젝트였습니다. 성수는 서울에서 가장 많은 사람들이 사진을 찍고 공유하는 거리 중 하나입니다.',
 problem_title='가장 뜨거운 거리,\n하지만 아무도 위를 보지 않았습니다',
 problem='클럽하우스 앞 보도의 폭은 약 3.5m. 좁은 보도에서 사람들은 앞만 보고 걷고, 4층 높이의 배너를 보려면 고개를 70도 넘게 꺾어야 합니다. 보통의 비주얼은 올려다볼 때 위쪽이 좁아지는 왜곡까지 생겼습니다. 그리고 멤버십 클럽의 가치는 한 문장으로 설명하기 어려웠습니다.',
 insight_title='명함은 수없이 주고받지만,\n정작 연락할 사람은 많지 않다',
 insight='비즈니스 현장에서 우리는 수많은 명함을 주고받지만, 필요할 때 편하게 연락할 수 있는 사람은 손에 꼽습니다. 한 건물 안에서 사우나를 하고, 미팅을 하고, 일상을 나누며 반복되는 만남이 관계를 깊게 만든다는 것, 그것이 클럽하우스가 주는 진짜 가치였습니다.',
 idea_title='고개를 들어야\n완성되는 광고',
 idea='“명함으로는 닿지 못할 사이가 있습니다.” 이 한 줄에 클럽하우스의 가치를 담고, 올려다보는 각도 자체를 비주얼의 일부로 만들었습니다. 인물을 극단적인 앙각(Low-angle shot)으로 담아, 보행자 시선과 가까운 하체는 크게 최상단의 얼굴과 팔은 작게 배치했습니다. 사진의 원근과 올려다보는 시선이 겹치는 순간, 배너 속 인물은 하늘로 떠오르기 시작합니다.',
 sections=[
  dict(label='VISUAL', title='좁은 보행로와 원근감을\n계산한 비주얼', body='배너 위로 2.5m의 풍선을 띄워 광고의 경계를 하늘까지 넓혔습니다. 이 공간에서 만난 창업가들이 풍선처럼 더 높은 곳으로 끝없이 성장하기를 바라는 메시지이자, 멀리서도 건물의 위치를 알아볼 수 있게 하는 랜드마크입니다.', images=['/media/narrative-ooh-1.jpg', '/media/narrative-ooh-2.jpg']),
  dict(label='2ND VIRAL', title='광고의 진짜 도달은\n벽이 아니라 피드에서', body='디지털 옥외광고를 본 소비자의 76%가 검색 · 방문 · 공유 등 실제 행동을 했다는 조사(OAAA × The Harris Poll, 2024)처럼, 옥외광고의 영향력은 찍혀서 공유될 때 커집니다. 한 장의 사진에 담기는 프레이밍과 그대로 캡션이 되는 카피로 ‘올려다보고 찍고 싶은’ 장면을 설계했습니다.', images=['/media/narrative-ooh-3.jpg', '/media/narrative-mock.jpg']),
 ],
 result_title='광고비 없이\n피드를 타고 퍼진 외벽',
 result='현장 사진은 인스타그램 매체와 개인 계정의 리포스트로 2차 유통되었고, 별도의 매체비 없이 여러 매거진에 소개되었습니다. 한 번 설치한 외벽이 온라인에서 계속 이동하는 광고가 되었습니다.',
 metrics=[dict(value='6+', label='광고비 없이 소개된 매거진 · 미디어'), dict(value='70°', label='보행자가 올려다보는 각도까지 계산한 앙각 비주얼'), dict(value='5,350 × 5,750', label='mm · 성수 클럽하우스 외벽 배너'), dict(value='2.5m', label='광고의 경계를 하늘까지 넓힌 벌룬')],
 thumbnail_url='/media/narrative-ooh-1.jpg', cover_url='/media/narrative-ooh-1.jpg', gallery=[],
),
# 7 ─────────────────────────────────────────────────────────────
dict(
 slug='tiro-sagwan', sort_order=7, category='Film', year=2026,
 title='이제 Tiro 하나로 든든하게 회의감',
 title_en='나보다 정확한 AI 회의록을 만나다',
 client='Tiro', client_logo_url='/brand/clients/tiro-white.svg',
 period='2026.08 – 2026.12', services=['Film', 'OOH', 'DOOH', 'Visual Design'],
 role='캠페인 기획 · 카피라이팅 · 키 비주얼 · 필름 스토리보드 · 옥외 집행',
 summary='왕의 말을 한 글자도 놓치지 않던 조선의 사관. 그 모습을 빌려 AI 회의록 Tiro의 역할을 단번에 보여주었습니다.',
 background_title='회의는 많고,\n기록은 늘 누군가의 몫이었습니다',
 background='Tiro는 회의를 실시간으로 받아쓰고, 요약하고, 지난 회의 내용을 바로 찾아주는 AI 회의록 서비스입니다. 98% 정확도의 받아쓰기, 17개 국어 실시간 번역, 모든 회의를 하나로 잇는 위키 기능을 갖추고 있습니다.',
 problem_title='AI 회의록은 많아졌지만,\n차이는 잘 보이지 않았습니다',
 problem='비슷한 AI 회의록 서비스가 빠르게 늘면서 기능을 나열하는 광고로는 차별점이 전달되지 않았습니다. 바쁜 직장인이 피드와 거리에서 단 몇 초 만에 ‘이게 왜 필요한지’를 느끼게 해야 했습니다.',
 insight_title='회의록 작성에 지친 사람에게\n회의는 곧 ‘회의감’이었다',
 insight='회의 내내 받아 적느라 정작 대화에 참여하지 못하고, 회의가 끝나면 “어제 뭐 결정했죠?”가 반복됩니다. 직장인에게 회의는 회의(會議)이면서 동시에 회의(懷疑)감이었습니다. 이 말맛에서 공감을 먼저 건드리기로 했습니다.',
 idea_title='사관(史官)의 기록으로 풀어낸\nAI 회의록',
 idea='왕의 곁에서 모든 말을 기록하던 조선의 사관을 빌려, 회의를 대신 기록하는 Tiro의 역할을 보여주었습니다. 익숙한 사극 일러스트로 피드 속 시선을 붙잡고, ‘이제 Tiro 하나로 든든하게 회의감!’이라는 카피로 회의록에 지친 직장인의 공감을 끌어냈습니다.',
 sections=[
  dict(label='OOH', title='강남 일대를 채운\n사극 일러스트 4종 시리즈', body='‘나보다 정확한 AI 회의록을 만나다’를 중심으로 사관 일러스트 4종을 강남 일대에 집행했습니다. 잠실 · 종합운동장 · 선릉을 지나는 버스 광고에는 ‘17개 국어 실시간 번역 회의록’을 여러 언어로 적어 기능을 장면으로 보여주었고, ‘미팅까지 세 정거장, 저번 미팅 결론을 다시 듣기엔 충분합니다’처럼 그 장소에서만 읽히는 카피를 더했습니다.', images=['/media/tiro-gangnam.jpg', '/media/tiro-sagwan-2.jpg']),
  dict(label='FILM', title='밤의 미술관,\n작품들의 회의가 시작된다', body='문이 닫힌 밤 10시의 미술관. 조각상과 명화들이 모여 회의를 시작하지만 “어제 회의에서 뭐 결정했죠?”라는 질문에 아무도 답하지 못합니다. 귀가 안 좋은 고흐, 적을 손이 없는 비너스, 비명만 지르는 절규. 결국 생각하는 사람이 Tiro를 꺼내 들며 ‘두말할 것 없는 회의의 시작’으로 끝나는 필름을 기획했습니다. 본 광고는 흑백개발자:THE해커톤 본편의 중간광고로도 삽입되었습니다.', images=['/media/tiro-film.jpg']),
 ],
 result_title='기능이 아니라\n장면으로 기억되는 서비스',
 result='사극과 명화라는 익숙한 이야기 틀을 빌려, 기능을 나열하지 않고도 ‘회의를 대신 기억해 주는 서비스’라는 역할이 한 장면으로 전달되도록 만들었습니다. 옥외, 버스, 필름, 디지털 사이니지까지 같은 메시지로 이어지는 캠페인을 완성했습니다.',
 metrics=[dict(value='4종', label='강남 일대 사관 일러스트 OOH 시리즈'), dict(value='17개 국어', label='버스 광고로 보여준 실시간 번역 기능'), dict(value='Mid-roll', label='흑백개발자:THE해커톤 본편 중간광고 삽입')],
 thumbnail_url='/media/tiro-sagwan-1.jpg', cover_url='/media/tiro-sagwan-1.jpg', gallery=[],
),
# 8 ─────────────────────────────────────────────────────────────
dict(
 slug='nego-bi', sort_order=8, category='Design', year=2026,
 title='Négo BI 리브랜딩',
 title_en='와이너리의 시작과 끝을 잇다',
 client='Négo', client_logo_url='/brand/clients/nego-white.svg',
 period='2026.11', services=['BI', 'Brand Guideline', 'Social Rebranding'],
 role='BI 가이드라인 수립 · 소셜 미디어 리브랜딩 전략 · AI 콘텐츠 제작 체계 설계',
 summary='와인과 사람, 끊어져 있던 유통의 흐름을 잇는 브랜드. 그 이름에 맞는 시각 언어와 운영 체계를 함께 만들었습니다.',
 background_title='와인을 둘러싼 사람과 가치를\n연결하기 위해 태어난 브랜드',
 background='한 잔의 와인도 아주 먼 곳에서 시작되어 테이블에 도착합니다. Négo는 좋은 와인과 그 가치를 알아보는 사람을 연결하고, 끊어져 있던 와인 유통의 흐름을 하나로 잇기 위해 탄생한 Narrative의 파트너사입니다.',
 problem_title='좋은 방향성은 있었지만,\n보이는 얼굴은 정리되지 않았습니다',
 problem='브랜드가 지향하는 방향은 분명했지만, 로고와 컬러, 콘텐츠의 톤이 채널마다 달라 하나의 브랜드로 읽히지 않았습니다. 적은 인원으로 꾸준히 콘텐츠를 만들어야 하는 상황에서, 일관성을 지킬 수 있는 기준도 필요했습니다.',
 insight_title='와인의 깊이는\n시간에서 나온다',
 insight='와인의 가치는 들뜬 화려함이 아니라 오래 숙성된 시간과 신뢰에서 나옵니다. 브랜드의 시각 언어도 같은 결이어야 한다고 봤습니다. 숙성된 레드 와인의 색, 오크통과 오래된 라벨지의 온기처럼 와인의 시간에서 브랜드의 컬러를 가져오기로 했습니다.',
 idea_title='숙성된 와인의 색으로\n신뢰를 말하다',
 idea='충분히 숙성된 레드 와인의 깊은 색 ‘Wine Burgundy(#510B15)’를 메인 컬러로, 오크통의 나뭇결과 코르크에서 가져온 미색 ‘Oak Cask Beige(#FDF7ED)’를 보조 컬러로 정했습니다. 로고의 최소 여백과 금지 사례까지 담은 BI 가이드라인을 수립해, 누가 만들어도 같은 브랜드로 보이게 했습니다.',
 sections=[
  dict(label='BI GUIDELINE', title='로고와 컬러,\n일관된 시각 언어로', body='채도를 낮춘 버건디로 들뜬 열정 대신 신뢰와 전문성, 시간이 만든 가치를 표현했습니다. 순백 대신 따뜻한 미색을 써 차갑지 않은 여백과 아날로그의 온기를 만들고, 로고의 회전 · 비율 변경 · 그라데이션 등 사용 금지 규칙을 정리했습니다.', images=[f'{W}/nego/bi-guide.jpg', '/media/nego-bi.jpg']),
  dict(label='SOCIAL', title='퇴근길 1분\n와인 큐레이션', body='기존 콘텐츠를 분석해 ‘1,000년의 역사가 와인의 깊이가 되기까지’, ‘퇴근길 1분 와인 큐레이션’처럼 브랜드의 전문성을 쉽게 전하는 소셜 미디어 리브랜딩 방향을 제안했습니다. MCP 연동 AI 콘텐츠 제작 프로세스를 설계해, 최소한의 리소스로도 일관된 콘텐츠를 계속 만들 수 있는 운영 체계를 함께 넘겼습니다.', images=[]),
 ],
 result_title='이름처럼,\n흐름을 잇는 브랜드',
 result='로고와 컬러, 콘텐츠 톤이 하나의 기준 아래 정리되며 Négo는 어느 채널에서든 같은 브랜드로 읽히게 되었습니다. 프로젝트가 끝난 뒤에도 브랜드 팀이 스스로 콘텐츠를 만들 수 있는 가이드와 제작 체계를 남겼습니다.',
 metrics=[dict(value='BI', label='로고 · 컬러 시스템 · 사용 규칙 가이드라인'), dict(value='Social', label='소셜 미디어 리브랜딩 전략 제안'), dict(value='AX', label='MCP 연동 콘텐츠 제작 프로세스 설계')],
 thumbnail_url=f'{W}/nego/bi-guide.jpg', cover_url=f'{W}/nego/bi-guide.jpg', gallery=[],
),
# 9 ─────────────────────────────────────────────────────────────
dict(
 slug='goongnori', sort_order=9, category='Design', year=2025,
 title='궁노리',
 title_en='NFC 노리개형 고궁 브로슈어, GOONGNORI',
 client='궁노리', client_logo_url=None,
 period='2025 – 2026', services=['Product', 'NFC', 'Field Research'],
 role='공동창업 · 기획(PM) · 현장 리서치 · 제품 디자인 · 크라우드펀딩',
 summary='종이 브로슈어 대신 손에 쥐는 노리개. 고궁에서 스마트폰을 대면 그 자리의 이야기가 열리는 NFC 브로슈어를 만들었습니다.',
 background_title='고궁을 찾는 사람은 늘었지만,\n이야기는 지나쳐 갔습니다',
 background='한복을 입고 고궁을 찾는 방문객은 꾸준히 늘고 있지만, 대부분의 관람은 사진을 찍고 지나가는 데서 끝납니다. 입구에서 받는 종이 브로슈어는 금세 가방 속에 들어가고, 건물마다 담긴 이야기는 전해지지 않았습니다.',
 problem_title='정보는 있었지만,\n꺼내 보고 싶은 형태가 아니었습니다',
 problem='고궁 안내 정보는 충분히 있었지만, 관람객이 직접 찾아 읽어야 하는 방식이었습니다. 정보를 더 늘리는 것이 아니라, 관람의 흐름 안에서 자연스럽게 손이 가는 형태가 필요했습니다.',
 insight_title='관람객이 직접 말해준\n불편함에서 시작했습니다',
 insight='고궁 현장에서 방문객에게 직접 QR 보드를 들고 관람 경험을 물었습니다. 사람들은 정보가 부족하다고 느끼기보다, 들고 다니기 번거롭고 오래 간직하고 싶지 않다는 점을 이야기했습니다. 브로슈어가 ‘들고 싶은 물건’이 되어야 한다고 봤습니다.',
 idea_title='전통 노리개에\nNFC를 담다',
 idea='한복의 장신구인 노리개 모양의 브로슈어에 NFC 칩을 넣었습니다. 고궁 곳곳에서 스마트폰을 가까이 대면 그 장소의 이야기와 안내가 열립니다. 관람이 끝난 뒤에는 가방에 달고 다니는 기념품이 되어, 브로슈어가 버려지지 않고 남습니다.',
 sections=[
  dict(label='FIELD RESEARCH', title='데이터로 보이지 않는 것은\n직접 묻는다', body='고궁 방문객에게 QR 보드를 들고 다가가 관람 경험과 불편함을 직접 물었습니다. 현장에서 모은 답이 제품의 형태와 기능을 정하는 기준이 되었습니다.', images=['/media/field-1.jpg', '/media/field-2.jpg', '/media/field-3.jpg']),
  dict(label='PRODUCT', title='손에 쥐는 브로슈어,\n가방에 다는 기념품', body='궁궐의 지붕선과 전통 매듭을 담은 노리개 두 가지 디자인(cut A · cut B)을 만들었습니다. 한복과 함께 착용해도 어색하지 않고, 관람이 끝난 뒤에는 일상에서 쓰는 키링이 되도록 설계했습니다.', images=[f'{W}/goongnori/norigae.jpg', '/media/goongnori.jpg']),
 ],
 result_title='110여 개 팀 중 1위,\n교육부장관상',
 result='궁노리는 2025 로컬히어로즈100 창업경진대회에서 110여 개 팀 중 1위로 대상(교육부장관상)을 받았고, 2026-1 서강리더스클럽 제작비 지원에 선정되었습니다. 텀블벅 크라우드펀딩에서는 목표 대비 103%를 달성했습니다.',
 metrics=[dict(value='1위', label='2025 로컬히어로즈100 창업경진대회 대상 · 교육부장관상 (110여 개 팀)'), dict(value='103%', label='텀블벅 크라우드펀딩 달성률'), dict(value='선정', label='2026-1 서강리더스클럽 제작비 지원')],
 thumbnail_url=f'{W}/goongnori/norigae.jpg', cover_url=f'{W}/goongnori/norigae.jpg', gallery=[f'{W}/goongnori/award.jpg'],
),
]

def q(v):
    if v is None: return 'null'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def arr(a):
    return "array[" + ",".join(q(x) for x in a) + "]::text[]" if a else "'{}'::text[]"

def js(v):
    return q(json.dumps(v, ensure_ascii=False)) + '::jsonb'

cols = ['slug','title','title_en','client','client_logo_url','year','period','category','services','role','summary',
        'background_title','background','problem_title','problem','insight_title','insight','idea_title','idea',
        'sections','result_title','result','metrics','thumbnail_url','cover_url','gallery','published','featured','sort_order']

out = ['-- IMBY Work 9 case studies (generated by works_2026.py)', 'begin;']
# 목록에서 빠진 작업물은 지우지 않고 비공개로
out.append("update public.projects set published = false where slug not in (" + ",".join(q(p['slug']) for p in P) + ");")
for p in P:
    vals = []
    for c in cols:
        v = p.get(c)
        if c in ('services',): vals.append(arr(v or []))
        elif c == 'gallery': vals.append(js(v or []))
        elif c in ('sections','metrics'): vals.append(js(v or []))
        elif c == 'published': vals.append('true')
        elif c == 'featured': vals.append('true' if p['sort_order'] <= 6 else 'false')
        else: vals.append(q(v))
    upd = ", ".join(f"{c} = excluded.{c}" for c in cols if c != 'slug')
    out.append(f"insert into public.projects ({', '.join(cols)}) values ({', '.join(vals)}) on conflict (slug) do update set {upd};")
out.append('commit;')
print("\n".join(out))
