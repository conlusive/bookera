'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * «Як вам візит?» і чайові - спільний блок для сторінки візиту (куди веде
 * лист) і профілю («Оцінити»). Один блок - одна логіка скрізь.
 *
 *   1. Дві оцінки: МАЙСТЕР і ЗАКЛАД окремо - щоб оцінювати обʼєктивно.
 *      Майстер міг зробити чудово, а в салоні було брудно й довелось
 *      чекати, - і навпаки. Зірка з листа заповнює обидві, їх можна змінити.
 *   2. Майстер 4-5 -> «Подякувати чайовими?» як у ресторані: 5 / 10 / 15%
 *      від вартості візиту або своя сума, «Ні, дякую» поруч.
 *      Будь-яка оцінка 1-3 -> «Заклад звʼяжеться з вами» (власник уже
 *      отримав лист). Якщо майстер 5, а заклад 2 - чайові майстрові все
 *      одно пропонуємо: він не винен.
 *   3. Чайові - 100% майстрові, один раз.
 */

const C = { ink: '#222222', sub: '#6B756A', line: '#E4EBE3', soft: '#F4FAF5', green: '#6F9273' };
const LABELS = ['', 'Погано', 'Так собі', 'Нормально', 'Добре', 'Чудово'];

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="vf-row">
      <div className="vf-row-label">{label}</div>
      <div className="vf-stars" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} з 5`}
            className={(hover || value) >= n ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>★</button>
        ))}
      </div>
      <div className="vf-row-hint">{LABELS[hover || value] || ' '}</div>
      <style jsx>{`
        .vf-row { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; align-items: center; gap: 0.1rem 0.75rem; padding: 0.75rem 0; border-top: 1px solid ${C.line}; text-align: left; }
        .vf-row:first-child { border-top: none; }
        .vf-row-label { font-size: 0.95rem; font-weight: 600; color: ${C.ink}; }
        .vf-row-hint { grid-column: 2; text-align: right; font-size: 0.75rem; color: ${C.sub}; min-height: 1em; }
        .vf-stars { display: flex; gap: 0.2rem; grid-row: 1 / span 2; grid-column: 2; align-self: start; }
        .vf-stars button { width: 40px; height: 40px; border: none; border-radius: 10px; background: #F7F7F5; color: #D8D8D2; font-size: 1.45rem; cursor: pointer; transition: transform .12s, color .12s, background-color .12s; }
        .vf-stars button.on { color: #F5A623; background: #FFF7E6; }
        .vf-stars button:active { transform: scale(.92); }
        @media (max-width: 420px) { .vf-stars button { width: 36px; height: 36px; font-size: 1.3rem; } }
      `}</style>
    </div>
  );
}

export default function VisitFeedback({ appointmentId, token, initialRate, onReviewed, compact = false }: {
  appointmentId: number; token: string; initialRate?: number; onReviewed?: () => void; compact?: boolean;
}) {
  const start = initialRate && initialRate >= 1 && initialRate <= 5 ? initialRate : 0;
  const [info, setInfo] = useState<any>(null);
  const [masterR, setMasterR] = useState(start);
  const [salonR, setSalonR] = useState(start);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<'rate' | 'tip' | 'sorry' | 'done'>('rate');
  const [salonLow, setSalonLow] = useState(false);
  const [pick, setPick] = useState<{ kind: 'pct'; v: number } | { kind: 'custom' }>({ kind: 'pct', v: 10 });
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api.getVisitFeedback(appointmentId, token).then(r => {
      setInfo(r);
      if (r.review) {
        // Уже оцінено - одразу наступний крок
        setStep((r.review.master_rating || r.review.rating) >= 4 && r.tip.can_tip ? 'tip' : 'done');
        setSalonLow((r.review.salon_rating || r.review.rating) <= 3);
      }
    }).catch(() => setInfo(null));
  }, [appointmentId, token]);

  useEffect(() => {
    if (info && !compact && typeof window !== 'undefined' && window.location.hash === '#feedback') {
      document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [info, compact]);

  if (!info || info.status !== 'completed') return null;

  const hasMaster = !!info.master_name;
  const master = (info.master_name || '').split(' ')[0] || 'майстрові';
  const price = Number(info.price || 0);
  // Як у ресторані: відсоток, округлений до 5 ₴ (не менше мінімуму)
  const pctAmount = (p: number) => Math.max(info.tip.min, Math.round((price * p) / 100 / 5) * 5);
  const usePercents = price >= info.tip.min * 4;
  const fixed = [50, 100, 200];
  const value = pick.kind === 'custom' ? Number(custom || 0) : usePercents ? pctAmount(pick.v) : pick.v;
  const valid = value >= info.tip.min && value <= info.tip.max;
  const canSend = salonR > 0 && (!hasMaster || masterR > 0);

  const sendReview = async () => {
    if (!canSend) return;
    setBusy(true); setError('');
    try {
      await api.createVisitReview(appointmentId, token, {
        master_rating: hasMaster ? masterR : undefined, salon_rating: salonR, comment: comment.trim() || undefined,
      });
      onReviewed?.();
      const low = salonR <= 3 || (hasMaster && masterR <= 3);
      setSalonLow(salonR <= 3);
      if (hasMaster && masterR >= 4 && info.tip.can_tip) setStep('tip');
      else setStep(low ? 'sorry' : 'done');
    } catch (e: any) {
      setError(e?.message || 'Не вдалося зберегти оцінку');
    } finally {
      setBusy(false);
    }
  };

  const sendTip = async () => {
    if (!valid) return;
    setBusy(true); setError('');
    try {
      const r = await api.tipMaster(appointmentId, token, Math.round(value));
      if (r.checkout_url) { window.location.href = r.checkout_url; return; }
      setInfo((i: any) => ({ ...i, tip: { ...i.tip, paid: r.amount, can_tip: false } }));
      setStep('done');
    } catch (e: any) {
      setError(e?.message || 'Не вдалося надіслати чайові');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="feedback" className={`vf ${compact ? 'compact' : ''}`}>
      {step === 'rate' && (
        <>
          <h2>Як вам візит?</h2>
          <p className="vf-sub">Оцініть окремо майстра й заклад — так оцінка буде чесною до обох.</p>
          <div className="vf-rows">
            {hasMaster && <Stars label={`Майстер · ${info.master_name}`} value={masterR} onChange={setMasterR} />}
            <Stars label={`Заклад${info.business_name ? ` · ${info.business_name}` : ''}`} value={salonR} onChange={setSalonR} />
          </div>
          {canSend && (
            <>
              <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 500))}
                placeholder={Math.min(salonR, hasMaster ? masterR : 5) <= 3 ? 'Що пішло не так? Заклад прочитає й звʼяжеться з вами' : 'Що сподобалось? (необовʼязково)'} />
              {error && <div className="vf-err">{error}</div>}
              <button type="button" className="vf-btn" disabled={busy} onClick={() => void sendReview()}>{busy ? 'Зберігаємо…' : 'Надіслати оцінку'}</button>
            </>
          )}
        </>
      )}

      {step === 'tip' && (
        <>
          <div className="vf-thanks">Дякуємо за оцінку!</div>
          {salonLow && <div className="vf-note">Заклад отримав ваш відгук і звʼяжеться з вами.</div>}
          <h2>Подякувати {master} чайовими?</h2>
          <p className="vf-sub">{usePercents ? `Від вартості візиту ${Math.round(price).toLocaleString('uk-UA')} ₴. ` : ''}Уся сума — майстрові, без комісії закладу.</p>
          <div className="vf-amounts">
            {(usePercents ? info.tip.percents : fixed).map((v: number) => {
              const on = pick.kind === 'pct' && pick.v === v;
              return (
                <button key={v} type="button" className={on ? 'on' : ''} onClick={() => { setPick({ kind: 'pct', v }); setCustom(''); }}>
                  {usePercents ? <><b>{v}%</b><small>{pctAmount(v)} ₴</small></> : <b>{v} ₴</b>}
                </button>
              );
            })}
          </div>
          <input className={`vf-custom ${pick.kind === 'custom' ? 'on' : ''}`} inputMode="numeric" value={custom}
            placeholder={`Своя сума, ₴ (${info.tip.min}–${info.tip.max})`}
            onFocus={() => setPick({ kind: 'custom' })}
            onChange={e => { setPick({ kind: 'custom' }); setCustom(e.target.value.replace(/[^0-9]/g, '').slice(0, 5)); }} />
          {error && <div className="vf-err">{error}</div>}
          <button type="button" className="vf-btn" disabled={busy || !valid} onClick={() => void sendTip()}>
            {busy ? 'Надсилаємо…' : valid ? `Залишити ${Math.round(value)} ₴` : 'Вкажіть суму'}
          </button>
          <button type="button" className="vf-skip" onClick={() => setStep(salonLow ? 'sorry' : 'done')}>Ні, дякую</button>
        </>
      )}

      {step === 'sorry' && (
        <>
          <h2>Дякуємо за чесність</h2>
          <p className="vf-sub">Шкода, що не все пройшло добре. Заклад уже отримав вашу оцінку й звʼяжеться з вами, щоб виправити.</p>
          {info.tip.paid ? <p className="vf-sub">Ваші {Math.round(info.tip.paid)} ₴ уже в {master}.</p> : null}
        </>
      )}

      {step === 'done' && (
        <>
          <h2>Дякуємо!</h2>
          <p className="vf-sub">
            {info.tip.paid ? `Ваші ${Math.round(info.tip.paid)} ₴ уже в ${master}. ` : ''}
            Чекаємо на вас знову{info.business_name ? ` у ${info.business_name}` : ''}.
          </p>
          {info.business_slug && !compact && <a className="vf-btn vf-link" href={`/${info.business_slug}`}>Записатись знову</a>}
        </>
      )}

      <style jsx>{`
        .vf { margin-top: 1.5rem; padding: 1.4rem 1.3rem; border-radius: 16px; background: #fff; border: 1px solid ${C.line}; text-align: center; scroll-margin-top: 1rem; }
        .vf.compact { margin-top: 0; border: none; padding: 0; }
        .vf h2 { font-size: 1.2rem; font-weight: 700; color: ${C.ink}; margin: 0 0 0.35rem; letter-spacing: -0.01em; }
        .vf-sub { font-size: 0.9rem; color: ${C.sub}; margin: 0 0 1rem; line-height: 1.45; }
        .vf-thanks { font-size: 0.8rem; font-weight: 700; color: ${C.green}; margin-bottom: 0.4rem; }
        .vf-note { font-size: 0.82rem; color: ${C.sub}; background: ${C.soft}; border-radius: 10px; padding: 0.5rem 0.7rem; margin-bottom: 0.8rem; }
        .vf-rows { margin-bottom: 0.9rem; }
        .vf textarea { width: 100%; box-sizing: border-box; height: 84px; resize: none; padding: 0.7rem 0.8rem; border-radius: 12px; border: 1px solid ${C.line}; font-family: inherit; font-size: 0.9rem; outline: none; text-align: left; }
        .vf textarea:focus, .vf-custom:focus, .vf-custom.on { border-color: ${C.green}; box-shadow: 0 0 0 3px rgba(111,146,115,.15); }
        .vf-amounts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.5rem; }
        .vf-amounts button { height: 58px; border-radius: 12px; border: 1px solid ${C.line}; background: #fff; font-family: inherit; color: ${C.ink}; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
        .vf-amounts button b { font-size: 1.05rem; font-weight: 700; }
        .vf-amounts button small { font-size: 0.78rem; color: ${C.sub}; }
        .vf-amounts button.on { border: 2px solid ${C.green}; background: ${C.soft}; }
        .vf-custom { width: 100%; box-sizing: border-box; height: 44px; padding: 0 0.8rem; border-radius: 12px; border: 1px solid ${C.line}; font-family: inherit; font-size: 0.9rem; outline: none; text-align: center; }
        .vf-btn { display: block; width: 100%; height: 48px; margin-top: 0.9rem; border-radius: 12px; border: none; background: ${C.ink}; color: #fff; font-family: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
        .vf-btn:disabled { opacity: .45; cursor: default; }
        .vf-link { line-height: 48px; text-decoration: none; }
        .vf-skip { margin-top: 0.5rem; border: none; background: none; font-family: inherit; font-size: 0.85rem; color: ${C.sub}; cursor: pointer; padding: 0.4rem; }
        .vf-err { font-size: 0.85rem; color: #A83934; margin-top: 0.6rem; }
      `}</style>
    </section>
  );
}
