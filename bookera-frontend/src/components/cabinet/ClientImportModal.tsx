'use client';

import { useRef, useState } from 'react';
import FormModal, { FormSection } from '@/components/ui/FormModal';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { actionError } from '@/lib/feedback';

/**
 * Імпорт бази клієнтів з Excel / CSV - три кроки в одному вікні:
 *   1. обрати файл (або завантажити шаблон)
 *   2. перевірка: скільки буде додано, що пропущено й чому - нічого ще
 *      не збережено
 *   3. «Імпортувати N» - і готово
 */
type Result = Awaited<ReturnType<typeof api.importClients>>;

export default function ClientImportModal({ open, onClose, businessId, onDone }: {
  open: boolean; onClose: () => void; businessId: number; onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<Result | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setCheck(null); setCreated(null); };
  const close = () => { reset(); onClose(); };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.(xlsx|xlsm|csv)$/i.test(f.name)) { actionError('Підтримуються файли .xlsx і .csv'); return; }
    setFile(f); setCheck(null); setBusy(true);
    try {
      setCheck(await api.importClients(await getAuthToken(), businessId, f, true));
    } catch (e: any) {
      setFile(null);
      actionError(e?.message || 'Не вдалося прочитати файл');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!file || !check?.to_create) return;
    setBusy(true);
    try {
      const r = await api.importClients(await getAuthToken(), businessId, file, false);
      setCreated(r.created ?? r.to_create);
      onDone();
    } catch (e: any) {
      actionError(e?.message || 'Не вдалося імпортувати');
    } finally {
      setBusy(false);
    }
  };

  const plural = (n: number, a: string, b: string, c: string) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);

  return (
    <FormModal
      open={open}
      onClose={close}
      title="Імпорт клієнтів"
      subtitle={created !== null ? undefined : 'З Excel чи CSV — наприклад, з іншої системи запису'}
      width={560}
      primary={created !== null
        ? { label: 'Готово', onClick: close }
        : { label: check ? `Імпортувати ${check.to_create}` : 'Імпортувати', onClick: () => void run(), loading: busy && !!check, disabled: !check?.to_create }}
      secondary={check && created === null ? { label: 'Інший файл', onClick: reset } : undefined}
    >
      {created !== null ? (
        <div className="ci-done">
          <b>{created} {plural(created, 'клієнта додано', 'клієнти додано', 'клієнтів додано')}</b>
          <span>Візити з їхніми номерами підтягнуться в картки самі.</span>
        </div>
      ) : !check ? (
        <FormSection>
          <div
            className={`ci-drop ${drag ? 'on' : ''}`}
            onClick={() => input.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files?.[0]); }}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') input.current?.click(); }}
          >
            <b>{busy ? 'Перевіряємо файл…' : 'Оберіть файл або перетягніть сюди'}</b>
            <span>.xlsx або .csv, до 5000 клієнтів</span>
          </div>
          <input ref={input} type="file" accept=".xlsx,.xlsm,.csv" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="ci-help">
            Колонки розпізнаються за назвою: <b>Імʼя</b>, <b>Телефон</b>, <b>Пошта</b>, <b>День народження</b>, <b>Теги</b>, <b>Нотатки</b>.
            Обовʼязкове лише імʼя. Номери в будь-якому вигляді приведемо до +380.{' '}
            <button type="button" onClick={async () => { try { await api.downloadClientsTemplate(await getAuthToken()); } catch (e: any) { actionError(e?.message || 'Не вдалося завантажити шаблон'); } }}>
              Завантажити шаблон
            </button>
          </div>
        </FormSection>
      ) : (
        <FormSection>
          <div className="ci-file">{file?.name}</div>
          <div className="ci-sum">
            <div className="ok"><b>{check.to_create}</b><span>буде додано</span></div>
            <div className={check.skipped ? 'warn' : ''}><b>{check.skipped}</b><span>пропущено</span></div>
            <div><b>{check.total}</b><span>рядків у файлі</span></div>
          </div>
          {check.truncated && <div className="ci-note">Файл довший за 5000 рядків — імпортуємо перші 5000.</div>}
          {check.preview.length > 0 && (
            <div className="ci-list">
              <div className="ci-cap">Перші клієнти</div>
              {check.preview.map((p, i) => <div key={i} className="ci-row"><b>{p.name}</b><span>{p.phone || p.email || 'без контактів'}</span></div>)}
            </div>
          )}
          {check.skipped_rows.length > 0 && (
            <div className="ci-list">
              <div className="ci-cap">Пропущено — і чому</div>
              {check.skipped_rows.slice(0, 8).map(s => (
                <div key={s.row} className="ci-row"><b>Рядок {s.row}{s.name ? ` · ${s.name}` : ''}</b><span className="why">{s.reason}</span></div>
              ))}
              {check.skipped_rows.length > 8 && <div className="ci-more">і ще {check.skipped - 8}</div>}
            </div>
          )}
          {check.to_create === 0 && <div className="ci-note">Нових клієнтів у файлі немає — усі вже є в базі або рядки не підійшли.</div>}
        </FormSection>
      )}

      <style jsx>{`
        .ci-drop { border: 2px dashed #cbd5e1; border-radius: 14px; padding: 2.2rem 1rem; text-align: center; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 0.3rem; background: #f8fafc; }
        .ci-drop:hover, .ci-drop.on { border-color: #0f172a; background: #f1f5f9; }
        .ci-drop b { font-size: 0.95rem; color: #0f172a; }
        .ci-drop span { font-size: 0.8rem; color: #64748b; }
        .ci-help { font-size: 0.82rem; color: #64748b; line-height: 1.55; }
        .ci-help b { color: #334155; font-weight: 600; }
        .ci-help button { border: none; background: none; padding: 0; font-family: inherit; font-size: 0.82rem; font-weight: 600; color: #436b49; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        .ci-file { font-size: 0.85rem; color: #64748b; }
        .ci-sum { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
        .ci-sum div { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 0.8rem; display: flex; flex-direction: column; gap: 0.1rem; }
        .ci-sum b { font-size: 1.4rem; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
        .ci-sum .ok b { color: #059669; }
        .ci-sum .warn b { color: #b45309; }
        .ci-sum span { font-size: 0.75rem; color: #64748b; }
        .ci-list { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.3rem 0.9rem; }
        .ci-cap { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.55rem 0 0.2rem; }
        .ci-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.45rem 0; border-top: 1px solid #f1f5f9; font-size: 0.85rem; }
        .ci-row b { font-weight: 600; color: #0f172a; }
        .ci-row span { color: #64748b; text-align: right; }
        .ci-row .why { color: #b45309; }
        .ci-more { font-size: 0.8rem; color: #94a3b8; padding: 0.4rem 0; }
        .ci-note { font-size: 0.82rem; color: #92400e; background: #fffbeb; border-radius: 10px; padding: 0.6rem 0.8rem; }
        .ci-done { text-align: center; padding: 1.5rem 0; display: flex; flex-direction: column; gap: 0.4rem; }
        .ci-done b { font-size: 1.2rem; color: #059669; }
        .ci-done span { font-size: 0.9rem; color: #64748b; }
      `}</style>
    </FormModal>
  );
}
