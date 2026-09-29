'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAuthToken, getAuthTokenOrNull } from '@/lib/auth-token-client';
import { CATEGORIES, MAIN_CATEGORIES, MORE_CATEGORIES, categoryTitle } from '@/lib/categories';
import { formatDuration } from '@/lib/duration';
import { OWNER_ROLE } from '@/lib/roles';

/**
 * Реєстрація бізнесу.
 *
 * Шість коротких кроків замість десяти, праворуч - живий перегляд того,
 * як заклад побачать клієнти. Усі дані - ПРО ЗАКЛАД:
 *   - жодних даних власника (раніше тут був рядок «Я (Власник)» і імʼя з
 *     памʼяті браузера)
 *   - пошта закладу обовʼязкова - сюди приходять записи й сповіщення
 *   - телефон - РОБОЧИЙ номер закладу, з поясненням, що це не особистий
 *   - місто окремим полем: раніше воно йшло в адресу одним рядком, а
 *     сервер ставив «Львів» усім
 * Чернетка зберігається в браузері - оновлення сторінки нічого не стирає.
 */

const LocationPicker = dynamic(() => import('@/components/ui/LocationPicker'), { ssr: false });

const INK = '#1D1D1F', SUB = '#6E6E73', LINE = '#E8E8ED', SOFT = '#F5F5F7', GREEN = '#6F9273', GREEN_SOFT = '#EEF5EE';
const DRAFT_KEY = 'bookera_register_draft_v2';
const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

type Day = { open: boolean; from: string; to: string };
type Service = { key: string; name: string; duration: number; price: number };
type Invite = { key: string; email: string; role: 'master' | 'admin' };
type Form = {
  name: string; category: string; type: 'solo' | 'salon' | '';
  email: string; phone: string; showPhone: boolean;
  workspace: 'studio' | 'client_place'; city: string; street: string; details: string;
  coords: { lat: number; lng: number } | null;
  hours: Day[]; services: Service[]; team: Invite[];
};

const EMPTY: Form = {
  name: '', category: '', type: '',
  email: '', phone: '', showPhone: true,
  workspace: 'studio', city: '', street: '', details: '', coords: null,
  hours: DAYS.map((_, i) => ({ open: i < 5, from: i < 5 ? '09:00' : '10:00', to: i < 5 ? '20:00' : '18:00' })),
  services: [], team: [],
};

// Готові послуги під категорію - один натиск замість заповнення з нуля
const TEMPLATES: Record<string, Omit<Service, 'key'>[]> = {
  barber: [{ name: 'Чоловіча стрижка', duration: 45, price: 500 }, { name: 'Стрижка + борода', duration: 90, price: 750 }, { name: 'Оформлення бороди', duration: 30, price: 300 }],
  hair: [{ name: 'Жіноча стрижка', duration: 60, price: 800 }, { name: 'Укладка', duration: 45, price: 500 }, { name: 'Фарбування в один тон', duration: 120, price: 1500 }],
  nails: [{ name: 'Манікюр із покриттям', duration: 90, price: 600 }, { name: 'Педикюр', duration: 90, price: 750 }, { name: 'Зняття покриття', duration: 30, price: 150 }],
  brows: [{ name: 'Корекція й фарбування брів', duration: 45, price: 450 }, { name: 'Ламінування вій', duration: 60, price: 600 }],
  skincare: [{ name: 'Чистка обличчя', duration: 90, price: 900 }, { name: 'Пілінг', duration: 45, price: 700 }],
  cosmetology: [{ name: 'Консультація косметолога', duration: 30, price: 400 }, { name: 'Біоревіталізація', duration: 60, price: 2500 }],
  massage: [{ name: 'Масаж тіла', duration: 60, price: 800 }, { name: 'Масаж спини й шиї', duration: 30, price: 500 }],
  tattoo: [{ name: 'Консультація й ескіз', duration: 30, price: 0 }, { name: 'Мінітату', duration: 60, price: 1200 }],
  epilation: [{ name: 'Лазерна епіляція: пахви', duration: 30, price: 600 }, { name: 'Шугаринг ніг', duration: 60, price: 700 }],
  makeup: [{ name: 'Вечірній макіяж', duration: 60, price: 800 }, { name: 'Денний макіяж', duration: 45, price: 600 }],
};

const STEPS = [
  { id: 'about', title: 'Заклад', hint: 'Назва й чим займаєтесь' },
  { id: 'contacts', title: 'Контакти закладу', hint: 'Пошта й робочий телефон' },
  { id: 'place', title: 'Де ви працюєте', hint: 'Адреса й мітка на мапі' },
  { id: 'hours', title: 'Графік', hint: 'Коли приймаєте клієнтів' },
  { id: 'services', title: 'Послуги', hint: 'Що можна забронювати' },
  { id: 'team', title: 'Команда', hint: 'Запросіть майстрів' },
  { id: 'review', title: 'Перевірка', hint: 'Усе на одному екрані' },
] as const;
type StepId = typeof STEPS[number]['id'];

const uid = () => Math.random().toString(36).slice(2, 9);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const phoneDigits = (v: string) => v.replace(/\D/g, '').slice(0, 9);
const phonePretty = (d: string) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');

