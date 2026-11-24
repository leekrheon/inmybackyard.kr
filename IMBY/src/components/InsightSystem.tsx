import { Rv } from './Reveal';
import BrainField from './BrainField';

/**
 * 홈 — "제작은 무한해졌고, 인사이트는 희소해졌습니다."
 * About의 What we believe 와 같은 레이아웃(왼쪽 고정 헤드라인 · 오른쪽 번호 목록)에,
 * 뇌 · Relevance 와 같은 은색 픽셀 3D 그래픽을 붙였다.
 * 내용: IMBY Team Profile 2026 — Prologue(Tacit Knowledge) · AX System Build.
 */
const HANDOVER = [
  { t: 'Prompt Playbook', d: '브랜드 톤, 레퍼런스, 금지어까지 담은 프롬프트 설계서' },
  { t: 'Photo & Asset Kit', d: '촬영 원본, 누끼 컷, 로고 · 폰트 · 컬러까지 브랜드 에셋 일체' },
  { t: 'MCP Template', d: '사진과 문구만 바꿔 끼우면 릴스 한 편이 완성되는 템플릿' },
  { t: 'Hand-off Session', d: '계약 후에도 자체 채널에서 콘텐츠를 재생산하는 실무 교육' },
];

const ITEMS = [
  {
    t: '우리는 말할 수 있는 것보다\n더 많이 알고 있다',
    d: 'AI는 이미 말로 쓰인 것, 즉 형식지를 학습합니다. 하지만 좋은 광고의 출발점은 아직 말로 쓰이지 않은 것입니다. 현장의 공기, 사람의 표정, 시장의 미묘한 결. 이 암묵지는 프롬프트로 검색되지 않습니다.',
    fx: '/media/fx-iceberg.png',
  },
  {
    t: 'AI가 바꾸지 못한 것,\n최초의 입력값',
    d: '카피, 이미지, 영상 시안은 몇 분 만에 나오고 하나의 아이디어는 수십 개의 베리에이션이 됩니다. 하지만 모두가 같은 AI를 쓰는 순간, 결과물의 차이는 무엇을 말할지 정하는 입력값에서만 나옵니다. 그래서 IMBY는 현장에서 길어 올린 인사이트를 브리프와 프롬프트로 번역합니다. 제작 대행이 아니라, 인사이트 대행입니다.',
    fx: '/media/fx-pen.png',
  },
  {
    t: '계약이 끝난 후에도,\n스스로 굴러가는 시스템을 남깁니다',
    d: '반복 가능한 일에는 사람을 쓰지 않습니다. IMBY의 인력은 인사이트와 기획에만 투입되고, 반복되는 제작은 시스템으로 만들어 넘깁니다. IMBY가 만들고, 시스템으로 넘기고, 클라이언트가 스스로 굴립니다.',
    fx: '/media/fx-gears.png',
    handover: true,
  },
];

export default function InsightSystem() {
  return (
    <section className="nl ins wrap">
      <div className="ins__head">
        <h2 className="nl__title">제작은 무한해졌고,<br />인사이트는 희소해졌습니다.</h2>
      </div>
      <ol className="nl__list">
        {ITEMS.map((it, i) => (
          <Rv as="li" key={it.fx} className="nl__item">
            <span className="nl__no tnum">{String(i + 1).padStart(2, '0')}</span>
            <div className="nl__body">
              <h3 className="nl__t">{it.t.split('\n').map((l, k) => <span key={k}>{l}{k === 0 && <br />}</span>)}</h3>
              <p className="nl__d">{it.d}</p>
              {it.handover && (
                <ul className="ins__hand">
                  {HANDOVER.map((h, k) => (
                    <li key={h.t}><span className="tnum">0{k + 1}</span><strong>{h.t}</strong><em>{h.d}</em></li>
                  ))}
                </ul>
              )}
              <div className="nl__fx">
                <BrainField src={it.fx} mode="image" grid={300} fit tilt={0.7} dissolve={false} />
              </div>
            </div>
          </Rv>
        ))}
      </ol>
    </section>
  );
}
