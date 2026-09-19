'use client';

import { useState } from 'react';

/**
 * Відео-фон банера: три кадри поруч.
 *
 * Замінює одне відео на всю ширину. Три різні сюжети - обличчя,
 * волосся, тіло - за секунду показують, чим тут займаються, і роблять
 * це без жодного слова.
 *
 * Це саме ФОН: без підписів, без кнопок, без реакції на клік. Усе
 * інтерактивне лежить поверх - пошук і заголовок. Картки, які
 * відгукуються на наведення, змагалися б із пошуком за увагу, а
 * прийшли сюди шукати.
 */

/**
 * Заглушки під час завантаження.
 *
 * Вбудовані SVG, а не файли: вони не роблять жодного запиту й
 * зʼявляються в тому ж кадрі, що й сторінка. Кольори взяті з самих
 * відео, тому перехід до першого кадру непомітний.
 */
const POSTERS = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='16'%3E%3ClinearGradient id='a' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23c9b8a8'/%3E%3Cstop offset='1' stop-color='%238f7a68'/%3E%3C/linearGradient%3E%3Crect width='9' height='16' fill='url(%23a)'/%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='16'%3E%3ClinearGradient id='a' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23a8b5c9'/%3E%3Cstop offset='1' stop-color='%235f6f85'/%3E%3C/linearGradient%3E%3Crect width='9' height='16' fill='url(%23a)'/%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='16'%3E%3ClinearGradient id='a' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23c2c9b8'/%3E%3Cstop offset='1' stop-color='%2378856a'/%3E%3C/linearGradient%3E%3Crect width='9' height='16' fill='url(%23a)'/%3E%3C/svg%3E",
];

const VIDEOS = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203023_87a26602-2898-4acc-a396-c7a2b5ad84fd.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203415_b86e3f19-2aec-46cd-9a86-b64c40118e38.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203051_85fee398-ea01-4aa0-972b-137a74213be5.mp4',
];

export default function HeroVideoBackdrop() {
  // Які відео вже грають. Поки ні - показуємо постер, і перехід
  // робимо плавним: різка підміна заглушки кадром смикає око.
  const [playing, setPlaying] = useState<boolean[]>([false, false, false]);
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        overflow: 'hidden',
      }}
    >
      {VIDEOS.map((src, i) => (
        <div key={src} style={{
          position: 'relative', overflow: 'hidden',
          // Заглушка ФОНОМ контейнера, а не лише атрибутом poster:
          // поки відео прозоре, poster теж не видно, і лишався б
          // чорний прямокутник.
          background: `url("${POSTERS[i]}") center/cover no-repeat`,
        }}>
          {/* Мʼяке світло, що повільно пливе по заглушці.
              Поки відео вантажиться, людина бачить не застиглу пляму,
              а щось живе - очікування читається як частина задуму. */}
          {!playing[i] && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.13) 50%, transparent 70%)',
              backgroundSize: '220% 100%',
              animation: `heroShimmer 2.6s ease-in-out ${i * 0.25}s infinite`,
            }} />
          )}
          <video
            autoPlay
            loop
            muted
            playsInline
            // preload="metadata" замість повного завантаження.
            //
            // Браузер бере лише заголовок файлу й починає грати, коли
            // накопичить перші кадри, а не коли скачає все. Три відео
            // в паралель при повному preload забивають канал, і перший
            // кадр зʼявляється через кілька секунд.
            preload="metadata"
            // Постер: кольорова заглушка тієї ж гами, що й кадр.
            // Порожній чорний прямокутник до старту відео виглядає як
            // поломка, а мʼяка пляма - як фото, що ще вантажиться.
            poster={POSTERS[i]}
            src={src}
            onPlaying={() => setPlaying(prev => {
              if (prev[i]) return prev;
              const next = [...prev];
              next[i] = true;
              return next;
            })}
            style={{
              opacity: playing[i] ? 1 : 0,
              // Довше проявлення (1.1s) і затримка по колонках:
              // три кадри, що зʼявляються одночасно, читаються як
              // перемикання слайда. По черзі - як розкриття.
              transition: `opacity 1.1s ease ${i * 160}ms`,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // Повільний наїзд: 20 секунд від 1.0 до 1.08 і назад.
              //
              // Самі ролики короткі й помітно зациклюються - око
              // ловить точку склейки. Повільний рух поверх них має
              // довший період, тому склейка перестає читатись.
              //
              // Кожна колонка починає з іншої фази (затримка -7s),
              // інакше всі три дихають синхронно, і це виглядає
              // механічно.
              animation: playing[i] ? `heroKenBurns 20s ease-in-out ${i * -7}s infinite` : 'none',
            }}
          />
        </div>
      ))}

      {/* Затемнення поверх усіх трьох.
          Градієнт, а не суцільний колір: угорі темніше під заголовок,
          посередині світліше - там пошук на білому тлі, і надто темний
          фон під ним створював би зайвий контраст. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0.46) 100%)',
        }}
      />

      {/* Тонкі розділювачі між кадрами - щоб стик читався як задум,
          а не як склейка. */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', pointerEvents: 'none' }}>
        <div />
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.09)', borderRight: '1px solid rgba(255,255,255,0.09)' }} />
        <div />
      </div>
    </div>
  );
}
