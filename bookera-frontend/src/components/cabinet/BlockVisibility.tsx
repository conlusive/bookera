'use client';

/**
 * Плашка видимості блоку вітрини.
 *
 * Раніше вимкнений блок ЗНИКАВ із редактора, і повернути його можна
 * було лише через модальне вікно «Вигляд та блоки» — де ще треба
 * здогадатись, що воно там. Людина вимикала команду, потім не могла
 * знайти, як увімкнути назад.
 *
 * Тепер блок лишається на місці: приглушений, з підписом «Не
 * показується клієнтам» і перемикачем просто на ньому. Видно і що
 * блок існує, і що його зараз не видно, і як це змінити — в одному
 * місці.
 */
export default function BlockVisibility({
  isVisible,
  onToggle,
  label,
}: {
  isVisible: boolean;
  onToggle: () => void;
  /** Назва блоку — для підказки на кнопці. */
  label: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.55rem 0.75rem',
        marginBottom: '1rem',
        borderRadius: '12px',
        background: isVisible ? 'transparent' : 'rgba(194, 216, 196, 0.16)',
        border: `1px solid ${isVisible ? 'transparent' : 'rgba(111, 146, 115, 0.25)'}`,
        transition: 'background-color 0.18s ease, border-color 0.18s ease',
      }}
    >
      <span
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: isVisible ? '#94a3b8' : '#5C6B5E',
        }}
      >
        {isVisible ? 'Показується клієнтам' : 'Не показується клієнтам'}
      </span>

      <button
        type="button"
        onClick={onToggle}
        title={isVisible ? `Сховати «${label}»` : `Показати «${label}»`}
        style={{
          width: '40px',
          height: '22px',
          flexShrink: 0,
          borderRadius: '999px',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          background: isVisible ? '#6F9273' : '#cbd5e1',
          transition: 'background-color 0.2s ease',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: isVisible ? '21px' : '3px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s ease',
          }}
        />
      </button>
    </div>
  );
}
