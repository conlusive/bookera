'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'motion/react';

/**
 * Одне велике речення, яке «проявляється» слово за словом, поки сторінку гортають.
 * Прив'язане до прокрутки, а не до часу: людина сама керує темпом.
 */
const TEXT = 'Календар, клієнти, нагадування й фінанси. В одному кабінеті. Без блокнотів і без хаосу в месенджерах.';

function Word({ w, i, n, progress }: { w: string; i: number; n: number; progress: MotionValue<number> }) {
  const start = i / n;
  const end = Math.min(1, start + 1.6 / n);
  const opacity = useTransform(progress, [start, end], [0.16, 1]);
  return <motion.span style={{ opacity }}>{w} </motion.span>;
}

export default function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.55'] });
  const words = TEXT.split(' ');
  return (
    <section className="st">
      <div className="container">
        <p ref={ref} className="st-p" aria-label={TEXT}>
          {reduce
            ? TEXT
            : words.map((w, i) => <Word key={i} w={w} i={i} n={words.length} progress={scrollYProgress} />)}
        </p>
      </div>
      <style jsx>{`
        .st { padding: 9rem 0 7rem; background: #fff; }
        .st-p { max-width: 17.5em; margin: 0 auto; text-align: center; font-size: clamp(1.9rem, 4.6vw, 3.6rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.16; color: #1D1D1F; }
        @media (max-width: 700px) { .st { padding: 6rem 0 4rem; } }
      `}</style>
    </section>
  );
}
