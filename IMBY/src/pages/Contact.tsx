import { useState, type FormEvent } from 'react';
import { useLang } from '../lib/i18n';
import { useLocation, useNavigate } from 'react-router-dom';
import { CoffeeChatForm } from './CoffeeChat';
import { supabase } from '../lib/supabase';
import { PageTitle } from '../components/Titles';
import { useDocTitle } from '../lib/useDocTitle';

const SERVICES = ['OOH · DOOH', 'Social', 'Design', 'Film', 'Offline', 'AX System', '아직 모르겠어요'];
const SERVICES_EN = ['OOH · DOOH', 'Social', 'Design', 'Film', 'Offline', 'AX System', 'Not sure yet'];
const BUDGETS = ['~ 1천만 원', '1천 – 3천만 원', '3천 – 5천만 원', '5천만 원 +', '상의 필요'];
const BUDGETS_EN = ['Under ₩10M', '₩10M – 30M', '₩30M – 50M', '₩50M +', 'Let’s discuss'];
const TIMELINES = ['한 달 안', '1 – 3개월', '3개월 +', '미정'];
const TIMELINES_EN = ['Within a month', '1 – 3 months', '3 months +', 'Not decided'];

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
  const { t } = useLang();
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
    if (!name || !email || !message) return setErr(t('이름, 이메일, 문의 내용은 필수입니다.', 'Name, email and message are required.'));
    if (!f.get('agree')) return setErr(t('개인정보 수집·이용에 동의해 주세요.', 'Please agree to the use of your personal information.'));
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
      return setErr(t('전송에 실패했습니다. 잠시 후 다시 시도하거나 메일로 보내주세요.', 'Sending failed. Please try again shortly, or email us directly.'));
    }
    setState('done');
  };

  return (
    <section className="wrap ct">
      <aside className="ct__aside">
        <h2 className="ct__h">{t(<>문제를 같이 고민할<br />뇌가 필요하다면.</>, <>Need another brain<br />on the problem?</>)}</h2>
        <p className="ct__lead">{t('브리프가 정리되지 않았어도 괜찮습니다. 문제 정의부터 함께합니다.', 'No finished brief? That’s fine. We start by defining the problem together.')}</p>
        <a className="ct__mail" href="mailto:support@inmybackyard.kr">support@inmybackyard.kr</a>
      </aside>

      {state === 'done' ? (
        <div className="ct__done">
          <p className="ct__h">{t('문의가 접수되었습니다.', 'Message received.')}</p>
          <p className="ct__lead">{t('남겨주신 이메일로 담당자가 직접 회신드리겠습니다.', 'Someone from the team will reply to your email directly.')}</p>
        </div>
      ) : (
        <form className="ct__form" onSubmit={submit} noValidate>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">01</span>
            <p className="ct__q">{t('관심 분야', 'What you need')} <span>{t('복수 선택', 'Pick any')}</span></p>
            <Chips options={t(SERVICES, SERVICES_EN)} value={services} onChange={setServices} multi /></fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">02</span>
            <p className="ct__q">{t('예산', 'Budget')}</p>
            <Chips options={t(BUDGETS, BUDGETS_EN)} value={budget} onChange={setBudget} /></fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">03</span>
            <p className="ct__q">{t('일정', 'Timeline')}</p>
            <Chips options={t(TIMELINES, TIMELINES_EN)} value={timeline} onChange={setTimeline} /></fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">04</span>
            <p className="ct__q">{t('연락처', 'Contact details')}</p>
            <div className="fields">
              <label className="field"><span className="field__l">{t('이름 *', 'Name *')}</span><input name="name" required autoComplete="name" maxLength={60} /></label>
              <label className="field"><span className="field__l">{t('회사 / 브랜드', 'Company / Brand')}</span><input name="company" autoComplete="organization" maxLength={120} /></label>
              <label className="field"><span className="field__l">{t('이메일 *', 'Email *')}</span><input name="email" type="email" required autoComplete="email" maxLength={200} /></label>
              <label className="field"><span className="field__l">{t('연락처', 'Phone')}</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
            </div>
          </fieldset>
          <fieldset className="ct__step"><span className="ct__no tnum" aria-hidden="true">05</span>
            <p className="ct__q">{t('문의 내용 *', 'Your message *')}</p>
            <label className="field field--full"><span className="sr-only">{t('문의 내용', 'Your message')}</span><textarea name="message" rows={5} required maxLength={4000} placeholder={t('브랜드가 지금 붙잡고 있는 고민을 적어주세요.', 'Tell us what your brand is wrestling with right now.')} /></label>
            <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          </fieldset>
          <div className="ct__send">
            <label className="agree"><input type="checkbox" name="agree" /> <span>{t('문의 회신을 위한 개인정보(이름, 이메일, 연락처) 수집·이용에 동의합니다.', 'I agree to IMBY using my name, email and phone number to reply to this inquiry.')}</span></label>
            {err && <p className="ct__err" role="alert">{err}</p>}
            <button className="pill pill--lg" disabled={state === 'sending'}>{state === 'sending' ? t('보내는 중…', 'Sending…') : t('문의하기', 'Send')}</button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Contact 하나로: Client(프로젝트 문의) / Coffee Chat 두 가지 중 고른다. */
export default function Contact() {
  const { t } = useLang();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const mode: 'client' | 'coffee' = pathname.startsWith('/contact/coffee-chat') ? 'coffee' : 'client';
  useDocTitle(mode === 'coffee' ? 'Coffee Chat — IMBY' : 'Contact — IMBY', t('IMBY에 프로젝트를 문의하거나 커피챗을 신청하세요.', 'Start a project with IMBY, or book a coffee chat.'));
  const set = (m: 'client' | 'coffee') => nav(m === 'coffee' ? '/contact/coffee-chat' : '/contact', { replace: true, preventScrollReset: true });
  return (
    <>
      <PageTitle>Contact</PageTitle>
      <div className="cx wrap" role="tablist" aria-label={t('문의 종류', 'Inquiry type')}>
        <button role="tab" aria-selected={mode === 'client'} className={mode === 'client' ? 'is-on' : ''} onClick={() => set('client')}>
          <span>Client</span><em>{t('프로젝트 문의', 'Project inquiry')}</em>
        </button>
        <button role="tab" aria-selected={mode === 'coffee'} className={mode === 'coffee' ? 'is-on' : ''} onClick={() => set('coffee')}>
          <span>Coffee Chat</span><em>{t('30분 대화', '30-min chat')}</em>
        </button>
      </div>
      <div key={mode} className="cx__panel">
        {mode === 'client' ? <ClientForm /> : <CoffeeChatForm />}
      </div>
    </>
  );
}
