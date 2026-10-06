'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * П'ять клопотів власника салону. Кожен - це фраза, яку власник сказав би сам, відповідь у два речення
 * і маленький живий приклад, у який можна натиснути. Без карток, без нумерації: це не послідовність.
 * Усе, що тут показано, справді є в кабінеті (нагадування й передоплата, ролі, дохід, журнал дій, розсилки).
 * Числа в прикладах умовні, це підписано.
 */

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`sw ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span className="sw-track"><i /></span>
      <span className="sw-t"><b>{label}</b>{hint && <small>{hint}</small>}</span>
    </button>
  );
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" aria-pressed={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

/* 1. Клієнти не приходять */
function ReminderDemo() {
  const [remind, setRemind] = useState(false);
  const [deposit, setDeposit] = useState(false);
  const secured = remind && deposit;
  return (
    <div className="d-rem">
      <div className="d-visit">
        <div><b>Пʼятниця, 14:00</b><span>Манікюр · Олена</span></div>
        <em className={secured ? 'ok' : remind || deposit ? 'mid' : ''}>{secured ? 'Підтверджено' : remind || deposit ? 'Майже певно' : 'Може не прийти'}</em>
      </div>
      <div className="d-switches">
        <Switch on={remind} onChange={setRemind} label="Нагадати за добу" hint="лист клієнту сам" />
        <Switch on={deposit} onChange={setDeposit} label="Передоплата" hint="сума або відсоток" />
      </div>
      <div className={`d-letter ${remind ? 'show' : ''}`} aria-live="polite">
        <span>Лист клієнту</span>
        Нагадуємо: завтра о 14:00 манікюр. Скасувати чи перенести можна за посиланням у листі.
      </div>
    </div>
  );
}

/* 2. Майстер пішов і забрав клієнтів */
type Role = 'owner' | 'admin' | 'master';
const ROLE_ROWS: { t: string; v: Record<Role, string> }[] = [
  { t: 'Розклад', v: { owner: 'усієї команди', admin: 'усієї команди', master: 'лише свій' } },
  { t: 'Клієнти', v: { owner: 'усі', admin: 'усі', master: 'лише свої' } },
  { t: 'Гроші й виплати', v: { owner: 'бачить', admin: 'бачить', master: 'закрито' } },
  { t: 'Команда й налаштування', v: { owner: 'керує', admin: 'керує', master: 'закрито' } },
  { t: 'Видалення адміністраторів', v: { owner: 'може', admin: 'закрито', master: 'закрито' } },
];
function RolesDemo() {
  const [role, setRole] = useState<Role>('master');
  return (
    <div className="d-roles">
      <Segmented<Role> label="Роль у команді" value={role} onChange={setRole}
        options={[{ id: 'master', label: 'Майстер' }, { id: 'admin', label: 'Адміністратор' }, { id: 'owner', label: 'Власник' }]} />
      <ul>
        {ROLE_ROWS.map(r => {
          const v = r.v[role];
          const locked = v === 'закрито';
          return (
            <li key={r.t} className={locked ? 'locked' : ''}>
              <span>{r.t}</span>
              <b>{locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 11V8a6 6 0 1112 0v3m-13 0h14v9H5v-9z" /></svg>}{v}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* 3. Не знаю, скільки заробили */
const DAYS = [{ d: 'Пн', v: 3200 }, { d: 'Вт', v: 4100 }, { d: 'Ср', v: 2800 }, { d: 'Чт', v: 5200 }, { d: 'Пт', v: 6100 }, { d: 'Сб', v: 7400 }, { d: 'Нд', v: 5600 }];
const COSTS = 9400;
const uah = (n: number) => `${n.toLocaleString('uk-UA')} ₴`;
function IncomeDemo() {
  const [sel, setSel] = useState(5);
  const [seen, setSeen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSeen(true); return; }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); o.disconnect(); } }, { threshold: 0.4 });
    o.observe(el); return () => o.disconnect();
  }, []);
  const total = DAYS.reduce((s, x) => s + x.v, 0);
  const max = Math.max(...DAYS.map(x => x.v));
  return (
    <div className="d-inc" ref={ref}>
      <div className="d-inc-top">
        <div><small>{DAYS[sel].d}</small><b>{uah(DAYS[sel].v)}</b></div>
        <div className="d-inc-sum">
          <span>Дохід за тиждень <b>{uah(total)}</b></span>
          <span>Витрати <b>−{uah(COSTS)}</b></span>
          <span className="net">Прибуток <b>{uah(total - COSTS)}</b></span>
        </div>
      </div>
      <div className={`d-bars ${seen ? 'on' : ''}`} role="group" aria-label="Дохід за днями тижня, умовний приклад">
        {DAYS.map((x, i) => (
          <button key={x.d} type="button" className={i === sel ? 'sel' : ''} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} aria-label={`${x.d}: ${uah(x.v)}`}>
            <i style={{ height: `${(x.v / max) * 100}%`, ['--i' as string]: i }} />
            <span>{x.d}</span>
          </button>
        ))}
      </div>
      <p className="d-note">Умовний приклад: ваші цифри з завершених візитів.</p>
    </div>
  );
}

/* 4. Хтось змінив ціну і не зізнається */
type Kind = 'all' | 'price' | 'team' | 'stock';
const LOG: { k: Exclude<Kind, 'all'>; who: string; what: string; when: string }[] = [
  { k: 'price', who: 'Адміністратор', what: 'змінила ціну послуги «Стрижка»: 500 → 650 ₴', when: 'сьогодні, 12:40' },
  { k: 'stock', who: 'Майстер', what: 'списала матеріал «Лак»: залишок 10 → 7', when: 'сьогодні, 11:05' },
  { k: 'team', who: 'Власник', what: 'запросив нового майстра на пошту', when: 'вчора, 18:20' },
  { k: 'price', who: 'Власник', what: 'змінив тривалість «Манікюр»: 60 → 75 хв', when: 'вчора, 10:12' },
];
function AuditDemo() {
  const [kind, setKind] = useState<Kind>('all');
  const rows = LOG.filter(r => kind === 'all' || r.k === kind);
  return (
    <div className="d-log">
      <Segmented<Kind> label="Фільтр журналу" value={kind} onChange={setKind}
        options={[{ id: 'all', label: 'Усе' }, { id: 'price', label: 'Ціни' }, { id: 'team', label: 'Команда' }, { id: 'stock', label: 'Склад' }]} />
      <ul>
        {rows.map(r => (
          <li key={r.what}>
            <p><b>{r.who}</b> {r.what}</p>
            <time>{r.when}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 5. Давні клієнти зникли */
type Aud = 'all' | 'regular' | 'lapsed';
const LETTER: Record<Aud, { who: string; h: string; p: string }> = {
  lapsed: { who: 'Давно не були', h: 'Ми скучили за вами', p: 'На цьому тижні в нас є вільні вікна, і ми будемо раді вас бачити.' },
  regular: { who: 'Постійні', h: 'Дякуємо, що ви з нами', p: 'Для тих, хто з нами давно: запишіться на зручний час першими.' },
  all: { who: 'Усі', h: 'Новини закладу', p: 'У нас з’явилась нова послуга. Деталі розповімо при записі.' },
};
function MailDemo() {
  const [aud, setAud] = useState<Aud>('lapsed');
  const l = LETTER[aud];
  return (
    <div className="d-mail">
      <Segmented<Aud> label="Кому надіслати" value={aud} onChange={setAud}
        options={[{ id: 'lapsed', label: 'Давно не були' }, { id: 'regular', label: 'Постійні' }, { id: 'all', label: 'Усі' }]} />
      <div className="d-paper" aria-live="polite">
        <div className="d-logo">Book<span>Era</span></div>
        <h4 key={aud}>{l.h}</h4>
        <p key={aud + 'p'}>{l.p}</p>
        <div className="d-btn">Записатися онлайн</div>
        <div className="d-unsub">Більше не хочете отримувати розсилки? <u>Відписатися</u></div>
      </div>
      <p className="d-note">Лише клієнтам із поштою, без відписаних. Ліміт листів на добу, відписка в кожному листі.</p>
    </div>
  );
}

const ITEMS: { q: string; a: string; demo: ReactNode }[] = [
  { q: 'Клієнти записуються й не приходять', a: 'Лист-нагадування йде клієнту за добу до візиту. Передоплату заклад вмикає сам: фіксована сума або відсоток.', demo: <ReminderDemo /> },
  { q: 'Майстер пішов і забрав клієнтів', a: 'Клієнтська база живе в кабінеті закладу. Майстер бачить лише свій розклад і своїх клієнтів, а гроші й налаштування лише власник та адміністратор.', demo: <RolesDemo /> },
  { q: 'Не знаю, скільки насправді заробили', a: 'Дохід рахується із завершених візитів, витрати віднімаються. Видно прибуток, а не просто кількість записів.', demo: <IncomeDemo /> },
  { q: 'Хтось змінив ціну і не зізнається', a: 'Журнал дій показує, хто, що й коли змінив: послуги, ціни, команду, склад і розсилки.', demo: <AuditDemo /> },
  { q: 'Постійні клієнти кудись зникли', a: 'Розсилка за аудиторією: постійним, тим, хто давно не був, або всім. Без спаму, бо клієнт може відписатися в один клік.', demo: <MailDemo /> },
];

export default function Worries() {
  return (
    <section id="worries" className="wr" style={{ scrollMarginTop: '80px' }}>
      <div className="container">
        <h2 className="wr-title">Знайомі клопоти?</h2>
        {ITEMS.map((it, i) => (
          <article key={it.q} className={`wr-item ${i % 2 ? 'flip' : ''}`}>
            <div className="wr-text">
              <h3>«{it.q}»</h3>
              <p>{it.a}</p>
            </div>
            <div className="wr-demo">{it.demo}</div>
          </article>
        ))}
      </div>
      <style jsx global>{`
        .wr { padding: 5rem 0 3rem; background: #fff; }
        .wr-title { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1E2124; margin: 0 0 3rem; }
        .wr-item { display: grid; grid-template-columns: 5fr 6fr; gap: 4rem; align-items: center; padding: 3.5rem 0; }
        .wr-item.flip { grid-template-columns: 6fr 5fr; }
        .wr-item.flip .wr-text { order: 2; }
        .wr-text h3 { font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; color: #1E2124; margin: 0 0 1.1rem; }
        .wr-text p { font-size: 1.1rem; line-height: 1.65; color: #475569; margin: 0; max-width: 34em; }
        .wr-demo { min-width: 0; }

        .sw { display: flex; align-items: center; gap: 0.85rem; background: none; border: none; padding: 0.4rem 0; cursor: pointer; text-align: left; font: inherit; color: #1E2124; }
        .sw-track { position: relative; flex: 0 0 auto; width: 46px; height: 28px; border-radius: 999px; background: #d4dad5; transition: background .25s ease; }
        .sw-track i { position: absolute; left: 3px; top: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); transition: transform .3s cubic-bezier(.34,1.56,.64,1); }
        .sw.on .sw-track { background: #4C7A55; }
        .sw.on .sw-track i { transform: translateX(18px); }
        .sw-t b { display: block; font-size: 1.02rem; }
        .sw-t small { color: #64748b; font-size: 0.85rem; }
        .sw:focus-visible, .seg button:focus-visible, .d-bars button:focus-visible { outline: 3px solid #1E2124; outline-offset: 3px; border-radius: 8px; }

        .seg { display: inline-flex; gap: 0.25rem; background: #F3F8F4; border: 1px solid #dfe8e0; border-radius: 999px; padding: 4px; margin-bottom: 1.4rem; flex-wrap: wrap; }
        .seg button { border: none; background: none; font: inherit; font-weight: 600; font-size: 0.92rem; color: #475569; padding: 0.5rem 1.1rem; border-radius: 999px; cursor: pointer; transition: background .25s ease, color .25s ease; }
        .seg button.on { background: #1E2124; color: #fff; }

        .d-visit { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #e8ece8; margin-bottom: 1rem; }
        .d-visit b { display: block; font-size: 1.15rem; } .d-visit span { color: #64748b; }
        .d-visit em { font-style: normal; font-weight: 700; font-size: 0.88rem; padding: 0.4rem 0.9rem; border-radius: 999px; background: #eceeee; color: #475569; transition: background .3s ease, color .3s ease; }
        .d-visit em.mid { background: #FCE6D5; color: #8a4b1c; } .d-visit em.ok { background: #E3EFE5; color: #2F5A39; }
        .d-switches { display: grid; gap: 0.4rem; margin-bottom: 1rem; }
        .d-letter { border-left: 3px solid #8fae92; padding: 0.2rem 0 0.2rem 1rem; color: #374151; font-size: 0.98rem; line-height: 1.55; max-height: 0; opacity: 0; overflow: hidden; transition: max-height .5s ease, opacity .4s ease; }
        .d-letter.show { max-height: 140px; opacity: 1; padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .d-letter span { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.2rem; }

        .d-roles ul, .d-log ul { list-style: none; margin: 0; padding: 0; }
        .d-roles li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.95rem 0; border-top: 1px solid #e8ece8; font-size: 1.02rem; animation: dIn .35s ease; }
        .d-roles li:last-child { border-bottom: 1px solid #e8ece8; }
        .d-roles li b { display: inline-flex; align-items: center; gap: 0.4rem; color: #2F5A39; font-weight: 700; }
        .d-roles li.locked { color: #9aa39b; } .d-roles li.locked b { color: #9aa39b; }
        @keyframes dIn { from { opacity: .3; transform: translateX(6px); } to { opacity: 1; transform: none; } }

        .d-inc-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5rem; margin-bottom: 1.2rem; flex-wrap: wrap; }
        .d-inc-top small { display: block; color: #64748b; font-weight: 600; } .d-inc-top > div > b { font-size: clamp(1.9rem, 3.4vw, 2.6rem); font-weight: 800; letter-spacing: -0.035em; font-variant-numeric: tabular-nums; }
        .d-inc-sum { display: grid; gap: 0.15rem; font-size: 0.92rem; color: #475569; text-align: right; } .d-inc-sum b { color: #1E2124; font-variant-numeric: tabular-nums; margin-left: 0.4rem; }
        .d-inc-sum .net b { color: #2F5A39; }
        .d-bars { height: 190px; display: flex; align-items: flex-end; gap: 10px; }
        .d-bars button { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; gap: 8px; background: none; border: none; padding: 0; cursor: pointer; font: inherit; }
        .d-bars i { display: block; border-radius: 8px; background: #dbe8dd; transform: scaleY(0); transform-origin: bottom; transition: background .2s ease; }
        .d-bars.on i { animation: bGrow .8s cubic-bezier(.16,1,.3,1) calc(var(--i) * .07s) forwards; }
        .d-bars button.sel i { background: #6F9273; }
        .d-bars span { text-align: center; font-size: 0.78rem; font-weight: 600; color: #8a948c; }
        @keyframes bGrow { to { transform: scaleY(1); } }
        .d-note { margin: 1rem 0 0; font-size: 0.85rem; color: #64748b; }

        .d-log li { padding: 0.95rem 0; border-top: 1px solid #e8ece8; animation: dIn .35s ease; }
        .d-log li:last-child { border-bottom: 1px solid #e8ece8; }
        .d-log p { margin: 0 0 0.2rem; font-size: 1.02rem; line-height: 1.5; color: #374151; } .d-log p b { color: #1E2124; }
        .d-log time { font-size: 0.83rem; color: #8a948c; }

        .d-paper { background: #fff; border: 1px solid #e3e9e4; border-radius: 6px; padding: 1.6rem 1.8rem; max-width: 420px; box-shadow: 0 16px 34px rgba(46,58,48,.08); transform: rotate(-.8deg); }
        .d-logo { font-weight: 900; letter-spacing: -0.04em; font-size: 1.3rem; margin-bottom: 1rem; } .d-logo span { color: #8fae92; }
        .d-paper h4 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; animation: dIn .35s ease; }
        .d-paper p { margin: 0 0 1.1rem; color: #475569; line-height: 1.55; animation: dIn .35s ease; }
        .d-btn { background: #1E2124; color: #fff; text-align: center; font-weight: 700; padding: 0.8rem; border-radius: 12px; margin-bottom: 1rem; }
        .d-unsub { font-size: 0.8rem; color: #64748b; border-top: 1px solid #eef1ee; padding-top: 0.8rem; } .d-unsub u { color: #1E2124; text-decoration-color: #8fae92; text-decoration-thickness: 2px; text-underline-offset: 3px; }

        @media (max-width: 900px) {
          .wr-item, .wr-item.flip { grid-template-columns: 1fr; gap: 2rem; padding: 2.5rem 0; }
          .wr-item.flip .wr-text { order: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .d-bars i { transform: none; animation: none !important; }
          .d-roles li, .d-log li, .d-paper h4, .d-paper p { animation: none; }
          .sw-track, .sw-track i, .d-letter { transition: none; }
        }
      `}</style>
    </section>
  );
}
