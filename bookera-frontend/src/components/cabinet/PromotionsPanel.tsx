'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, PromotionInput, PromotionRow } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { notify } from '@/lib/feedback';
import FormModal, { Field, FormSection } from '@/components/ui/FormModal';

/**
 * Акції закладу: знижка у відсотках на одну, кілька чи всі послуги - увесь день або в певні години й дні.
 * Знижку рахує сервер при записі, клієнт бачить її на вітрині й у формі запису.
 */

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const PERCENTS = [10, 15, 20, 30, 50];

const empty = (): PromotionInput => ({
  name: '', discount_percent: 10, service_ids: null, weekdays: null, time_from: null, time_to: null,
  date_from: null, date_to: null, is_active: true,
});

const presets: { title: string; text: string; make: () => PromotionInput }[] = [
  { title: 'Знижка на послугу', text: '−10% на одну з ваших послуг', make: () => ({ ...empty(), name: 'Знижка 10%', discount_percent: 10 }) },
  { title: 'Щасливі години', text: 'Щодня з 8:00 до 10:00 − 50%', make: () => ({ ...empty(), name: 'Щасливі години', discount_percent: 50, time_from: '08:00', time_to: '10:00' }) },
  { title: 'Будні вдень', text: 'Пн–Пт з 12:00 до 16:00 − 20%', make: () => ({ ...empty(), name: 'Будній день', discount_percent: 20, weekdays: [0, 1, 2, 3, 4], time_from: '12:00', time_to: '16:00' }) },
];

