'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, RadarOverview, RadarPackage } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { notify } from '@/lib/feedback';
import { goToCheckout } from '@/lib/checkout';
import FormModal from '@/components/ui/FormModal';
import HelpTip from '@/components/ui/HelpTip';

/**
 * Маркетинг - три розділи, і кожен робить те, що написано:
 *
 *   Радар     платне просування у видачі BookEra. Пакети 7 / 14 / 30 днів,
 *             оплата карткою або балами. Ціни, ваги й позицію віддає сервер
 *             (app/services/ranking.py) - тут жодних власних чисел.
 *   Розсилки  лист клієнтам закладу. Скільки людей отримає - видно до
 *             відправки (той самий підрахунок, що й у самій розсилці).
 *   Посилання пряме посилання (клієнт безкоштовний) і посилання вітрини
 *             (з комісією), QR-код.
 *
 * Прибрано те, що не працювало: промокоди й «автоматизації» жили лише в
 * браузері (localStorage) і нічого не робили на сервері; «AI-текст» був
 * заготовкою із затримкою, що обіцяла неіснуючі знижки; «Радар» у
 * вкладці був вигаданою «аналітикою розкладу»; лояльність - заглушка.
 */

type View = 'radar' | 'campaigns' | 'links';
type Audience = 'all' | 'regular' | 'lapsed';

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: 'all', label: 'Усі', hint: 'Усі клієнти з поштою' },
  { id: 'regular', label: 'Постійні', hint: 'Від трьох візитів' },
  { id: 'lapsed', label: 'Давно не були', hint: 'Понад 60 днів і без майбутнього запису' },
];

const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
// Сервер віддає UTC без позначки пояса; без «Z» браузер вважав би це місцевим часом
const utc = (s?: string | null) => (s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`) : null);
const dayLabel = (s?: string | null) => utc(s)?.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) ?? '';
const daysWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дні' : 'днів');

const TEMPLATES = (name: string, link: string) => [
  { id: 'remind', label: 'Нагадування', subject: `Чекаємо вас у «${name}»`, message: `Вітаємо! Ви можете записатися до нас онлайн у зручний для вас час.${link ? `\n\nЗапис: ${link}` : ''}` },
  { id: 'missed', label: 'Давно не бачились', subject: `Ми скучили за вами, ${name}`, message: `Давно не бачились! На цьому тижні є вільні вікна — будемо раді вас бачити.${link ? `\n\nЗапис: ${link}` : ''}` },
  { id: 'news', label: 'Новинка', subject: `Новинка в «${name}»`, message: `У нас з'явилась нова послуга! Розкажемо деталі при записі.${link ? `\n\nЗапис: ${link}` : ''}` },
];

