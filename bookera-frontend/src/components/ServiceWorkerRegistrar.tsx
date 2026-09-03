'use client';

import { useEffect } from 'react';

/**
 * Реєстрація Service Worker для PWA.
 *
 * Раніше це був інлайновий <script dangerouslySetInnerHTML> прямо в
 * layout.tsx. React на це скаржився ("Encountered a script tag while
 * rendering React component") і — головне — через нього падала гідратація:
 * сервер віддавав <script>, клієнт малював інше, дерево розходилось і
 * React перемальовував усю сторінку заново. Саме тому стилі й поведінка
 * виглядали непередбачувано.
 *
 * useEffect виконується лише в браузері й після монтування, тому в
 * серверний HTML нічого не потрапляє і розходитись немає чому.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // У режимі розробки SW лише заважає: він кешує сторінки й віддає
    // стару версію після змін у коді.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => void reg.unregister());
      });
      return;
    }

    const onLoad = () => {
      void navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Не вдалося зареєструвати Service Worker:', err);
      });
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);

    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
