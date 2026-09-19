'use client';

import { useEffect, useState } from 'react';

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
 * Набори кадрів, що змінюють один одного.
 *
 * Один набір - три відео поруч, обʼєднані настроєм. Награвшись,
 * набір поступається наступному: теплі процедури змінюються
 * холодними й далі по колу.
 *
 * Чому не просто три вічні ролики: короткий цикл ловиться оком
 * за кілька секунд, і фон перетворюється на шпалери. Зміна сцени
 * дає підставу подивитись ще раз.
 */
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P';

/** Заглушка - вбудований SVG у кольорах самого кадру, без запиту в мережу. */
const gradient = (from: string, to: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='16'%3E%3ClinearGradient id='a' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23${from}'/%3E%3Cstop offset='1' stop-color='%23${to}'/%3E%3C/linearGradient%3E%3Crect width='9' height='16' fill='url(%23a)'/%3E%3C/svg%3E`;

interface VideoSet {
  /** Для чого набір - лише для читання коду, в інтерфейсі не видно. */
  mood: string;
  videos: string[];
  posters: string[];
}

/**
 * ЩОБ ДОДАТИ ЧОЛОВІЧИЙ НАБІР: допишіть другий обʼєкт із трьома
 * посиланнями й кольорами заглушок. Решта коду не знає, скільки
 * наборів, і працюватиме з будь-якою кількістю.
 */
const SETS: VideoSet[] = [
  {
    mood: 'теплі процедури',
    videos: [
      `${CDN}/hf_20260518_203023_87a26602-2898-4acc-a396-c7a2b5ad84fd.mp4`,
      `${CDN}/hf_20260518_203415_b86e3f19-2aec-46cd-9a86-b64c40118e38.mp4`,
      `${CDN}/hf_20260518_203051_85fee398-ea01-4aa0-972b-137a74213be5.mp4`,
    ],
    posters: [gradient('c9b8a8', '8f7a68'), gradient('a8b5c9', '5f6f85'), gradient('c2c9b8', '78856a')],
  },
  // {
  //   mood: 'барбершоп, холодна гама',
  //   videos: [`${CDN}/...`, `${CDN}/...`, `${CDN}/...`],
  //   posters: [gradient('2a3340', '141a23'), gradient('34404f', '1b2430'), gradient('222c38', '11161d')],
  // },
];

/** Скільки набір тримається на екрані. */
const SET_DURATION_MS = 7000;

export default function HeroVideoBackdrop() {
  const [setIndex, setSetIndex] = useState(0);

  // Один набір - чергувати нічого, і таймер лише грів би процесор.
  const hasMultipleSets = SETS.length > 1;

  useEffect(() => {
    if (!hasMultipleSets) return;
    const timer = setInterval(() => setSetIndex(i => (i + 1) % SETS.length), SET_DURATION_MS);
    return () => clearInterval(timer);
  }, [hasMultipleSets]);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
      {/* Усі набори лежать один на одному; видно той, чия черга.
          Так наступний уже завантажений до моменту появи - інакше
          зміна сцени щоразу починалася б із порожніх заглушок. */}
      {SETS.map((set, si) => (
        <VideoRow key={si} set={set} isActive={si === setIndex} />
      ))}

      {/* Затемнення: градієнт, а не суцільний колір - угорі темніше
          під заголовок, посередині світліше під пошук. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0.46) 100%)',
        }}
      />

      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', pointerEvents: 'none' }}>
        <div />
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.09)', borderRight: '1px solid rgba(255,255,255,0.09)' }} />
        <div />
      </div>
    </div>
  );
}

function VideoRow({ set, isActive }: { set: VideoSet; isActive: boolean }) {
  const [playing, setPlaying] = useState<boolean[]>([false, false, false]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        opacity: isActive ? 1 : 0,
        // Довге перехрещення: набори різні за кольором, і різка зміна
        // читається як перемикання каналу.
        transition: 'opacity 1.4s ease',
        pointerEvents: 'none',
      }}
    >
      {set.videos.map((src, i) => (
        <div
          key={src}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: `url("${set.posters[i]}") center/cover no-repeat`,
          }}
        >
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
            preload="metadata"
            poster={set.posters[i]}
            src={src}
            onPlaying={() => setPlaying(prev => {
              if (prev[i]) return prev;
              const next = [...prev];
              next[i] = true;
              return next;
            })}
            style={{
              opacity: playing[i] ? 1 : 0,
              transition: `opacity 1.1s ease ${i * 160}ms`,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              animation: playing[i] ? `heroKenBurns 20s ease-in-out ${i * -7}s infinite` : 'none',
            }}
          />
        </div>
      ))}
    </div>
  );
}
