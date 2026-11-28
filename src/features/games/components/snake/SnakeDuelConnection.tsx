'use client';

import * as React from 'react';

import SnakeDuelRoom from '@/features/games/components/snake/SnakeDuelRoom';
import type { Pair } from '@/features/games/logic/snake-duel';
import { newToken } from '@/features/rooms/codes';
import RoomBar from '@/features/rooms/components/RoomBar';
import { iceServers } from '@/features/rooms/ice-servers';
import { callRoom } from '@/features/rooms/room-request';
import {
  DUEL_SIGNAL_URL,
  DuelSession,
  DuelSignal,
  DuelSignaling,
} from '@/features/snake-duel/protocol';

interface Connection {
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  names: Pair<string>;
}

function gatherIce(peer: RTCPeerConnection, signal: AbortSignal) {
  if (peer.iceGatheringState === 'complete' || signal.aborted) return;
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(done, 4500);
    function done() {
      window.clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', change);
      signal.removeEventListener('abort', done);
      resolve();
    }
    function change() {
      if (peer.iceGatheringState === 'complete') done();
    }
    peer.addEventListener('icegatheringstatechange', change);
    signal.addEventListener('abort', done, { once: true });
  });
}

export default function SnakeDuelConnection({
  session,
  onExit,
}: {
  session: DuelSession;
  onExit: () => void;
}) {
  const [connection, setConnection] = React.useState<Connection | null>(null);
  const [matching, setMatching] = React.useState(false);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  const supported = typeof RTCPeerConnection !== 'undefined';
  const { code, token, seat } = session;

  React.useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    const url = `${DUEL_SIGNAL_URL}?room=${encodeURIComponent(code)}&seat=${seat}`;
    const host = seat === 0;
    let peer: RTCPeerConnection | null = null;
    let guest: string | null = null;
    let attempt = '';
    let outgoing: DuelSignal | null = null;
    let sent = false;
    let delivery: number | undefined;
    let timeout: number | undefined;
    let failures = 0;

    function stop() {
      controller.abort();
      window.clearTimeout(delivery);
      window.clearTimeout(timeout);
    }

    function fail(message: string) {
      if (controller.signal.aborted) return;
      stop();
      peer?.close();
      setError(message);
    }

    function attach(
      current: RTCPeerConnection,
      channel: RTCDataChannel,
      names: Pair<string>,
      reservation: string,
    ) {
      async function opened() {
        if (controller.signal.aborted || current !== peer) return;
        try {
          await callRoom(url, {
            token,
            signal: controller.signal,
            body: { paired: reservation },
          });
          if (controller.signal.aborted || current !== peer) return;
          stop();
          setConnection({ peer: current, channel, names });
        } catch (error) {
          if (current === peer) fail((error as Error).message);
        }
      }
      if (channel.readyState === 'open') opened();
      else channel.addEventListener('open', opened, { once: true });
    }

    async function negotiate(
      names: Pair<string>,
      reservation: string,
      offer: DuelSignal | null,
    ) {
      peer?.close();
      const current = new RTCPeerConnection({ iceServers: iceServers() });
      peer = current;
      const id = offer?.attempt ?? newToken();
      current.onconnectionstatechange = () => {
        if (!host && peer === current && current.connectionState === 'failed') {
          fail('Koneksi WebRTC gagal. Coba lagi atau buat room baru.');
        }
      };
      if (host)
        attach(
          current,
          current.createDataChannel('snake-duel'),
          names,
          reservation,
        );
      else
        current.ondatachannel = (event) =>
          attach(current, event.channel, names, reservation);
      if (offer)
        await current.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
      await current.setLocalDescription(
        host ? await current.createOffer() : await current.createAnswer(),
      );
      await gatherIce(current, controller.signal);
      const sdp = current.localDescription?.sdp;
      if (controller.signal.aborted || !sdp) return;
      attempt = id;
      outgoing = { guest: reservation, attempt, sdp };
      sent = false;
    }

    async function poll() {
      if (controller.signal.aborted) return;
      try {
        const options = { token, signal: controller.signal };
        const {
          names: [first, second],
          guest: reservation,
          signal,
        }: DuelSignaling = await callRoom(url, options);
        if (controller.signal.aborted) return;
        if (guest !== reservation) {
          const previous = peer;
          peer = null;
          previous?.close();
          guest = reservation;
          attempt = '';
          outgoing = null;
          sent = false;
          window.clearTimeout(timeout);
          timeout = undefined;
          setMatching(false);
        }
        if (first && second && reservation) {
          if (timeout === undefined) {
            setMatching(true);
            timeout = window.setTimeout(
              () =>
                fail('Koneksi ke lawan belum terbuka. Coba sambungkan ulang.'),
              25_000,
            );
          }
          if (host && !attempt)
            await negotiate([first, second], reservation, null);
          if (!host && signal && signal.attempt !== attempt)
            await negotiate([first, second], reservation, signal);
          if (controller.signal.aborted) return;
          if (outgoing && !sent) {
            await callRoom(url, { ...options, body: outgoing });
            sent = true;
          }
          if (
            host &&
            signal?.attempt === attempt &&
            peer?.signalingState === 'have-local-offer'
          ) {
            await peer.setRemoteDescription({
              type: 'answer',
              sdp: signal.sdp,
            });
          }
        }
        failures = 0;
      } catch (cause) {
        const failure = cause as Error & { status?: number };
        if (
          failure.status === 403 ||
          failure.status === 404 ||
          ++failures >= 4
        ) {
          fail(failure.message || 'Koneksi ke room terputus.');
        }
      }
      if (!controller.signal.aborted) delivery = window.setTimeout(poll, 750);
    }

    void poll();
    return () => {
      stop();
      peer?.close();
    };
  }, [code, retry, seat, supported, token]);

  if (connection)
    return <SnakeDuelRoom {...connection} seat={seat} onExit={onExit} />;

  return (
    <section aria-label='Lobi Snake Duel' className='mx-auto max-w-[30rem]'>
      <RoomBar code={code} share={seat === 0} onLeave={onExit} />
      {!supported || error ? (
        <p role='alert' className='text-center text-sm text-err'>
          {!supported ? 'Browser ini tidak mendukung WebRTC.' : error}
        </p>
      ) : (
        <p role='status' className='text-center text-sm text-mute'>
          {matching
            ? 'Membuka koneksi langsung dengan lawan…'
            : 'Menunggu lawan masuk…'}
        </p>
      )}
      {supported && error && (
        <button
          type='button'
          className='mx-auto mt-3 block min-h-11 rounded-lg border border-line px-3 text-sm'
          onClick={() => {
            setError('');
            setMatching(false);
            setRetry((count) => count + 1);
          }}
        >
          Sambung ulang
        </button>
      )}
    </section>
  );
}
