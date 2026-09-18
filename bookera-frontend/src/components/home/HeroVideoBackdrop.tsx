'use client';

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

const VIDEOS = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203023_87a26602-2898-4acc-a396-c7a2b5ad84fd.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203415_b86e3f19-2aec-46cd-9a86-b64c40118e38.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203051_85fee398-ea01-4aa0-972b-137a74213be5.mp4',
];

export default function HeroVideoBackdrop() {
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
        <div key={src} style={{ position: 'relative', overflow: 'hidden' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            // preload="none" не ставимо: відео має грати одразу, воно
            // й є фоном. Але й постер не потрібен - три кадри
            // завантажуються паралельно й перекривають один одного.
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // Легке наближення середнього кадру: три однакові прямокутники
              // читаються як таблиця, невелика різниця робить із них
              // композицію.
              transform: i === 1 ? 'scale(1.06)' : 'scale(1)',
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
