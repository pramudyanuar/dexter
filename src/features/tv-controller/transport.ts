import type { TvMessage } from '@/features/tv-controller/protocol';
import { createClient } from '@/integrations/supabase/client';
import { getSupabasePublicConfig } from '@/integrations/supabase/config';

export type TransportMode = 'realtime' | 'local';

export interface TvTransport {
  mode: TransportMode;
  send: (msg: TvMessage) => void;
  close: () => void;
}

/**
 * Connects a TV host or phone controller to a shared room channel.
 * Uses Supabase Realtime Broadcast on Vercel/production (works across Wi-Fi & 4G/5G
 * without a WebSocket server) and BroadcastChannel for same-browser local testing.
 */
export function connectTvChannel(
  code: string,
  onMessage: (msg: TvMessage) => void,
  onStatus?: (connected: boolean) => void,
): TvTransport {
  const room = code.toUpperCase();
  const hasSupabase = Boolean(getSupabasePublicConfig());

  let localChannel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    localChannel = new BroadcastChannel(`dexter-tv:${room}`);
    localChannel.onmessage = (event) => {
      if (event.data && typeof event.data === 'object') {
        onMessage(event.data as TvMessage);
      }
    };
  }

  if (!hasSupabase) {
    queueMicrotask(() => onStatus?.(true));
    return {
      mode: 'local',
      send: (msg) => {
        localChannel?.postMessage(msg);
      },
      close: () => {
        localChannel?.close();
      },
    };
  }

  const supabase = createClient();
  const channel = supabase.channel(`tv-controller:${room}`, {
    config: {
      broadcast: { self: false, ack: false },
    },
  });

  channel
    .on('broadcast', { event: 'tv' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        onMessage(payload as TvMessage);
      }
    })
    .subscribe((status) => {
      onStatus?.(status === 'SUBSCRIBED');
    });

  return {
    mode: 'realtime',
    send: (msg) => {
      localChannel?.postMessage(msg);
      void channel.send({
        type: 'broadcast',
        event: 'tv',
        payload: msg,
      });
    },
    close: () => {
      localChannel?.close();
      void supabase.removeChannel(channel);
    },
  };
}
