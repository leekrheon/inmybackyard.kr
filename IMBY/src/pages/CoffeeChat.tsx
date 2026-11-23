import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/** 커피챗: 음료 = 대화 주제. IMBY만의 장치는 '메뉴판'과 '영수증' 두 군데에만. */
const MENU = [
  { id: 'americano', name: 'Americano', kr: '아메리카노', topic: '광고·업계 이야기', desc: '에이전시의 하루, 광고를 업으로 삼는다는 것.' },
  { id: 'latte', name: 'Latte', kr: '라떼', topic: '협업·프로젝트 탐색', desc: '브리프는 없지만 뭔가 같이 해보고 싶을 때.' },
  { id: 'ade', name: 'Lime Ade', kr: '라임 에이드', topic: '아이디어 잼', desc: '각자 꽂힌 아이디어를 들고 와서 30분 동안 굴려봅니다.' },
  { id: 'tea', name: 'Earl Grey', kr: '얼그레이', topic: 'IMBY 합류 고민', desc: '함께 일하는 건 어떤지, 어떤 사람을 찾는지.' },
] as const;
type MenuId = (typeof MENU)[number]['id'];
const SLOTS = ['오전', '점심', '오후', '저녁'];

function nextWeekdays(n: number) {
  const out: { key: string; label: string; dow: string }[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dows = ['일', '월', '화', '수', '목', '금', '토'];
  while (out.length < n) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const m = d.getMonth() + 1, dd = d.getDate();
      out.push({ key: `${d.getFullYear()}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`, label: `${m}.${dd}`, dow: dows[day] });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function CoffeeChatForm() {
  const days = useMemo(() => nextWeekdays(10), []);
  const [menu, setMenu] = useState<MenuId>('americano');
  const [slots, setSlots] = useState<string[]>([]);
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [receipt, setReceipt] = useState<{ no: string; name: string } | null>(null);
  const m = MENU.find((x) => x.id === menu)!;

  const toggleSlot = (k: string) => setSlots((s) => (s.includes(k) ? s.filter((x) => x !== k) : s.length >= 6 ? s : [...s, k]));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('website')) return;
    const name = String(f.get('name') || '').trim();
    const email = String(f.get('email') || '').trim();
    if (!name || !email) return setErr('이름과 이메일은 필수입니다.');
    if (slots.length === 0) return setErr('가능한 시간을 하나 이상 선택해 주세요.');
    if (!f.get('agree')) return setErr('개인정보 수집·이용에 동의해 주세요.');
    setErr('');
    setState('sending');
    const { error } = await supabase.from('coffee_chats').insert({
      menu, name, email, mode, preferred_slots: slots,
      affiliation: String(f.get('affiliation') || '').trim() || null,
      phone: String(f.get('phone') || '').trim() || null,
      message: String(f.get('message') || '').trim() || null,
    });
    if (error) {
      setState('error');
      return setErr('신청이 접수되지 않았습니다. 잠시 후 다시 시도해 주세요.');
    }
    setReceipt({ no: String(Math.floor(1000 + Math.random() * 9000)), name });
    setState('done');
  };

  return (
    <>
      {state === 'done' && receipt ? (
        <section className="wrap cc-done">
          <div className="receipt" role="status">
            <p className="t-cap">IMBY Coffee Bar</p>
            <p className="t-xxs">In My BackYard, Seoul</p>
            <hr />
            <p className="receipt__no">No. {receipt.no}</p>
            <div className="receipt__row"><span>{m.kr} — {m.topic}</span><span>₩0</span></div>
            <div className="receipt__row"><span>{mode === 'offline' ? '오프라인 · 서울' : '온라인 · 화상'}</span><span>30min</span></div>
            <div className="receipt__row"><span>희망 시간</span><span>{slots.length}개</span></div>
            <hr />
            <div className="receipt__row receipt__total"><span>TOTAL</span><span>₩0</span></div>
            <p className="t-xxs">{receipt.name}님, 신청이 접수되었습니다.<br />메일로 시간을 확정해 드릴게요.</p>
          </div>
          <Link to="/work" className="pill pill--lg">Work 보기</Link>
        </section>
      ) : (
        <form className="wrap cc" onSubmit={submit} noValidate>
          <p className="cx__lead">30분, 커피는 저희가 삽니다. 메뉴를 고르면 대화 주제가 정해집니다.</p>

          <section className="cc__step">
            <h3 className="cc__h"><span className="g2 tnum">01</span> 메뉴</h3>
            <ul className="menu" role="radiogroup" aria-label="대화 주제">
              {MENU.map((x) => (
                <li key={x.id}>
                  <button type="button" role="radio" aria-checked={menu === x.id} className={`menu__item ${menu === x.id ? 'is-on' : ''}`} onClick={() => setMenu(x.id)}>
                    <span className="menu__name">{x.name}</span>
                    <span className="menu__kr">{x.kr}</span>
                    <span className="menu__topic">{x.topic}</span>
                    <span className="menu__desc">{x.desc}</span>
                    <span className="menu__price tnum">₩0</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="cc__step">
            <div className="cc__row">
              <h3 className="cc__h"><span className="g2 tnum">02</span> 희망 시간 <span className="g2 t-xxs tnum">({slots.length}/6)</span></h3>
              <div className="chips" role="radiogroup" aria-label="만남 방식">
                {(['offline', 'online'] as const).map((md) => (
                  <button type="button" key={md} role="radio" aria-checked={mode === md} className={`chip ${mode === md ? 'is-on' : ''}`} onClick={() => setMode(md)}>
                    {md === 'offline' ? '오프라인 · 서울' : '온라인 · 화상'}
                  </button>
                ))}
              </div>
            </div>
            <div className="cal" role="group" aria-label="희망 시간">
              <div />
              {days.map((d) => (
                <div key={d.key} className="cal__day"><span className="tnum">{d.label}</span><span className="g2">{d.dow}</span></div>
              ))}
              {SLOTS.map((s) => (
                <div key={s} style={{ display: 'contents' }}>
                  <div className="cal__slot g2">{s}</div>
                  {days.map((d) => {
                    const k = `${d.key} ${s}`;
                    const on = slots.includes(k);
                    return <button type="button" key={k} className={`cal__cell ${on ? 'is-on' : ''}`} aria-pressed={on} aria-label={`${d.label}(${d.dow}) ${s}`} onClick={() => toggleSlot(k)} />;
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="cc__step">
            <h3 className="cc__h"><span className="g2 tnum">03</span> 신청자 정보</h3>
            <div className="fields">
              <label className="field"><span className="field__l">이름 *</span><input name="name" required autoComplete="name" maxLength={60} /></label>
              <label className="field"><span className="field__l">소속 / 하는 일</span><input name="affiliation" maxLength={120} /></label>
              <label className="field"><span className="field__l">이메일 *</span><input name="email" type="email" required autoComplete="email" maxLength={200} /></label>
              <label className="field"><span className="field__l">연락처</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
              <label className="field field--full"><span className="field__l">미리 나누고 싶은 이야기</span><textarea name="message" rows={4} maxLength={2000} /></label>
              <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            </div>
            <label className="agree"><input type="checkbox" name="agree" /> <span>일정 조율을 위한 개인정보(이름, 이메일, 연락처) 수집·이용에 동의합니다.</span></label>
            {err && <p className="ct__err" role="alert">{err}</p>}
            <button className="pill pill--lg pill--solid" disabled={state === 'sending'}>{state === 'sending' ? '신청 중…' : `${m.kr} 주문하기`}</button>
          </section>
        </form>
      )}
    </>
  );
}
