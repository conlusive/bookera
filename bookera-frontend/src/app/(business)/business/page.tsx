'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken, getAuthTokenOrNull } from '@/lib/auth-token-client';
import { isBusinessRole } from '@/lib/roles';
import Avatar from '@/components/ui/Avatar';

// 1. ОПТИМІЗАЦІЯ: Виносимо статичні дані за межі компонента,
// щоб вони не перестворювалися при кожному рендері
const faqs = [
  { q: "Що таке BookEra Business?", a: "Це комплексний сервіс для автоматизації: онлайн-запис 24/7, клієнтська база та фінанси." },
  { q: "Чи дійсно базовий функціонал безкоштовний?", a: "Так! Ви можете створити сторінку, додати послуги та приймати записи абсолютно безкоштовно." },
  { q: "Як клієнти можуть записатися?", a: "Ви отримуєте персональне посилання (bookera.com/ваш-бізнес), яке легко додати в Instagram." },
  { q: "Кому підходить цей сервіс?", a: "Барберам, перукарям, майстрам манікюру, косметологам та всім, хто працює за попереднім записом." }
];

/**
 * Число, що рахується від нуля, коли зʼявляється на екрані.
 *
 * Раніше лічильник жив у стані ВСІЄЇ сторінки: setPercent кожні 25 мс,
 * 50 разів поспіль. Кожен виклик перемальовував увесь бізнес-лендінг,
 * разом із важкими макетами «Можливостей для росту» - звідси ривки
 * саме тоді, коли людина гортає до цього блоку.
 *
 * Тут число пишеться прямо в елемент через requestAnimationFrame:
 * React не перемальовує нічого, хоч скільки кадрів.
 */
function CountUp({ to, suffix = '', duration = 1200 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = `${to}${suffix}`;
      return;
    }
    let raf = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / duration);
        el.textContent = `${Math.round(to * (1 - Math.pow(1 - k, 3)))}${suffix}`;
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [to, suffix, duration]);

  return <span ref={ref}>0{suffix}</span>;
}

/* ------------------------------------------------------------------ */
/* МОЖЛИВОСТІ ДЛЯ РОСТУ                                                */
/* ------------------------------------------------------------------ */

/**
 * Три можливості: список ліворуч, живий макет праворуч.
 *
 * Раніше - слайдер на 480px зі стрілками поверх картинки, і стан
 * слайдера жив у ВСІЙ сторінці: кожне автоперемикання раз на 5 секунд
 * перемальовувало весь бізнес-лендінг. Тепер стан усередині цього
 * компонента, і перемикання торкається лише його.
 *
 * Компонування як на сторінках Apple: активний пункт розгорнутий
 * і має смужку прогресу, решта - лише заголовок. Усі три теми видно
 * одразу, без гортання, і блок удвічі нижчий.
 *
 * Макети - про те, що система справді робить:
 *   вітрина   - обкладинка, зручності, послуга, запис
 *   розсилки  - лист із промокодом (POST /crm/campaigns)
 *   аналітика - дохід за тижнями
 * Без емодзі: у кожній системі вони малюються по-різному й виглядають
 * чужими в дизайні.
 */

const GROWTH_MS = 6000;

function GrowthStorefront() {
  return (
    <div className="gm gm-store">
      <div className="gm-cover">
        <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=700&q=75" alt="" loading="lazy" />
        <div className="gm-logo">TB</div>
      </div>
      <div className="gm-pad">
        <div className="gm-name">Top Barber</div>
        <div className="gm-sub">Львів, вул. Дорошенка 1</div>
        {/* Зручності - ті самі, що власник обирає у вітрині */}
        <div className="gm-chips"><span>Wi-Fi</span><span>Паркування</span><span>Pet friendly</span></div>
        <div className="gm-service">
          <div><b>Стрижка + борода</b><small>60 хв</small></div>
          <b>800 ₴</b>
        </div>
        <div className="gm-btn">Записатися</div>
      </div>
    </div>
  );
}

function GrowthCampaign() {
  return (
    <div className="gm gm-pad">
      <div className="gm-head">
        <div className="gm-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        </div>
        <div><div className="gm-name">Розсилка листом</div><div className="gm-sub">Клієнти, що не приходили 2 місяці</div></div>
      </div>
      <div className="gm-mail">
        <div className="gm-sub">Тема</div>
        <div className="gm-mail-subj">Сумуємо за вами - знижка на наступний візит</div>
        <div className="gm-code"><span>BACK20</span>−20%</div>
      </div>
      <div className="gm-stats">
        <div><small>Отримувачі</small><b>142</b></div>
        <div><small>Канал</small><b>Email</b></div>
      </div>
    </div>
  );
}

function GrowthAnalytics() {
  const weeks = [48, 62, 55, 80, 100];
  return (
    <div className="gm gm-pad">
      <div className="gm-sub">Дохід за місяць</div>
      <div className="gm-big">84 500 ₴</div>
      <div className="gm-bars">
        {weeks.map((h, i) => (
          <div key={i} className={`gm-bar ${i === weeks.length - 1 ? 'now' : ''}`} style={{ ['--h' as string]: `${h}%`, animationDelay: `${i * 0.07}s` }} />
        ))}
      </div>
      <div className="gm-axis"><span>Тиждень 1</span><span>Цей тиждень</span></div>
    </div>
  );
}

const GROWTH_FEATURES = [
  {
    title: 'Ваша онлайн-вітрина',
    desc: 'Власна сторінка для запису: обкладинка, послуги з цінами, зручності й команда. Клієнт записується сам, без дзвінків.',
    Mockup: GrowthStorefront,
  },
  {
    title: 'Розсилки й промокоди',
    desc: 'Повертайте клієнтів, які давно не приходили: лист із промокодом тим, кому він справді потрібен.',
    Mockup: GrowthCampaign,
  },
  {
    title: 'Аналітика доходу',
    desc: 'Дохід, завантаженість і найпопулярніші послуги - видно, що працює, а що варто змінити.',
    Mockup: GrowthAnalytics,
  },
];

