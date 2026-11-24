import { useMemo, useState, type FormEvent } from 'react';
import { useLang } from '../lib/i18n';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/** 커피챗: 음료 = 대화 주제. IMBY만의 장치는 '메뉴판'과 '영수증' 두 군데에만. */
const MENU = [
  { id: 'americano', name: 'Americano', kr: '아메리카노', topic: '광고·업계 이야기', desc: '에이전시의 하루, 광고를 업으로 삼는다는 것.', topicEn: 'Advertising & the industry', descEn: 'A day at an agency, and what it means to make ads for a living.' },
  { id: 'latte', name: 'Latte', kr: '라떼', topic: '협업·프로젝트 탐색', desc: '브리프는 없지만 뭔가 같이 해보고 싶을 때.', topicEn: 'Exploring a collaboration', descEn: 'No brief yet, but you want to make something together.' },
  { id: 'ade', name: 'Lime Ade', kr: '라임 에이드', topic: '아이디어 잼', desc: '각자 꽂힌 아이디어를 들고 와서 30분 동안 굴려봅니다.', topicEn: 'Idea jam', descEn: 'Bring the idea you can’t stop thinking about and we’ll riff on it for 30 minutes.' },
  { id: 'tea', name: 'Earl Grey', kr: '얼그레이', topic: 'IMBY 합류 고민', desc: '함께 일하는 건 어떤지, 어떤 사람을 찾는지.', topicEn: 'Thinking of joining IMBY', descEn: 'What it’s like to work with us, and who we’re looking for.' },
] as const;
type MenuId = (typeof MENU)[number]['id'];
const SLOTS = ['오전', '점심', '오후', '저녁'];
const SLOTS_EN: Record<string, string> = { 오전: 'AM', 점심: 'Lunch', 오후: 'PM', 저녁: 'Eve' };

