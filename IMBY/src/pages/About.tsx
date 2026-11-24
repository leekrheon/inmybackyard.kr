import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollTrigger } from '../lib/motion';
import { useOpenings } from '../lib/data';
import { useDocTitle } from '../lib/useDocTitle';
import { Rv } from '../components/Reveal';
import { TeamMembers } from './Team';
import { BrainField } from '../components/LazyGraphic';
import { useLocation } from 'react-router-dom';

/**
 * About — 디마이너스원(dminus1.com) 구조를 검은 바탕으로 뒤집어 옮겼다.
 * 1) 거대한 문장 + 실시간 서울 시각
 * 2) 반원 행성이 고정되고, 스크롤마다 가치가 (1/4)→(4/4)로 바뀐다
 * 3) OUR PHILOSOPHY — 왼쪽 고정 제목, 오른쪽 (01) 제목 + 굵은 본문
 * 5) FROM THE FOUNDER
 * 6) NOW HIRING — 거대한 두 단어 + 포지션 목록
 */

/* ---------------- 1. Hero — 굵은 국문 두 줄, 시계·행성 같은 남의 오브젝트는 쓰지 않는다 ---------------- */
function Hero() {
  return (
    <section className="ab wrap">
      <h1 className="sr-only">About IMBY</h1>
      <div className="ab__mark">
        <BrainField src="/brand/relevance.svg" mode="shape" grid={600} fit tilt={0.55} dissolve={false} className="ab__relevance" />
      </div>
    </section>
  );
}