function GrowthFeatures() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Перезапуск смужки прогресу з кожним перемиканням.
  const [cycle, setCycle] = useState(0);

  const select = (i: number) => { setActive(i); setCycle(n => n + 1); };

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => select((active + 1) % GROWTH_FEATURES.length), GROWTH_MS);
    return () => clearTimeout(t);
  }, [active, paused, cycle]);

  const { Mockup } = GROWTH_FEATURES[active];

  return (
    <section className="growth">
      <div className="container">
        <div className="gr-head">
          <h2>Можливості для росту.</h2>
          <p>Аналітика, розсилки та власна онлайн-вітрина. Усе для того, щоб ви заробляли більше.</p>
        </div>

        <div className="gr-body" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="gr-list" role="tablist">
            {GROWTH_FEATURES.map((f, i) => (
              <button
                key={f.title}
                role="tab"
                aria-selected={i === active}
                className={`gr-item ${i === active ? 'on' : ''}`}
                onClick={() => select(i)}
              >
                <span className="gr-title">{f.title}</span>
                {/* Опис видно лише в активного пункту: усі три теми
                    читаються одразу, а деталі - там, куди дивишся. */}
                <span className="gr-desc"><span>{f.desc}</span></span>
                <span className="gr-track">
                  {i === active && (
                    <span
                      key={cycle}
                      className="gr-fill"
                      style={{ animationDuration: `${GROWTH_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="gr-stage">
            {/* key - макет перемальовується й відпрацьовує появу знову. */}
            <div key={active} className="gr-mock"><Mockup /></div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .growth { padding: 6rem 0; background: #fff; }
        .gr-head { max-width: 640px; margin-bottom: 3rem; }
        .gr-head h2 {
          font-size: clamp(2rem, 4.2vw, 3rem);
          font-weight: 700; letter-spacing: -0.035em; line-height: 1.06;
          color: #1D1D1F; margin: 0 0 0.9rem;
        }
        .gr-head p { font-size: 1.125rem; line-height: 1.55; color: #6E6E73; margin: 0; }

        .gr-body { display: grid; grid-template-columns: 1fr 1.1fr; gap: clamp(2rem, 5vw, 4.5rem); align-items: center; }

        .gr-list { display: flex; flex-direction: column; }
        .gr-item {
          display: flex; flex-direction: column; align-items: flex-start; text-align: left;
          padding: 1.25rem 0; border: none; background: none; cursor: pointer; font-family: inherit;
          border-top: 1px solid #EDEDF0;
        }
        .gr-item:last-child { border-bottom: 1px solid #EDEDF0; }
        .gr-title {
          font-size: 1.3rem; font-weight: 600; letter-spacing: -0.02em;
          color: #AEAEB2; transition: color 0.3s ease;
        }
        .gr-item.on .gr-title, .gr-item:hover .gr-title { color: #1D1D1F; }
        /* Опис розгортається плавно через grid-rows, без стрибка висоти. */
        .gr-desc {
          display: grid; grid-template-rows: 0fr; overflow: hidden;
          font-size: 1rem; line-height: 1.55; color: #6E6E73;
          transition: grid-template-rows 0.45s cubic-bezier(0.16, 1, 0.3, 1), margin 0.45s ease, opacity 0.3s ease;
          opacity: 0; margin-top: 0;
        }
        .gr-item.on .gr-desc { grid-template-rows: 1fr; opacity: 1; margin-top: 0.5rem; }
        /* Без внутрішньої обгортки з min-height: 0 рядок сітки 0fr не
           згортається - текст лишався б видимим у неактивних пунктах. */
        .gr-desc > span { min-height: 0; overflow: hidden; }
        .gr-track { display: block; width: 100%; height: 2px; margin-top: 1rem; background: transparent; border-radius: 2px; overflow: hidden; }
        .gr-item.on .gr-track { background: #EDEDF0; }
        .gr-fill {
          display: block; height: 100%; background: #6F9273; transform-origin: left;
          animation-name: grFill; animation-timing-function: linear; animation-fill-mode: forwards;
        }
        @keyframes grFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

        .gr-stage {
          height: 440px; border-radius: 32px;
          background: radial-gradient(80% 60% at 50% 0%, #F4FAF5 0%, transparent 70%), #F5F5F7;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .gr-mock { animation: grIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes grIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }

        /* --- Макети --- */
        .gm {
          width: 290px; background: #fff; border-radius: 22px; overflow: hidden;
          box-shadow: 0 24px 50px -24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
          color: #1D1D1F;
        }
        .gm-pad { padding: 1.25rem; }
        .gm-name { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; }
        .gm-sub { font-size: 0.78rem; color: #86868B; }

        .gm-cover { position: relative; height: 110px; }
        .gm-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .gm-logo {
          position: absolute; left: 1.25rem; bottom: -22px; width: 48px; height: 48px; border-radius: 50%;
          background: #EEF1F6; border: 3px solid #fff; display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; font-weight: 700; color: #222;
        }
        .gm-store .gm-pad { padding-top: 1.9rem; }
        .gm-chips { display: flex; gap: 0.35rem; flex-wrap: wrap; margin: 0.75rem 0; }
        .gm-chips span { font-size: 0.68rem; font-weight: 500; padding: 0.25rem 0.55rem; border-radius: 999px; background: #F4FAF5; color: #2E3A30; }
        .gm-service { display: flex; justify-content: space-between; align-items: center; padding: 0.7rem 0.8rem; border-radius: 12px; background: #F5F5F7; margin-bottom: 0.75rem; font-size: 0.85rem; }
        .gm-service small { display: block; font-size: 0.72rem; color: #86868B; }
        .gm-btn { text-align: center; padding: 0.7rem; border-radius: 12px; background: #1D1D1F; color: #fff; font-size: 0.85rem; font-weight: 600; }

        .gm-head { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 1rem; }
        .gm-icon { width: 38px; height: 38px; border-radius: 11px; background: #F4FAF5; color: #6F9273; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .gm-mail { padding: 0.85rem; border-radius: 14px; background: #F5F5F7; margin-bottom: 0.9rem; }
        .gm-mail-subj { font-size: 0.85rem; font-weight: 600; margin: 0.2rem 0 0.7rem; line-height: 1.35; }
        .gm-code { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; font-weight: 600; color: #2E3A30; }
        .gm-code span { padding: 0.25rem 0.55rem; border-radius: 7px; border: 1px dashed #8FAE93; background: #fff; letter-spacing: 0.04em; }
        .gm-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .gm-stats small { display: block; font-size: 0.7rem; color: #86868B; }
        .gm-stats b { font-size: 1rem; font-weight: 600; }

        .gm-big { font-size: 2rem; font-weight: 700; letter-spacing: -0.035em; margin: 0.15rem 0 1.1rem; font-variant-numeric: tabular-nums; }
        .gm-bars { display: flex; align-items: flex-end; gap: 0.5rem; height: 110px; padding-bottom: 0.6rem; border-bottom: 1px solid #F0F0F2; }
        .gm-bar {
          flex: 1; height: var(--h); border-radius: 6px 6px 3px 3px; background: #DCE8DB;
          transform-origin: bottom; animation: grGrow 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .gm-bar.now { background: #6F9273; }
        @keyframes grGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .gm-axis { display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.7rem; color: #86868B; }

        @media (max-width: 900px) {
          .gr-body { grid-template-columns: 1fr; }
          .gr-stage { height: 400px; order: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gr-mock, .gm-bar { animation: none; }
          .gr-desc { transition: none; }
          .gr-fill { display: none; }
        }
      `}</style>
    </section>
  );
}

export default function BusinessLandingPage() {
  const router = useRouter();

  // 2. ОПТИМІЗАЦІЯ: Кешуємо Supabase-клієнт!
  // Без useMemo він створював би нове з'єднання при кожному мікро-рендері (наприклад, при скролі)
  const supabase = useMemo(() => createClient(), []);

  const [scrollState, setScrollState] = useState('top');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');

  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('client');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const profileRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      const storedRole = localStorage.getItem('userRole') || 'client';
      const storedAvatar = localStorage.getItem('userAvatar');

      if (storedAvatar) setAvatarUrl(storedAvatar);

      if (storedName) {
        setIsLoggedIn(true);
        const displayName = storedName.includes('@') ? 'Користувач' : storedName;
        setUserName(displayName);
        setUserRole(storedRole);

        // localStorage - лише швидкий "перший малюнок", щоб сторінка не
        // блимала. Справжня роль приходить з бекенду: у браузері могло
        // залишитись застаріле значення ('vendor'/'owner' зі старих версій),
        // через яке власник бачив кнопку "Відкрити бізнес" замість кабінету.
        void (async () => {
          try {
            const token = await getAuthToken();
            const me = await api.getMyProfile(token);
            if (me.role) {
              setUserRole(me.role);
              localStorage.setItem('userRole', me.role);
            }
          } catch {
            // Немає сесії або бекенд недоступний - лишаємо значення з localStorage.
          }
        })();

        const nameParts = displayName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());
      }

      // Слухач миттєвого оновлення аватарки при зміні в іншій вкладці
      const handleStorageUpdate = () => {
        setAvatarUrl(localStorage.getItem('userAvatar') || null);
        const updatedName = localStorage.getItem('userName');
        if (updatedName) setUserName(updatedName);
      };
      window.addEventListener('storage', handleStorageUpdate);
    }

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          if (scrollY > 500) {
            setScrollState(prev => prev !== 'scrolled' ? 'scrolled' : prev);
          } else if (scrollY > 200) {
            setScrollState(prevState => {
              if (prevState === 'scrolled') return 'hiding';
              if (prevState === 'top') return 'top';
              return prevState;
            });
          } else {
            setScrollState(prev => prev !== 'top' ? 'top' : prev);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');

          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    setTimeout(() => {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
    }, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
    };
    const handleScrollClose = () => {
      if (isProfileOpen) setIsProfileOpen(false);
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollClose, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollClose);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userAvatar');
    setAvatarUrl(null);
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUserName(null);
    setUserRole('client');
    router.refresh();
  };

  const handleModalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (error) {
          alert(`Помилка входу: ${error.message}`);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', data.user.id)
          .single();

        const metadataName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name;
        let finalName = profile?.full_name || metadataName || 'Василь Циган';

        if (finalName.includes('@')) {
          finalName = 'Василь Циган';
        }

        const finalRole = profile?.role || 'client';

        localStorage.setItem('userName', finalName);
        localStorage.setItem('userRole', finalRole);
        localStorage.setItem('userId', data.user.id);

        setUserName(finalName);
        setUserRole(finalRole);
        const nameParts = finalName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);

        if (finalRole === 'vendor') {
          router.replace('/cabinet');
        } else {
          router.push('/business/register');
        }
      } else {
        const targetEmail = loginEmail.trim().toLowerCase();
        const targetFullName = `${regFirstName} ${regLastName}`.trim();

        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password: loginPassword,
          options: {
            data: {
              full_name: targetFullName
            }
          }
        });

        if (error) {
          alert(`Помилка реєстрації: ${error.message}`);
          return;
        }

        localStorage.setItem('userName', targetFullName);
        localStorage.setItem('userRole', 'client');
        if (data?.session?.user) {
          localStorage.setItem('userId', data.session.user.id);
        }

        setUserName(targetFullName);
        setUserRole('client');
        setInitials((regFirstName[0] + (regLastName[0] || '')).toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);
        router.push('/business/register');
      }
    } catch (error) {
      alert("Відбулася непередбачувана помилка при з'єднанні з сервером.");
    }
  };

  const handleStartBusinessClick = async () => {
    if (isLoggedIn) {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setIsLoginView(false);
        setIsAuthModalOpen(true);
        return;
      }

      // Перевіряємо, чи є у цього власника реальний бізнес - через
      // /crm/businesses/me (єдине надійне джерело "мого бізнесу"),
      // а не пряме звернення в базу.
      try {
        // getAuthTokenOrNull, а не getAuthToken: людина могла не увійти
        // або сесія добігла кінця, поки вкладка була відкрита. Це
        // звичайний стан, а не аварія - виняток тут лише засмічував
        // консоль помилкою «Сесія закінчилась».
        const token = await getAuthTokenOrNull();
        if (!token) {
          localStorage.removeItem('userName');
          localStorage.removeItem('userRole');
          setIsLoggedIn(false);
          setIsLoginView(true);
          setIsAuthModalOpen(true);
          return;
        }

        const me = await api.getMyProfile(token);

        if (me.business_id) {
          router.push('/cabinet');
        } else {
          localStorage.setItem('userRole', 'client');
          setUserRole('client');
          router.push('/business/register');
        }
      } catch (err: any) {
        // Сюди тепер потрапляють лише справжні збої (бекенд недоступний
        // тощо) - відсутність сесії обробляється вище, до запиту.
        console.error('Не вдалося перевірити бізнес:', err);
        router.push('/business/register');
      }
    } else {
      setIsLoginView(false);
      setIsAuthModalOpen(true);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  if (!mounted) return null;

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#111827', overflowX: 'hidden' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; position: relative; z-index: 10; }
        @media (max-width: 768px) { .container { padding: 0 1.5rem; } }
        
        .anim { transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); will-change: transform, opacity; }
        
        .hero-title { font-size: clamp(3rem, 6vw, 5.2rem); font-weight: 900; letter-spacing: -0.04em; line-height: 1.05; color: #111827; margin-bottom: 1.5rem; position: relative; z-index: 2; }
        .hero-subtitle { font-size: clamp(1.1rem, 2vw, 1.25rem); font-weight: 400; color: #64748b; max-width: 600px; margin: 0 auto 2.5rem auto; line-height: 1.5; position: relative; z-index: 2; }

        .btn-primary { background-color: #C2D8C4; color: #111827; font-weight: 700; font-size: 1.05rem; padding: 1.1rem 2.4rem; border-radius: 999px; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: transform 0.3s ease, box-shadow 0.3s ease; box-shadow: 0 10px 25px rgba(194, 216, 196, 0.4); will-change: transform; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(194, 216, 196, 0.6); }

        .btn-secondary { background-color: #ffffff; color: #111827; font-weight: 700; font-size: 1.05rem; padding: 1rem 2.4rem; border-radius: 999px; border: 1px solid #e2e8f0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.3s ease; will-change: transform; }
        .btn-secondary:hover { background-color: #f8fafc; border-color: #cbd5e1; transform: translateY(-2px); }

        .main-header { position: absolute; top: 0; left: 0; width: 100%; height: 72px; z-index: 1000; display: flex; align-items: center; background-color: transparent; border-bottom: 1px solid transparent; will-change: transform, background-color; }
        .main-header.top { transform: translateY(0); }
        .main-header.scrolled { position: fixed; background-color: rgba(255, 255, 255, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid #f1f5f9; box-shadow: 0 4px 30px rgba(0,0,0,0.05); animation: slideDown 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
        .main-header.hiding { position: fixed; background-color: rgba(255, 255, 255, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid #f1f5f9; box-shadow: 0 4px 30px rgba(0,0,0,0.05); animation: slideUp 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(0); } to { transform: translateY(-100%); } }

        .bento-grid { display: grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 380px; gap: 1.5rem; margin-top: 3rem; }
        @media (max-width: 992px) { .bento-grid { grid-template-columns: 1fr; grid-auto-rows: auto; } }

        .bento-card { background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 32px; padding: 2.5rem; position: relative; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.4s ease, box-shadow 0.4s ease; will-change: transform; }
        .bento-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.04); }
        
        .bento-large { grid-column: span 8; }
        .bento-small { grid-column: span 4; }
        @media (max-width: 992px) { .bento-large, .bento-small { grid-column: span 1 !important; min-height: 380px; } }

        .bento-tag { display: inline-block; padding: 0.3rem 0.8rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; align-self: flex-start; }
        .bento-title { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; color: #111827; line-height: 1.1; margin-bottom: 0.5rem; z-index: 2; }
        .bento-desc { font-size: 1rem; color: #64748b; line-height: 1.5; font-weight: 400; max-width: 280px; z-index: 2; }

        .ui-mockup-calendar { position: absolute; right: -20px; bottom: -20px; width: 55%; height: 75%; background: #ffffff; border-radius: 24px 0 0 0; box-shadow: -15px -15px 40px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; padding: 1.5rem; z-index: 1; transform: translateZ(0); }
        .ui-appointment { background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.8rem; }
        .ui-appointment.blue { background: #eff6ff; border-left: 4px solid #2563eb; }

        .text-content { max-width: 40%; position: relative; z-index: 10; padding-right: 1rem; }
        @media (max-width: 992px) {
          .text-content { max-width: 100%; margin-bottom: 2rem; padding-right: 0; }
          .ui-mockup-calendar { position: relative !important; right: auto !important; bottom: auto !important; width: 100% !important; height: auto !important; border-radius: 20px !important; box-shadow: 0 10px 30px rgba(0,0,0,0.05) !important; padding: 1.5rem !important; }
        }
        
        .reveal-on-scroll { opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1); will-change: opacity, transform; }
        .reveal-on-scroll.is-visible { opacity: 1; transform: translate(0, 0); }
        .delay-100 { transition-delay: 100ms; }

        .text-glow-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -60%);
          width: 280%;
          height: 350%;
          background: radial-gradient(ellipse at center, rgba(143, 174, 146, 0.25) 0%, rgba(143, 174, 146, 0.08) 45%, transparent 75%);
          filter: blur(45px);
          z-index: -1;
          pointer-events: none;
        }

        .modal-input { width: 100%; padding: 0.9rem 1.2rem; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem; box-sizing: border-box; margin-bottom: 1rem; transition: 0.2s; background-color: #f8fafc; }
        .modal-input:focus { outline: none; border-color: #C2D8C4; background-color: #ffffff; box-shadow: 0 0 0 4px rgba(194, 216, 196, 0.2); }
        .social-btn { display: flex; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; padding: 0.9rem; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; font-weight: 600; color: #111827; cursor: pointer; margin-bottom: 0.75rem; transition: 0.2s; font-size: 1rem; }
        .social-btn:hover { background: #f8fafc; }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes toggleBg { from { background-color: #e2e8f0; } to { background-color: #16a34a; } }
        @keyframes toggleCir { from { transform: translateX(0); } to { transform: translateX(20px); } }

        .reveal-on-scroll.is-visible .anim-slide-1 { opacity: 0; animation: slideInUp 0.5s ease forwards 0.2s; }
        .reveal-on-scroll.is-visible .anim-slide-2 { opacity: 0; animation: slideInUp 0.5s ease forwards 0.4s; }
        .reveal-on-scroll.is-visible .anim-pop { opacity: 0; animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.3s; }
        .reveal-on-scroll.is-visible .anim-toggle-bg { animation: toggleBg 0.4s ease forwards 0.5s; background-color: #e2e8f0; }
        .reveal-on-scroll.is-visible .anim-toggle-circle { animation: toggleCir 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.5s; }

        .explore-slider-container { display: flex; align-items: center; justify-content: space-between; gap: 4rem; margin-top: 3rem; }
        @media (max-width: 992px) { .explore-slider-container { flex-direction: column; text-align: center; gap: 2rem; } }
        
        .slider-text-area { flex: 1; max-width: 450px; }
        .slider-image-area { flex: 1.2; height: 480px; background: #f8fafc; border-radius: 40px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; transform: translateZ(0); }
        @media (max-width: 992px) { .slider-image-area { width: 100%; height: 400px; } }

        .slider-nav-btn { width: 48px; height: 48px; border-radius: 50%; background: #111827; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer; border: none; transition: transform 0.2s; will-change: transform; }
        .slider-nav-btn:hover { transform: scale(1.05); }

        .slider-progress-track { width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; margin-top: 3rem; position: relative; overflow: hidden; }
        .slider-progress-fill { height: 100%; background: #8fae92; transition: width 0.4s ease; will-change: width; }

        .faq-answer-wrapper { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease; }
        .faq-answer-wrapper.open { grid-template-rows: 1fr; }
        .faq-answer-inner { overflow: hidden; color: #64748b; font-size: 1rem; line-height: 1.6; }
        .faq-icon { transition: transform 0.3s ease; }
        .faq-icon.open { transform: rotate(180deg); }

        .dark-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
        @media (max-width: 992px) {
          .dark-hero-grid { grid-template-columns: 1fr; text-align: center; gap: 4rem; }
        }

        /* ЧОРНИЙ ФУТЕР */
        .clean-dark-footer {
          background-color: #111215;
          color: #ffffff;
          padding: 4.5rem 0 2.5rem 0;
          position: relative;
          z-index: 10;
        }
        .footer-col-title {
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1.35rem;
        }
        .footer-nav-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.15s ease, transform 0.15s ease;
          display: inline-block;
          line-height: 1.5;
        }
        .footer-nav-link:hover {
          color: #ffffff;
          transform: translateX(2px);
        }
      `}} />

      {/* МОДАЛКА ЛОГІНУ/РЕЄСТРАЦІЇ */}
      {isAuthModalOpen && (
        <div onClick={() => setIsAuthModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(17, 24, 39, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="anim" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <button onClick={() => { setIsAuthModalOpen(false); setIsLoginView(true); }} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>×</button>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem', color: '#111827', letterSpacing: '-0.02em' }}>{isLoginView ? 'З поверненням' : 'Почати роботу'}</h2>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.4' }}>{isLoginView ? 'Увійдіть, щоб керувати розкладом.' : 'Створіть акаунт для вашого бізнесу.'}</p>
            <form onSubmit={handleModalAuth}>
              {!isLoginView && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0rem' }}>
                  <input type="text" placeholder="Ім'я" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} className="modal-input" required />
                  <input type="text" placeholder="Прізвище" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} className="modal-input" required />
                </div>
              )}
              <input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="modal-input" required />
              <input type="password" placeholder="Пароль" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="modal-input" required />
              <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: '#111827', color: '#fff', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', marginBottom: '1.5rem', marginTop: '0.5rem', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#0f172a'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#111827'}>{isLoginView ? 'Продовжити' : 'Зареєструватись'}</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#94a3b8', fontSize: '0.85rem' }}><div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div><span style={{ padding: '0 1rem' }}>АБО</span><div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div></div>
            <button className="social-btn" onClick={() => alert('Ця функція з\'явиться пізніше')}>Google</button>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#64748b', marginTop: '1.5rem' }}>{isLoginView ? (<>Немає акаунту? <span onClick={() => setIsLoginView(false)} style={{ color: '#111827', fontWeight: '700', cursor: 'pointer' }}>Створити</span></>) : (<>Вже маєте акаунт? <span onClick={() => setIsLoginView(true)} style={{ color: '#111827', fontWeight: '700', cursor: 'pointer' }}>Увійти</span></>)}</p>
          </div>
        </div>
      )}

      {/* ОНОВЛЕНИЙ ХЕДЕР БІЗНЕС-ЛЕНДІНГУ */}
      <header className={`main-header ${scrollState}`}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%', gap: '1.5rem' }}>

          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827', letterSpacing: '-0.04em', transition: 'color 0.3s ease' }}>
                Book<span style={{ color: '#8fae92' }}>Era</span>
              </div>
              <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '700', marginLeft: '6px' }}>Business</span>
            </Link>
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem' }}>
            <Link
              href="/"
              style={{ whiteSpace: 'nowrap', color: '#475569', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '600', transition: 'color 0.2s ease', cursor: 'pointer' }}
              onMouseOver={e => { e.currentTarget.style.color = '#8fae92'; }}
              onMouseOut={e => { e.currentTarget.style.color = '#475569'; }}
            >
              Для клієнтів
            </Link>

            {isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={profileRef}>
                <div
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.65rem', userSelect: 'none', padding: '0.3rem 0.5rem', borderRadius: '20px', transition: 'all 0.2s ease' }}
                  className="anim"
                >
                  <span style={{ color: '#111827', fontSize: '0.95rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                    {userName}
                  </span>

                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={userName || 'Аватарка'}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <Avatar name={userName} size={36} />
                  )}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}>
                    <path d="M1 1L5 5L9 1" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {isProfileOpen && (
                  <div className="search-dropdown anim" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 16px 40px rgba(0,0,0,0.08)', padding: '0.4rem', zIndex: 1001, border: '1px solid #e2e8f0' }}>
                    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#222222', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                    </div>
                    <Link href="/account/profile" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Мій профіль</Link>
                    {isBusinessRole(userRole) && (<Link href="/cabinet" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Бізнес-кабінет</Link>)}
                    <Link href="/account/profile" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                    <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid #f1f5f9', marginTop: '2px', boxSizing: 'border-box' }}>Вийти з акаунту</button>
                  </div>
                )}
              </div>
            ) : (
              <span
                onClick={() => { setIsLoginView(true); setIsAuthModalOpen(true); }}
                className="anim"
                style={{ color: '#475569', cursor: 'pointer', transition: 'color 0.2s ease', fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap' }}
                onMouseOver={e => { e.currentTarget.style.color = '#8fae92'; }}
                onMouseOut={e => { e.currentTarget.style.color = '#475569'; }}
              >
                Увійти / Зареєструватись
              </span>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ paddingTop: '160px', paddingBottom: '80px', textAlign: 'center', position: 'relative' }}>
        <div className="container" style={{ position: 'relative', zIndex: 10 }}>
          <div className="reveal-on-scroll">
            <h1 className="hero-title">
              Керуйте бізнесом.<br />
              <span style={{ position: 'relative', display: 'inline-block' }}>
                 <div className="text-glow-bg"></div>
                 <span style={{ color: '#8fae92', position: 'relative', zIndex: 1 }}>Легко. Красиво.</span>
              </span>
            </h1>
            <p className="hero-subtitle">
              Більше часу на улюблену роботу, менше — на рутину. BookEra бере на себе онлайн-запис, нагадування та фінанси.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={handleStartBusinessClick} className="btn-primary">
                {isBusinessRole(userRole) ? 'Перейти в кабінет' : isLoggedIn ? 'Відкрити бізнес' : 'Створити профіль'}
              </button>
              <button onClick={() => document.getElementById('bento')?.scrollIntoView({ behavior: 'smooth' })} className="btn-secondary">
                Огляд функцій
              </button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1.5rem', fontWeight: '500' }}>
              Базовий функціонал назавжди безкоштовний.
            </p>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="reveal-on-scroll delay-100" style={{ padding: '0 0 5rem 0' }}>
        <div className="container">
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '2.5rem 0' }}>
              <div><div style={{ fontSize: '3rem', fontWeight: '900', color: '#111827', marginBottom: '0.2rem', letterSpacing: '-0.04em' }}>24/7</div><div style={{ color: '#64748b', fontWeight: '500', fontSize: '0.95rem' }}>Онлайн-запис без вас</div></div>
              <div><div style={{ fontSize: '3rem', fontWeight: '900', color: '#111827', marginBottom: '0.2rem', letterSpacing: '-0.04em' }}>-40%</div><div style={{ color: '#64748b', fontWeight: '500', fontSize: '0.95rem' }}>Зменшення неявок</div></div>
              <div><div style={{ fontSize: '3rem', fontWeight: '900', color: '#111827', marginBottom: '0.2rem', letterSpacing: '-0.04em' }}>+25%</div><div style={{ color: '#64748b', fontWeight: '500', fontSize: '0.95rem' }}>Зростання прибутку</div></div>
            </div>
        </div>
      </section>

      {/* BENTO GRID SECTION */}
      <section id="bento" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal-on-scroll">
            <h2 style={{ fontSize: '3rem', fontWeight: '900', textAlign: 'center', letterSpacing: '-0.03em', color: '#111827', marginBottom: '1rem' }}>Базовий арсенал майстра.</h2>
          </div>

          <div className="bento-grid">
            <div className="bento-card bento-large reveal-on-scroll">
              <div className="text-content">
                <span className="bento-tag">Календар</span>
                <h3 className="bento-title">Ідеальний розклад.</h3>
                <p className="bento-desc">Забудьте про блокноти. Керуйте часом зручно з телефону.</p>
              </div>

              <div className="ui-mockup-calendar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#111827' }}>Сьогодні</div>
                  <div style={{ background: '#f1f5f9', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Вересень</div>
                </div>
                <div className="ui-appointment anim-slide-1">
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700', marginBottom: '4px' }}>10:00 - 11:30</div>
                  <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '700' }}>Стрижка</div>
                </div>
                <div className="ui-appointment blue anim-slide-2">
                  <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700', marginBottom: '4px' }}>12:00 - 14:00</div>
                  <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '700' }}>Фарбування</div>
                </div>
              </div>
            </div>

            <div className="bento-card bento-small reveal-on-scroll delay-100" style={{ background: '#111827' }}>
              <span className="bento-tag" style={{ background: 'rgba(255,255,255,0.1)', color: '#C2D8C4', border: 'none' }}>База клієнтів</span>
              <h3 className="bento-title" style={{ color: '#ffffff' }}>Всі клієнти<br/>як на долоні.</h3>
              <div className="anim-slide-1" style={{ marginTop: 'auto', display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                 <div style={{ width: '36px', height: '36px', background: '#C2D8C4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontWeight: '800' }}>М</div>
                 <div>
                    <div style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>Михайло В.</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Останній візит: 14 днів тому</div>
                 </div>
              </div>
            </div>

            <div className="bento-card bento-small reveal-on-scroll">
              <span className="bento-tag">Сповіщення</span>
              <h3 className="bento-title">Автоматичні <br/>нагадування.</h3>
              <div className="anim-pop" style={{ marginTop: 'auto', background: '#ffffff', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', gap: '0.8rem', boxShadow: '0 10px 20px rgba(0,0,0,0.02)' }}>
                 {/* Фірмова іконка застосунку замість емодзі: емодзі в
                     кожній системі малюється по-різному й виглядає як
                     чужий елемент у дизайні. */}
                 <div style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '9px', background: 'linear-gradient(145deg, #2E3A30, #1D1D1F)', color: '#C2D8C4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 800 }}>B</div>
                 <div>
                    <div style={{ color: '#111827', fontWeight: '700', fontSize: '0.85rem', marginBottom: '2px' }}>BookEra</div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: '1.4' }}>Нагадуємо про запис завтра о 14:00!</div>
                 </div>
              </div>
            </div>

            <div className="bento-card bento-large reveal-on-scroll delay-100 finance-card-trigger" style={{ background: '#f0fdf4', borderColor: '#dcfce7' }}>
              <div className="text-content">
                <span className="bento-tag" style={{ background: '#ffffff', color: '#166534', borderColor: '#bbf7d0' }}>Фінанси</span>
                <h3 className="bento-title" style={{ color: '#14532d' }}>Захистіть дохід.</h3>
                <p className="bento-desc" style={{ color: '#166534' }}>Беріть передоплату та захистіть себе від скасувань.</p>
              </div>

              <div className="ui-mockup-calendar" style={{ right: '-20px', bottom: '-20px', width: '50%', height: '80%', padding: '1.5rem' }}>
                 <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>Налаштування</div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.9rem' }}>Передоплата</div>
                    <div className="anim-toggle-bg" style={{ width: '40px', height: '22px', borderRadius: '11px', position: 'relative' }}>
                       <div className="anim-toggle-circle" style={{ position: 'absolute', left: '2px', top: '2px', width: '18px', height: '18px', background: '#fff', borderRadius: '50%' }}></div>
                    </div>
                 </div>
                 <div className="anim-slide-1" style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Сума передоплати</div>
                    <div style={{ fontSize: '1.8rem', color: '#111827', fontWeight: '900' }}><CountUp to={50} suffix="%" /></div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EXPLORE FEATURES */}
      {/* МОЖЛИВОСТІ ДЛЯ РОСТУ - власний компонент зі своїм станом. */}
      <GrowthFeatures />

      {/* FINAL HERO */}
      <section className="reveal-on-scroll" style={{ backgroundColor: '#8fae92', position: 'relative', zIndex: 20, padding: '0', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-10%', right: '5%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, rgba(255,255,255,0) 70%)', filter: 'blur(50px)' }}></div>
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 10 }}>
          <div className="dark-hero-grid">

            <div className="dark-hero-content" style={{ padding: '8rem 0' }}>
              <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: '900', color: '#111827', marginBottom: '1rem', letterSpacing: '-0.04em', lineHeight: '1.05' }}>
                Управління бізнесом. <br/> На новому рівні.
              </h2>
              <p style={{ color: '#1f2937', fontSize: '1.05rem', marginBottom: '2.5rem', lineHeight: '1.5', maxWidth: '450px', fontWeight: '500' }}>
                Всі необхідні інструменти для бронювання, фінансів та клієнтів — в одному зручному додатку.
              </p>
              <button onClick={handleStartBusinessClick} style={{ backgroundColor: '#111827', color: '#ffffff', fontWeight: '700', fontSize: '1rem', padding: '1.1rem 2.8rem', borderRadius: '999px', border: 'none', cursor: 'pointer', transition: '0.3s', boxShadow: '0 15px 30px rgba(17, 24, 39, 0.15)', willChange: 'transform' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-3px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
                {isBusinessRole(userRole) ? 'Перейти в кабінет' : 'Створити акаунт'}
              </button>
            </div>

            <div style={{ position: 'relative', height: '100%', minHeight: '600px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', bottom: '-50px', left: '0', right: '0', display: 'flex', justifyContent: 'center', zIndex: 30 }}>
                <div style={{
                  width: '300px', height: '620px', backgroundColor: '#f1f5f9', borderRadius: '54px', padding: '4px',
                  boxShadow: '0 30px 60px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.5)', position: 'relative'
                }}>
                  <div style={{
                    width: '100%', height: '100%', backgroundColor: '#111827', borderRadius: '50px', padding: '10px',
                  }}>
                    <div className="hide-scrollbar" style={{
                      width: '100%', height: '100%', backgroundColor: '#ffffff', borderRadius: '40px', position: 'relative', overflowY: 'auto', overflowX: 'hidden'
                    }}>
                      <div style={{ position: 'absolute', top: '11px', left: '50%', transform: 'translateX(-50%)', width: '85px', height: '26px', backgroundColor: '#000000', borderRadius: '20px', zIndex: 20 }}></div>
                      <div style={{ position: 'absolute', top: '15px', left: '24px', fontSize: '0.85rem', fontWeight: '800', color: '#111827', zIndex: 10, letterSpacing: '-0.02em' }}>9:41</div>

                      <div style={{ position: 'absolute', top: '17px', right: '20px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10 }}>
                        <svg width="15" height="10" viewBox="0 0 18 12" fill="#111827" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="6" width="3" height="6" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                        <svg width="15" height="10" viewBox="0 0 17 12" fill="#111827" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 12C9.32843 12 10 11.3284 10 10.5C10 9.67157 9.32843 9 8.5 9C7.67157 9 7 9.67157 7 10.5C7 11.3284 7.67157 12 8.5 12Z" /><path d="M12.515 7.621C11.432 6.649 10.036 6.136 8.5 6.136C6.964 6.136 5.568 6.649 4.485 7.621C4.159 7.913 3.661 7.884 3.369 7.558C3.076 7.231 3.105 6.733 3.432 6.441C4.805 5.21 6.579 4.536 8.5 4.536C10.421 4.536 12.195 5.21 13.568 6.441C13.895 6.733 13.924 7.231 13.631 7.558C13.339 7.884 12.841 7.913 12.515 7.621Z" /><path d="M15.92 4.498C13.968 2.766 11.352 1.745 8.5 1.745C5.648 1.745 3.032 2.766 1.08 4.498C0.745 4.795 0.248 4.755 -0.049 4.42C-0.346 4.085 -0.306 3.588 0.029 3.291C2.282 1.285 5.257 0.145 8.5 0.145C11.743 0.145 14.718 1.285 16.971 3.291C17.306 3.588 17.346 4.085 17.049 4.42C16.752 4.755 16.255 4.795 15.92 4.498Z" /></svg>
                        <svg width="22" height="10" viewBox="0 0 25 12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#111827" strokeWidth="1"/><rect x="2.5" y="2.5" width="17" height="7" rx="2" fill="#111827"/><path d="M23 4.5C23.5523 4.5 24 4.94772 24 5.5V6.5C24 7.05228 23.5523 7.5 23 7.5" stroke="#111827" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>

                      <div style={{ padding: '1.2rem', paddingTop: '3.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#111827' }}>Сьогодні</div>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.8rem' }}>+</div>
                        </div>
                        <div style={{ background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '16px', padding: '1rem', marginBottom: '0.8rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '700', marginBottom: '4px' }}>10:00 - 11:30</div>
                          <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '800' }}>Чоловіча стрижка</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>Олександр П.</div>
                        </div>
                        <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '16px', padding: '1rem', marginBottom: '0.8rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700', marginBottom: '4px' }}>12:00 - 14:00</div>
                          <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '800' }}>Фарбування</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>Марія К.</div>
                        </div>
                        <div style={{ background: '#fef2f2', borderLeft: '4px solid #dc2626', borderRadius: '16px', padding: '1rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '700', marginBottom: '4px' }}>15:00 - 16:00</div>
                          <div style={{ fontSize: '1rem', color: '#111827', fontWeight: '800' }}>Корекція бороди</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>Іван С.</div>
                        </div>
                      </div>
                      <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', width: '100px', height: '4px', backgroundColor: '#cbd5e1', borderRadius: '10px', zIndex: 20 }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="reveal-on-scroll" style={{ padding: '8rem 0 6rem 0', backgroundColor: '#f8fafc', position: 'relative', zIndex: 10 }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem' }}>
            <div>
              <h2 style={{ fontSize: 'clamp(2.2rem, 4vw, 3rem)', fontWeight: '900', color: '#111827', letterSpacing: '-0.04em', lineHeight: '1.1', marginBottom: '1rem' }}>Часті<br/>питання</h2>
              <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '2rem', maxWidth: '350px', lineHeight: '1.5' }}>Ми зібрали відповіді на найпопулярніші питання користувачів.</p>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0' }}>
              {faqs.map((faq, index) => (
                <div key={index} style={{ borderBottom: '1px solid #e2e8f0', padding: '1.2rem 0' }}>
                  <button onClick={() => toggleFaq(index)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '0', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#111827', paddingRight: '1.5rem' }}>{faq.q}</span>
                    <span className={`faq-icon ${openFaq === index ? 'open' : ''}`} style={{ fontSize: '1.2rem', color: '#64748b' }}>▼</span>
                  </button>
                  <div className={`faq-answer-wrapper ${openFaq === index ? 'open' : ''}`}>
                    <div className="faq-answer-inner"><div style={{ paddingTop: '0.8rem' }}>{faq.a}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ЧОРНИЙ ФУТЕР ІЗ КОТИКОМ */}
      <footer className="clean-dark-footer" style={{ marginTop: 'auto', position: 'relative', overflow: 'hidden' }}>
        <div className="container">

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3.5rem' }}>
            <div>
              <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.04em' }}>
                  Book<span style={{ color: '#8fae92' }}>Era</span>
                </div>
              </Link>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: '1.6', margin: '0 0 1.25rem 0', maxWidth: '300px' }}>
                Простий та надійний онлайн-запис до перевірених майстрів і салонів краси у вашому місті.
              </p>
            </div>

            <div>
              <div className="footer-col-title">Можливості</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/" className="footer-nav-link">Онлайн-запис</Link>
                <Link href="/" className="footer-nav-link">Пошук закладів</Link>
                <Link href="/" className="footer-nav-link">Подарункові сертифікати</Link>
                <Link href="/account/profile" className="footer-nav-link">Особистий кабінет</Link>
              </div>
            </div>

            <div>
              <div className="footer-col-title">Для бізнесу</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/business" className="footer-nav-link" style={{ color: '#C2D8C4', fontWeight: 600 }}>BookEra Business</Link>
                <Link href="/business/register" className="footer-nav-link">Підключити салон</Link>
                <Link href="/cabinet" className="footer-nav-link">Панель керування CRM</Link>
                <Link href="/business#pricing" className="footer-nav-link">Тарифи</Link>
              </div>
            </div>

            <div>
              <div className="footer-col-title">Підтримка</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="#" className="footer-nav-link">Служба турботи</Link>
                <Link href="/#faq" className="footer-nav-link">Поширені запитання</Link>
                <Link href="#" className="footer-nav-link">Безпека клієнтів</Link>
                <Link href="#" className="footer-nav-link">Контакти команди</Link>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <Link href="#" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ</Link>
                <Link href="#" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>УМОВИ ВИКОРИСТАННЯ</Link>
                <Link href="#" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>БЕЗПЕКА</Link>
              </div>

              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
                © 2026 BookEra. Платформа онлайн-запису до закладів краси в Україні.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', color: '#64748B', fontSize: '0.82rem', fontWeight: 500 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                SSL Захист
              </span>
              <span>•</span>
              <span>Україна • UA</span>
            </div>
          </div>

        </div>

        {/* ВЕСЕЛИЙ КОТИК В НИЗУ ФУТЕРА */}
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none', zIndex: 12, lineHeight: 0 }}>
          <svg width="84" height="42" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <path d="M20 50 C20 22, 80 22, 80 50 Z" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="26,30 20,8 38,22" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="27,27 23,13 35,21" fill="#FFB4C2" />
            <polygon points="74,30 80,8 62,22" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="73,27 77,13 65,21" fill="#FFB4C2" />
            <ellipse cx="40" cy="34" rx="3.5" ry="4.5" fill="#C2D8C4" />
            <circle cx="41" cy="33" r="1.5" fill="#111" />
            <ellipse cx="60" cy="34" rx="3.5" ry="4.5" fill="#C2D8C4" />
            <circle cx="61" cy="33" r="1.5" fill="#111" />
            <polygon points="50,38 47,35 53,35" fill="#FFB4C2" />
            <line x1="33" y1="36" x2="18" y2="34" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="33" y1="38" x2="19" y2="39" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="67" y1="36" x2="82" y2="34" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="67" y1="38" x2="81" y2="39" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <ellipse cx="28" cy="48" rx="6" ry="4" fill="#2D2F36" stroke="#111" strokeWidth="1" />
            <ellipse cx="72" cy="48" rx="6" ry="4" fill="#2D2F36" stroke="#111" strokeWidth="1" />
          </svg>
        </div>
      </footer>
    </div>
  );
}