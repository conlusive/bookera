'use client';

import { useEffect } from 'react';

/**
 * Поки на екрані відкрите вікно (запис, відгуки, галерея, форми кабінету),
 * сторінка за ним не повинна прокручуватись.
 *
 * Один компонент у кореневому layout замість правок у кожному вікні:
 * він сам помічає накладки на весь екран (position: fixed, майже весь
 * viewport) і
 *  1) блокує прокрутку сторінки (клас на <html>, з компенсацією ширини
 *     смуги прокрутки, щоб сторінка не «стрибала»),
 *  2) глушить колесо/дотик на самій накладці, якщо під курсором немає
 *     блоку, що справді прокручується. Для кабінету це важливо: там
 *     прокручується внутрішній контейнер, а не body.
 */

const CLASS = 'modal-scroll-locked';

function isFullScreenOverlay(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const cs = getComputedStyle(el);
  if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.95 && r.height >= window.innerHeight * 0.95;
}

function canScroll(el: HTMLElement, deltaY: number): boolean {
  const oy = getComputedStyle(el).overflowY;
  if (oy !== 'auto' && oy !== 'scroll') return false;
  if (el.scrollHeight <= el.clientHeight) return false;
  return deltaY < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
}

export default function ModalScrollLock() {
  useEffect(() => {
    const overlays = new Set<HTMLElement>();
    const guards = new Map<HTMLElement, () => void>();
    let lastTouchY = 0;

    const guard = (overlay: HTMLElement) => {
      const onWheel = (e: WheelEvent) => {
        let n = e.target as HTMLElement | null;
        while (n && n !== overlay.parentElement) {
          if (n instanceof HTMLElement && canScroll(n, e.deltaY)) return;
          if (n === overlay) break;
          n = n.parentElement;
        }
        e.preventDefault();
      };
      const onTouchStart = (e: TouchEvent) => { lastTouchY = e.touches[0]?.clientY ?? 0; };
      const onTouchMove = (e: TouchEvent) => {
        const y = e.touches[0]?.clientY ?? 0;
        const delta = lastTouchY - y;
        lastTouchY = y;
        let n = e.target as HTMLElement | null;
        while (n) {
          if (n instanceof HTMLElement && canScroll(n, delta)) return;
          if (n === overlay) break;
          n = n.parentElement;
        }
        if (e.cancelable) e.preventDefault();
      };
      overlay.addEventListener('wheel', onWheel, { passive: false });
      overlay.addEventListener('touchstart', onTouchStart, { passive: true });
      overlay.addEventListener('touchmove', onTouchMove, { passive: false });
      guards.set(overlay, () => {
        overlay.removeEventListener('wheel', onWheel);
        overlay.removeEventListener('touchstart', onTouchStart);
        overlay.removeEventListener('touchmove', onTouchMove);
      });
    };

    const apply = () => {
      const root = document.documentElement;
      if (overlays.size > 0) {
        if (!root.classList.contains(CLASS)) {
          const sb = window.innerWidth - root.clientWidth;
          root.style.setProperty('--scrollbar-comp', `${Math.max(0, sb)}px`);
          root.classList.add(CLASS);
        }
      } else {
        root.classList.remove(CLASS);
        root.style.removeProperty('--scrollbar-comp');
      }
    };

    const consider = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      if (isFullScreenOverlay(node) && !overlays.has(node)) {
        overlays.add(node);
        guard(node);
      }
    };

    const prune = () => {
      overlays.forEach(el => {
        if (!el.isConnected) {
          guards.get(el)?.();
          guards.delete(el);
          overlays.delete(el);
        }
      });
    };

    let raf = 0;
    const observer = new MutationObserver(records => {
      for (const rec of records) rec.addedNodes.forEach(consider);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { prune(); apply(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Накладка, що вже є на сторінці при завантаженні
    document.body.querySelectorAll('div').forEach(el => consider(el));
    apply();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      guards.forEach(off => off());
      document.documentElement.classList.remove(CLASS);
    };
  }, []);

  return null;
}
