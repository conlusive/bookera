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

export default function DurationPicker({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const h = Math.floor((value || 0) / 60);
  const m = (value || 0) % 60;

  return (
    <div className="dp">
      <div className="dp-presets" role="radiogroup" aria-label="Тривалість">
        {PRESETS.map(p => (
          <button key={p} type="button" role="radio" aria-checked={value === p} className={value === p ? 'on' : ''} onClick={() => onChange(p)}>
            {formatDuration(p)}
          </button>
        ))}
      </div>
      {/* Точна тривалість - кнопками −/+, як в iOS, а не системними списками */}
      <div className="dp-exact">
        <div className="dp-step">
          <button type="button" aria-label="Мінус година" onClick={() => onChange(Math.max(5, (value || 0) - 60))} disabled={(value || 0) <= 60}>−</button>
          <span><b>{h}</b> год</span>
          <button type="button" aria-label="Плюс година" onClick={() => onChange(Math.min(480, (value || 0) + 60))} disabled={(value || 0) + 60 > 480}>+</button>
        </div>
        <div className="dp-step">
          <button type="button" aria-label="Мінус 5 хвилин" onClick={() => onChange(Math.max(5, (value || 0) - 5))} disabled={(value || 0) <= 5}>−</button>
          <span><b>{m}</b> хв</span>
          <button type="button" aria-label="Плюс 5 хвилин" onClick={() => onChange(Math.min(480, (value || 0) + 5))} disabled={(value || 0) >= 480}>+</button>
        </div>
        <span className="dp-sum">{formatDuration(value)}</span>
      </div>
      <style jsx>{`
        .dp { display: flex; flex-direction: column; gap: 0.65rem; }
        .dp-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; }
        .dp-presets button { height: 38px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 500; color: #0f172a; cursor: pointer; transition: border-color .15s, background-color .15s; white-space: nowrap; }
        .dp-presets button:hover { background: #f8fafc; }
        .dp-presets button.on { background: #0f172a; border-color: #0f172a; color: #fff; font-weight: 600; }
        .dp-exact { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .dp-step { display: flex; align-items: center; height: 40px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; }
        .dp-step button { width: 38px; height: 100%; border: none; background: #fff; font-size: 1.15rem; color: #0f172a; cursor: pointer; font-family: inherit; transition: background-color .15s; }
        .dp-step button:hover:not(:disabled) { background: #f1f5f9; }
        .dp-step button:disabled { color: #cbd5e1; cursor: default; }
        .dp-step span { min-width: 64px; text-align: center; font-size: 0.875rem; color: #64748b; border-left: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; line-height: 38px; }
        .dp-step span b { color: #0f172a; font-weight: 700; font-variant-numeric: tabular-nums; }
        .dp-sum { margin-left: auto; font-size: 0.85rem; font-weight: 700; color: #0f172a; padding: 0 0.8rem; height: 32px; line-height: 32px; border-radius: 999px; background: #f1f5f9; }
        @media (max-width: 480px) { .dp-presets { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
