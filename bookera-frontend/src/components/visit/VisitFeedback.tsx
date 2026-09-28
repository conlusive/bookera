'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * «Як вам візит?» і чайові - на сторінці візиту, куди веде лист.
 *
 * Порядок продуманий:
 *   1. Оцінка. Якщо людина натиснула зірку в листі, вона вже обрана.
 *   2. Оцінка 4-5 -> «Подякувати майстрові?» з сумами одним дотиком.
 *      Оцінка 1-3 -> жодних прохань про гроші: «Шкода. Заклад уже знає
 *      й звʼяжеться з вами» (власник отримав лист).
 *   3. Чайові - 100% майстрові, один раз, «Ні, дякую» завжди поруч.
 */

const C = { ink: '#222222', sub: '#6B756A', line: '#E4EBE3', soft: '#F4FAF5', green: '#6F9273' };
const PRESETS = [50, 100, 200];

export default function VisitFeedback({ appointmentId, token, initialRate }: { appointmentId: number; token: string; initialRate?: number }) {
  const [info, setInfo] = useState<any>(null);
  const [rating, setRating] = useState(initialRate && initialRate >= 1 && initialRate <= 5 ? initialRate : 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<'rate' | 'tip' | 'sorry' | 'done'>('rate');
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api.getVisitFeedback(appointmentId, token).then(r => {
      setInfo(r);
      // Уже оцінено - одразу наступний крок
      if (r.review) setStep(r.review.rating >= 4 && r.tip.can_tip ? 'tip' : 'done');
    }).catch(() => setInfo(null));
  }, [appointmentId, token]);

  // Прокрутити до блоку, якщо прийшли з листа (#feedback)
  useEffect(() => {
    if (info && typeof window !== 'undefined' && window.location.hash === '#feedback') {
      document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [info]);

  if (!info || info.status !== 'completed') return null;

  const master = (info.master_name || '').split(' ')[0] || 'майстрові';
  const value = custom ? Number(custom) : amount;
  const valid = value >= info.tip.min && value <= info.tip.max;

  const sendReview = async () => {
    if (!rating) return;
    setBusy(true); setError('');
    try {
      await api.createVisitReview(appointmentId, token, rating, comment.trim() || undefined);
      setStep(rating >= 4 ? (info.tip.can_tip ? 'tip' : 'done') : 'sorry');
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
    <section id="feedback" className="vf">
      {step === 'rate' && (
        <>
          <h2>Як вам візит?</h2>
          <p className="vf-sub">{info.master_name ? `Оцініть роботу ${master} — це допоможе рости.` : 'Ваша оцінка допоможе закладу стати кращим.'}</p>
          <div className="vf-stars" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Оцінка">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} з 5`}
                className={(hover || rating) >= n ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>★</button>
            ))}
          </div>
          <div className="vf-hint">{['', 'Погано', 'Так собі', 'Нормально', 'Добре', 'Чудово'][hover || rating] || ' '}</div>
          {rating > 0 && (
            <>
              <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 500))}
                placeholder={rating >= 4 ? 'Що сподобалось? (необовʼязково)' : 'Що пішло не так? Заклад прочитає й звʼяжеться з вами'} />
              {error && <div className="vf-err">{error}</div>}
              <button type="button" className="vf-btn" disabled={busy} onClick={() => void sendReview()}>{busy ? 'Зберігаємо…' : 'Надіслати оцінку'}</button>
            </>
          )}
        </>
      )}

      {step === 'tip' && (
        <>
          <div className="vf-thanks">Дякуємо за оцінку!</div>
          <h2>Подякувати {master} чайовими?</h2>
          <p className="vf-sub">Уся сума — майстрові, без комісії закладу.</p>
          <div className="vf-amounts">
            {PRESETS.map(p => (
              <button key={p} type="button" className={!custom && amount === p ? 'on' : ''} onClick={() => { setAmount(p); setCustom(''); }}>{p} ₴</button>
            ))}
          </div>
          <input className="vf-custom" inputMode="numeric" value={custom} placeholder={`Інша сума, ${info.tip.min}–${info.tip.max} ₴`}
            onChange={e => setCustom(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} />
          {error && <div className="vf-err">{error}</div>}
          <button type="button" className="vf-btn" disabled={busy || !valid} onClick={() => void sendTip()}>
            {busy ? 'Надсилаємо…' : `Залишити ${valid ? Math.round(value) : ''} ₴`}
          </button>
          <button type="button" className="vf-skip" onClick={() => setStep('done')}>Ні, дякую</button>
        </>
      )}

      {step === 'sorry' && (
        <>
          <h2>Шкода, що так вийшло</h2>
          <p className="vf-sub">Заклад уже отримав вашу оцінку й звʼяжеться з вами, щоб усе виправити.</p>
        </>
      )}

      {step === 'done' && (
        <>
          <h2>Дякуємо!</h2>
          <p className="vf-sub">
            {info.tip.paid ? `Ваші ${Math.round(info.tip.paid)} ₴ уже в ${master}. ` : ''}
            Чекаємо на вас знову{info.business_name ? ` у ${info.business_name}` : ''}.
          </p>
          {info.business_slug && <a className="vf-btn vf-link" href={`/${info.business_slug}`}>Записатись знову</a>}
        </>
      )}

      <style jsx>{`
        .vf { margin-top: 1.5rem; padding: 1.4rem 1.3rem; border-radius: 16px; background: #fff; border: 1px solid ${C.line}; text-align: center; scroll-margin-top: 1rem; }
        .vf h2 { font-size: 1.2rem; font-weight: 700; color: ${C.ink}; margin: 0 0 0.35rem; letter-spacing: -0.01em; }
        .vf-sub { font-size: 0.9rem; color: ${C.sub}; margin: 0 0 1.1rem; line-height: 1.45; }
        .vf-thanks { font-size: 0.8rem; font-weight: 700; color: ${C.green}; margin-bottom: 0.4rem; }
        .vf-stars { display: flex; justify-content: center; gap: 0.35rem; }
        .vf-stars button { width: 48px; height: 48px; border: none; border-radius: 12px; background: #F7F7F5; color: #D8D8D2; font-size: 1.7rem; cursor: pointer; transition: transform .12s, color .12s, background-color .12s; }
        .vf-stars button.on { color: #F5A623; background: #FFF7E6; }
        .vf-stars button:active { transform: scale(.92); }
        .vf-hint { font-size: 0.8rem; color: ${C.sub}; min-height: 1.2em; margin: 0.45rem 0 0.9rem; }
        .vf textarea { width: 100%; box-sizing: border-box; height: 84px; resize: none; padding: 0.7rem 0.8rem; border-radius: 12px; border: 1px solid ${C.line}; font-family: inherit; font-size: 0.9rem; outline: none; text-align: left; }
        .vf textarea:focus, .vf-custom:focus { border-color: ${C.green}; box-shadow: 0 0 0 3px rgba(111,146,115,.15); }
        .vf-amounts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.5rem; }
        .vf-amounts button { height: 50px; border-radius: 12px; border: 1px solid ${C.line}; background: #fff; font-family: inherit; font-size: 1.05rem; font-weight: 700; color: ${C.ink}; cursor: pointer; }
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
