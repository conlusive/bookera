'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAuthToken, getAuthTokenOrNull } from '@/lib/auth-token-client';
import { MAIN_CATEGORIES, MORE_CATEGORIES, categoryTitle } from '@/lib/categories';
import { formatDuration } from '@/lib/duration';
import { OWNER_ROLE } from '@/lib/roles';

/**
 * Реєстрація бізнесу - покроково, одне питання на екран (як і було),
 * лише краще й логічніше.
 *
 * Порядок: назва -> категорія -> формат -> контакти закладу -> де працюєте
 * -> адреса -> графік -> послуги -> команда (лише салон) -> перевірка.
 *
 * Що виправлено в самій логіці:
 *   - «Готово» показувалось ДО створення закладу: якщо збереження падало,
 *     людина вже бачила «календар готовий». Тепер - перевірка, «Створити»,
 *     і «Готово» лише коли заклад справді створено
 *   - крок «Скільки у вас спеціалістів» нікуди не зберігався - прибрано,
 *     його роль виконує «Приватний майстер / Салон»
 *   - запрошення майстра: лише пошта й роль (імʼя, телефон і посада не
 *     надсилались нікуди)
 *   - жодних даних власника: без «Я (Власник)» і імʼя з памʼяті браузера
 *   - пошта закладу обовʼязкова; телефон - РОБОЧИЙ, з поясненням
 *   - місто окремо (раніше йшло в адресу, а сервер ставив «Львів» усім);
 *     мітка на мапі
 *   - чернетка зберігається: оновлення сторінки нічого не стирає
 */

const LocationPicker = dynamic(() => import('@/components/ui/LocationPicker'), { ssr: false });

const DRAFT_KEY = 'bookera_register_draft_v3';
const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];

type Day = { open: boolean; from: string; to: string };
type Service = { id: string; name: string; duration: number; price: number };
type Invite = { id: string; email: string; role: 'master' | 'admin' };
type Form = {
  name: string; category: string; type: 'individual' | 'company' | '';
  email: string; phone: string; showPhone: boolean;
  workspace: 'my_place' | 'client_place' | ''; city: string; street: string; details: string;
  coords: { lat: number; lng: number } | null;
  hours: Day[]; services: Service[]; team: Invite[];
};

const EMPTY: Form = {
  name: '', category: '', type: '', email: '', phone: '', showPhone: true,
  workspace: '', city: '', street: '', details: '', coords: null,
  hours: DAYS.map((_, i) => ({ open: i < 5, from: '09:00', to: '20:00' })),
  services: [], team: [],
};

const TEMPLATES: Record<string, Omit<Service, 'id'>[]> = {
  barber: [{ name: 'Чоловіча стрижка', duration: 45, price: 500 }, { name: 'Моделювання бороди', duration: 30, price: 300 }],
  hair: [{ name: 'Жіноча стрижка', duration: 60, price: 800 }, { name: 'Укладка волосся', duration: 40, price: 500 }, { name: 'Фарбування в один тон', duration: 120, price: 1500 }],
  nails: [{ name: 'Манікюр + гель-лак', duration: 90, price: 600 }, { name: 'Педикюр (апаратний)', duration: 90, price: 750 }],
  brows: [{ name: 'Корекція й фарбування брів', duration: 45, price: 450 }, { name: 'Ламінування вій', duration: 60, price: 600 }],
  massage: [{ name: 'Загальний масаж тіла', duration: 60, price: 800 }, { name: 'Масаж спини й шиї', duration: 30, price: 500 }],
  skincare: [{ name: 'Чистка обличчя', duration: 90, price: 900 }, { name: 'Пілінг', duration: 45, price: 700 }],
  makeup: [{ name: 'Вечірній макіяж', duration: 60, price: 800 }, { name: 'Макіяж nude', duration: 40, price: 600 }],
  cosmetology: [{ name: 'Консультація косметолога', duration: 30, price: 400 }],
  tattoo: [{ name: 'Консультація й ескіз', duration: 30, price: 300 }],
  epilation: [{ name: 'Шугаринг ніг', duration: 60, price: 700 }],
};

type StepId = 'name' | 'category' | 'type' | 'contacts' | 'workspace' | 'address' | 'hours' | 'services' | 'team' | 'review';
const STEP_TEXT: Record<StepId, { title: string; desc: string }> = {
  name: { title: 'Як називається ваш заклад?', desc: 'Цю назву клієнти бачитимуть у пошуку й на сторінці запису.' },
  category: { title: 'Чим ви займаєтесь?', desc: 'Оберіть основну сферу — за нею вас шукатимуть клієнти.' },
  type: { title: 'Як ви працюєте?', desc: 'Від цього залежать налаштування календаря й команди.' },
  contacts: { title: 'Контакти закладу', desc: 'Саме закладу — не ваші особисті. Змінити можна будь-коли.' },
  workspace: { title: 'Де ви приймаєте клієнтів?', desc: 'Так клієнти знатимуть, куди йти або куди вас кликати.' },
  address: { title: 'Адреса закладу', desc: 'Вкажіть адресу й перевірте мітку на мапі.' },
  hours: { title: 'Коли ви працюєте?', desc: 'Клієнти зможуть записатись лише в ці години.' },
  services: { title: 'Ваші послуги', desc: 'Ми підготували популярні для вашої сфери — змініть під себе.' },
  team: { title: 'Ваша команда', desc: 'Запросіть майстрів — вони отримають лист із посиланням. Можна пропустити.' },
  review: { title: 'Усе правильно?', desc: 'Перевірте — і календар одразу готовий до записів.' },
};

const uid = () => Math.random().toString(36).slice(2, 9);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const digits9 = (v: string) => v.replace(/\D/g, '').replace(/^380/, '').slice(0, 9);
const prettyPhone = (d: string) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180];

