import type { CSSProperties } from 'react';

import { spriteFrame } from './art';

export default function Sprite({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { x, y, w, h, size, file } = spriteFrame(name);
  return (
    <span
      aria-hidden='true'
      className={className}
      style={{
        display: 'block',
        aspectRatio: `${w}/${h}`,
        backgroundImage: `url(${file})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${(size / w) * 100}% ${(size / h) * 100}%`,
        backgroundPosition: `${(x / (size - w)) * 100}% ${(y / (size - h)) * 100}%`,
        ...style,
      }}
    />
  );
}
