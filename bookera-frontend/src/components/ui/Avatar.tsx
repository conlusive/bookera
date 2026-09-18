'use client';

/**
 * Аватарка людини або закладу.
 *
 * Раніше кожне місце малювало її по-своєму: десь чорний фон, десь
 * матчевий, десь сірий; десь одна літера, десь дві. Людина бачила
 * себе трьома різними кружками на трьох екранах одного продукту.
 *
 * Тут один вигляд: білий фон, тонка рамка, ініціали чорнильним
 * кольором. Білий обрано свідомо - кольоровий кружок конкурує за
 * увагу з іменем поруч, хоча сам по собі нічого не повідомляє.
 */
export default function Avatar({
  name,
  src,
  size = 40,
}: {
  name?: string | null;
  /** Фото, якщо є. Ініціали - запасний варіант, а не основний. */
  src?: string | null;
  size?: number;
}) {
  // Ім'я + прізвище. Якщо слово одне - беремо перші дві літери:
  // одна літера на великому кружку виглядає загубленою.
  const initials = (() => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  })();

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        // Світло-сірий із холодним відтінком - як у хедері профілю.
        // Чисто білий зливався з тлом карток і кружок губився;
        // рамка при цьому стає зайвою - форму задає сам фон.
        background: '#EEF1F6',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#222222',
        // Кегль від розміру: на 28 пікселях 16px не вміщається,
        // на 80 - виглядає загубленим.
        fontSize: Math.max(11, Math.round(size * 0.36)),
        fontWeight: 700,
        letterSpacing: '0.01em',
        userSelect: 'none',
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initials
      )}
    </div>
  );
}
