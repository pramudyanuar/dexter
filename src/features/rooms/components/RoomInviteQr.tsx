'use client';

import Image from 'next/image';
import { useMemo } from 'react';

import useMounted from '@/hooks/useMounted';

import { useLang } from '@/features/games/components/lang';
import { inviteLink } from '@/features/rooms/components/RoomBar';
import { encodeQrMatrix, qrToSvg } from '@/features/tools/qr';

export default function RoomInviteQr({ code }: { code: string }) {
  const mounted = useMounted();
  const english = useLang() === 'en';
  const url = mounted ? inviteLink(code) : null;
  const image = useMemo(() => {
    if (!url) return null;
    try {
      return `data:image/svg+xml,${encodeURIComponent(qrToSvg(encodeQrMatrix(url)))}`;
    } catch {
      // Long host names or paths can exceed the encoder's capacity.
      return null;
    }
  }, [url]);

  if (!image || !url) return null;
  const label = english ? 'Scan to join' : 'Pindai untuk bergabung';

  return (
    <figure className='mt-4 flex flex-col items-center gap-2'>
      <a
        href={url}
        aria-label={
          english
            ? `Open invitation to room ${code}`
            : `Buka undangan room ${code}`
        }
        className='rounded-md bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'
      >
        <Image
          src={image}
          alt={
            english ? `QR code for room ${code}` : `Kode QR untuk room ${code}`
          }
          width={128}
          height={128}
          unoptimized
        />
      </a>
      <figcaption className='text-xs text-mute'>{label}</figcaption>
    </figure>
  );
}