export default function PromotionsPanel({ businessId, services }: { businessId: number; services: any[] }) {
  const [rows, setRows] = useState<PromotionRow[] | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; form: PromotionInput } | null>(null);
  const [saving, setSaving] = useState(false);
  // «Обрані» можна вибрати ще до того, як відмічено першу послугу
  const [pickServices, setPickServices] = useState(false);
  const openEditor = (id: number | null, f: PromotionInput) => { setPickServices(!!f.service_ids?.length); setEditing({ id, form: f }); };

  const load = useCallback(async () => {
    try { setRows(await api.listPromotions(await getAuthToken(), businessId)); }
    catch (e: any) { setRows([]); notify(e?.message || 'Не вдалося завантажити акції', 'error'); }
  }, [businessId]);
  useEffect(() => { void load(); }, [load]);

  const serviceName = useCallback((id: number) => services.find((s: any) => Number(s.id) === id)?.name || `№${id}`, [services]);
  const scope = (p: PromotionInput) => !p.service_ids?.length ? 'Усі послуги' : p.service_ids.map(serviceName).join(', ');
  const when = (p: PromotionInput) => {
    const parts: string[] = [];
    parts.push(p.weekdays?.length ? p.weekdays.map(d => DAYS[d]).join(', ') : 'щодня');
    if (p.time_from && p.time_to) parts.push(`${p.time_from}–${p.time_to}`);
    if (p.date_from || p.date_to) {
      const f = (d: string) => new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      parts.push(`${p.date_from ? `з ${f(p.date_from)}` : ''}${p.date_from && p.date_to ? ' ' : ''}${p.date_to ? `до ${f(p.date_to)}` : ''}`);
    }
    return parts.join(' · ');
  };

  const form = editing?.form;
  const patch = (v: Partial<PromotionInput>) => setEditing(e => (e ? { ...e, form: { ...e.form, ...v } } : e));
  const hasHours = !!(form?.time_from || form?.time_to);

  const problem = useMemo(() => {
    if (!form) return '';
    if (form.name.trim().length < 2) return 'Дайте акції назву';
    if (pickServices && !form.service_ids?.length) return 'Оберіть хоча б одну послугу або виберіть «Усі послуги»';
    if (hasHours && (!form.time_from || !form.time_to)) return 'Вкажіть початок і кінець годин';
    if (form.date_from && form.date_to && form.date_to < form.date_from) return 'Кінець акції раніше за початок';
    return '';
  }, [form, hasHours, pickServices]);

  const save = async () => {
    if (!editing || problem) return;
    setSaving(true);
    try {
      const t = await getAuthToken();
      const body = { ...editing.form, name: editing.form.name.trim(), service_ids: editing.form.service_ids?.length ? editing.form.service_ids : null };
      if (editing.id) await api.updatePromotion(t, editing.id, body); else await api.createPromotion(t, businessId, body);
      setEditing(null);
      await load();
      notify('Акцію збережено', 'success');
    } catch (e: any) { notify(e?.message || 'Не вдалося зберегти акцію', 'error'); }
    finally { setSaving(false); }
  };

  const toggle = async (p: PromotionRow) => {
    try {
      const { id, label, ...rest } = p; void label;
      await api.updatePromotion(await getAuthToken(), id, { ...rest, is_active: !p.is_active });
      await load();
    } catch (e: any) { notify(e?.message || 'Не вдалося змінити акцію', 'error'); }
  };

  const remove = async () => {
    if (!editing?.id) return;
    try { await api.deletePromotion(await getAuthToken(), editing.id); setEditing(null); await load(); notify('Акцію видалено', 'success'); }
    catch (e: any) { notify(e?.message || 'Не вдалося видалити', 'error'); }
  };

  const preview = form ? `−${form.discount_percent}% · ${scope(form).toLowerCase() === 'усі послуги' ? 'на всі послуги' : `на: ${scope(form)}`} · ${when(form)}` : '';

  return (
    <div className="pr">
      <div className="pr-head">
        <div>
          <h2>Акції</h2>
          <p>Знижка на послугу чи на все одразу, на весь день або в певні години. Клієнти бачать її на вашій сторінці й у запису.</p>
        </div>
        {rows && rows.length > 0 && <button type="button" className="clean-btn" onClick={() => openEditor(null, empty())}>+ Нова акція</button>}
      </div>

      {rows === null ? (
        <div className="pr-empty"><span>Завантаження…</span></div>
      ) : rows.length === 0 ? (
        <div className="pr-start">
          <b>Почніть із готового варіанту</b>
          <div className="pr-presets">
            {presets.map(p => (
              <button key={p.title} type="button" onClick={() => openEditor(null, p.make())}>
                <strong>{p.title}</strong><span>{p.text}</span>
              </button>
            ))}
          </div>
          <button type="button" className="pr-link" onClick={() => openEditor(null, empty())}>або створіть свою</button>
        </div>
      ) : (
        <ul className="pr-list">
          {rows.map(p => (
            <li key={p.id} className={p.is_active ? '' : 'off'}>
              <button type="button" className="pr-badge" onClick={() => openEditor(p.id, { ...p })} title="Змінити">−{p.discount_percent}%</button>
              <div className="pr-main" onClick={() => openEditor(p.id, { ...p })}>
                <b>{p.name}</b>
                <span>{scope(p)} · {when(p)}</span>
              </div>
              <label className="pr-switch" title={p.is_active ? 'Вимкнути' : 'Увімкнути'}>
                <input type="checkbox" checked={p.is_active} onChange={() => void toggle(p)} />
                <i />
              </label>
            </li>
          ))}
        </ul>
      )}

      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Змінити акцію' : 'Нова акція'}
        subtitle={preview}
        primary={{ label: 'Зберегти', onClick: () => void save(), loading: saving, disabled: !!problem }}
        secondary={{ label: 'Скасувати', onClick: () => setEditing(null) }}
        danger={editing?.id ? { label: 'Видалити', onClick: () => void remove() } : undefined}
        width={560}
      >
        {form && (
          <>
            <FormSection title="Що пропонуєте">
              <Field label="Назва">
                <input className="fm-input" value={form.name} maxLength={80} placeholder="Наприклад: Щасливі години" onChange={e => patch({ name: e.target.value })} />
              </Field>
              <Field label="Знижка">
                <div className="pr-chips">
                  {PERCENTS.map(n => (
                    <button key={n} type="button" className={form.discount_percent === n ? 'on' : ''} onClick={() => patch({ discount_percent: n })}>−{n}%</button>
                  ))}
                  <span className="pr-own"><input className="fm-input" type="number" min={1} max={90} value={form.discount_percent} onChange={e => patch({ discount_percent: Math.min(90, Math.max(1, Number(e.target.value) || 1)) })} />%</span>
                </div>
              </Field>
            </FormSection>

            <FormSection title="На які послуги">
              <div className="pr-radio">
                <button type="button" className={!pickServices ? 'on' : ''} onClick={() => { setPickServices(false); patch({ service_ids: null }); }}>Усі послуги</button>
                <button type="button" className={pickServices ? 'on' : ''} onClick={() => setPickServices(true)}>Обрані</button>
              </div>
              {pickServices && (
                <div className="pr-services">
                  {services.map((s: any) => {
                    const id = Number(s.id);
                    const on = !!form.service_ids?.includes(id);
                    return (
                      <label key={id} className={on ? 'on' : ''}>
                        <input type="checkbox" checked={on} onChange={() => {
                          const cur = form.service_ids || [];
                          const next = on ? cur.filter(x => x !== id) : [...cur, id];
                          patch({ service_ids: next.length ? next : null });
                        }} />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </FormSection>

            <FormSection title="Коли діє">
              <div className="pr-radio">
                <button type="button" className={!hasHours ? 'on' : ''} onClick={() => patch({ time_from: null, time_to: null })}>Весь день</button>
                <button type="button" className={hasHours ? 'on' : ''} onClick={() => patch({ time_from: form.time_from || '08:00', time_to: form.time_to || '10:00' })}>У певні години</button>
              </div>
              {hasHours && (
                <div className="pr-hours">
                  <span>З</span><input className="fm-input" type="time" value={form.time_from || ''} onChange={e => patch({ time_from: e.target.value })} />
                  <span>до</span><input className="fm-input" type="time" value={form.time_to || ''} onChange={e => patch({ time_to: e.target.value })} />
                  <small>за годиною початку візиту</small>
                </div>
              )}
              <div className="pr-days">
                {DAYS.map((d, i) => {
                  const on = !form.weekdays?.length || form.weekdays.includes(i);
                  return (
                    <button key={d} type="button" className={on ? 'on' : ''} onClick={() => {
                      const cur = form.weekdays?.length ? form.weekdays : [0, 1, 2, 3, 4, 5, 6];
                      const next = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i].sort();
                      patch({ weekdays: next.length === 7 || next.length === 0 ? null : next });
                    }}>{d}</button>
                  );
                })}
              </div>
              <div className="pr-dates">
                <Field label="Починається"><input className="fm-input" type="date" value={form.date_from || ''} onChange={e => patch({ date_from: e.target.value || null })} /></Field>
                <Field label="Закінчується"><input className="fm-input" type="date" value={form.date_to || ''} onChange={e => patch({ date_to: e.target.value || null })} /></Field>
              </div>
            </FormSection>
            {problem && <p className="pr-problem">{problem}</p>}
          </>
        )}
      </FormModal>

      <style dangerouslySetInnerHTML={{ __html: `
        .pr-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.2rem; }
        .pr-head h2 { margin: 0 0 0.2rem; font-size: 1.25rem; font-weight: 800; color: #0f172a; }
        .pr-head p { margin: 0; font-size: 0.88rem; color: #64748b; max-width: 560px; line-height: 1.45; }
        .pr-empty { padding: 3rem; text-align: center; color: #94a3b8; }
        .pr-start { border: 1px dashed #dbe2ea; border-radius: 16px; padding: 1.4rem; display: flex; flex-direction: column; gap: 0.9rem; align-items: flex-start; }
        .pr-start > b { color: #0f172a; font-size: 0.95rem; }
        .pr-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.7rem; width: 100%; }
        .pr-presets button { text-align: left; border: 1px solid #e8ecf0; background: #fff; border-radius: 12px; padding: 0.85rem 1rem; cursor: pointer; font-family: inherit; display: flex; flex-direction: column; gap: 0.2rem; transition: border-color .15s; }
        .pr-presets button:hover { border-color: #0f172a; }
        .pr-presets strong { font-size: 0.9rem; color: #0f172a; }
        .pr-presets span { font-size: 0.8rem; color: #64748b; }
        .pr-link { border: none; background: none; padding: 0; font-family: inherit; font-size: 0.85rem; font-weight: 600; color: #475569; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .pr-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .pr-list li { display: flex; align-items: center; gap: 0.9rem; padding: 0.85rem 0; border-bottom: 1px solid #f1f5f9; }
        .pr-list li.off .pr-badge { background: #f1f5f9; color: #94a3b8; }
        .pr-list li.off .pr-main { opacity: 0.55; }
        .pr-badge { flex-shrink: 0; min-width: 62px; height: 36px; border: none; border-radius: 10px; background: #0f172a; color: #fff; font-weight: 800; font-size: 0.9rem; cursor: pointer; font-family: inherit; }
        .pr-main { flex: 1; min-width: 0; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
        .pr-main b { color: #0f172a; font-size: 0.95rem; }
        .pr-main span { color: #64748b; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pr-switch { position: relative; width: 38px; height: 22px; flex-shrink: 0; cursor: pointer; }
        .pr-switch input { position: absolute; inset: 0; opacity: 0; cursor: pointer; margin: 0; }
        .pr-switch i { position: absolute; inset: 0; border-radius: 999px; background: #e2e8f0; transition: background .15s; pointer-events: none; }
        .pr-switch i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
        .pr-switch input:checked + i { background: #0f172a; }
        .pr-switch input:checked + i::after { transform: translateX(16px); }
        .pr-chips, .pr-radio, .pr-days { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
        .pr-chips button, .pr-radio button, .pr-days button { height: 34px; padding: 0 0.9rem; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; color: #334155; font-family: inherit; font-size: 0.84rem; font-weight: 600; cursor: pointer; }
        .pr-chips button.on, .pr-radio button.on, .pr-days button.on { background: #0f172a; border-color: #0f172a; color: #fff; }
        .pr-days { margin-top: 0.8rem; }
        .pr-days button { width: 42px; padding: 0; }
        .pr-own { display: inline-flex; align-items: center; gap: 0.3rem; color: #64748b; }
        .pr-own input { width: 70px; height: 34px; border-radius: 999px; text-align: center; }
        .pr-services { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.7rem; max-height: 170px; overflow-y: auto; }
        .pr-services label { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border-radius: 8px; font-size: 0.88rem; color: #334155; cursor: pointer; }
        .pr-services label.on { background: #f4f6f8; font-weight: 600; color: #0f172a; }
        .pr-hours { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.7rem; flex-wrap: wrap; font-size: 0.85rem; color: #64748b; }
        .pr-hours .fm-input { width: 120px; }
        .pr-hours small { flex-basis: 100%; color: #94a3b8; }
        .pr-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; margin-top: 0.8rem; }
        .pr-problem { margin: 0.6rem 0 0; color: #b42318; font-size: 0.85rem; }
        @media (max-width: 760px) { .pr-presets { grid-template-columns: 1fr; } .pr-head { flex-direction: column; } .pr-dates { grid-template-columns: 1fr; } }
      ` }} />
    </div>
  );
}
