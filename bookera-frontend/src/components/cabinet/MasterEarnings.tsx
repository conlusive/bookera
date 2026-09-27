'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Заробіток» майстра - окремо від розкладу.
 *
 * Розклад майстра - у «Календарі» (одразу з його записами й «Перервою»),
 * тож тут лише те, чого там немає: гроші, візити й рейтинг.
 *
 * Мова оформлення - як у «Аналітиці»: заголовок 1.75rem, білі картки з
 * рамкою #e5e5ea і радіусом 16px, палітра #1d1d1f / #86868b.
 *
 * Дані - ті самі, що бачить власник: розрахунок до виплати з розбивкою
 * й історія виплат. Майстер бачить лише свої, чужі - ні (сервер).
 */

const C = { text: '#1d1d1f', sub: '#86868b', border: '#e5e5ea', green: '#6F9273' };
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

const money = (n: number | null | undefined) => `${Math.round(Number(n || 0)).toLocaleString('uk-UA')} ₴`;
const dateOf = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
};
const plural = (n: number, a: string, b: string, c: string) =>
  n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;

export default function MasterEarnings({ businessId, userId }: { businessId: number; userId: string }) {
  const [preview, setPreview] = useState<any | null | undefined>(undefined);
  const [history, setHistory] = useState<any[] | null>(null);
  const [work, setWork] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const t = await getAuthToken();
      const [p, h, w] = await Promise.allSettled([
        api.getPayoutPreview(t, businessId, userId),
        api.listPayouts(t, businessId, userId),
        api.getMyWork(t, businessId),
      ]);
      if (!alive) return;
      setPreview(p.status === 'fulfilled' ? p.value : null);
      setHistory(h.status === 'fulfilled' ? (h.value as any[]).filter(x => x.status !== 'cancelled') : []);
      setWork(w.status === 'fulfilled' ? w.value : {});
    })();
    return () => { alive = false; };
  }, [businessId, userId]);

  const s30 = work?.stats_30d || {};
  const configured = preview && (Number(preview.commission_rate || 0) > 0 || Number(preview.fixed_part || 0) > 0);
  const paidTotal = (history || []).reduce((s, p) => s + Number(p.payout_amount || 0), 0);

  // Рядки розбивки - лише ті, що справді є в розрахунку
  const breakdown: { label: string; value: string; minus?: boolean }[] = [];
  if (preview) {
    breakdown.push({ label: `Виручка за ${preview.completed_appointments_count} ${plural(preview.completed_appointments_count, 'візит', 'візити', 'візитів')}`, value: money(preview.gross_revenue) });
    if (Number(preview.commission_rate || 0) > 0) breakdown.push({ label: `Ваш відсоток, ${Number(preview.commission_rate)}%`, value: money(preview.commission_part) });
    if (Number(preview.fixed_part || 0) > 0) breakdown.push({ label: 'Фіксована ставка', value: money(preview.fixed_part) });
    if (preview.materials_deducted && Number(preview.materials_cost || 0) > 0) breakdown.push({ label: 'Матеріали', value: `− ${money(preview.materials_cost)}`, minus: true });
    if (Number(preview.tax_amount || 0) > 0) breakdown.push({ label: `Податок, ${Number(preview.tax_rate)}%`, value: `− ${money(preview.tax_amount)}`, minus: true });
  }

  return (
    <div className="me">
      <div className="me-header">
        <h2>Заробіток</h2>
        {preview?.period_start && <div className="me-period">Поточний період з {dateOf(preview.period_start)}</div>}
      </div>

      <div className="me-kpis">
        <div className="me-kpi">
          <div className="me-kpi-l">До виплати</div>
          <div className="me-kpi-v" style={{ color: configured ? C.text : C.sub }}>{preview === undefined ? '—' : configured ? money(preview.payout_amount) : '—'}</div>
          <div className="me-kpi-s">{configured ? 'за поточний період' : 'оплату ще не налаштовано'}</div>
        </div>
        <div className="me-kpi">
          <div className="me-kpi-l">Виплачено всього</div>
          <div className="me-kpi-v">{history ? money(paidTotal) : '—'}</div>
          <div className="me-kpi-s">{history ? `${history.length} ${plural(history.length, 'виплата', 'виплати', 'виплат')}` : ' '}</div>
        </div>
        <div className="me-kpi">
          <div className="me-kpi-l">Виручка за 30 днів</div>
          <div className="me-kpi-v">{work ? money(s30.revenue) : '—'}</div>
          <div className="me-kpi-s">{work ? `${s30.visits ?? 0} ${plural(Number(s30.visits || 0), 'візит', 'візити', 'візитів')} · середній чек ${money(s30.avg_check)}` : ' '}</div>
        </div>
        <div className="me-kpi">
          <div className="me-kpi-l">Рейтинг</div>
          <div className="me-kpi-v">{work?.rating ? `${work.rating} ★` : '—'}</div>
          <div className="me-kpi-s">{work?.reviews ? `${work.reviews} ${plural(work.reviews, 'відгук', 'відгуки', 'відгуків')}` : 'поки без відгуків'}</div>
        </div>
      </div>

      <div className="me-grid">
        <section className="me-card">
          <div className="me-card-title">Як рахується</div>
          {preview === undefined ? (
            <div className="me-muted">Завантаження…</div>
          ) : !configured ? (
            <div className="me-muted" style={{ lineHeight: 1.55 }}>
              Салон ще не налаштував вашу оплату - відсоток від послуг чи фіксовану ставку. Щойно налаштує,
              тут зʼявиться розрахунок за кожен завершений візит.
            </div>
          ) : (
            <>
              <div className="me-card-sub">За завершені візити з {dateOf(preview.period_start)}</div>
              <div className="me-rows">
                {breakdown.map(r => (
                  <div key={r.label} className="me-row">
                    <span>{r.label}</span>
                    <b style={{ color: r.minus ? C.sub : C.text }}>{r.value}</b>
                  </div>
                ))}
                <div className="me-row me-total">
                  <span>До виплати</span>
                  <b>{money(preview.payout_amount)}</b>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="me-card">
          <div className="me-card-title">Історія виплат</div>
          {history === null ? (
            <div className="me-muted">Завантаження…</div>
          ) : history.length === 0 ? (
            <div className="me-muted">Виплат ще не було.</div>
          ) : (
            <div className="me-table">
              <div className="me-th"><span>Дата</span><span>Період</span><span>Візити</span><span style={{ textAlign: 'right' }}>Сума</span></div>
              {history.map(p => (
                <div key={p.id} className="me-tr">
                  <span>{dateOf(p.paid_at)}</span>
                  <span className="me-sub">{dateOf(p.period_start)} – {dateOf(p.period_end)}</span>
                  <span className="me-sub">{p.appointments_count}</span>
                  <b style={{ textAlign: 'right' }}>{money(p.payout_amount)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .me { font-family: inherit; padding: 1.5rem 3rem; flex-grow: 1; background: #fff; min-height: 100vh; width: 100%; box-sizing: border-box; color: ${C.text}; }
        .me-header { display: flex; justify-content: space-between; align-items: center; margin: 0.5rem 0 1.5rem; gap: 1rem; flex-wrap: wrap; }
        .me-header h2 { font-size: 1.75rem; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
        .me-period { font-size: 0.85rem; color: ${C.sub}; padding: 8px 14px; border: 1px solid ${C.border}; border-radius: 10px; }
        .me-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.25rem; }
        .me-kpi { background: #fff; border: 1px solid ${C.border}; border-radius: 16px; padding: 1.1rem 1.25rem; }
        .me-kpi-l { font-size: 0.8rem; color: ${C.sub}; font-weight: 500; }
        .me-kpi-v { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.5px; margin-top: 0.35rem; font-variant-numeric: tabular-nums; }
        .me-kpi-s { font-size: 0.75rem; color: ${C.sub}; margin-top: 0.15rem; min-height: 1em; }
        .me-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 1.25rem; align-items: start; }
        .me-card { background: #fff; border: 1px solid ${C.border}; border-radius: 16px; padding: 1.25rem 1.4rem; }
        .me-card-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.2rem; }
        .me-card-sub { font-size: 0.85rem; color: ${C.sub}; margin-bottom: 0.9rem; }
        .me-muted { font-size: 0.9rem; color: ${C.sub}; margin-top: 0.5rem; }
        .me-rows { display: flex; flex-direction: column; }
        .me-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.7rem 0; border-top: 1px solid #f2f2f4; font-size: 0.9rem; }
        .me-row:first-child { border-top: none; }
        .me-row span { color: ${C.sub}; }
        .me-row b { font-weight: 600; font-variant-numeric: tabular-nums; }
        .me-total { margin-top: 0.3rem; padding-top: 0.9rem; border-top: 1px solid ${C.border}; }
        .me-total span { color: ${C.text}; font-weight: 600; }
        .me-total b { font-size: 1.15rem; font-weight: 700; }
        .me-table { display: flex; flex-direction: column; margin-top: 0.6rem; }
        .me-th, .me-tr { display: grid; grid-template-columns: 1fr 1.6fr 0.6fr 1fr; gap: 0.75rem; align-items: center; padding: 0.7rem 0; font-size: 0.875rem; }
        .me-th { font-size: 0.78rem; color: ${C.sub}; font-weight: 600; border-bottom: 2px solid ${C.border}; padding-top: 0.2rem; }
        .me-tr { border-bottom: 1px solid #f2f2f4; }
        .me-tr b { font-weight: 600; font-variant-numeric: tabular-nums; }
        .me-sub { color: ${C.sub}; font-variant-numeric: tabular-nums; }
        @media (max-width: 1100px) {
          .me-grid { grid-template-columns: 1fr; }
          .me-kpis { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) { .me { padding: 1.25rem 1rem; } }
      `}</style>
    </div>
  );
}
