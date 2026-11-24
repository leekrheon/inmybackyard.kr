import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CoffeeChatForm } from './CoffeeChat';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/Titles';
import { useDocTitle } from '../lib/useDocTitle';

const SERVICES = ['OOH · DOOH', 'Social', 'Design', 'Film', 'Offline', 'AX System', '아직 모르겠어요'];
const BUDGETS = ['~ 1천만 원', '1천 – 3천만 원', '3천 – 5천만 원', '5천만 원 +', '상의 필요'];
const TIMELINES = ['한 달 안', '1 – 3개월', '3개월 +', '미정'];

export function Chips({ options, value, onChange, multi }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : on ? [] : [o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function ClientForm() {
  const [services, setServices] = useState<string[]>([]);
  const [budget, setBudget] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('website')) return;
    const name = String(f.get('name') || '').trim();
    const email = String(f.get('email') || '').trim();
    const message = String(f.get('message') || '').trim();
    if (!name || !email || !message) return setErr('이름, 이메일, 문의 내용은 필수입니다.');
    if (!f.get('agree')) return setErr('개인정보 수집·이용에 동의해 주세요.');
    setErr('');
    setState('sending');
    const { error } = await supabase.from('contact_messages').insert({
      name, email, message,
      company: String(f.get('company') || '').trim() || null,
      phone: String(f.get('phone') || '').trim() || null,
      services, budget: budget[0] ?? null, timeline: timeline[0] ?? null,
    });
    if (error) {
      setState('error');
      return setErr('전송에 실패했습니다. 잠시 후 다시 시도하거나 메일로 보내주세요.');
    }
    setState('done');
  };

  return (
    <section className="wrap ct">
      <aside className="ct__aside">
        <h2 className="ct__h">문제를 같이 고민할<br />뇌가 필요하다면.</h2>
        <p className="ct__lead">브리프가 정리되지 않았어도 괜찮습니다. 문제 정의부터 함께합니다.</p>
        <a className="ct__mail" href="mailto:idealee@inmybackyard.kr">idealee@inmybackyard.kr</a>
      </aside>

      {state === 'done' ? (
        <div className="ct__done">
          <p className="ct__h">문의가 접수되었습니다.</p>
          <p className="ct__lead">남겨주신 이메일로 담당자가 직접 회신드리겠습니다.</p>
        </div>
      ) : (
        <form className="ct__form" onSubmit={submit} noValidate>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">01</span>
            <p className="ct__q">관심 분야 <span>복수 선택</span></p>
            <Chips options={SERVICES} value={services} onChange={setServices} multi /></fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">02</span>
            <p className="ct__q">예산</p>
            <Chips options={BUDGETS} value={budget} onChange={setBudget} /></fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">03</span>
            <p className="ct__q">일정</p>
            <Chips options={TIMELINES} value={timeline} onChange={setTimeline} /></fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">04</span>
            <p className="ct__q">연락처</p>
            <div className="fields">
              <label className="field"><span className="field__l">이름 *</span><input name="name" required autoComplete="name" maxLength={60} /></label>
              <label className="field"><span className="field__l">회사 / 브랜드</span><input name="company" autoComplete="organization" maxLength={120} /></label>
              <label className="field"><span className="field__l">이메일 *</span><input name="email" type="email" required autoComplete="email" maxLength={200} /></label>
              <label className="field"><span className="field__l">연락처</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
            </div>
          </fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">05</span>
            <p className="ct__q">문의 내용 *</p>
            <label className="field field--full"><span className="sr-only">문의 내용</span><textarea name="message" rows={5} required maxLength={4000} placeholder="브랜드가 지금 붙잡고 있는 고민을 적어주세요." /></label>
            <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          </fieldset>
          <div className="ct__send">
            <label className="agree"><input type="checkbox" name="agree" /> <span>문의 회신을 위한 개인정보(이름, 이메일, 연락처) 수집·이용에 동의합니다.</span></label>
            {err && <p className="ct__err" role="alert">{err}</p>}
            <button className="pill pill--lg" disabled={state === 'sending'}>{state === 'sending' ? '보내는 중…' : '문의하기'}</button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Contact 하나로: Client(프로젝트 문의) / Coffee Chat 두 가지 중 고른다. */
export default function Contact() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const mode: 'client' | 'coffee' = pathname.startsWith('/contact/coffee-chat') ? 'coffee' : 'client';
  useDocTitle(mode === 'coffee' ? 'Coffee Chat — IMBY' : 'Contact — IMBY', 'IMBY에 프로젝트를 문의하거나 커피챗을 신청하세요.');
  const set = (m: 'client' | 'coffee') => nav(m === 'coffee' ? '/contact/coffee-chat' : '/contact', { replace: true, preventScrollReset: true });
  return (
    <>
      <PageTitle>Contact</PageTitle>
      <div className="cx wrap" role="tablist" aria-label="문의 종류">
        <button role="tab" aria-selected={mode === 'client'} className={mode === 'client' ? 'is-on' : ''} onClick={() => set('client')}>
          <span>Client</span><em>프로젝트 문의</em>
        </button>
        <button role="tab" aria-selected={mode === 'coffee'} className={mode === 'coffee' ? 'is-on' : ''} onClick={() => set('coffee')}>
          <span>Coffee Chat</span><em>30분 대화</em>
        </button>
      </div>
      <div key={mode} className="cx__panel">
        {mode === 'client' ? <ClientForm /> : <CoffeeChatForm />}
      </div>
    </>
  );
}