export default function BusinessRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ name: string; failed: string[] } | null>(null);
  const [svcModal, setSvcModal] = useState<Service | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<{ email: string; role: 'master' | 'admin' }>({ email: '', role: 'master' });
  const ready = useRef(false);

  // Вулиця й будинок - єдине поле адреси: підказки під ним, а мітка на мапі ставиться сама.
  // Мапа лише для уточнення входу (мітку можна перетягнути).
  const [suggest, setSuggest] = useState<{ title: string; subtitle: string; lat: number; lng: number }[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const pickedStreet = useRef('');

  useEffect(() => {
    void getAuthTokenOrNull().then(t => { if (!t) router.replace('/business'); });
  }, [router]);

  // Чернетка
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d?.form) setForm({ ...EMPTY, ...d.form });
      if (typeof d?.idx === 'number') setIdx(d.idx);
    } catch { /* з нуля */ }
    ready.current = true;
  }, []);
  useEffect(() => {
    if (ready.current && !created) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, idx })); } catch { /* немає місця */ }
    }
  }, [form, idx, created]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  // Адреса змінилась - шукаємо її на мапі й ставимо мітку (через 450 мс після останньої літери).
  // Підказку, яку людина вибрала сама, повторно не шукаємо.
  useEffect(() => {
    const street = form.street.trim();
    const city = form.city.trim();
    if (form.workspace !== 'my_place' || street.length < 3 || city.length < 2) { setSuggest([]); return; }
    if (street === pickedStreet.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLooking(true);
      try {
        const list = await api.geoSuggest(await getAuthToken(), `${city}, ${street}`);
        if (cancelled) return;
        setSuggest(list);
        if (list[0]) setForm(f => (f.street.trim() === street ? { ...f, coords: { lat: list[0].lat, lng: list[0].lng } } : f));
      } catch {
        if (!cancelled) setSuggest([]);
      } finally {
        if (!cancelled) setLooking(false);
      }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.street, form.city, form.workspace]);

  const pickSuggestion = (s: { title: string; lat: number; lng: number }) => {
    pickedStreet.current = s.title.trim();
    setForm(f => ({ ...f, street: s.title, coords: { lat: s.lat, lng: s.lng } }));
    setSuggest([]);
    setSuggestOpen(false);
  };

  // Кроки: адреса - лише для закладу, команда - лише для салону
  const steps = useMemo<StepId[]>(() => {
    const s: StepId[] = ['name', 'category', 'type', 'contacts', 'workspace'];
    s.push('address');
    s.push('hours', 'services');
    if (form.type === 'company') s.push('team');
    s.push('review');
    return s;
  }, [form.type]);
  const step = steps[Math.min(idx, steps.length - 1)];

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = 'Щонайменше 2 символи';
    if (!isEmail(form.email)) e.email = form.email ? 'Перевірте адресу пошти' : 'Потрібна пошта закладу';
    // Телефон - необовʼязковий; але якщо почали вводити - повний номер
    if (form.phone && digits9(form.phone).length !== 9) e.phone = 'Не вистачає цифр';
    if (form.city.trim().length < 2) e.city = 'Вкажіть місто';
    if (form.workspace === 'my_place' && form.street.trim().length < 3) e.street = 'Вкажіть вулицю й будинок';
    if (!form.hours.some(h => h.open)) e.hours = 'Оберіть хоча б один робочий день';
    else if (form.hours.some(h => h.open && h.to <= h.from)) e.hours = 'Кінець дня має бути пізніше за початок';
    if (!form.services.length) e.services = 'Додайте хоча б одну послугу';
    return e;
  }, [form]);

  const valid = (s: StepId): boolean => {
    switch (s) {
      case 'name': return !errors.name;
      case 'category': return !!form.category;
      case 'type': return !!form.type;
      case 'contacts': return !errors.email && !errors.phone;
      case 'workspace': return !!form.workspace;
      case 'address': return !errors.city && !errors.street;
      case 'hours': return !errors.hours;
      case 'services': return !errors.services;
      default: return true;
    }
  };

  const go = useCallback((to: number) => {
    setDir(to > idx ? 1 : -1);
    setIdx(Math.max(0, Math.min(to, steps.length - 1)));
    setError('');
  }, [idx, steps.length]);

  const next = () => {
    if (!valid(step)) { setBlurred(b => ({ ...b, name: true, email: true, phone: true, city: true, street: true })); return; }
    if (step === 'review') void create();
    else go(idx + 1);
  };

  // Категорія: обрав - і далі (як було); послуги - з шаблону, якщо ще не додані свої
  const pickCategory = (slug: string) => {
    setForm(f => ({
      ...f, category: slug,
      services: f.services.length && f.category === slug ? f.services
        : (TEMPLATES[slug] || [{ name: 'Консультація', duration: 30, price: 300 }]).map(s => ({ ...s, id: uid() })),
    }));
    setTimeout(() => go(idx + 1), 220);
  };
  const pickCard = <K extends 'type' | 'workspace'>(k: K, v: Form[K]) => { set(k, v); setTimeout(() => go(idx + 1), 220); };

  const create = async () => {
    const bad = steps.find(s => !valid(s));
    if (bad) { go(steps.indexOf(bad)); return; }
    setSaving(true); setError('');
    try {
      const token = await getAuthToken();
      const business = await api.registerBusiness(token, {
        name: form.name.trim(),
        category: form.category,
        business_type: form.type || 'company',
        workspace_type: form.workspace || 'my_place',
        city: form.city.trim(),
        address: form.workspace === 'my_place' ? [form.street.trim(), form.details.trim()].filter(Boolean).join(', ') : undefined,
        email: form.email.trim(),
        phone: digits9(form.phone).length === 9 ? `+380${digits9(form.phone)}` : undefined,
        show_phone_publicly: form.showPhone,
        hours: form.hours.map((h, i) => ({ weekday: i, is_open: h.open, open_time: h.from, close_time: h.to })),
        ...(form.coords ? { latitude: form.coords.lat, longitude: form.coords.lng } : {}),
      });
      for (const s of form.services) {
        await api.createService(token, { business_id: business.id, name: s.name, price: s.price, duration_minutes: s.duration });
      }
      const failed: string[] = [];
      for (const m of form.type === 'company' ? form.team : []) {
        try { await api.inviteStaff(token, business.id, { email: m.email, role: m.role }); } catch { failed.push(m.email); }
      }
      localStorage.setItem('userRole', OWNER_ROLE);
      localStorage.removeItem(DRAFT_KEY);
      setCreated({ name: business.name, failed });
    } catch (e: any) {
      setError(e?.message || 'Не вдалося створити заклад. Спробуйте ще раз.');
    } finally {
      setSaving(false);
    }
  };

  const saveService = () => {
    if (!svcModal || svcModal.name.trim().length < 2) return;
    const s = { ...svcModal, name: svcModal.name.trim() };
    set('services', form.services.some(x => x.id === s.id) ? form.services.map(x => (x.id === s.id ? s : x)) : [...form.services, s]);
    setSvcModal(null);
  };
  const addInvite = () => {
    const email = invite.email.trim().toLowerCase();
    if (!isEmail(email) || email === form.email.trim().toLowerCase() || form.team.some(t => t.email === email)) return;
    set('team', [...form.team, { id: uid(), email, role: invite.role }]);
    setInvite({ email: '', role: invite.role });
    setInviteOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t.tagName === 'INPUT' && !t.closest('.rg-modal')) { e.preventDefault(); next(); }
  };

  const err = (k: string) => (blurred[k] ? errors[k] : undefined);
  // Смуга - лише за позицією, як було: рухається тільки при переході й рівно
  // на один крок. Раніше вона додавала крок наперед, щойно поля ставали
  // заповненими, а після «Продовжити» стрибала одразу на два.
  const progress = created ? 100 : Math.round(((idx + 1) / steps.length) * 100);
  const text = STEP_TEXT[step];
  const autoAdvance = step === 'category' || step === 'type' || step === 'workspace';

  return (
    <div className="rg" onKeyDown={onKey}>
      {/* Лого - точно як на бізнес-лендингу: «BookEra» одним словом, «Business» поруч.
          Раніше контейнер був гнучким із проміжком, і «Book» та «Era» розʼїжджались. */}
      <Link href="/business" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', marginBottom: '2rem' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111827', letterSpacing: '-0.04em' }}>
          Book<span style={{ color: '#8fae92' }}>Era</span>
        </div>
        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 700, marginLeft: '6px' }}>Business</span>
      </Link>

      <div className="rg-card">
        <div className="rg-progress"><i style={{ width: `${Math.min(progress, 100)}%` }} /></div>

        {created ? (
          <div className="rg-step rg-done">
            <svg className="rg-check" width="76" height="76" viewBox="0 0 76 76" aria-hidden>
              <circle cx="38" cy="38" r="34" fill="#ECFDF5" />
              <path d="M24 39l10 10 19-21" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1>«{created.name}» відкрито</h1>
            <p>14 днів безкоштовно — усі можливості вже доступні.</p>
            <div className="rg-rows">
              <div className="rg-row static"><span>Календар готовий до записів</span><i className="dot" /></div>
              <div className="rg-row static"><span>Сповіщення йдуть на {form.email || 'пошту закладу'}</span><i className="dot" /></div>
              {form.type === 'company' && (
                <div className="rg-row static"><span>{form.team.length ? `Запрошення надіслано: ${form.team.length - created.failed.length}` : 'Команду запросите в кабінеті'}</span><i className="dot" /></div>
              )}
            </div>
            {created.failed.length > 0 && <div className="rg-warn">Не вдалося запросити: {created.failed.join(', ')}. Спробуйте в кабінеті, розділ «Команда».</div>}
            <button type="button" className="rg-continue" onClick={() => router.push('/cabinet')}>Відкрити кабінет</button>
          </div>
        ) : (
          <>
            {idx > 0 && <button type="button" className="rg-back" onClick={() => go(idx - 1)} aria-label="Назад">←</button>}
            <div className="rg-head">
              <div className="rg-count">Крок {idx + 1} з {steps.length}</div>
              <h1>{text.title}</h1>
              <p>{text.desc}</p>
            </div>

            <div key={step} className={`rg-step ${dir > 0 ? 'fwd' : 'back'}`}>
              {step === 'name' && (
                <label className="rg-field">
                  <span>Назва закладу</span>
                  <input autoFocus value={form.name} maxLength={60} placeholder="Barber Studio" className={err('name') ? 'bad' : ''}
                    onChange={e => set('name', e.target.value)} onBlur={() => setBlurred(b => ({ ...b, name: true }))} />
                  {err('name') && <em>{err('name')}</em>}
                </label>
              )}

              {step === 'category' && (
                <div className="rg-rows scroll">
                  {MAIN_CATEGORIES.map(c => (
                    <button key={c.slug} type="button" className={`rg-row ${form.category === c.slug ? 'on' : ''}`} onClick={() => pickCategory(c.slug)}>
                      <span>{c.title}</span>{form.category === c.slug ? <b className="tick">✓</b> : <b>›</b>}
                    </button>
                  ))}
                  <button type="button" className="rg-row dashed" onClick={() => setShowMore(v => !v)}>
                    <span>{showMore ? 'Сховати' : 'Інші сфери…'}</span><b className={showMore ? 'rot' : ''}>›</b>
                  </button>
                  {showMore && MORE_CATEGORIES.map(c => (
                    <button key={c.slug} type="button" className={`rg-row small ${form.category === c.slug ? 'on' : ''}`} onClick={() => pickCategory(c.slug)}>
                      <span>{c.title}</span>{form.category === c.slug ? <b className="tick">✓</b> : <b>›</b>}
                    </button>
                  ))}
                </div>
              )}

              {step === 'type' && (
                <>
                  {([
                    { id: 'individual', title: 'Приватний майстер / ФОП', text: 'Працюєте самі. Простий календар без налаштувань команди.' },
                    { id: 'company', title: 'Салон / компанія', text: 'Кілька майстрів: графіки, зарплати, ролі й запити команди.' },
                  ] as const).map(o => (
                    <button key={o.id} type="button" className={`rg-option ${form.type === o.id ? 'on' : ''}`} onClick={() => pickCard('type', o.id)}>
                      <i className="radio" /><span><b>{o.title}</b><small>{o.text}</small></span>
                    </button>
                  ))}
                </>
              )}

              {step === 'contacts' && (
                <>
                  <label className="rg-field">
                    <span>Пошта закладу</span>
                    <input autoFocus type="email" inputMode="email" autoComplete="off" value={form.email} placeholder="studio@example.com"
                      className={err('email') ? 'bad' : ''} onChange={e => set('email', e.target.value)} onBlur={() => setBlurred(b => ({ ...b, email: true }))} />
                    {err('email') ? <em>{err('email')}</em> : <small>Сюди приходитимуть нові записи, скасування й відгуки клієнтів.</small>}
                  </label>
                  {/* Телефон - окремим блоком, а не всередині <label>: разом із
                      поясненням і перемикачем у мітці текст налазив на сусідні
                      елементи. Необовʼязковий. */}
                  <div className="rg-field">
                    <span>Робочий телефон <i>необовʼязково</i></span>
                    <div className={`rg-phone ${err('phone') ? 'bad' : ''}`}>
                      <b>+380</b>
                      <input inputMode="numeric" autoComplete="off" aria-label="Робочий телефон закладу" value={prettyPhone(digits9(form.phone))} placeholder="67 123 45 67"
                        onChange={e => set('phone', digits9(e.target.value))} onBlur={() => setBlurred(b => ({ ...b, phone: true }))} />
                    </div>
                    {err('phone') ? <em>{err('phone')}</em> : <small>Номер салону чи адміністратора — не ваш особистий.</small>}
                  </div>
                  {digits9(form.phone).length === 9 && (
                    <button type="button" className="rg-toggle" role="switch" aria-checked={form.showPhone} onClick={() => set('showPhone', !form.showPhone)}>
                      <span className={`sw ${form.showPhone ? 'on' : ''}`}><i /></span>
                      <span className="rg-toggle-text"><b>Показувати номер на сторінці</b><small>{form.showPhone ? 'Клієнти бачать номер закладу' : 'Номер прихований від клієнтів'}</small></span>
                    </button>
                  )}
                </>
              )}

              {step === 'workspace' && (
                <>
                  {([
                    { id: 'my_place', title: 'У закладі (студія)', text: 'Клієнти приходять за вашою адресою.' },
                    { id: 'client_place', title: 'Виїзне обслуговування', text: 'Ви приїжджаєте до клієнта. Вулиця не потрібна.' },
                  ] as const).map(o => (
                    <button key={o.id} type="button" className={`rg-option ${form.workspace === o.id ? 'on' : ''}`} onClick={() => pickCard('workspace', o.id)}>
                      <i className="radio" /><span><b>{o.title}</b><small>{o.text}</small></span>
                    </button>
                  ))}
                </>
              )}

              {step === 'address' && (
                <>
                  <label className="rg-field">
                    <span>{form.workspace === 'client_place' ? 'Місто, де ви працюєте' : 'Місто'}</span>
                    <input autoFocus value={form.city} placeholder="Наприклад: Київ" className={err('city') ? 'bad' : ''}
                      onChange={e => set('city', e.target.value)} onBlur={() => setBlurred(b => ({ ...b, city: true }))} />
                    {err('city') && <em>{err('city')}</em>}
                  </label>
                  {form.workspace === 'my_place' && (
                    <>
                      <label className="rg-field rg-addr">
                        <span>Вулиця та будинок {looking && <i>шукаємо на мапі…</i>}</span>
                        <input value={form.street} placeholder="вул. Івана Франка, 12" className={err('street') ? 'bad' : ''} autoComplete="off"
                          onChange={e => { set('street', e.target.value); setSuggestOpen(true); }}
                          onFocus={() => setSuggestOpen(true)}
                          onBlur={() => { setBlurred(b => ({ ...b, street: true })); setTimeout(() => setSuggestOpen(false), 150); }} />
                        {err('street') && <em>{err('street')}</em>}
                        {suggestOpen && suggest.length > 0 && form.street.trim() !== pickedStreet.current && (
                          <div className="rg-suggest" role="listbox">
                            {suggest.slice(0, 5).map(s => (
                              <button key={`${s.lat},${s.lng}`} type="button" role="option" aria-selected={false}
                                onMouseDown={e => { e.preventDefault(); pickSuggestion(s); }}>
                                <b>{s.title}</b>{s.subtitle && <small>{s.subtitle}</small>}
                              </button>
                            ))}
                          </div>
                        )}
                      </label>
                      <label className="rg-field">
                        <span>Поверх, кабінет <i>необовʼязково</i></span>
                        <input value={form.details} placeholder="2 поверх, кабінет 4" onChange={e => set('details', e.target.value)} />
                      </label>
                      <div className="rg-mapcap">Перевірте місце на мапі {form.coords ? <b>✓ мітку поставлено за адресою</b> : <i>— зʼявиться, щойно введете адресу</i>}</div>
                      <div className="rg-map"><LocationPicker hideSearch value={form.coords} city={form.city} height={230} onChange={c => set('coords', c)} /></div>
                    </>
                  )}
                </>
              )}

              {step === 'hours' && (
                <>
                  <div className="rg-presets">
                    {[
                      { l: 'Пн–Пт, 9–20', f: (i: number) => ({ open: i < 5, from: '09:00', to: '20:00' }) },
                      { l: 'Пн–Сб, 10–19', f: (i: number) => ({ open: i < 6, from: '10:00', to: '19:00' }) },
                      { l: 'Щодня, 10–20', f: () => ({ open: true, from: '10:00', to: '20:00' }) },
                    ].map(p => <button key={p.l} type="button" onClick={() => set('hours', DAYS.map((_, i) => p.f(i)))}>{p.l}</button>)}
                  </div>
                  <div className="rg-hours">
                    {form.hours.map((h, i) => (
                      <div key={i} className="rg-day">
                        <button type="button" role="switch" aria-checked={h.open} aria-label={DAYS[i]} className={`sw ${h.open ? 'on' : ''}`}
                          onClick={() => set('hours', form.hours.map((d, k) => (k === i ? { ...d, open: !d.open } : d)))}><i /></button>
                        <span className={`dn ${h.open ? '' : 'off'}`}>{DAYS[i]}</span>
                        {h.open ? (
                          <span className="tm">
                            <input type="time" value={h.from} onChange={e => set('hours', form.hours.map((d, k) => (k === i ? { ...d, from: e.target.value } : d)))} />
                            <i>—</i>
                            <input type="time" value={h.to} onChange={e => set('hours', form.hours.map((d, k) => (k === i ? { ...d, to: e.target.value } : d)))} />
                          </span>
                        ) : <span className="offl">Вихідний</span>}
                      </div>
                    ))}
                  </div>
                  {errors.hours && <em className="rg-err">{errors.hours}</em>}
                </>
              )}

              {step === 'services' && (
                <>
                  <div className="rg-rows">
                    {form.services.length === 0 && <div className="rg-empty">Поки порожньо — додайте першу послугу.</div>}
                    {form.services.map(s => (
                      <div key={s.id} className="rg-row static svc">
                        <span><b>{s.name}</b><small>{formatDuration(s.duration)} · <em>{s.price ? `${s.price.toLocaleString('uk-UA')} ₴` : 'безкоштовно'}</em></small></span>
                        <span className="acts">
                          <button type="button" aria-label="Змінити" onClick={() => setSvcModal(s)}>✎</button>
                          <button type="button" aria-label="Прибрати" className="danger" onClick={() => set('services', form.services.filter(x => x.id !== s.id))}>✕</button>
                        </span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="rg-outline" onClick={() => setSvcModal({ id: uid(), name: '', duration: 60, price: 0 })}>+ Додати послугу</button>
                </>
              )}

              {step === 'team' && (
                <>
                  <div className="rg-owner">Ви — власник і вже в команді. Додайте майстрів, які працюватимуть із вами.</div>
                  <div className="rg-rows">
                    {form.team.map(t => (
                      <div key={t.id} className="rg-row static svc">
                        <span className="av">{t.email[0].toUpperCase()}</span>
                        <span style={{ flex: 1 }}><b>{t.email}</b><small>{t.role === 'admin' ? 'Адміністратор' : 'Майстер'} · отримає запрошення</small></span>
                        <span className="acts"><button type="button" className="danger" aria-label="Прибрати" onClick={() => set('team', form.team.filter(x => x.id !== t.id))}>✕</button></span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="rg-outline" onClick={() => setInviteOpen(true)}>+ Запросити фахівця</button>
                </>
              )}

              {step === 'review' && (
                <div className="rg-rows">
                  {[
                    { s: 'name' as StepId, t: 'Заклад', v: `${form.name} · ${categoryTitle(form.category)}` },
                    { s: 'type' as StepId, t: 'Формат', v: form.type === 'individual' ? 'Приватний майстер' : 'Салон / компанія' },
                    { s: 'contacts' as StepId, t: 'Контакти', v: digits9(form.phone).length === 9 ? `${form.email} · +380 ${prettyPhone(digits9(form.phone))}` : form.email },
                    { s: 'address' as StepId, t: 'Адреса', v: form.workspace === 'client_place' ? `${form.city} · виїзд до клієнта` : [form.city, form.street, form.details].filter(Boolean).join(', ') },
                    { s: 'hours' as StepId, t: 'Графік', v: form.hours.map((h, i) => (h.open ? `${DAYS[i].slice(0, 2)} ${h.from}–${h.to}` : null)).filter(Boolean).join(', ') },
                    { s: 'services' as StepId, t: 'Послуги', v: `${form.services.length}: ${form.services.map(x => x.name).join(', ')}` },
                    ...(form.type === 'company' ? [{ s: 'team' as StepId, t: 'Команда', v: form.team.length ? `${form.team.length} запрошень` : 'Запросите пізніше' }] : []),
                  ].map(r => (
                    <button key={r.t} type="button" className={`rg-row sum ${valid(r.s) ? '' : 'bad'}`} onClick={() => go(steps.indexOf(r.s))}>
                      <span><small>{r.t}</small><b>{r.v}</b></span><i>Змінити</i>
                    </button>
                  ))}
                </div>
              )}

              {error && <div className="rg-error">{error}</div>}
            </div>

            {!autoAdvance && (
              <button type="button" className="rg-continue" disabled={saving || !valid(step)} onClick={next}>
                {saving ? 'Створюємо заклад…' : step === 'review' ? 'Створити заклад' : step === 'team' && !form.team.length ? 'Пропустити' : 'Продовжити'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Послуга */}
      {svcModal && (
        <div className="rg-overlay" onClick={() => setSvcModal(null)}>
          <div className="rg-modal" onClick={e => e.stopPropagation()}>
            <div className="mh"><h3>{form.services.some(s => s.id === svcModal.id) ? 'Редагувати послугу' : 'Нова послуга'}</h3><button type="button" onClick={() => setSvcModal(null)}>✕</button></div>
            <label className="rg-field"><span>Назва послуги</span>
              <input autoFocus value={svcModal.name} maxLength={80} placeholder="Наприклад: Чоловіча стрижка" onChange={e => setSvcModal({ ...svcModal, name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') saveService(); }} />
            </label>
            <div className="rg-field"><span>Тривалість</span>
              <div className="rg-durs">{DURATIONS.map(m => <button key={m} type="button" className={svcModal.duration === m ? 'on' : ''} onClick={() => setSvcModal({ ...svcModal, duration: m })}>{formatDuration(m)}</button>)}</div>
            </div>
            <label className="rg-field"><span>Ціна</span>
              <div className="rg-phone"><input inputMode="numeric" value={svcModal.price ? String(svcModal.price) : ''} placeholder="0"
                onChange={e => setSvcModal({ ...svcModal, price: Number(e.target.value.replace(/\D/g, '').slice(0, 6)) || 0 })}
                onKeyDown={e => { if (e.key === 'Enter') saveService(); }} /><b>₴</b></div>
            </label>
            <button type="button" className="rg-continue" disabled={svcModal.name.trim().length < 2} onClick={saveService}>Зберегти</button>
          </div>
        </div>
      )}

      {/* Запрошення */}
      {inviteOpen && (
        <div className="rg-overlay" onClick={() => setInviteOpen(false)}>
          <div className="rg-modal" onClick={e => e.stopPropagation()}>
            <div className="mh"><h3>Запросити фахівця</h3><button type="button" onClick={() => setInviteOpen(false)}>✕</button></div>
            <label className="rg-field"><span>Пошта фахівця</span>
              <input autoFocus type="email" value={invite.email} placeholder="master@example.com" onChange={e => setInvite({ ...invite, email: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') addInvite(); }} />
              {isEmail(invite.email) && invite.email.trim().toLowerCase() === form.email.trim().toLowerCase()
                ? <em>Це пошта закладу — вкажіть пошту самого фахівця</em>
                : <small>Він отримає лист із посиланням, імʼя й телефон заповнить сам.</small>}
            </label>
            <div className="rg-field"><span>Роль</span>
              <div className="rg-seg">
                {([['master', 'Майстер'], ['admin', 'Адміністратор']] as const).map(([v, l]) => (
                  <button key={v} type="button" className={invite.role === v ? 'on' : ''} onClick={() => setInvite({ ...invite, role: v })}>{l}</button>
                ))}
              </div>
            </div>
            <button type="button" className="rg-continue" disabled={!isEmail(invite.email) || invite.email.trim().toLowerCase() === form.email.trim().toLowerCase()} onClick={addInvite}>Додати</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .rg { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2.5rem 1rem 4rem; box-sizing: border-box;
          background: radial-gradient(60% 40% at 50% 0%, #EEF3EE 0%, rgba(238,243,238,0) 70%), #F8FAFC; color: #0f172a;
          /* Шрифт - той самий, що на бізнес-лендингу */
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }

        .rg-card { width: 100%; max-width: 520px; background: #fff; border-radius: 26px; border: 1px solid #e2e8f0; padding: 2.6rem 2.5rem 2.2rem; position: relative; overflow: hidden;
          box-shadow: 0 1px 2px rgba(15,23,42,.03), 0 24px 60px -30px rgba(15,23,42,.18); box-sizing: border-box; }
        .rg-progress { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: #f1f5f9; }
        .rg-progress i { display: block; height: 100%; background: linear-gradient(90deg, #8fae92, #0f172a); border-radius: 0 4px 4px 0; transition: width .5s cubic-bezier(.16,1,.3,1); }
        .rg-back { position: absolute; top: 1.3rem; left: 1.3rem; width: 38px; height: 38px; border-radius: 50%; border: none; background: transparent; color: #64748b; font-size: 1.15rem; cursor: pointer; transition: background-color .2s, color .2s; }
        .rg-back:hover { background: #f1f5f9; color: #0f172a; }

        .rg-head { text-align: center; margin: 0.4rem 0 1.8rem; }
        .rg-count { font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; }
        .rg-head h1, .rg-done h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 0.45rem; line-height: 1.2; }
        .rg-head p, .rg-done p { color: #64748b; font-size: 0.92rem; margin: 0; line-height: 1.5; }

        .rg-step { display: flex; flex-direction: column; animation: rgFwd .42s cubic-bezier(.16,1,.3,1); }
        .rg-step.back { animation-name: rgBack; }
        @keyframes rgFwd { from { opacity: 0; transform: translateX(28px); } }
        @keyframes rgBack { from { opacity: 0; transform: translateX(-28px); } }

        .rg-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.1rem; }
        .rg-field > span { font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
        .rg-field > span i { font-style: normal; text-transform: none; font-weight: 500; color: #94a3b8; letter-spacing: 0; }
        .rg-field input, .rg-modal input { width: 100%; height: 52px; padding: 0 1rem; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 14px; background: #fff;
          font-family: inherit; font-size: 1rem; font-weight: 500; color: #0f172a; outline: none; transition: border-color .2s, box-shadow .2s; }
        .rg-field input:focus, .rg-modal input:focus { border-color: #0f172a; box-shadow: 0 0 0 4px rgba(15,23,42,.06); }
        .rg-field input::placeholder { color: #94a3b8; font-weight: 400; }
        .rg-field input.bad, .rg-phone.bad { border-color: #ef4444; }
        .rg-field small { display: block; font-size: 0.82rem; color: #94a3b8; line-height: 1.45; }
        .rg-field em, .rg-err { font-style: normal; font-size: 0.82rem; color: #ef4444; font-weight: 500; }

        .rg-phone { display: flex; align-items: center; height: 52px; border: 1px solid #cbd5e1; border-radius: 14px; background: #fff; overflow: hidden; transition: border-color .2s, box-shadow .2s; }
        .rg-phone:focus-within { border-color: #0f172a; box-shadow: 0 0 0 4px rgba(15,23,42,.06); }
        .rg-phone b { padding: 0 0.9rem; color: #64748b; font-weight: 700; }
        .rg-phone input { border: none !important; box-shadow: none !important; height: 100% !important; padding: 0 1rem 0 0 !important; width: auto !important; flex: 1; min-width: 0; }

        .rg-toggle { display: flex; align-items: center; gap: 0.85rem; width: 100%; padding: 0.9rem 1rem; border-radius: 14px; border: 1.5px solid #e2e8f0; background: #fff; font-family: inherit; text-align: left; cursor: pointer; }
        .rg-toggle-text { flex: 1; min-width: 0; }
        .rg-toggle b { display: block; font-size: 0.93rem; color: #0f172a; }
        .rg-toggle small { display: block; font-size: 0.8rem; color: #64748b; margin-top: 1px; }
        .sw { width: 42px; height: 24px; border-radius: 12px; border: none; background: #e2e8f0; position: relative; flex-shrink: 0; padding: 0; cursor: pointer; transition: background-color .25s; display: inline-block; }
        .sw i { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: left .25s cubic-bezier(.16,1,.3,1); }
        .sw.on { background: #10b981; }
        .sw.on i { left: 20px; }

        .rg-rows { display: flex; flex-direction: column; gap: 0.55rem; }
        .rg-rows.scroll { max-height: 440px; overflow-y: auto; padding: 2px; margin: -2px; }
        .rg-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 1.05rem 1.2rem; border: 1.5px solid #e2e8f0; border-radius: 14px; background: #fff;
          font-family: inherit; font-size: 1rem; font-weight: 600; color: #0f172a; cursor: pointer; text-align: left; transition: all .18s; }
        .rg-row:hover:not(.static) { border-color: #cbd5e1; transform: translateY(-1px); box-shadow: 0 6px 16px -10px rgba(15,23,42,.2); }
        .rg-row:active:not(.static) { transform: scale(.99); }
        .rg-row.on { border-color: #0f172a; background: #f8fafc; box-shadow: 0 0 0 1px #0f172a; }
        .rg-row > b { color: #cbd5e1; font-size: 1.4rem; font-weight: 700; line-height: 1; transition: transform .2s; }
        .rg-row > b.rot { transform: rotate(90deg); }
        .rg-row > b.tick { color: #0f172a; font-size: 1rem; }
        .rg-row.dashed { border-style: dashed; background: #f8fafc; color: #64748b; }
        .rg-row.small { padding: 0.85rem 1.1rem; font-size: 0.95rem; animation: rgFwd .3s ease; }
        .rg-row.static { cursor: default; }
        .rg-row.svc { padding: 0.95rem 1.1rem; animation: rgFwd .3s ease; }
        .rg-row.svc b { display: block; font-size: 0.98rem; }
        .rg-row.svc small { display: block; font-size: 0.83rem; color: #64748b; font-weight: 500; margin-top: 2px; }
        .rg-row.svc small em { font-style: normal; color: #0f172a; font-weight: 700; }
        .rg-row .av { width: 38px; height: 38px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #475569; flex-shrink: 0; }
        .acts { display: flex; gap: 0.3rem; }
        .acts button { width: 34px; height: 34px; border-radius: 10px; border: none; background: #f8fafc; color: #64748b; cursor: pointer; font-size: 0.9rem; transition: all .15s; }
        .acts button:hover { background: #f1f5f9; color: #0f172a; }
        .acts button.danger:hover { background: #fef2f2; color: #ef4444; }
        .rg-empty { padding: 1.6rem; text-align: center; color: #94a3b8; font-size: 0.92rem; border: 1.5px dashed #e2e8f0; border-radius: 14px; }
        .rg-row.sum { padding: 0.85rem 1.1rem; font-weight: 500; }
        .rg-row.sum small { display: block; font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .rg-row.sum b { display: block; font-size: 0.93rem; font-weight: 600; color: #0f172a; margin-top: 2px; line-height: 1.4; }
        .rg-row.sum i { font-style: normal; font-size: 0.82rem; font-weight: 600; color: #8fae92; white-space: nowrap; }
        .rg-row.sum.bad { border-color: #fca5a5; }
        .rg-row .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px #d1fae5; }

        .rg-option { display: flex; gap: 1rem; align-items: flex-start; width: 100%; padding: 1.25rem; margin-bottom: 0.8rem; border: 1.5px solid #e2e8f0; border-radius: 16px; background: #fff;
          font-family: inherit; text-align: left; cursor: pointer; transition: all .2s; }
        .rg-option:hover { border-color: #cbd5e1; transform: translateY(-2px); box-shadow: 0 8px 20px -12px rgba(15,23,42,.2); }
        .rg-option.on { border-color: #0f172a; background: #f8fafc; box-shadow: 0 0 0 1px #0f172a; }
        .rg-option b { display: block; font-weight: 800; font-size: 1.05rem; color: #0f172a; margin-bottom: 0.2rem; }
        .rg-option small { display: block; color: #64748b; font-size: 0.87rem; line-height: 1.45; }
        .radio { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #cbd5e1; flex-shrink: 0; margin-top: 1px; position: relative; transition: border-color .2s; }
        .rg-option.on .radio { border-color: #0f172a; }
        .rg-option.on .radio::after { content: ''; position: absolute; inset: 4px; border-radius: 50%; background: #0f172a; animation: rgPop .25s cubic-bezier(.34,1.56,.64,1); }
        @keyframes rgPop { from { transform: scale(0); } }

        .rg-addr { position: relative; }
        .rg-suggest { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30; background: #fff; border-radius: 14px; padding: 6px;
          box-shadow: 0 18px 40px -12px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06); }
        .rg-suggest button { display: block; width: 100%; text-align: left; border: none; background: transparent; border-radius: 10px; padding: 0.6rem 0.75rem; cursor: pointer; font-family: inherit; }
        .rg-suggest button:hover, .rg-suggest button:focus { background: #f1f5f9; outline: none; }
        .rg-suggest b { display: block; font-size: 0.92rem; font-weight: 600; color: #0f172a; }
        .rg-suggest small { display: block; font-size: 0.78rem; color: #94a3b8; margin-top: 1px; }
        .rg-mapcap { font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem; }
        .rg-mapcap b { color: #10b981; text-transform: none; letter-spacing: 0; }
        .rg-mapcap i { font-style: normal; font-weight: 500; color: #94a3b8; text-transform: none; letter-spacing: 0; }
        .rg-map { border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; }

        .rg-presets { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
        .rg-presets button { height: 34px; padding: 0 0.85rem; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; font-family: inherit; font-size: 0.82rem; font-weight: 600; color: #475569; cursor: pointer; transition: all .15s; }
        .rg-presets button:hover { border-color: #0f172a; color: #0f172a; }
        .rg-hours { display: flex; flex-direction: column; }
        .rg-day { display: grid; grid-template-columns: 42px 1fr auto; align-items: center; gap: 0.9rem; padding: 0.7rem 0; border-bottom: 1px solid #f1f5f9; }
        .rg-day:last-child { border-bottom: none; }
        .dn { font-weight: 700; font-size: 0.95rem; }
        .dn.off { color: #94a3b8; }
        .tm { display: flex; align-items: center; gap: 0.45rem; }
        .tm i { font-style: normal; color: #cbd5e1; font-weight: 700; }
        .tm input { height: 38px; padding: 0 0.55rem; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: #0f172a; outline: none; }
        .tm input:focus { border-color: #0f172a; background: #fff; }
        .offl { color: #94a3b8; font-size: 0.9rem; font-weight: 600; }

        .rg-outline { width: 100%; height: 52px; margin-top: 0.8rem; border-radius: 14px; border: 1.5px dashed #cbd5e1; background: #fff; font-family: inherit; font-size: 0.95rem; font-weight: 700; color: #0f172a; cursor: pointer; transition: all .2s; }
        .rg-outline:hover { border-color: #0f172a; background: #f8fafc; }
        .rg-owner { font-size: 0.87rem; color: #3F5F45; background: #EEF5EE; border-radius: 12px; padding: 0.75rem 0.95rem; margin-bottom: 0.9rem; line-height: 1.45; }

        .rg-continue { width: 100%; height: 54px; margin-top: 1.6rem; border-radius: 15px; border: none; background: #111; color: #fff; font-family: inherit; font-size: 1.02rem; font-weight: 700; cursor: pointer; transition: transform .15s, opacity .2s, background-color .2s; }
        .rg-continue:hover:not(:disabled) { background: #000; }
        .rg-continue:active:not(:disabled) { transform: scale(.985); }
        .rg-continue:disabled { background: #e5e7eb; color: #9ca3af; cursor: default; }
        .rg-error { margin-top: 1rem; padding: 0.75rem 0.9rem; border-radius: 12px; background: #fef2f2; color: #b91c1c; font-size: 0.9rem; }
        .rg-warn { margin-top: 1rem; padding: 0.75rem 0.9rem; border-radius: 12px; background: #fffbeb; color: #92400e; font-size: 0.87rem; text-align: left; }

        .rg-done { align-items: center; text-align: center; padding-top: 0.5rem; }
        .rg-done .rg-rows { width: 100%; margin-top: 1.5rem; text-align: left; }
        .rg-check { animation: rgPop .5s cubic-bezier(.34,1.56,.64,1) .05s both; margin-bottom: 1rem; }
        .rg-check path { stroke-dasharray: 55; stroke-dashoffset: 55; animation: rgDraw .5s ease .4s forwards; }
        @keyframes rgDraw { to { stroke-dashoffset: 0; } }

        .rg-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(15,23,42,.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; animation: rgFade .2s ease; }
        @keyframes rgFade { from { opacity: 0; } }
        .rg-modal { width: 100%; max-width: 440px; background: #fff; border-radius: 22px; padding: 1.6rem; box-shadow: 0 30px 80px -20px rgba(15,23,42,.45); animation: rgUp .3s cubic-bezier(.16,1,.3,1); }
        @keyframes rgUp { from { opacity: 0; transform: translateY(14px) scale(.98); } }
        .mh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
        .mh h3 { font-size: 1.2rem; font-weight: 800; margin: 0; }
        .mh button { width: 32px; height: 32px; border-radius: 50%; border: none; background: #f1f5f9; color: #64748b; cursor: pointer; }
        .rg-modal .rg-continue { margin-top: 0.6rem; }
        .rg-durs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
        .rg-durs button { height: 38px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; font-family: inherit; font-size: 0.82rem; font-weight: 600; color: #0f172a; cursor: pointer; white-space: nowrap; }
        .rg-durs button.on { background: #111; border-color: #111; color: #fff; }
        .rg-seg { display: flex; background: #f1f5f9; border-radius: 12px; padding: 3px; }
        .rg-seg button { flex: 1; height: 40px; border: none; border-radius: 10px; background: transparent; font-family: inherit; font-size: 0.9rem; font-weight: 600; color: #475569; cursor: pointer; }
        .rg-seg button.on { background: #fff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

        @media (max-width: 560px) {
          .rg { padding: 1.5rem 0.75rem 3rem; }
          .rg-card { padding: 2.3rem 1.3rem 1.6rem; border-radius: 22px; }
          .rg-head h1, .rg-done h1 { font-size: 1.35rem; }
          .rg-back { top: 0.9rem; left: 0.8rem; }
          .rg-day { grid-template-columns: 42px 1fr; }
          .tm, .offl { grid-column: 2; }
          .rg-durs { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}
