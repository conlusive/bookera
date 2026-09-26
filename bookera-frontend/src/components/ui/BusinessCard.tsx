'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { imageLoadProps } from '@/lib/images';
import { getOpenStatus } from '@/lib/businessStatus';
import { categoryTitles, categoryTitle } from '@/lib/categories';

/**
 * Картка закладу - ОДНА на весь сайт.
 *
 * Раніше головна малювала свою, а профіль тримав власну копію стилів -
 * стару, з рамкою, тінню й підйомом. Головну переробили на плитки, а
 * копія лишилась, і картки в улюблених виглядали інакше. Тепер обидві
 * сторінки малюють цей компонент, і розійтись їм нема з чого.
 *
 * Дані, які картка сама не знає, приходять пропсами: чи заклад в
 * улюблених, відстань, вільні години.
 */
export default function BusinessCard({
  biz,
  isFavorite,
  onToggleFavorite,
  distanceTag,
  showTimeSlots,
  slots,
}: {
  biz: any;
  isFavorite: boolean;
  onToggleFavorite: (bizId: number) => void;
  distanceTag?: string;
  showTimeSlots?: boolean;
  slots?: string[];
}) {
  const router = useRouter();

  const rank = parseFloat(biz.rating);
  const hasRating = !isNaN(rank) && rank > 0;
  // Рейтингу немає - не вигадуємо.
  //
  // Раніше тут стояло '5.0': заклад без жодного відгуку виглядав
  // ідеальним. Людина довіряла цифрі, за якою нічого не стояло,
  // і це найгірший вид обману в маркетплейсі.
  const displayRank = hasRating ? rank.toFixed(1) : null;
  const reviewCount = parseInt(biz.reviews_count) || 0;
  const bgImage = biz.cover_photo || biz.logo || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80";
  const isFav = isFavorite;

  // Справжня мінімальна ціна серед послуг салону
  const prices = (biz.services || [])
    .map((s: any) => Number(s.price))
    .filter((p: number) => !isNaN(p) && p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const category = categoryTitle(biz.category);

  // Формування точної локації та відстані
  // Адреса без відстані: відстань тепер окремою плашкою поверх фото.
  //
  // У рядку «500 м • Дорошенка 10» вона губилась серед тексту того
  // самого кольору й розміру, хоча це найцінніше, що є в картці:
  // адресу людина прочитає потім, а «як далеко» вирішує одразу.
  const locationText = [biz.city, biz.address].filter(Boolean).join(', ') || 'Адресу уточнюйте';

  // Локальна дата, НЕ через toISOString.
  //
  // toISOString повертає дату в UTC: після 21:00 за Києвом це вже
  // завтра, і картка просила слоти не на той день - показувала
  // завтрашні години як сьогоднішні.
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const salonSlots = slots || [];
  const primaryService = biz.services?.[0];

  return (
    <Link href={`/${biz.slug || biz.id}`} className="apple-biz-card anim">
      <div className="card-photo-box">
        {/* next/image: браузер отримує фото під розмір картки у WebP
            чи AVIF, а не оригінал на кілька мегабайт. На телефоні
            картка на всю ширину, на компʼютері - чверть. */}
        <Image
          src={bgImage}
          alt={biz.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw"
          className="card-photo-img"
          {...imageLoadProps(bgImage)}
        />

        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: '6px', zIndex: 2 }}>
          {distanceTag ? (
            <div className="glass-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{distanceTag}</span>
            </div>
          ) : null}
          {/* Плашку «Топ вибір» прибрано.
              Умова була `!hasRating || rank >= 4.8` - тобто заклад
              БЕЗ ЖОДНОГО рейтингу теж отримував «Топ вибір».
              Плашка, яку має майже кожен, нічого не означає, а тут
              вона ще й брехала.
              Для найкращих є ціла зона «Рекомендовані». */}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(biz.id);
          }}
          className="glass-fav-btn anim"
          title="Зберегти"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "#ef4444" : "none"} stroke={isFav ? "#ef4444" : "#111827"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
          <h3 className="card-heading">{biz.name}</h3>
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#111827', whiteSpace: 'nowrap' }}>
            {minPrice ? `від ${minPrice} ₴` : 'від 450 ₴'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
          {displayRank && reviewCount > 0 ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#111827', fontWeight: '600' }}>
                <span style={{ color: '#f59e0b' }}>★</span> {displayRank}
                <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.75rem' }}>({reviewCount})</span>
              </span>
              <span>•</span>
            </>
          ) : (
            /* Новий заклад - так і кажемо. Це чесно й навіть
               працює на нього: людина розуміє, що відгуків немає
               не через погану роботу. */
            <>
              <span style={{ color: '#94a3b8' }}>Новий заклад</span>
              <span>•</span>
            </>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
          {(() => {
            const status = getOpenStatus(biz);
            if (!status.label) return null;
            const color = status.state === 'open' ? '#10b981'
              : status.state === 'paused' ? '#d97706'
              : '#94a3b8';
            return (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                <span style={{ color, fontWeight: '600' }}>{status.label}</span>
                <span>•</span>
              </>
            );
          })()}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locationText}</span>
        </div>

        {/* РЕАЛЬНІ СЛОТИ ЧАСУ НА СЬОГОДНІ */}
        {showTimeSlots ? (
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: '#8fae92', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Сьогодні:
            </span>
            {salonSlots.length > 0 ? (
              <div style={{ display: 'flex', gap: '5px' }}>
                {salonSlots.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const query = new URLSearchParams({
                        date: todayStr,
                        time: time,
                      });
                      // Послугу НЕ підставляємо: раніше тут ставилась перша
                      // послуга закладу, і людина потрапляла одразу на
                      // вибір часу, не обравши ні послуги, ні майстра.
                      // Тепер вона обирає їх сама, а година чекає.
                      router.push(`/${biz.slug || biz.id}?${query.toString()}`);
                    }}
                    className="interactive-time-chip anim"
                  >
                    {time}
                  </button>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '500' }}>
                Немає слотів на сьогодні
              </span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>
              Швидкий запис
            </span>
            <span className="card-action-link">
              Записатись
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/* Стилі картки - тут, поруч із розміткою, а не копіями на кожній
   сторінці. Глобальні, бо ті самі класи використовуються й вище по
   дереву (наведення на картку змінює фото всередині). */
export function BusinessCardStyles() {
  return (
    <style jsx global>{`
        /* ОДНАКОВІ КАРТКИ В СТИЛІ APPLE */
        /* Картка закладу - плитка, а не «картка».
           Рамка, тінь і підйом при наведенні робили з кожного закладу
           окремий обʼєкт, що претендує на увагу. У сітці з восьми це
           вісім прямокутників, які змагаються між собою.
           Лишилось фото й текст під ним: межі задає сам вміст. */
        .apple-biz-card {
          background: transparent;
          border: none;
          box-shadow: none;
          display: flex;
          flex-direction: column;
          text-decoration: none;
          position: relative;
          box-sizing: border-box;
        }
        /* При наведенні рухається ЛИШЕ фото - легке наближення.
           Підйом усієї картки зсуває сусідні рядки й ламає сітку. */
        .apple-biz-card:hover .card-photo-img {
          transform: scale(1.04);
        }
        .card-photo-img {
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-photo-box {
          width: 100%;
          /* Стале співвідношення замість фіксованої висоти: плитки
             в ряду однакові незалежно від ширини колонки. */
          aspect-ratio: 4 / 3;
          height: auto;
          border-radius: 14px;
          position: relative;
          overflow: hidden;
          background: #F5F5F7;
          background-color: #f1f5f9;
        }
        .card-photo-img {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .apple-biz-card:hover .card-photo-img {
          transform: scale(1.04);
        }
        /* СКЛЯНИЙ БЕЙДЖ */
        .glass-pill {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.7);
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }
        /* КНОПКА «В ОБРАНЕ» */
        .glass-fav-btn {
          position: absolute; top: 10px; right: 10px; z-index: 2;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.7);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }
        .glass-fav-btn:hover {
          transform: scale(1.1);
          background: #ffffff;
        }
        .card-body {
          /* Без бічних полів: текст вирівняний по краю фото, як
             у сітці альбому. Поля всередині картки мали сенс, поки
             була рамка - тепер вони лише зсували текст від плитки. */
          padding: 0.85rem 0.15rem 0;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .card-heading {
          /* Легша вага й менший кегль: 800 на кожній назві в сітці
             з восьми читається як вісім заголовків. */
          font-size: 1.0625rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: #111827;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.015em;
        }
        .card-action-link {
          font-size: 0.85rem;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .apple-biz-card:hover .card-action-link {
          color: #8fae92;
          transform: translateX(2px);
        }
        /* КЛІКАБЕЛЬНІ СЛОТИ ЧАСУ */
        .interactive-time-chip {
          background: #f1f5f9;
          color: #111827;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }
        .interactive-time-chip:hover {
          background: #C2D8C4;
          color: #111827;
          transform: translateY(-1px);
        }
    `}</style>
  );
}
