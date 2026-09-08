'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Випадний список у стилі проєкту.
 *
 * Зроблений за зразком фільтра майстрів у календарі — там уже був
 * власний список, і саме він виглядає як частина продукту, тоді як
 * системний <select> малює macOS-меню, що накладається поверх поля.
 *
 * Компонент, а не копія розмітки в кожному місці: список використовують
 * у налаштуваннях, складі й статистиці, і три копії розійшлись би
 * після першої ж правки.
 */

export interface SelectOption {
  value: string | number;
  label: string;
}

export default function AppSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Оберіть…',
}: {
  value: string | number;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Клік поза списком закриває його. Без цього відкритий список
  // лишається висіти, коли людина пішла робити щось інше.
  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(v => !v)}
        disabled={disabled}
        style={{
          width: '100%', height: '44px', padding: '0 0.9rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
          background: disabled ? '#f8fafc' : '#fff',
          border: `1px solid ${isOpen ? '#94a3b8' : '#e2e8f0'}`,
          borderRadius: '12px',
          fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 500,
          color: selected ? '#0f172a' : '#94a3b8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left', outline: 'none',
          transition: 'border-color 0.15s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder}
        </span>
        <span style={{
          flexShrink: 0, color: '#94a3b8', fontSize: '0.7rem', lineHeight: 1,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          className="custom-scroll"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(15,23,42,0.12)',
            padding: '0.3rem', zIndex: 50, maxHeight: '240px', overflowY: 'auto',
          }}
        >
          {options.map(opt => {
            const isActive = String(opt.value) === String(value);
            return (
              <div
                key={String(opt.value)}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                style={{
                  padding: '0.55rem 0.7rem', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#0f172a' : '#475569',
                  background: isActive ? '#f1f5f9' : 'transparent',
                }}
                onMouseOver={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
