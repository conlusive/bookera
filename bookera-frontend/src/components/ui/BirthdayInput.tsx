'use client';

import { useEffect, useState } from 'react';

/**
 * Дата народження - ДД.ММ.РРРР, крапки ставляться самі.
 *
 * Замість системного поля дати: у Safari порожнє поле показує СЬОГОДНІШНЄ
 * число, і здається, що дату вже заповнено (а збережеться порожнеча чи
 * сьогодні - незрозуміло). Тут порожнє - справді порожнє.
 *
 * value / onChange - у форматі сервера РРРР-ММ-ДД ('' - не вказано).
 * Неможлива дата (31.02, майбутнє, понад 120 років) - рамка червона, у
 * onChange іде '' - тож помилкова дата не збережеться.
 */
const toView = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};

function parse(view: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(view);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const now = new Date();
  if (dt.getTime() > now.getTime() || y < now.getFullYear() - 120) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function BirthdayInput({ value, onChange, className, style, dataField, onBlur }: {
  value: string; onChange: (iso: string) => void; className?: string; style?: React.CSSProperties; dataField?: string; onBlur?: () => void;
}) {
  const [view, setView] = useState(toView(value));
  useEffect(() => { setView(v => (parse(v) === (value || null) || (!value && !v) ? v : toView(value))); }, [value]);

  const complete = view.length === 10;
  const bad = complete && !parse(view);

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="bday"
      placeholder="ДД.ММ.РРРР"
      maxLength={10}
      data-field={dataField}
      className={`${className || ''} ${bad ? 'bk-invalid' : ''}`.trim()}
      style={style}
      value={view}
      aria-invalid={bad || undefined}
      title={bad ? 'Такої дати не буває або вона ще не настала' : undefined}
      onBlur={onBlur}
      onChange={e => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
        const v = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.');
        setView(v);
        if (!v) onChange('');
        else onChange(parse(v) || '');
      }}
    />
  );
}
