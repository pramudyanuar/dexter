'use client';

import * as React from 'react';

export type Lang = 'id' | 'en';

const LangContext = React.createContext<Lang>('id');

/** Sets the language of the room controls (notices, chat, players) below it. */
export const LangProvider = LangContext.Provider;
export const useLang = () => React.useContext(LangContext);

const text = {
  id: {
    you: 'Kamu',
    player: (n: number) => `Pemain ${n}`,
    meOut: {
      kicked: 'Kamu dikeluarkan dari permainan oleh admin.',
      idle: 'Kamu dikeluarkan dari permainan karena terlalu lama tidak bergerak.',
      left: 'Kamu keluar dari permainan.',
    },
    other: {
      kicked: 'dikeluarkan admin.',
      idle: 'dikeluarkan karena terlalu lama tidak bergerak.',
      left: 'keluar dari permainan.',
    },
    leaving: (name: string, n: number) =>
      `${name} keluar. Dikeluarkan dari permainan dalam ${n} detik kalau tidak kembali.`,
    nowAdmin: (name: string | null) =>
      name ? `${name} sekarang admin room.` : 'Kamu sekarang admin room.',
    strike: (n: number, max: number) =>
      `Peringatan ${n}/${max}: kamu terlalu lama tidak bergerak. Di ${max} kali kamu dikeluarkan.`,
    yourClock: (n: number) => `Giliranmu habis dalam ${n} detik`,
    theirClock: (who: string, n: number) => `Menunggu ${who}: ${n} detik`,
    manage: 'Kelola pemain',
    copyCode: 'Salin kode room',
    copy: 'salin',
    copied: 'tersalin',
    leave: 'Keluar',
    youAdmin: 'Kamu admin room ini',
    remove: 'Keluarkan',
    sure: 'Yakin?',
    cancel: 'Batal',
    close: 'Tutup',
    chat: 'Chat',
    chatRoom: 'Chat room',
    room: 'room',
    noMessages: 'Belum ada pesan. Sapa temanmu.',
    write: 'Tulis pesan…',
    send: 'Kirim',
    message: 'Pesan',
    openChat: 'Buka chat',
    closeChat: 'Tutup chat',
    chatNew: (n: number) => `Chat, ${n} pesan baru`,
    sendFailed: 'Pesan gagal dikirim',
    players: 'Pemain',
    admin: 'admin',
    out: 'keluar',
    locale: 'id-ID',
  },
  en: {
    you: 'You',
    player: (n: number) => `Player ${n}`,
    meOut: {
      kicked: 'You were removed from the game by the admin.',
      idle: 'You were removed from the game for being inactive.',
      left: 'You left the game.',
    },
    other: {
      kicked: 'was removed by the admin.',
      idle: 'was removed for being inactive.',
      left: 'left the game.',
    },
    leaving: (name: string, n: number) =>
      `${name} left. Removed from the game in ${n}s unless they come back.`,
    nowAdmin: (name: string | null) =>
      name ? `${name} is now the room admin.` : 'You are now the room admin.',
    strike: (n: number, max: number) =>
      `Warning ${n}/${max}: you took too long to move. At ${max} you are removed.`,
    yourClock: (n: number) => `Your turn ends in ${n}s`,
    theirClock: (who: string, n: number) => `Waiting for ${who}: ${n}s`,
    manage: 'Manage players',
    copyCode: 'Copy room code',
    copy: 'copy',
    copied: 'copied',
    leave: 'Leave',
    youAdmin: 'You are the room admin',
    remove: 'Remove',
    sure: 'Sure?',
    cancel: 'Cancel',
    close: 'Close',
    chat: 'Chat',
    chatRoom: 'Room chat',
    room: 'room',
    noMessages: 'No messages yet. Say hi.',
    write: 'Type a message…',
    send: 'Send',
    message: 'Message',
    openChat: 'Open chat',
    closeChat: 'Close chat',
    chatNew: (n: number) => `Chat, ${n} new`,
    sendFailed: 'Message failed to send',
    players: 'Players',
    admin: 'admin',
    out: 'out',
    locale: 'en-US',
  },
} as const;

export const useText = () => text[useLang()];

/** The name shown for a seat: "You" for yourself, else their name or "Player N". */
export const seatName = (
  lang: Lang,
  seat: number,
  you: number,
  names?: (string | null)[],
) =>
  seat === you ? text[lang].you : names?.[seat] || text[lang].player(seat + 1);