export default function BusinessRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [stepIdx, setStepIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ name: string; failedInvites: string[] } | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [svcDraft, setSvcDraft] = useState({ name: '', duration: 60, price: '' });
  const [invDraft, setInvDraft] = useState<{ email: string; role: 'master' | 'admin' }>({ email: '', role: 'master' });
  const loaded = useRef(false);

  // Лише для тих, хто увійшов (сервер визначає власника з токена)
  useEffect(() => {
    void getAuthTokenOrNull().then(t => { if (!t) router.replace('/business?login=1'); });
  }, [router]);

  // Чернетка: відновити й зберігати
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.form) setForm({ ...EMPTY, ...d.form });
        if (typeof d?.step === 'number') setStepIdx(Math.min(d.step, STEPS.length - 1));
      }
    } catch { /* зіпсована чернетка - з нуля */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current || done) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step: stepIdx })); } catch { /* немає місця */ }
  }, [form, stepIdx, done]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const touch = (k: string) => setTouched(t => ({ ...t, [k]: true }));

  // Крок «Команда» - лише для салону
  const steps = useMemo(() => STEPS.filter(s => s.id !== 'team' || form.type === 'salon'), [form.type]);
  const step = steps[Math.min(stepIdx, steps.length - 1)];

  // --- Перевірка кроку ---
  const problems = useMemo(() => {
    const p: Record<string, string> = {};
    if (form.name.trim().length < 2) p.name = 'Щонайменше 2 символи';
    if (!form.category) p.category = 'Оберіть категорію';
    if (!form.type) p.type = 'Оберіть формат';
    if (!isEmail(form.email)) p.email = form.email ? 'Перевірте адресу' : 'Обовʼязково: сюди приходитимуть записи';
    if (phoneDigits(form.phone).length !== 9) p.phone = form.phone ? 'Ще кілька цифр' : 'Обовʼязково';
    if (form.city.trim().length < 2) p.city = 'Вкажіть місто';
    if (form.workspace === 'studio' && form.street.trim().length < 3) p.street = 'Вкажіть вулицю й будинок';
    if (!form.hours.some(h => h.open)) p.hours = 'Хоча б один робочий день';
    if (form.hours.some(h => h.open && h.to <= h.from)) p.hoursRange = 'Кінець дня має бути пізніше за початок';
    if (!form.services.length) p.services = 'Додайте хоча б одну послугу';
    return p;
  }, [form]);
  const STEP_FIELDS: Record<StepId, string[]> = {
    about: ['name', 'category', 'type'], contacts: ['email', 'phone'], place: ['city', 'street'],
    hours: ['hours', 'hoursRange'], services: ['services'], team: [], review: [],
  };
  const stepOk = (id: StepId) => STEP_FIELDS[id].every(f => !problems[f]);
  const firstBad = steps.findIndex(s => !stepOk(s.id));

  const go = useCallback((to: number) => {
    setDir(to > stepIdx ? 1 : -1);
    setStepIdx(Math.max(0, Math.min(to, steps.length - 1)));
    setError('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stepIdx, steps.length]);

  const next = () => {
    STEP_FIELDS[step.id].forEach(touch);
    if (!stepOk(step.id)) return;
    if (step.id === 'review') { void submit(); return; }
    go(stepIdx + 1);
  };

  // --- Відправка ---
  const submit = async () => {
    if (firstBad !== -1) { go(firstBad); return; }
    setSaving(true); setError('');
    try {
      const token = await getAuthToken();
      const business = await api.registerBusiness(token, {
        name: form.name.trim(),
        category: form.category,
        // Коди - як на сервері (business_profile.py): individual / company, my_place / client_place
        business_type: form.type === 'solo' ? 'individual' : 'company',
        workspace_type: form.workspace === 'studio' ? 'my_place' : 'client_place',
        city: form.city.trim(),
        address: form.workspace === 'studio' ? [form.street.trim(), form.details.trim()].filter(Boolean).join(', ') : undefined,
        email: form.email.trim(),
        phone: `+380${phoneDigits(form.phone)}`,
        hours: form.hours.map((h, i) => ({ weekday: i, is_open: h.open, open_time: h.from, close_time: h.to })),
        ...(form.coords ? { latitude: form.coords.lat, longitude: form.coords.lng } : {}),
        show_phone_publicly: form.showPhone,
      } as any);
      for (const s of form.services) {
        await api.createService(token, { business_id: business.id, name: s.name, price: s.price, duration_minutes: s.duration });
      }
      const failedInvites: string[] = [];
      for (const m of form.type === 'salon' ? form.team : []) {
        try { await api.inviteStaff(token, business.id, { email: m.email, role: m.role }); }
        catch { failedInvites.push(m.email); }
      }
      localStorage.setItem('userRole', OWNER_ROLE);
      localStorage.removeItem(DRAFT_KEY);
      setDone({ name: business.name, failedInvites });
    } catch (e: any) {
      setError(e?.message || 'Не вдалося створити заклад. Спробуйте ще раз.');
    } finally {
      setSaving(false);
    }
  };

  // Enter - далі (крім багаторядкових полів)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && !(e.target as HTMLElement).dataset.noenter) { e.preventDefault(); next(); }
  };

  const show = (k: string) => touched[k] && problems[k];

  // --- Послуги ---
  const templates = (TEMPLATES[form.category] || []).filter(t => !form.services.some(s => s.name === t.name));
  const addService = (s: Omit<Service, 'key'>) => set('services', [...form.services, { ...s, key: uid() }]);
  const addCustom = () => {
    const name = svcDraft.name.trim();
    if (name.length < 2 || svcDraft.price === '') return;
    addService({ name, duration: svcDraft.duration, price: Number(svcDraft.price) });
    setSvcDraft({ name: '', duration: 60, price: '' });
  };

  // --- Команда ---
  const addInvite = () => {
    const email = invDraft.email.trim().toLowerCase();
    if (!isEmail(email) || email === form.email.trim().toLowerCase() || form.team.some(t => t.email === email)) return;
    set('team', [...form.team, { key: uid(), email, role: invDraft.role }]);
    setInvDraft({ email: '', role: invDraft.role });
  };

  const cat = CATEGORIES.find(c => c.slug === form.category);
  const openDays = form.hours.map((h, i) => (h.open ? i : -1)).filter(i => i >= 0);
  const progress = Math.round(((stepIdx + (stepOk(step.id) ? 1 : 0.4)) / steps.length) * 100);

  // ---------------------------------------------------------------- Готово
  if (done) {
    return (
      <main className="rg-done">
        <div className="rg-done-card">
          <svg className="rg-check" width="84" height="84" viewBox="0 0 84 84" aria-hidden>
            <circle cx="42" cy="42" r="38" fill={GREEN_SOFT} />
            <path d="M26 43l11 11 21-23" fill="none" stroke={GREEN} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1>«{done.name}» створено</h1>
          <p>Календар готовий до записів. 14 днів — безкоштовно, усі можливості відкриті.</p>
          {done.failedInvites.length > 0 && (
            <div className="rg-warn">Не вдалося надіслати запрошення: {done.failedInvites.join(', ')}. Запросіть їх у кабінеті, розділ «Команда».</div>
          )}
          <button type="button" className="rg-primary" onClick={() => router.push('/cabinet')}>Відкрити кабінет</button>
        </div>
        <style jsx>{`
          .rg-done { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1.25rem;
            background: radial-gradient(60% 50% at 50% 0%, ${GREEN_SOFT}, transparent 70%), #FAFAFA; font-family: inherit; }
          .rg-done-card { max-width: 460px; text-align: center; animation: rgRise .6s cubic-bezier(.16,1,.3,1); }
          .rg-done h1 { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.03em; color: ${INK}; margin: 1.1rem 0 0.5rem; }
          .rg-done p { color: ${SUB}; font-size: 1rem; line-height: 1.5; margin: 0 0 1.5rem; }
          .rg-warn { font-size: 0.875rem; color: #8A6516; background: #FBF6EC; border-radius: 12px; padding: 0.7rem 0.9rem; margin-bottom: 1.2rem; }
          .rg-primary { height: 52px; padding: 0 2rem; border-radius: 14px; border: none; background: ${INK}; color: #fff; font-family: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; }
          .rg-check { animation: rgPop .5s cubic-bezier(.34,1.56,.64,1) .1s both; }
          .rg-check path { stroke-dasharray: 60; stroke-dashoffset: 60; animation: rgDraw .5s ease .45s forwards; }
          @keyframes rgRise { from { opacity: 0; transform: translateY(14px); } }
          @keyframes rgPop { from { transform: scale(.4); opacity: 0; } }
          @keyframes rgDraw { to { stroke-dashoffset: 0; } }
        `}</style>
      </main>
    );
  }

  // ---------------------------------------------------------------- Форма
  return (
    <main className="rg" onKeyDown={onKey}>
      <header className="rg-top">
        <button type="button" className="rg-logo" onClick={() => router.push('/business')}>Book<span>Era</span></button>
        <div className="rg-bar" aria-hidden><i style={{ width: `${progress}%` }} /></div>
        <span className="rg-count">Крок {stepIdx + 1} з {steps.length}</span>
      </header>

      <div className="rg-layout">
        {/* Кроки */}
        <nav className="rg-steps" aria-label="Кроки реєстрації">
          {steps.map((s, i) => {
            const ok = stepOk(s.id) && i < stepIdx;
            const reachable = i <= stepIdx || steps.slice(0, i).every(p => stepOk(p.id));
            return (
              <button key={s.id} type="button" disabled={!reachable} onClick={() => go(i)}
                className={`rg-step ${i === stepIdx ? 'on' : ''} ${ok ? 'ok' : ''}`}>
                <span className="rg-dot">{ok ? '✓' : i + 1}</span>
                <span><b>{s.title}</b><small>{s.hint}</small></span>
              </button>
            );
          })}
        </nav>

        {/* Крок */}
        <section className="rg-main">
          <div key={step.id} className={`rg-pane ${dir > 0 ? 'fwd' : 'back'}`}>
            <h1>{step.title}</h1>

            {step.id === 'about' && (
              <>
                <p className="rg-lead">Як називається заклад і чим ви займаєтесь.</p>
                <label className="rg-field">
                  <span>Назва закладу</span>
                  <input className={show('name') ? 'bad' : ''} value={form.name} maxLength={60} autoFocus placeholder="Напр., Barber Studio"
                    onChange={e => set('name', e.target.value)} onBlur={() => touch('name')} />
                  {show('name') && <em>{problems.name}</em>}
                </label>
                <div className="rg-label">Категорія</div>
                <div className="rg-chips">
                  {(showMore ? [...MAIN_CATEGORIES, ...MORE_CATEGORIES] : MAIN_CATEGORIES).map(c => (
                    <button key={c.slug} type="button" className={form.category === c.slug ? 'on' : ''} onClick={() => { set('category', c.slug); touch('category'); }}>{c.title}</button>
                  ))}
                  {!showMore && <button type="button" className="rg-more" onClick={() => setShowMore(true)}>Більше…</button>}
                </div>
                {show('category') && <em className="rg-err">{problems.category}</em>}
                <div className="rg-label">Формат</div>
                <div className="rg-cards">
                  {([
                    { id: 'solo', title: 'Приватний майстер', text: 'Працюю сам. Простий календар без налаштувань команди.' },
                    { id: 'salon', title: 'Салон із командою', text: 'Кілька майстрів, графіки, зарплати, ролі.' },
                  ] as const).map(t => (
                    <button key={t.id} type="button" className={`rg-card ${form.type === t.id ? 'on' : ''}`} onClick={() => { set('type', t.id); touch('type'); }}>
                      <span className="rg-radio" />
                      <span><b>{t.title}</b><small>{t.text}</small></span>
                    </button>
                  ))}
                </div>
                {show('type') && <em className="rg-err">{problems.type}</em>}
              </>
            )}

            {step.id === 'contacts' && (
              <>
                <p className="rg-lead">Контакти <b>закладу</b>, а не ваші особисті. Ви зможете змінити їх у налаштуваннях.</p>
                <label className="rg-field">
                  <span>Пошта закладу</span>
                  <input type="email" inputMode="email" autoComplete="off" className={show('email') ? 'bad' : ''} value={form.email} autoFocus
                    placeholder="studio@example.com" onChange={e => set('email', e.target.value)} onBlur={() => touch('email')} />
                  {show('email') ? <em>{problems.email}</em> : <small>Сюди приходитимуть нові записи, скасування й відгуки. Клієнти бачать її на сторінці закладу.</small>}
                </label>
                <label className="rg-field">
                  <span>Робочий телефон закладу</span>
                  <div className={`rg-phone ${show('phone') ? 'bad' : ''}`}>
                    <b>+380</b>
                    <input inputMode="numeric" autoComplete="off" value={phonePretty(phoneDigits(form.phone))} placeholder="67 123 45 67"
                      onChange={e => set('phone', phoneDigits(e.target.value))} onBlur={() => touch('phone')} />
                  </div>
                  {show('phone') ? <em>{problems.phone}</em> : <small>Номер салону чи адміністратора — не ваш особистий. За ним клієнти дзвонитимуть із питаннями.</small>}
                </label>
                <button type="button" className="rg-toggle" onClick={() => set('showPhone', !form.showPhone)} role="switch" aria-checked={form.showPhone}>
                  <span className={`rg-switch ${form.showPhone ? 'on' : ''}`}><i /></span>
                  <span><b>Показувати телефон клієнтам</b><small>{form.showPhone ? 'Номер видно на сторінці закладу' : 'Лише для записів, на сторінці прихований'}</small></span>
                </button>
              </>
            )}

            {step.id === 'place' && (
              <>
                <p className="rg-lead">Де клієнти вас знайдуть.</p>
                <div className="rg-cards">
                  {([
                    { id: 'studio', title: 'У закладі', text: 'Клієнти приходять за вашою адресою.' },
                    { id: 'client_place', title: 'Виїзд до клієнта', text: 'Ви їдете до клієнта. Вулиця не потрібна.' },
                  ] as const).map(t => (
                    <button key={t.id} type="button" className={`rg-card ${form.workspace === t.id ? 'on' : ''}`} onClick={() => set('workspace', t.id)}>
                      <span className="rg-radio" />
                      <span><b>{t.title}</b><small>{t.text}</small></span>
                    </button>
                  ))}
                </div>
                <label className="rg-field">
                  <span>Місто</span>
                  <input className={show('city') ? 'bad' : ''} value={form.city} placeholder="Напр., Київ" onChange={e => set('city', e.target.value)} onBlur={() => touch('city')} />
                  {show('city') && <em>{problems.city}</em>}
                </label>
                {form.workspace === 'studio' && (
                  <>
                    <div className="rg-row">
                      <label className="rg-field" style={{ flex: 2 }}>
                        <span>Вулиця й будинок</span>
                        <input className={show('street') ? 'bad' : ''} value={form.street} placeholder="вул. Івана Франка, 12" onChange={e => set('street', e.target.value)} onBlur={() => touch('street')} />
                        {show('street') && <em>{problems.street}</em>}
                      </label>
                      <label className="rg-field" style={{ flex: 1 }}>
                        <span>Поверх, кабінет</span>
                        <input value={form.details} placeholder="2 поверх" onChange={e => set('details', e.target.value)} />
                      </label>
                    </div>
                    <div className="rg-label">Мітка на мапі <small>— знайдіть адресу або перетягніть мітку, щоб клієнти не заблукали</small></div>
                    <div className="rg-map">
                      <LocationPicker value={form.coords} city={form.city} height={280} onChange={c => set('coords', c)} />
                    </div>
                    {form.coords && <small className="rg-ok">✓ Мітку поставлено</small>}
                  </>
                )}
              </>
            )}

            {step.id === 'hours' && (
              <>
                <p className="rg-lead">Коли можна записатись. Графік кожного майстра налаштуєте пізніше.</p>
                <div className="rg-chips" style={{ marginBottom: '1rem' }}>
                  {[
                    { label: 'Пн–Пт 9:00–20:00', v: (i: number) => ({ open: i < 5, from: '09:00', to: '20:00' }) },
                    { label: 'Пн–Сб 10:00–19:00', v: (i: number) => ({ open: i < 6, from: '10:00', to: '19:00' }) },
                    { label: 'Щодня 10:00–20:00', v: () => ({ open: true, from: '10:00', to: '20:00' }) },
                  ].map(p => (
                    <button key={p.label} type="button" onClick={() => set('hours', DAYS.map((_, i) => p.v(i)))}>{p.label}</button>
                  ))}
                </div>
                <div className="rg-hours">
                  {form.hours.map((h, i) => (
                    <div key={i} className={`rg-day ${h.open ? '' : 'off'}`}>
                      <button type="button" role="switch" aria-checked={h.open} aria-label={DAYS[i]} className={`rg-switch ${h.open ? 'on' : ''}`}
                        onClick={() => set('hours', form.hours.map((d, k) => (k === i ? { ...d, open: !d.open } : d)))}><i /></button>
                      <span className="rg-dayname">{DAYS[i]}</span>
                      {h.open ? (
                        <span className="rg-times">
                          <input type="time" value={h.from} onChange={e => set('hours', form.hours.map((d, k) => (k === i ? { ...d, from: e.target.value } : d)))} />
                          <i>–</i>
                          <input type="time" value={h.to} onChange={e => set('hours', form.hours.map((d, k) => (k === i ? { ...d, to: e.target.value } : d)))} />
                        </span>
                      ) : <span className="rg-offlabel">Вихідний</span>}
                      {h.open && i > 0 && (
                        <button type="button" className="rg-copy" title="Як у попередній день"
                          onClick={() => set('hours', form.hours.map((d, k) => (k === i ? { ...form.hours[i - 1], open: true } : d)))}>↑</button>
                      )}
                    </div>
                  ))}
                </div>
                {(problems.hours || problems.hoursRange) && touched.hours && <em className="rg-err">{problems.hours || problems.hoursRange}</em>}
              </>
            )}

            {step.id === 'services' && (
              <>
                <p className="rg-lead">Що клієнти зможуть забронювати. Змінити й доповнити можна будь-коли.</p>
                {templates.length > 0 && (
                  <>
                    <div className="rg-label">Популярні для категорії «{categoryTitle(form.category)}»</div>
                    <div className="rg-tpls">
                      {templates.map(t => (
                        <button key={t.name} type="button" onClick={() => addService(t)}>
                          <b>+ {t.name}</b><small>{formatDuration(t.duration)} · {t.price ? `${t.price} ₴` : 'безкоштовно'}</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {form.services.length > 0 && (
                  <div className="rg-list">
                    {form.services.map(s => (
                      <div key={s.key} className="rg-item">
                        <span><b>{s.name}</b><small>{formatDuration(s.duration)}</small></span>
                        <span className="rg-price">{s.price ? `${s.price.toLocaleString('uk-UA')} ₴` : 'безкоштовно'}</span>
                        <button type="button" aria-label="Прибрати" onClick={() => set('services', form.services.filter(x => x.key !== s.key))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rg-add">
                  <div className="rg-label" style={{ marginTop: 0 }}>Своя послуга</div>
                  <input data-noenter value={svcDraft.name} maxLength={80} placeholder="Назва послуги" onChange={e => setSvcDraft(d => ({ ...d, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
                  <div className="rg-durs">
                    {[30, 45, 60, 90, 120, 180].map(m => (
                      <button key={m} type="button" className={svcDraft.duration === m ? 'on' : ''} onClick={() => setSvcDraft(d => ({ ...d, duration: m }))}>{formatDuration(m)}</button>
                    ))}
                  </div>
                  <div className="rg-row" style={{ alignItems: 'center' }}>
                    <div className="rg-phone" style={{ flex: 1 }}>
                      <input data-noenter inputMode="numeric" value={svcDraft.price} placeholder="Ціна" onChange={e => setSvcDraft(d => ({ ...d, price: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
                      <b>₴</b>
                    </div>
                    <button type="button" className="rg-secondary" disabled={svcDraft.name.trim().length < 2 || svcDraft.price === ''} onClick={addCustom}>Додати</button>
                  </div>
                </div>
                {touched.services && problems.services && <em className="rg-err">{problems.services}</em>}
              </>
            )}

            {step.id === 'team' && (
              <>
                <p className="rg-lead">Надішліть запрошення майстрам — вони приєднаються за посиланням із листа. Можна пропустити й запросити пізніше.</p>
                <div className="rg-note">Ви вже в команді як власник — додавати себе не потрібно.</div>
                <div className="rg-row" style={{ alignItems: 'stretch' }}>
                  <input data-noenter className="rg-plain" type="email" value={invDraft.email} placeholder="Пошта майстра" style={{ flex: 1 }}
                    onChange={e => setInvDraft(d => ({ ...d, email: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInvite(); } }} />
                  <div className="rg-seg">
                    {([['master', 'Майстер'], ['admin', 'Адміністратор']] as const).map(([id, l]) => (
                      <button key={id} type="button" className={invDraft.role === id ? 'on' : ''} onClick={() => setInvDraft(d => ({ ...d, role: id }))}>{l}</button>
                    ))}
                  </div>
                  <button type="button" className="rg-secondary" disabled={!isEmail(invDraft.email)} onClick={addInvite}>Додати</button>
                </div>
                {invDraft.email && isEmail(invDraft.email) && invDraft.email.trim().toLowerCase() === form.email.trim().toLowerCase() && (
                  <em className="rg-err">Це пошта закладу — вкажіть пошту самого майстра</em>
                )}
                {form.team.length > 0 && (
                  <div className="rg-list">
                    {form.team.map(t => (
                      <div key={t.key} className="rg-item">
                        <span><b>{t.email}</b><small>{t.role === 'admin' ? 'Адміністратор' : 'Майстер'} · отримає запрошення</small></span>
                        <span />
                        <button type="button" aria-label="Прибрати" onClick={() => set('team', form.team.filter(x => x.key !== t.key))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {step.id === 'review' && (
              <>
                <p className="rg-lead">Перевірте — і календар готовий до записів.</p>
                {[
                  { id: 'about', title: 'Заклад', lines: [form.name, `${categoryTitle(form.category)} · ${form.type === 'solo' ? 'приватний майстер' : 'салон із командою'}`] },
                  { id: 'contacts', title: 'Контакти закладу', lines: [form.email, `+380 ${phonePretty(phoneDigits(form.phone))}${form.showPhone ? '' : ' · прихований'}`] },
                  { id: 'place', title: 'Де ви працюєте', lines: [form.workspace === 'studio' ? [form.city, form.street, form.details].filter(Boolean).join(', ') : `${form.city} · виїзд до клієнта`, form.workspace === 'studio' ? (form.coords ? 'Мітку на мапі поставлено' : 'Точку визначимо за адресою') : ''] },
                  { id: 'hours', title: 'Графік', lines: [openDays.length ? openDays.map(i => `${DAYS_SHORT[i]} ${form.hours[i].from}–${form.hours[i].to}`).join(', ') : '—'] },
                  { id: 'services', title: 'Послуги', lines: [form.services.map(s => s.name).join(', ') || '—'] },
                  ...(form.type === 'salon' ? [{ id: 'team', title: 'Команда', lines: [form.team.length ? `${form.team.length} запрошення` : 'Запросите пізніше'] }] : []),
                ].map(b => (
                  <div key={b.id} className={`rg-sum ${!stepOk(b.id as StepId) ? 'bad' : ''}`}>
                    <div>
                      <small>{b.title}</small>
                      {b.lines.filter(Boolean).map((l, i) => <div key={i} className={i ? 'rg-sum-sub' : ''}>{l}</div>)}
                    </div>
                    <button type="button" onClick={() => go(steps.findIndex(s => s.id === b.id))}>Змінити</button>
                  </div>
                ))}
                <div className="rg-trial">14 днів безкоштовно, без картки. Потім — тариф за вибором.</div>
              </>
            )}

            {error && <div className="rg-error">{error}</div>}

            <div className="rg-nav">
              <button type="button" className="rg-back" onClick={() => (stepIdx === 0 ? router.push('/business') : go(stepIdx - 1))}>
                {stepIdx === 0 ? 'Скасувати' : '← Назад'}
              </button>
              <button type="button" className="rg-primary" disabled={saving} onClick={next}>
                {saving ? 'Створюємо…' : step.id === 'review' ? 'Створити заклад' : step.id === 'team' && !form.team.length ? 'Пропустити' : 'Далі'}
              </button>
            </div>
          </div>
        </section>

        {/* Живий перегляд */}
        <aside className="rg-preview" aria-label="Як вас побачать клієнти">
          <div className="rg-preview-cap">Так вас побачать клієнти</div>
          <div className="rg-pcard">
            <div className="rg-pcover"><span>{(form.name || 'Ваш заклад').slice(0, 1).toUpperCase()}</span></div>
            <div className="rg-pbody">
              <div className="rg-pname">{form.name || 'Назва закладу'}</div>
              <div className="rg-pmeta">{cat ? cat.title : 'Категорія'}{form.city ? ` · ${form.city}` : ''}</div>
              <div className="rg-pline">{form.workspace === 'client_place' ? 'Виїзд до клієнта' : (form.street || 'Адреса')}</div>
              <div className="rg-pline">{openDays.length ? `${DAYS_SHORT[openDays[0]]}–${DAYS_SHORT[openDays[openDays.length - 1]]} ${form.hours[openDays[0]].from}–${form.hours[openDays[0]].to}` : 'Графік'}</div>
              {form.showPhone && phoneDigits(form.phone).length === 9 && <div className="rg-pline">+380 {phonePretty(phoneDigits(form.phone))}</div>}
              <div className="rg-psvc">
                {(form.services.length ? form.services.slice(0, 3) : [{ key: 'x', name: 'Ваші послуги', duration: 60, price: 0 }]).map(s => (
                  <div key={s.key}><span>{s.name}</span><b>{s.price ? `${s.price} ₴` : ''}</b></div>
                ))}
              </div>
              <div className="rg-pbtn">Записатись</div>
            </div>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .rg { min-height: 100vh; background: #FAFAFA; color: ${INK}; font-family: inherit; }
        .rg-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 1.25rem; padding: 0.9rem clamp(1rem, 3vw, 2.5rem); background: rgba(250,250,250,.86); backdrop-filter: blur(14px); border-bottom: 1px solid ${LINE}; }
        .rg-logo { border: none; background: none; font-family: inherit; font-size: 1.2rem; font-weight: 800; letter-spacing: -0.03em; color: ${INK}; cursor: pointer; padding: 0; }
        .rg-logo span { color: ${GREEN}; }
        .rg-bar { flex: 1; height: 4px; border-radius: 2px; background: ${LINE}; overflow: hidden; }
        .rg-bar i { display: block; height: 100%; background: ${GREEN}; border-radius: 2px; transition: width .5s cubic-bezier(.16,1,.3,1); }
        .rg-count { font-size: 0.8rem; color: ${SUB}; white-space: nowrap; }

        .rg-layout { display: grid; grid-template-columns: 250px minmax(0, 620px) 300px; gap: 2.5rem; justify-content: center; padding: 2.5rem clamp(1rem, 3vw, 2.5rem) 4rem; }
        .rg-steps { display: flex; flex-direction: column; gap: 0.25rem; position: sticky; top: 90px; align-self: start; }
        .rg-step { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.7rem; border: none; background: none; border-radius: 12px; text-align: left; font-family: inherit; cursor: pointer; transition: background-color .2s; }
        .rg-step:disabled { cursor: default; opacity: .45; }
        .rg-step:hover:not(:disabled) { background: #fff; }
        .rg-step.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
        .rg-dot { width: 28px; height: 28px; border-radius: 50%; background: ${SOFT}; color: ${SUB}; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; transition: all .3s; }
        .rg-step.on .rg-dot { background: ${INK}; color: #fff; }
        .rg-step.ok .rg-dot { background: ${GREEN_SOFT}; color: ${GREEN}; }
        .rg-step b { display: block; font-size: 0.9rem; font-weight: 600; color: ${INK}; }
        .rg-step small { display: block; font-size: 0.75rem; color: ${SUB}; }

        .rg-main { min-width: 0; }
        .rg-pane { animation: rgIn .45s cubic-bezier(.16,1,.3,1); }
        .rg-pane.back { animation-name: rgInBack; }
        @keyframes rgIn { from { opacity: 0; transform: translateX(26px); } }
        @keyframes rgInBack { from { opacity: 0; transform: translateX(-26px); } }
        .rg-pane h1 { font-size: clamp(1.7rem, 3vw, 2.2rem); font-weight: 700; letter-spacing: -0.035em; margin: 0 0 0.4rem; }
        .rg-lead { font-size: 1rem; color: ${SUB}; margin: 0 0 1.6rem; line-height: 1.5; }
        .rg-lead b { color: ${INK}; }

        .rg-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.15rem; }
        .rg-field > span, .rg-label { font-size: 0.85rem; font-weight: 600; color: #3A3A3C; }
        .rg-label { margin: 1.3rem 0 0.6rem; }
        .rg-label small { font-weight: 400; color: ${SUB}; }
        .rg-field input, .rg-plain, .rg-add > input { height: 50px; padding: 0 1rem; border-radius: 14px; border: 1px solid ${LINE}; background: #fff; font-family: inherit; font-size: 1rem; color: ${INK}; outline: none; transition: border-color .2s, box-shadow .2s; box-sizing: border-box; width: 100%; }
        .rg-field input:focus, .rg-plain:focus, .rg-add > input:focus { border-color: ${GREEN}; box-shadow: 0 0 0 4px rgba(111,146,115,.15); }
        .rg-field input.bad, .rg-phone.bad { border-color: #E0645C; }
        .rg-field small { font-size: 0.8rem; color: ${SUB}; line-height: 1.45; }
        .rg-field em, .rg-err { font-style: normal; font-size: 0.8rem; color: #C2410C; display: block; }
        .rg-err { margin-top: 0.5rem; }
        .rg-ok { font-size: 0.8rem; color: ${GREEN}; font-weight: 600; display: block; margin-top: 0.5rem; }
        .rg-row { display: flex; gap: 0.75rem; }
        .rg-row .rg-field { margin-bottom: 1.15rem; }

        .rg-phone { display: flex; align-items: center; height: 50px; border-radius: 14px; border: 1px solid ${LINE}; background: #fff; overflow: hidden; transition: border-color .2s, box-shadow .2s; }
        .rg-phone:focus-within { border-color: ${GREEN}; box-shadow: 0 0 0 4px rgba(111,146,115,.15); }
        .rg-phone b { padding: 0 0.9rem; font-weight: 600; color: ${SUB}; font-size: 1rem; }
        .rg-phone input { border: none !important; box-shadow: none !important; height: 100%; flex: 1; padding: 0 0.9rem 0 0; font-family: inherit; font-size: 1rem; outline: none; background: transparent; min-width: 0; }

        .rg-chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
        .rg-chips button { height: 40px; padding: 0 1rem; border-radius: 999px; border: 1px solid ${LINE}; background: #fff; font-family: inherit; font-size: 0.9rem; color: ${INK}; cursor: pointer; transition: all .18s; }
        .rg-chips button:hover { border-color: #C7C7CC; }
        .rg-chips button:active { transform: scale(.96); }
        .rg-chips button.on { background: ${INK}; border-color: ${INK}; color: #fff; }
        .rg-chips .rg-more { color: ${GREEN}; border-style: dashed; }

        .rg-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; margin-bottom: 1.2rem; }
        .rg-card { display: flex; gap: 0.75rem; align-items: flex-start; padding: 1rem 1.05rem; border-radius: 16px; border: 1.5px solid ${LINE}; background: #fff; text-align: left; font-family: inherit; cursor: pointer; transition: all .2s; }
        .rg-card:hover { border-color: #C7C7CC; }
        .rg-card.on { border-color: ${GREEN}; background: ${GREEN_SOFT}; }
        .rg-card b { display: block; font-size: 0.95rem; color: ${INK}; }
        .rg-card small { display: block; font-size: 0.82rem; color: ${SUB}; margin-top: 3px; line-height: 1.4; }
        .rg-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #C7C7CC; flex-shrink: 0; margin-top: 2px; position: relative; transition: border-color .2s; }
        .rg-card.on .rg-radio { border-color: ${GREEN}; }
        .rg-card.on .rg-radio::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: ${GREEN}; animation: rgPop .25s ease; }
        @keyframes rgPop { from { transform: scale(0); } }

        .rg-toggle { display: flex; align-items: center; gap: 0.85rem; width: 100%; padding: 0.95rem 1rem; border-radius: 14px; border: 1px solid ${LINE}; background: #fff; text-align: left; font-family: inherit; cursor: pointer; }
        .rg-toggle b { display: block; font-size: 0.925rem; color: ${INK}; }
        .rg-toggle small { display: block; font-size: 0.8rem; color: ${SUB}; }
        .rg-switch { width: 44px; height: 26px; border-radius: 13px; border: none; background: #E5E5EA; position: relative; flex-shrink: 0; padding: 0; cursor: pointer; transition: background-color .25s; display: inline-block; }
        .rg-switch i { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: left .25s cubic-bezier(.16,1,.3,1); }
        .rg-switch.on { background: #34C759; }
        .rg-switch.on i { left: 20px; }

        .rg-map { border-radius: 16px; overflow: hidden; border: 1px solid ${LINE}; }

        .rg-hours { background: #fff; border: 1px solid ${LINE}; border-radius: 16px; padding: 0.3rem 1rem; }
        .rg-day { display: grid; grid-template-columns: 44px 120px 1fr 32px; align-items: center; gap: 0.75rem; padding: 0.65rem 0; border-top: 1px solid ${SOFT}; }
        .rg-day:first-child { border-top: none; }
        .rg-dayname { font-size: 0.925rem; font-weight: 500; }
        .rg-day.off .rg-dayname { color: ${SUB}; }
        .rg-times { display: flex; align-items: center; gap: 0.4rem; }
        .rg-times i { font-style: normal; color: ${SUB}; }
        .rg-times input { height: 38px; padding: 0 0.6rem; border-radius: 10px; border: 1px solid ${LINE}; font-family: inherit; font-size: 0.9rem; background: #fff; outline: none; }
        .rg-times input:focus { border-color: ${GREEN}; }
        .rg-offlabel { font-size: 0.875rem; color: #AEAEB2; }
        .rg-copy { width: 30px; height: 30px; border-radius: 8px; border: 1px solid ${LINE}; background: #fff; color: ${SUB}; cursor: pointer; font-size: 0.85rem; }
        .rg-copy:hover { color: ${INK}; background: ${SOFT}; }

        .rg-tpls { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.55rem; }
        .rg-tpls button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 0.8rem 0.95rem; border-radius: 14px; border: 1px dashed #C7C7CC; background: #fff; font-family: inherit; text-align: left; cursor: pointer; transition: all .18s; }
        .rg-tpls button:hover { border-color: ${GREEN}; background: ${GREEN_SOFT}; }
        .rg-tpls button:active { transform: scale(.97); }
        .rg-tpls b { font-size: 0.9rem; color: ${INK}; }
        .rg-tpls small { font-size: 0.78rem; color: ${SUB}; }
        .rg-list { margin-top: 1rem; background: #fff; border: 1px solid ${LINE}; border-radius: 16px; padding: 0 1rem; }
        .rg-item { display: grid; grid-template-columns: 1fr auto 32px; gap: 0.75rem; align-items: center; padding: 0.8rem 0; border-top: 1px solid ${SOFT}; animation: rgIn .35s cubic-bezier(.16,1,.3,1); }
        .rg-item:first-child { border-top: none; }
        .rg-item b { display: block; font-size: 0.925rem; }
        .rg-item small { display: block; font-size: 0.78rem; color: ${SUB}; }
        .rg-price { font-weight: 600; font-variant-numeric: tabular-nums; }
        .rg-item button { width: 30px; height: 30px; border-radius: 50%; border: none; background: ${SOFT}; color: ${SUB}; font-size: 1.05rem; cursor: pointer; }
        .rg-item button:hover { background: #FDECEC; color: #C2410C; }
        .rg-add { margin-top: 1.2rem; padding: 1rem; border-radius: 16px; background: #fff; border: 1px solid ${LINE}; display: flex; flex-direction: column; gap: 0.65rem; }
        .rg-durs { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .rg-durs button { height: 34px; padding: 0 0.8rem; border-radius: 10px; border: 1px solid ${LINE}; background: #fff; font-family: inherit; font-size: 0.82rem; cursor: pointer; }
        .rg-durs button.on { background: ${INK}; color: #fff; border-color: ${INK}; }

        .rg-note { font-size: 0.875rem; color: #3F5F45; background: ${GREEN_SOFT}; border-radius: 12px; padding: 0.7rem 0.9rem; margin-bottom: 1rem; }
        .rg-seg { display: flex; background: ${SOFT}; border-radius: 12px; padding: 3px; }
        .rg-seg button { border: none; background: transparent; padding: 0 0.8rem; border-radius: 9px; font-family: inherit; font-size: 0.82rem; cursor: pointer; color: ${INK}; }
        .rg-seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.1); font-weight: 600; }

        .rg-sum { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 0.95rem 1.1rem; border-radius: 14px; background: #fff; border: 1px solid ${LINE}; margin-bottom: 0.55rem; }
        .rg-sum.bad { border-color: #F5B7A5; }
        .rg-sum small { display: block; font-size: 0.75rem; font-weight: 600; color: ${SUB}; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem; }
        .rg-sum div div { font-size: 0.95rem; }
        .rg-sum .rg-sum-sub { font-size: 0.85rem; color: ${SUB}; }
        .rg-sum button { border: none; background: none; color: ${GREEN}; font-family: inherit; font-weight: 600; font-size: 0.85rem; cursor: pointer; white-space: nowrap; }
        .rg-trial { font-size: 0.875rem; color: ${SUB}; text-align: center; margin-top: 1rem; }

        .rg-error { margin-top: 1rem; padding: 0.75rem 0.9rem; border-radius: 12px; background: #FDECEC; color: #B42318; font-size: 0.9rem; }
        .rg-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid ${LINE}; }
        .rg-back { border: none; background: none; font-family: inherit; font-size: 0.95rem; color: ${SUB}; cursor: pointer; padding: 0.6rem 0; }
        .rg-back:hover { color: ${INK}; }
        .rg-primary { height: 50px; padding: 0 2rem; border-radius: 14px; border: none; background: ${INK}; color: #fff; font-family: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform .15s, opacity .2s; }
        .rg-primary:active { transform: scale(.97); }
        .rg-primary:disabled { opacity: .5; cursor: default; }
        .rg-secondary { height: 50px; padding: 0 1.2rem; border-radius: 14px; border: 1px solid ${LINE}; background: #fff; font-family: inherit; font-size: 0.925rem; font-weight: 600; color: ${INK}; cursor: pointer; white-space: nowrap; }
        .rg-secondary:disabled { opacity: .4; cursor: default; }

        .rg-preview { position: sticky; top: 90px; align-self: start; }
        .rg-preview-cap { font-size: 0.75rem; font-weight: 600; color: ${SUB}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.7rem; }
        .rg-pcard { background: #fff; border-radius: 22px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 24px 50px -30px rgba(0,0,0,.25); }
        .rg-pcover { height: 110px; background: linear-gradient(135deg, #DCE8DB, #B8CFB9); display: flex; align-items: flex-end; padding: 0 1rem; }
        .rg-pcover span { width: 56px; height: 56px; border-radius: 16px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: ${GREEN}; transform: translateY(24px); box-shadow: 0 6px 16px -6px rgba(0,0,0,.2); }
        .rg-pbody { padding: 2rem 1.1rem 1.1rem; }
        .rg-pname { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; transition: all .2s; }
        .rg-pmeta { font-size: 0.85rem; color: ${GREEN}; font-weight: 600; margin: 0.15rem 0 0.6rem; }
        .rg-pline { font-size: 0.82rem; color: ${SUB}; margin-top: 0.2rem; }
        .rg-psvc { margin-top: 0.9rem; border-top: 1px solid ${SOFT}; padding-top: 0.6rem; }
        .rg-psvc div { display: flex; justify-content: space-between; font-size: 0.85rem; padding: 0.3rem 0; }
        .rg-psvc b { font-weight: 600; }
        .rg-pbtn { margin-top: 0.9rem; height: 40px; border-radius: 12px; background: ${INK}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.875rem; font-weight: 600; }

        @media (max-width: 1180px) { .rg-layout { grid-template-columns: 220px minmax(0, 620px); } .rg-preview { display: none; } }
        @media (max-width: 820px) {
          .rg-layout { grid-template-columns: 1fr; padding-top: 1.5rem; }
          .rg-steps { display: none; }
          .rg-cards { grid-template-columns: 1fr; }
          .rg-row { flex-direction: column; gap: 0; }
          .rg-day { grid-template-columns: 44px 1fr auto; }
          .rg-copy { display: none; }
          .rg-nav { position: sticky; bottom: 0; background: #FAFAFA; margin: 1.5rem -1rem 0; padding: 0.9rem 1rem calc(0.9rem + env(safe-area-inset-bottom)); }
        }
      `}</style>
    </main>
  );
}