/* ---------------- 3–4. 디마원식 번호 목록 ---------------- */
type Fx = { src: string; mode?: 'image' | 'shape'; grid?: number };
type Item = { t: string; d: string; proof?: string; img?: string; fx?: Fx };
function NumberedList({ title, items, id, photos }: { title: [string, string]; items: Item[]; id?: string; photos?: string[] }) {
  const root = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(0);
  // 오른쪽 목록 중 화면 가운데에 걸린 항목을 따라 왼쪽 사진이 한 장씩 겹쳐 바뀐다
  useEffect(() => {
    const el = root.current;
    if (!el || !photos?.length) return;
    const lis = Array.from(el.querySelectorAll<HTMLElement>('.nl__item'));
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) setOn(Math.min(lis.indexOf(e.target as HTMLElement), photos.length - 1)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    lis.forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, [photos]);
  const head = <h2 className="nl__title">{title[0]}<br />{title[1]}</h2>;
  return (
    <section className={`nl wrap ${photos?.length ? 'nl--photos' : ''}`} id={id} ref={root}>
      {photos?.length ? (
        <div className="nl__side">
          {head}
          <div className="nl__stack" aria-hidden="true">
            {photos.map((src, k) => <img key={src} src={src} alt="" loading={k ? 'lazy' : 'eager'} className={k === on ? 'is-on' : ''} />)}
          </div>
        </div>
      ) : head}
      <ol className="nl__list">
        {items.map((it, i) => (
          <Rv as="li" key={it.t} className="nl__item">
            <span className="nl__no tnum">{String(i + 1).padStart(2, '0')}</span>
            <div className="nl__body">
              <h3 className="nl__t">{it.t}</h3>
              <p className="nl__d">{it.d}</p>
              {it.proof && <p className="nl__proof">{it.proof}</p>}
              {it.img && <div className="nl__img"><img src={it.img} alt="" loading="lazy" /></div>}
              {it.fx && (
                <div className="nl__fx">
                  <BrainField src={it.fx.src} mode={it.fx.mode ?? 'image'} grid={it.fx.grid ?? 300} fit tilt={0.7} dissolve={false} />
                </div>
              )}
            </div>
          </Rv>
        ))}
      </ol>
    </section>
  );
}

/** What we believe 왼쪽에 이어지는 팀 사진 (흑백) */
const BELIEVE_PHOTOS = ['/media/about/believe-1.webp', '/media/about/believe-2.webp', '/media/about/believe-3.webp', '/media/about/believe-4.webp'];

const PHILOSOPHY: Item[] = [
  {
    t: 'Every line needs a reason.',
    d: '잘 만든 제품에 이유 없는 선이 없듯, 좋은 광고에도 설명할 수 없는 요소는 없습니다. 왜 이 매체여야 하는지, 왜 이 자리에 이 문장이어야 하는지, 왜 지금이어야 하는지. 우리는 그 질문에 답할 수 있을 때까지 선을 긋지 않습니다. 감으로 시작해도, 이유로 끝냅니다.',
    fx: { src: '/brand/relevance.svg', mode: 'shape', grid: 520 },
  },
  {
    t: 'People don’t share ads, they share stories.',
    d: '사람들은 광고를 공유하지 않습니다. 재밌는 장면을 공유합니다. 그래서 우리는 얼마나 많이 보여줄지보다, 왜 찍어서 올리고 싶어질지를 먼저 고민합니다. 돈으로 산 도달은 집행이 끝나면 멈추지만, 사람들이 스스로 옮긴 이야기는 계속 퍼집니다. 함께하는 사람들도 마찬가지입니다. 섭외하기보다, 먼저 같이 하고 싶어지는 판을 깝니다.',
    fx: { src: '/media/fx-heart.png' },
  },
  {
    t: 'Machines repeat. Humans imagine.',
    d: '자료를 찾고, 정리하고, 같은 포맷을 반복하는 일에 사람의 시간을 쓰지 않습니다. 쌓아 둔 생각과 경험은 팀 전체가 언제든 꺼내 쓸 수 있게 만들고, 사람은 아직 아무도 하지 않은 생각에 집중합니다. 다섯 명이 하나의 뇌처럼 움직이는 방법입니다. 그리고 일이 끝나면, 클라이언트가 우리 없이도 계속 굴릴 수 있는 방식까지 함께 넘깁니다.',
    fx: { src: '/media/fx-hands.png', grid: 360 },
  },
  {
    t: 'Problems first. Formats later.',
    d: '문제가 먼저고, 형식은 나중입니다. 답이 옥외광고일 때도, 캐릭터일 때도, 커뮤니티나 직접 만든 브랜드일 때도 있습니다. 매체의 경계도, 업종의 경계도 미리 정해 두지 않습니다. 크리에이티브가 필요한 곳이라면 어디든 갑니다.',
    fx: { src: '/media/fx-mobius.png', grid: 340 },
  },
];

/* ---------------- 5. Founder ---------------- */
const LETTER = [
  '안녕하십니까, 저희 팀을 소개해 드릴 수 있어 영광입니다.',
  '열 살, 처음 광고라는 세계를 알게 되었습니다. 잠들기 직전 떠오른 아이디어 하나에 가슴이 뛰어 밤을 지새우던 소년은 그때부터 줄곧 한 가지 질문을 품고 살아왔습니다. “어떻게 하면 사람들의 마음을 움직일 수 있을까?”',
  '열아홉 살, 그 질문에 처음으로 답해 보았습니다. 직접 기획한 첫 옥외광고가 검색량을 집계 최고치로 끌어올린 것입니다. 아이디어 하나가 실제로 사람들의 행동을 바꾸는 순간을 목격했고, 지금까지 저는 그 창의력이 가진 힘을 확신하며 살아오고 있습니다.',
  'IMBY는 그 확신에서 출발했습니다. 그리고 저희는 좋은 크리에이티브에는 반드시 ‘그래야만 하는 이유’가 있다고 믿습니다. 잘 만든 제품 디자인에 이유 없는 선이 하나도 없듯, 매체를 고르는 이유부터 카피 한 줄을 쓰는 이유까지, 모든 요소에 당위성을 쌓아 올려 논리적으로 정답에 가까운 크리에이티브를 찾아갑니다. 저희는 이것을 ‘렐러번스(Relevance)’라고 부릅니다.',
  '브랜드가 가진 고민을 저희의 고민처럼 붙잡고, ‘왜 꼭 이것이어야 하는가’에 답할 수 있을 때까지 머리를 맞댑니다.',
  '저희는 일을 받아 처리하는 곳에 머물고 싶지 않습니다. 같은 테이블에 앉아 함께 고민하고, 함께 웃고, 결과 앞에서 함께 기뻐하는 진짜 파트너가 되고 싶습니다.',
];

/* ---------------- 5. Greetings — 대표 편지. 스크롤에 맞춰 한 문단씩 떠오른다 ---------------- */
function Founder() {
  return (
    <section className="nl wrap">
      <h2 className="nl__title">Greetings</h2>
      <div className="nl__list">
        <div className="nl__item nl__item--letter">
          <div className="nl__body gl">
            {LETTER.map((p, i) => (
              <Rv as="p" key={i} className={`gl__p ${i === 0 ? 'gl__p--first' : ''}`} delay={i === 0 ? 0 : 80}>{p}</Rv>
            ))}
            <Rv as="p" className="gl__sign" delay={120}>이주헌 드림</Rv>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- 6. NOW HIRING ---------------- */
function Hiring() {
  const { data } = useOpenings();
  return (
    <section className="nh wrap">
      <h2 className="nh__big">Join the<br />backyard</h2>
      <div className="nh__side">
        <p className="nh__d">IMBY의 방식에 공감하고, 무엇을 말할지부터 함께 고민할 동료를 찾습니다. 연차와 직무보다 태도를 봅니다. 같은 뒷마당에서 함께 일해요.</p>
        <ul className="nh__list">
          {data.length > 0 ? data.map((o) => (
            <li key={o.id}><span>{[o.title, o.experience, 'Open'].filter(Boolean).join(' / ')}</span><a href="mailto:support@inmybackyard.kr?subject=IMBY%20%EC%A7%80%EC%9B%90">Apply</a></li>
          )) : (
            <>
              <li><span>상시 지원 / 포트폴리오 / Open</span><a href="mailto:support@inmybackyard.kr?subject=IMBY%20%EC%A7%80%EC%9B%90">Apply</a></li>
              <li><span>커피챗 / 합류 고민 / Open</span><Link to="/contact/coffee-chat">Coffee Chat</Link></li>
            </>
          )}
        </ul>
      </div>
    </section>
  );
}

export default function About() {
  useDocTitle('About — IMBY', 'In My BackYard — 가장 가까운 곳에서 가장 멀리 가는 생각을 찾는 크리에이티브 & 인사이트 에이전시.');
  const { hash } = useLocation();
  useEffect(() => { const t = window.setTimeout(() => ScrollTrigger.refresh(), 300); return () => window.clearTimeout(t); }, []);
  // /about#team 처럼 들어오면 해당 섹션으로
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ block: 'start' }), 450);
    return () => window.clearTimeout(t);
  }, [hash]);
  return (
    <>
      <Hero />
      <NumberedList title={['What we', 'believe']} items={PHILOSOPHY} photos={BELIEVE_PHOTOS} />
      <TeamMembers />
      <Founder />
      <Hiring />
    </>
  );
}
