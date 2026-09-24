'use client';

import Image, { type ImageProps } from 'next/image';
import { canOptimize } from '@/lib/images';

/**
 * Зображення, що оптимізується скрізь, де це можливо.
 *
 * Через next/image браузер отримує файл під розмір на екрані й у WebP
 * чи AVIF, а не оригінал на кілька мегабайт. Адреси, які оптимізувати
 * не можна (чужий сайт, blob: при завантаженні файлу, згенерований
 * QR), показуються як є - сторінка не падає.
 *
 * width/height - підказка про пропорції для вибору розміру файлу.
 * Показаний розмір і далі задають стилі, тож заміна <img> на
 * SmartImage не зсуває верстку.
 */
type Props = Omit<ImageProps, 'src' | 'alt' | 'width' | 'height'> & {
  src: string | null | undefined;
  alt?: string;
  width?: number;
  height?: number;
};

export default function SmartImage({ src, alt = '', width = 800, height = 600, fill, sizes, style, ...rest }: Props) {
  if (!src) return null;
  const unoptimized = !canOptimize(src);

  if (fill) {
    return <Image src={src} alt={alt} fill sizes={sizes ?? '100vw'} unoptimized={unoptimized} style={style} {...rest} />;
  }
  // width і height тут - лише підказка для вибору розміру файлу, але
  // next/image ставить їх ще й атрибутами. Там, де стилі задають тільки
  // ширину (width: 100%), атрибут висоти розтягнув би фото; де розміри
  // не задані зовсім (галерея) - вийшло б 1600x1200 замість природного.
  // auto за замовчуванням повертає поведінку звичайного <img>; явні
  // розміри зі стилів (аватарки 36px) і далі мають перевагу.
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      unoptimized={unoptimized}
      style={{ width: 'auto', height: 'auto', ...style }}
      {...rest}
    />
  );
}