function nextWeekdays(n: number, en = false) {
  const out: { key: string; label: string; dow: string }[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dows = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['일', '월', '화', '수', '목', '금', '토'];
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
  const { lang, t } = useLang();
  const days = useMemo(() => nextWeekdays(10, lang === 'en'), [lang]);
  const slotLabel = (s: string) => t(s, SLOTS_EN[s] ?? s);
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
    if (!name || !email) return setErr(t('이름과 이메일은 필수입니다.', 'Name and email are required.'));
    if (slots.length === 0) return setErr(t('가능한 시간을 하나 이상 선택해 주세요.', 'Please pick at least one time slot.'));
    if (!f.get('agree')) return setErr(t('개인정보 수집·이용에 동의해 주세요.', 'Please agree to the use of your personal information.'));
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
      return setErr(t('신청이 접수되지 않았습니다. 잠시 후 다시 시도해 주세요.', 'Your request didn’t go through. Please try again shortly.'));
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
            <div className="receipt__row"><span>{t(m.kr, m.name)} — {t(m.topic, m.topicEn)}</span><span>₩0</span></div>
            <div className="receipt__row"><span>{mode === 'offline' ? t('오프라인 · 서울', 'In person · Seoul') : t('온라인 · 화상', 'Online · Video')}</span><span>30min</span></div>
            <div className="receipt__row"><span>{t('희망 시간', 'Time slots')}</span><span>{slots.length}</span></div>
            <hr />
            <div className="receipt__row receipt__total"><span>TOTAL</span><span>₩0</span></div>
            <p className="t-xxs">{t(<>{receipt.name}님, 신청이 접수되었습니다.<br />메일로 시간을 확정해 드릴게요.</>, <>Thanks, {receipt.name}. We got your request.<br />We’ll confirm the time by email.</>)}</p>
          </div>
          <Link to="/work" className="pill pill--lg">{t('Work 보기', 'See our work')}</Link>
        </section>
      ) : (
        <form className="wrap cc" onSubmit={submit} noValidate>
          <p className="cx__lead">{t('30분, 커피는 저희가 삽니다. 메뉴를 고르면 대화 주제가 정해집니다.', '30 minutes, coffee’s on us. The drink you pick sets the topic.')}</p>

          <section className="cc__step">
            <h3 className="cc__h"><span className="g2 tnum">01</span> {t('메뉴', 'Menu')}</h3>
            <ul className="menu" role="radiogroup" aria-label={t('대화 주제', 'Topic')}>
              {MENU.map((x) => (
                <li key={x.id}>
                  <button type="button" role="radio" aria-checked={menu === x.id} className={`menu__item ${menu === x.id ? 'is-on' : ''}`} onClick={() => setMenu(x.id)}>
                    <span className="menu__name">{x.name}</span>
                    {lang === 'ko' && <span className="menu__kr">{x.kr}</span>}
                    <span className="menu__topic">{t(x.topic, x.topicEn)}</span>
                    <span className="menu__desc">{t(x.desc, x.descEn)}</span>
                    <span className="menu__price tnum">₩0</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="cc__step">
            <div className="cc__row">
              <h3 className="cc__h"><span className="g2 tnum">02</span> {t('희망 시간', 'Preferred time')} <span className="g2 t-xxs tnum">({slots.length}/6)</span></h3>
              <div className="chips" role="radiogroup" aria-label={t('만남 방식', 'Format')}>
                {(['offline', 'online'] as const).map((md) => (
                  <button type="button" key={md} role="radio" aria-checked={mode === md} className={`chip ${mode === md ? 'is-on' : ''}`} onClick={() => setMode(md)}>
                    {md === 'offline' ? t('오프라인 · 서울', 'In person · Seoul') : t('온라인 · 화상', 'Online · Video')}
                  </button>
                ))}
              </div>
            </div>
            <div className="cal" role="group" aria-label={t('희망 시간', 'Preferred time')}>
              <div />
              {days.map((d) => (
                <div key={d.key} className="cal__day"><span className="tnum">{d.label}</span><span className="g2">{d.dow}</span></div>
              ))}
              {SLOTS.map((s) => (
                <div key={s} style={{ display: 'contents' }}>
                  <div className="cal__slot g2">{slotLabel(s)}</div>
                  {days.map((d) => {
                    const k = `${d.key} ${s}`;
                    const on = slots.includes(k);
                    return <button type="button" key={k} className={`cal__cell ${on ? 'is-on' : ''}`} aria-pressed={on} aria-label={`${d.label}(${d.dow}) ${slotLabel(s)}`} onClick={() => toggleSlot(k)} />;
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className="cc__step">
            <h3 className="cc__h"><span className="g2 tnum">03</span> {t('신청자 정보', 'About you')}</h3>
            <div className="fields">
              <label className="field"><span className="field__l">{t('이름 *', 'Name *')}</span><input name="name" required autoComplete="name" maxLength={60} /></label>
              <label className="field"><span className="field__l">{t('소속 / 하는 일', 'Company / What you do')}</span><input name="affiliation" maxLength={120} /></label>
              <label className="field"><span className="field__l">{t('이메일 *', 'Email *')}</span><input name="email" type="email" required autoComplete="email" maxLength={200} /></label>
              <label className="field"><span className="field__l">{t('연락처', 'Phone')}</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
              <label className="field field--full"><span className="field__l">{t('미리 나누고 싶은 이야기', 'Anything we should know beforehand')}</span><textarea name="message" rows={4} maxLength={2000} /></label>
              <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            </div>
            <label className="agree"><input type="checkbox" name="agree" /> <span>{t('일정 조율을 위한 개인정보(이름, 이메일, 연락처) 수집·이용에 동의합니다.', 'I agree to IMBY using my name, email and phone number to schedule this chat.')}</span></label>
            {err && <p className="ct__err" role="alert">{err}</p>}
            <button className="pill pill--lg pill--solid" disabled={state === 'sending'}>{state === 'sending' ? t('신청 중…', 'Sending…') : t(`${m.kr} 주문하기`, `Order ${m.name}`)}</button>
          </section>
        </form>
      )}
    </>
  );
}