export default function MarketingTab({ business }: { business: any }) {
  const [view, setView] = useState<View>('radar');
  const bid = Number(business?.id);

  // --- Радар ---
  const [radar, setRadar] = useState<RadarOverview | null>(null);
  const [radarError, setRadarError] = useState('');
  const [confirm, setConfirm] = useState<{ pkg: RadarPackage; method: 'card' | 'points' } | null>(null);
  const [paying, setPaying] = useState(false);

  // --- Розсилки ---
  const [counts, setCounts] = useState<{ all: number; regular: number; lapsed: number; total_clients: number; without_email: number } | null>(null);
  const [audience, setAudience] = useState<Audience>('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendConfirm, setSendConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  // --- Посилання ---
  const [links, setLinks] = useState<{ direct_url: string; marketplace_url: string } | null>(null);
  const [copied, setCopied] = useState<'direct' | 'market' | null>(null);
  const [commission, setCommission] = useState(10);

  const loadRadar = useCallback(async () => {
    if (!bid) return;
    try {
      setRadar(await api.getRadarStatus(await getAuthToken(), bid));
      setRadarError('');
    } catch (err: any) {
      setRadarError(err?.message || 'Не вдалося завантажити Радар');
    }
  }, [bid]);

  useEffect(() => { void loadRadar(); }, [loadRadar]);

  useEffect(() => {
    if (!bid) return;
    void (async () => {
      try {
        const t = await getAuthToken();
        setCounts(await api.getCampaignAudience(t, bid));
      } catch { /* розсилка покаже порожні лічильники */ }
      try {
        setCommission(Number((await api.getMonetizationSummary(await getAuthToken(), bid)).commission_rate) || 10);
      } catch { /* лишається стандартні 10% */ }
      try {
        // Пряме посилання - окремим запитом: у публічній відповіді закладу
        // його токен був би доступний будь-кому й дозволяв уникати комісії.
        setLinks(await api.getDirectLink(await getAuthToken(), bid));
      } catch { /* посилання - не критична частина екрана */ }
    })();
  }, [bid]);

  const templates = useMemo(() => TEMPLATES(business?.name || 'наш заклад', links?.direct_url || ''), [business?.name, links?.direct_url]);
  const reachable = counts ? counts[audience] : 0;

  // ---------- дії ----------
  const pay = async () => {
    if (!confirm) return;
    setPaying(true);
    try {
      const t = await getAuthToken();
      if (confirm.method === 'points') {
        setRadar(await api.activateRadarWithPoints(t, bid, confirm.pkg.days));
        setConfirm(null);
      } else {
        const res = await api.checkoutRadar(t, bid, confirm.pkg.days);
        if (res.activated) { setRadar(res); setConfirm(null); }
        else if (!goToCheckout(res)) { setRadar(res); setConfirm(null); }
      }
    } catch (err: any) {
      notify(err?.message || 'Не вдалося підключити Радар', 'error');
    } finally {
      setPaying(false);
    }
  };

  const doSend = async () => {
    setSending(true);
    try {
      const res = await api.sendCampaign(await getAuthToken(), {
        business_id: bid,
        subject: subject.trim() || `Новини від ${business?.name}`,
        message: message.trim(),
        audience,
      });
      setSendConfirm(false);
      if (res.queued === 0) {
        notify('Жоден лист не надіслано: у цих клієнтів немає пошти', 'error');
      } else {
        setSent(`Надіслано листів: ${res.queued}${res.without_email ? ` · без пошти: ${res.without_email}` : ''}`);
        setMessage(''); setSubject('');
      }
    } catch (err: any) {
      setSendConfirm(false);
      notify(err?.message || 'Не вдалося надіслати розсилку', 'error');
    } finally {
      setSending(false);
    }
  };

  const askSend = () => {
    setSent(null);
    if (message.trim().length < 10) return notify('Напишіть хоча б кілька слів (від 10 символів)', 'error', { field: 'mk-message' });
    if (reachable === 0) return notify('Цій аудиторії нікому надсилати: у клієнтів немає пошти', 'error');
    setSendConfirm(true);
  };

  const copy = async (what: 'direct' | 'market', text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1600); }
    catch { notify('Не вдалося скопіювати — виділіть посилання вручну', 'error'); }
  };

  const qrUrl = links ? `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=12&data=${encodeURIComponent(links.direct_url)}` : '';
  const downloadQr = async () => {
    try {
      const blob = await (await fetch(qrUrl)).blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qr-${business?.slug || 'booking'}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { notify('Не вдалося завантажити QR-код', 'error'); }
  };

  const w = radar?.rules?.weights;
  const pos = radar?.position;
  const res = radar?.results;
  const trend = res ? res.storefront_bookings_30d - res.storefront_bookings_prev_30d : 0;

  const hint = view === 'radar'
    ? { t: 'Радар — це реклама', x: 'Заклад отримує бали в позиції та позначку «Реклама» на картці. Комісії за Радар немає: 10% беруться лише з клієнтів, що прийшли з вітрини.' }
    : view === 'campaigns'
      ? { t: 'Лист із вашим посиланням', x: 'Шаблони вже містять пряме посилання: клієнти, що запишуться з розсилки, не рахуються як клієнти вітрини — комісії за них немає.' }
      : { t: 'Куди ставити посилання', x: 'Шапка Instagram, Telegram, візитка, QR на дверях. Усі, хто запишеться за прямим посиланням, — ваші клієнти без комісії.' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', background: '#fff' }}>
      {/* --- ПАНЕЛЬ --- */}
      <div className="mk-toolbar">
        <div className="mk-seg" role="tablist">
          {([['radar', 'Радар'], ['campaigns', 'Розсилки'], ['links', 'Посилання']] as [View, string][]).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>
              {label}
              {id === 'radar' && radar?.active && <span className="mk-live" title="Радар активний" />}
            </button>
          ))}
        </div>
        {view === 'radar' && radar && (
          <div className="mk-balance" title="Бали заробляються за кожного нового клієнта екосистеми BookEra">
            Бали: <b>{radar.points_balance}</b>
          </div>
        )}
      </div>

      <div className="mk-grid">
        <div className="custom-scroll mk-main">
          <div className="mk-main-inner">

            {/* ================= РАДАР ================= */}
            {view === 'radar' && (
              radarError ? <div className="mk-empty"><b>Радар недоступний</b><span>{radarError}</span></div>
              : !radar ? <div className="mk-empty"><span>Завантаження…</span></div>
              : (
                <>
                  <section className={`mk-hero ${radar.active ? 'on' : ''}`}>
                    <div className="mk-hero-top">
                      <span className="mk-radar-ico" aria-hidden>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><line x1="12" y1="12" x2="18" y2="6" /></svg>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2>{radar.active ? 'Радар працює' : 'Радар вимкнено'}</h2>
                        <p>
                          {radar.active
                            ? <>До <b>{dayLabel(radar.expires_at)}</b> · залишилось {radar.days_left} {daysWord(radar.days_left)}</>
                            : 'Піднімає ваш заклад вище у видачі BookEra — там, де клієнти обирають, куди записатись.'}
                        </p>
                      </div>
                    </div>
                    {pos && (
                      <div className="mk-pos">
                        <div>
                          <small>Ваша позиція за якістю{radar.active ? '' : ' зараз'}</small>
                          <strong>№{pos.position}<span> із {pos.total}</span></strong>
                        </div>
                        {(radar.active ? pos.position_without_radar !== pos.position : pos.position_with_radar !== pos.position) && (
                          <>
                            <div className="mk-pos-arrow">→</div>
                            <div>
                              <small>{radar.active ? 'Без Радара було б' : 'З Радаром стане'}</small>
                              <strong className={radar.active ? 'mute' : 'up'}>
                                №{radar.active ? pos.position_without_radar : pos.position_with_radar}
                                <span> {radar.active ? `(−${pos.position_without_radar - pos.position})` : `(+${pos.position - pos.position_with_radar})`}</span>
                              </strong>
                            </div>
                          </>
                        )}
                        <HelpTip>Позиція серед закладів вашої категорії та міста за якістю (рейтинг і відгуки) й Радаром. Відстань до клієнта та вільні вікна в кожного свої, тож реальне місце у видачі змінюється.</HelpTip>
                      </div>
                    )}
                  </section>

                  <h3 className="mk-h">{radar.active ? 'Продовжити' : 'Підключити'}</h3>
                  <div className="mk-packages">
                    {radar.packages.map(p => (
                      <div key={p.days} className={`mk-pkg ${p.days === 14 ? 'best' : ''}`}>
                        {p.discount_percent > 0 && <span className="mk-save">−{p.discount_percent}%</span>}
                        <div className="mk-pkg-days">{p.days} {daysWord(p.days)}</div>
                        <div className="mk-pkg-price">{money(p.price_uah)}</div>
                        <div className="mk-pkg-day">{p.per_day_uah.toLocaleString('uk-UA')} ₴ за день</div>
                        <button type="button" className="clean-btn" onClick={() => setConfirm({ pkg: p, method: 'card' })}>Сплатити карткою</button>
                        <button type="button" className="mk-points" disabled={!p.can_afford_points} onClick={() => setConfirm({ pkg: p, method: 'points' })}
                          title={p.can_afford_points ? '' : `Не вистачає ${p.price_points - radar.points_balance} балів`}>
                          {p.price_points} балів
                        </button>
                      </div>
                    ))}
                  </div>

                  {w && (
                    <>
                      <h3 className="mk-h">Як це працює <HelpTip>Позицію в «Рекомендованих» рахує сервер: усі числа на цій сторінці взято з нього, а не з інтерфейсу.</HelpTip></h3>
                      <div className="mk-weights">
                        <div className="mk-bar" role="img" aria-label="Із чого складається позиція">
                          <i style={{ flex: w.quality_max, background: '#94a3b8' }} />
                          <i style={{ flex: w.proximity_max, background: '#38bdf8' }} />
                          <i style={{ flex: w.free_slots, background: '#2dd4bf' }} />
                          <i style={{ flex: w.radar, background: '#8b5cf6' }} />
                        </div>
                        <ul>
                          <li><i style={{ background: '#94a3b8' }} /><span>Якість</span><b>до {w.quality_max}</b><small>рейтинг і кількість відгуків</small></li>
                          <li><i style={{ background: '#38bdf8' }} /><span>Поруч</span><b>до {w.proximity_max}</b><small>чим ближче до клієнта, тим більше</small></li>
                          <li><i style={{ background: '#2dd4bf' }} /><span>Вільні вікна</span><b>{w.free_slots}</b><small>є вільний час сьогодні</small></li>
                          <li><i style={{ background: '#8b5cf6' }} /><span>Радар</span><b>+{w.radar}</b><small>лише поки пакет діє</small></li>
                        </ul>
                        <p>«Найближчі»: заклад із Радаром рахується ближчим на {radar.rules?.radar_bonus_km} км. «Рекомендовані»: до +{w.radar} балів із {w.quality_max + w.proximity_max + w.free_slots + w.radar} (слабшому закладу менше, сильнішому більше). Радар — підсилення, а не заміна якості: він піднімає вас над рівними, але не над помітно кращими. «Дешевші»: Радар не змінює ціну, але виграє, коли ціни однакові. У «Дешевших» і «Рекомендованих» спершу йдуть заклади в радіусі {radar.rules?.nearby_radius_km} км, і Радар додає ці {radar.rules?.radar_bonus_km} км «ближче»: з {Number(radar.rules?.nearby_radius_km) + Number(radar.rules?.radar_bonus_km)} км ви вже в блоці «Поруч із вами». На картці стоїть позначка «Реклама». Слабкий заклад не стане першим лише за гроші: якість важить найбільше.</p>
                      </div>
                    </>
                  )}

                  {radar.history.length > 0 && (
                    <>
                      <h3 className="mk-h">Історія</h3>
                      <table className="service-table">
                        <thead><tr><th>Період</th><th>Оплата</th><th style={{ textAlign: 'right' }}>Сума</th></tr></thead>
                        <tbody>
                          {radar.history.map((h, i) => (
                            <tr key={i} className="service-row" style={{ cursor: 'default' }}>
                              <td>{h.started_at ? `${dayLabel(h.started_at)} → ` : ''}{dayLabel(h.expires_at)}{h.is_active && <span className="mk-tag">зараз</span>}</td>
                              <td>{h.paid_with === 'points' ? 'Бали' : 'Картка'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{h.paid_with === 'points' ? `${h.points_spent} балів` : money(h.amount_uah || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )
            )}

            {/* ================= РОЗСИЛКИ ================= */}
            {view === 'campaigns' && (
              <>
                <div className="mk-pills">
                  {AUDIENCES.map(a => (
                    <button key={a.id} type="button" title={a.hint} className={`category-pill ${audience === a.id ? 'active' : ''}`} onClick={() => { setAudience(a.id); setSent(null); }}>
                      {a.label} <span className="mk-c">{counts ? counts[a.id] : '…'}</span>
                    </button>
                  ))}
                </div>

                <div className="mk-campaign">
                <div className="mk-form">
                  <div className="mk-chips">
                    <span>Шаблон:</span>
                    {templates.map(t => (
                      <button key={t.id} type="button" className="mk-chip" onClick={() => { setSubject(t.subject); setMessage(t.message); setSent(null); }}>{t.label}</button>
                    ))}
                  </div>
                  <label className="mk-lbl">Тема листа</label>
                  <input className="clean-input" maxLength={150} placeholder={`Новини від ${business?.name || 'закладу'}`} value={subject} onChange={e => setSubject(e.target.value)} />
                  <label className="mk-lbl">Текст <small>{message.trim().length}/3000</small></label>
                  <textarea className="clean-input mk-text" data-field="mk-message" maxLength={3000} placeholder="Що ви хочете сказати клієнтам?" value={message} onChange={e => { setMessage(e.target.value); setSent(null); }} />
                  <div className="mk-send-row">
                    <span className="mk-reach">
                      {counts ? <>Лист отримають: <b>{reachable}</b>{counts.without_email > 0 && <> · без пошти: {counts.without_email}</>}</> : 'Рахуємо аудиторію…'}
                    </span>
                    <button type="button" className="clean-btn" onClick={askSend}>Надіслати</button>
                  </div>
                  {sent && <div className="mk-ok" role="status">{sent}</div>}
                </div>

                <div className="mk-mail">
                  <small>Так виглядатиме лист</small>
                  <div className="mk-mail-card">
                    <div className="mk-mail-from">{business?.name}</div>
                    <div className="mk-mail-subj">{subject.trim() || `Новини від ${business?.name || 'закладу'}`}</div>
                    <div className="mk-mail-body">{message.trim() || 'Тут з’явиться ваш текст — пишіть ліворуч…'}</div>
                  </div>
                </div>
                </div>
              </>
            )}

            {/* ================= ПОСИЛАННЯ ================= */}
            {view === 'links' && (
              <div className="mk-links">
                <section className="mk-link-card">
                  <div className="mk-link-main">
                    <h3>Пряме посилання <span className="mk-free">без комісії</span></h3>
                    <p>Ваш особистий запис. Кладіть його в Instagram, Telegram, візитку — клієнт, що записався звідси, ваш назавжди.</p>
                    <div className="mk-url">
                      <input readOnly className="clean-input" value={links?.direct_url || 'Завантаження…'} onFocus={e => e.currentTarget.select()} />
                      <button type="button" className="clean-btn" disabled={!links} onClick={() => links && copy('direct', links.direct_url)}>{copied === 'direct' ? 'Скопійовано ✓' : 'Копіювати'}</button>
                    </div>
                  </div>
                  {links && (
                    <div className="mk-qr">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrUrl} alt="QR-код прямого посилання" width={132} height={132} />
                      <button type="button" className="mk-link-btn" onClick={() => void downloadQr()}>Завантажити QR</button>
                    </div>
                  )}
                </section>

                <section className="mk-link-card plain">
                  <div className="mk-link-main">
                    <h3>Посилання вітрини</h3>
                    <p>Так вас знаходять у каталозі BookEra. За клієнтів, що прийшли звідси, стягується комісія {commission}% із завершеного візиту.</p>
                    <div className="mk-url">
                      <input readOnly className="clean-input" value={links?.marketplace_url || 'Завантаження…'} onFocus={e => e.currentTarget.select()} />
                      <button type="button" className="clean-btn-ghost" disabled={!links} onClick={() => links && copy('market', links.marketplace_url)}>{copied === 'market' ? 'Скопійовано ✓' : 'Копіювати'}</button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {/* --- БІЧНА КОЛОНКА --- */}
        <aside className="mk-side">
          <div className="custom-scroll mk-side-scroll">
            {view === 'radar' && radar && (
              <>
                <div className="widget-card">
                  <div className="widget-title">Записи з вітрини</div>
                  <div className="mk-row"><span>За 30 днів</span><b>{res?.storefront_bookings_30d ?? 0}</b></div>
                  <div className="mk-row"><span>Попередні 30</span><b className="mute">{res?.storefront_bookings_prev_30d ?? 0}</b></div>
                  {res && trend !== 0 && <div className={`mk-delta ${trend > 0 ? 'up' : 'down'}`}>{trend > 0 ? '↑' : '↓'} {Math.abs(trend)} {trend > 0 ? 'більше' : 'менше'}, ніж раніше</div>}
                </div>
                <div className="widget-card">
                  <div className="widget-title">Бали</div>
                  <div className="mk-row"><span>На рахунку</span><b>{radar.points_balance}</b></div>
                  <p className="mk-note">+10 балів за кожного нового клієнта, якого ще не було в жодному закладі BookEra.</p>
                </div>
              </>
            )}
            {view === 'campaigns' && (
              <div className="widget-card">
                <div className="widget-title">Ваша база</div>
                <div className="mk-row"><span>Усього клієнтів</span><b>{counts?.total_clients ?? '—'}</b></div>
                <div className="mk-row"><span>З поштою</span><b>{counts ? counts.total_clients - counts.without_email : '—'}</b></div>
                <div className="mk-row"><span>Без пошти</span><b className="mute">{counts?.without_email ?? '—'}</b></div>
                <p className="mk-note">Розсилка йде листом на пошту. Номер телефону для неї не потрібен.</p>
              </div>
            )}
            {view === 'links' && (
              <div className="widget-card">
                <div className="widget-title">Звідки клієнт</div>
                <div className="mk-row"><span>Пряме посилання</span><b className="up">0%</b></div>
                <div className="mk-row"><span>Вітрина BookEra</span><b>{commission}%</b></div>
                <p className="mk-note">Комісія — із завершеного візиту, не за запис. Розсилки, QR і власні клієнти її не мають.</p>
              </div>
            )}
          </div>
          <div className="mk-hint">
            <div className="mk-hint-t">✦ Підказка</div>
            <b>{hint.t}</b>
            <p>{hint.x}</p>
          </div>
        </aside>
      </div>

      {/* --- ПІДТВЕРДЖЕННЯ ОПЛАТИ РАДАРА --- */}
      {confirm && (
        <FormModal open onClose={() => setConfirm(null)} width={460} title={radar?.active ? 'Продовжити Радар' : 'Підключити Радар'}
          subtitle={`${confirm.pkg.days} ${daysWord(confirm.pkg.days)} · ${confirm.method === 'card' ? money(confirm.pkg.price_uah) : `${confirm.pkg.price_points} балів`}`}
          primary={{ label: confirm.method === 'card' ? `Сплатити ${money(confirm.pkg.price_uah)}` : `Списати ${confirm.pkg.price_points} балів`, onClick: () => void pay(), loading: paying }}>
          <div className="mk-confirm">
            <p>{radar?.active
              ? <>Дні додадуться до поточного пакета: Радар діятиме до <b>{dayLabel(new Date((utc(radar.expires_at)?.getTime() ?? 0) + confirm.pkg.days * 86400000).toISOString())}</b>.</>
              : <>Радар запрацює одразу й діятиме {confirm.pkg.days} {daysWord(confirm.pkg.days)}.</>}</p>
            <p className="mk-note">{confirm.method === 'card'
              ? 'Оплата карткою на захищеній сторінці платіжної системи.'
              : `Після оплати на рахунку лишиться ${(radar?.points_balance ?? 0) - confirm.pkg.price_points} балів.`}</p>
          </div>
        </FormModal>
      )}

      {/* --- ПІДТВЕРДЖЕННЯ РОЗСИЛКИ --- */}
      {sendConfirm && (
        <FormModal open onClose={() => setSendConfirm(false)} width={460} title="Надіслати розсилку?"
          subtitle={`${AUDIENCES.find(a => a.id === audience)?.label} · ${reachable} ${reachable === 1 ? 'лист' : 'листів'}`}
          primary={{ label: 'Надіслати', onClick: () => void doSend(), loading: sending }}>
          <div className="mk-confirm">
            <div className="mk-preview">
              <small>Тема</small><b>{subject.trim() || `Новини від ${business?.name}`}</b>
              <small>Текст</small><p>{message.trim()}</p>
            </div>
            <p className="mk-note">Листи йдуть реальним людям, скасувати відправку неможливо.</p>
          </div>
        </FormModal>
      )}

      <style>{`
        .mk-toolbar { padding: 0.8rem 2rem 0.8rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid #f1f5f9; }
        .mk-seg { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
        .mk-seg button { position: relative; height: 32px; padding: 0 1rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s; }
        .mk-seg button:hover { color: #0f172a; }
        .mk-seg button.on { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .mk-live { position: absolute; top: 6px; right: 5px; width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
        .mk-balance { font-size: 0.85rem; color: #64748b; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 999px; padding: 0.35rem 0.9rem; }
        .mk-balance b { color: #0f172a; font-variant-numeric: tabular-nums; }

        .mk-grid { display: grid; grid-template-columns: 1fr 300px; flex: 1; min-height: 0; overflow: hidden; }
        .mk-main { overflow-y: auto; border-right: 1px solid #f1f5f9; }
        .mk-main-inner { width: 100%; padding: 1.4rem 2rem 2rem; box-sizing: border-box; }
        .mk-side { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .mk-side-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 1.2rem 1.2rem 0.4rem; }
        @media (max-width: 1100px) { .mk-grid { grid-template-columns: 1fr; } .mk-side { display: none; } .mk-main { border-right: none; } .mk-toolbar { padding: 0.8rem 1rem; } }

        /* ---- спільні класи: дослівно як у «Клієнтах» і «Складі» ---- */
        .clean-input { width: 100%; padding: 0.5rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; font-size: 0.85rem; color: #0f172a; outline: none; transition: all 0.2s; box-sizing: border-box; font-family: inherit; }
        .clean-input:focus { border-color: #436b49; background: #fff; }
        .clean-input::placeholder { color: #94a3b8; }
        .clean-btn { background: #0f172a; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; white-space: nowrap; }
        .clean-btn:hover { background: #1e293b; }
        .clean-btn:disabled { opacity: .5; cursor: not-allowed; }
        .clean-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; white-space: nowrap; }
        .clean-btn-ghost:hover { background: #f8fafc; color: #0f172a; }
        .category-pill { padding: 0.4rem 1.2rem; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink: 0; }
        .category-pill:hover { background: #f8fafc; color: #0f172a; }
        .category-pill.active { background: #0f172a; color: #fff; border-color: #0f172a; }
        .service-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; text-align: left; }
        .service-table th { padding: 0.75rem 1rem; color: #64748b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; background: #fff; }
        .service-table td { padding: 0.95rem 1rem; border-bottom: 1px solid #f8fafc; border-top: 1px solid transparent; vertical-align: middle; color: #0f172a; font-size: 0.9rem; }
        .widget-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 1.2rem; margin-bottom: 0.8rem; }
        .widget-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; }

        .mk-h { margin: 1.7rem 0 0.8rem; font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; }
        .mk-empty { text-align: center; padding: 4rem 2rem; color: #64748b; display: flex; flex-direction: column; gap: 0.4rem; }
        .mk-empty b { color: #0f172a; font-size: 1.05rem; }
        .mk-row { display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; font-size: 0.8rem; color: #475569; }
        .mk-row b { color: #0f172a; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
        .mk-row b.mute { color: #64748b; } .mk-row b.up { color: #059669; }
        .mk-delta { font-size: 0.75rem; font-weight: 600; margin-top: 0.3rem; } .mk-delta.up { color: #059669; } .mk-delta.down { color: #dc2626; }
        .mk-note { margin: 0.5rem 0 0; font-size: 0.75rem; line-height: 1.45; color: #64748b; }

        /* Радар */
        .mk-hero { border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.3rem 1.4rem; background: #fff; }
        .mk-hero.on { background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%); border-color: #ddd6fe; }
        .mk-hero-top { display: flex; align-items: center; gap: 1rem; }
        .mk-radar-ico { width: 52px; height: 52px; border-radius: 14px; background: #f1f5f9; color: #64748b; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .mk-hero.on .mk-radar-ico { background: #8b5cf6; color: #fff; }
        .mk-hero h2 { margin: 0 0 0.15rem; font-size: 1.25rem; font-weight: 800; color: #0f172a; }
        .mk-hero p { margin: 0; font-size: 0.9rem; color: #64748b; }
        .mk-hero p b { color: #0f172a; }
        .mk-pos { display: flex; align-items: center; gap: 1.2rem; margin-top: 1.1rem; padding-top: 1.1rem; border-top: 1px solid rgba(15,23,42,.07); flex-wrap: wrap; }
        .mk-pos small { display: block; font-size: 0.72rem; color: #94a3b8; font-weight: 600; margin-bottom: 0.15rem; }
        .mk-pos strong { font-size: 1.5rem; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
        .mk-pos strong span { font-size: 0.85rem; font-weight: 600; color: #64748b; }
        .mk-pos strong.up, .mk-pos strong.up span { color: #7c3aed; }
        .mk-pos strong.mute, .mk-pos strong.mute span { color: #94a3b8; }
        .mk-pos-arrow { color: #cbd5e1; font-size: 1.2rem; }

        .mk-packages { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.9rem; }
        @media (max-width: 760px) { .mk-packages { grid-template-columns: 1fr; } }
        .mk-pkg { position: relative; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.35rem; background: #fff; }
        .mk-pkg.best { border-color: #c4b5fd; box-shadow: 0 0 0 3px rgba(139,92,246,.08); }
        .mk-save { position: absolute; top: 0.9rem; right: 0.9rem; font-size: 0.7rem; font-weight: 700; color: #7c3aed; background: #f5f3ff; border-radius: 999px; padding: 0.15rem 0.5rem; }
        .mk-pkg-days { font-size: 0.85rem; font-weight: 700; color: #64748b; }
        .mk-pkg-price { font-size: 1.7rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
        .mk-pkg-day { font-size: 0.78rem; color: #94a3b8; margin-bottom: 0.6rem; }
        .mk-pkg .clean-btn { width: 100%; }
        .mk-points { width: 100%; padding: 0.55rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: .2s; }
        .mk-points:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
        .mk-points:disabled { color: #94a3b8; background: #f8fafc; cursor: not-allowed; }

        .mk-weights { border: 1px solid #f1f5f9; border-radius: 14px; padding: 1.1rem 1.2rem; background: #fff; }
        .mk-bar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; gap: 2px; margin-bottom: 1rem; }
        .mk-bar i { display: block; }
        .mk-weights ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem 1.6rem; }
        @media (max-width: 1400px) { .mk-weights ul { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 760px) { .mk-weights ul { grid-template-columns: 1fr; } }
        .mk-weights li { display: grid; grid-template-columns: 10px auto 1fr; column-gap: 0.55rem; align-items: baseline; font-size: 0.85rem; color: #0f172a; }
        .mk-weights li i { width: 8px; height: 8px; border-radius: 50%; align-self: center; }
        .mk-weights li b { justify-self: end; font-variant-numeric: tabular-nums; }
        .mk-weights li small { grid-column: 2 / 4; color: #94a3b8; font-size: 0.74rem; }
        .mk-weights p { margin: 1rem 0 0; font-size: 0.8rem; line-height: 1.5; color: #64748b; }
        .mk-tag { margin-left: 0.5rem; font-size: 0.68rem; font-weight: 700; color: #059669; background: #ecfdf5; border-radius: 999px; padding: 0.1rem 0.45rem; }

        /* Розсилки */
        .mk-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1.2rem; }
        .mk-c { margin-left: 0.35rem; font-size: 0.72rem; opacity: .6; font-variant-numeric: tabular-nums; }
        .mk-form { display: flex; flex-direction: column; gap: 0.35rem; }
        .mk-chips { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.6rem; font-size: 0.8rem; color: #94a3b8; }
        .mk-chip { padding: 0.3rem 0.8rem; border-radius: 999px; border: 1px dashed #cbd5e1; background: #fff; color: #475569; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: .2s; }
        .mk-chip:hover { border-style: solid; border-color: #94a3b8; color: #0f172a; }
        .mk-lbl { font-size: 0.78rem; font-weight: 600; color: #475569; margin-top: 0.5rem; display: flex; justify-content: space-between; }
        .mk-lbl small { color: #94a3b8; font-weight: 500; }
        .mk-campaign { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 2rem; align-items: start; }
        @media (max-width: 1250px) { .mk-campaign { grid-template-columns: 1fr; } }
        .mk-mail small { display: block; font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.6rem; }
        .mk-mail-card { border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; padding: 1.2rem 1.3rem; }
        .mk-mail-from { font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.3rem; }
        .mk-mail-subj { font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.9rem; padding-bottom: 0.9rem; border-bottom: 1px solid #e2e8f0; }
        .mk-mail-body { white-space: pre-wrap; font-size: 0.88rem; line-height: 1.6; color: #334155; min-height: 120px; overflow-wrap: anywhere; }
        .mk-text { min-height: 190px; resize: vertical; line-height: 1.5; }
        .mk-send-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 0.9rem; flex-wrap: wrap; }
        .mk-reach { font-size: 0.85rem; color: #64748b; } .mk-reach b { color: #0f172a; }
        .mk-ok { margin-top: 0.8rem; padding: 0.7rem 1rem; border-radius: 10px; background: #f0fdf4; color: #166534; font-size: 0.85rem; font-weight: 600; }

        /* Посилання */
        .mk-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 1rem; align-items: start; }
        .mk-link-card { display: flex; gap: 1.4rem; align-items: center; justify-content: space-between; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.3rem 1.4rem; background: #fff; flex-wrap: wrap; }
        .mk-link-card.plain { background: #f8fafc; }
        .mk-link-main { flex: 1; min-width: 260px; }
        .mk-link-main h3 { margin: 0 0 0.3rem; font-size: 1.05rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.6rem; }
        .mk-link-main p { margin: 0 0 0.9rem; font-size: 0.85rem; line-height: 1.5; color: #64748b; }
        .mk-free { font-size: 0.7rem; font-weight: 700; color: #059669; background: #ecfdf5; border-radius: 999px; padding: 0.15rem 0.55rem; }
        .mk-url { display: flex; gap: 0.5rem; }
        .mk-qr { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .mk-qr img { border-radius: 10px; border: 1px solid #f1f5f9; background: #fff; }
        .mk-link-btn { border: none; background: none; font-size: 0.78rem; font-weight: 600; color: #436b49; cursor: pointer; }

        /* підказка - закріплена внизу колонки */
        .mk-hint { flex: none; margin: 0.4rem 1.2rem 1.2rem; background: #f5f3ff; border: 1px dashed #c4b5fd; border-radius: 12px; padding: 1rem; }
        .mk-hint-t { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #7c3aed; margin-bottom: 0.6rem; }
        .mk-hint b { display: block; font-weight: 700; color: #5b21b6; font-size: 0.85rem; margin-bottom: 0.3rem; }
        .mk-hint p { font-size: 0.75rem; color: #6d28d9; line-height: 1.45; margin: 0; }

        .mk-confirm p { margin: 0 0 0.6rem; font-size: 0.9rem; line-height: 1.5; color: #334155; }
        .mk-preview { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 0.9rem 1rem; margin-bottom: 0.8rem; }
        .mk-preview small { display: block; font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-top: 0.4rem; }
        .mk-preview small:first-child { margin-top: 0; }
        .mk-preview b { font-size: 0.9rem; color: #0f172a; }
        .mk-preview p { white-space: pre-wrap; margin: 0.1rem 0 0; max-height: 160px; overflow: auto; font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
