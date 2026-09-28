'use client';

import { formatDuration } from '@/lib/duration';

/**
 * Вибір тривалості послуги.
 *
 * Раніше - поле «Тривалість (хв)»: «2 години» треба було перерахувати
 * у «120». Тепер - готові варіанти одним натиском (найчастіші в салонах)
 * і точні години й хвилини для решти. Межі - як на сервері: 5 хв - 8 год.
 */
const PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];
const HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function DurationPicker({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const h = Math.floor((value || 0) / 60);
  const m = (value || 0) % 60;
  const set = (hh: number, mm: number) => onChange(Math.min(480, Math.max(5, hh * 60 + mm)));

  return (
    <div className="dp">
      <div className="dp-presets" role="radiogroup" aria-label="Тривалість">
        {PRESETS.map(p => (
          <button key={p} type="button" role="radio" aria-checked={value === p} className={value === p ? 'on' : ''} onClick={() => onChange(p)}>
            {formatDuration(p)}
          </button>
        ))}
      </div>
      <div className="dp-exact">
        <span className="dp-lbl">Точно:</span>
        <select className="fm-input" value={h} onChange={e => set(Number(e.target.value), Number(e.target.value) === 8 ? 0 : m)} aria-label="Години">
          {HOURS.map(x => <option key={x} value={x}>{x} год</option>)}
        </select>
        <select className="fm-input" value={m} onChange={e => set(h, Number(e.target.value))} disabled={h === 8} aria-label="Хвилини">
          {MINUTES.map(x => <option key={x} value={x}>{x} хв</option>)}
        </select>
        <span className="dp-sum">= {formatDuration(value)}</span>
      </div>
      <style jsx>{`
        .dp { display: flex; flex-direction: column; gap: 0.65rem; }
        .dp-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; }
        .dp-presets button { height: 38px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 500; color: #0f172a; cursor: pointer; transition: border-color .15s, background-color .15s; white-space: nowrap; }
        .dp-presets button:hover { background: #f8fafc; }
        .dp-presets button.on { background: #0f172a; border-color: #0f172a; color: #fff; font-weight: 600; }
        .dp-exact { display: flex; align-items: center; gap: 0.5rem; }
        .dp-exact :global(select) { width: auto; min-width: 92px; height: 38px; padding: 0 0.6rem; }
        .dp-lbl { font-size: 0.8rem; color: #64748b; }
        .dp-sum { font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-left: 0.25rem; }
        @media (max-width: 480px) { .dp-presets { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
