import { NextResponse } from 'next/server';

import {
  AdminAction,
  applyAdminAction,
  summarizeRoom,
} from '@/features/rooms/admin';
import { isAdminAuthed } from '@/features/rooms/admin-auth';
import { CODE_PATTERN, normalizeCode } from '@/features/rooms/codes';
import { mutate } from '@/features/rooms/mutate';
import { getRoomStore } from '@/features/rooms/store';
import { RoomError } from '@/features/rooms/types';

const NO_STORE = { 'Cache-Control': 'no-store' };
const NO_STORE_ERROR =
  'Penyimpanan room belum diatur. Hubungkan Supabase ke project ini (lihat .env.example).';

type Context = { params: Promise<{ code: string }> };

function fail(err: unknown) {
  if (err instanceof RoomError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: 'Terjadi kesalahan di server' },
    { status: 500 },
  );
}

export async function GET(req: Request, { params }: Context) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const store = getRoomStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Kode room tidak valid' },
      { status: 400 },
    );
  }

  const room = await store.get(code);
  if (!room) {
    return NextResponse.json(
      { error: 'Room tidak ditemukan' },
      { status: 404 },
    );
  }

  const chat = await store.chatList(code);
  return NextResponse.json(
    {
      room: summarizeRoom(room),
      options: room.options ?? null,
      state: room.state ?? null,
      chat,
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request, { params }: Context) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const store = getRoomStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Kode room tidak valid' },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    seat?: number;
    text?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: 'Aksi wajib diisi' }, { status: 400 });
  }

  try {
    if (body.action === 'announce') {
      const text = String(body.text ?? '')
        .trim()
        .slice(0, 240);
      if (!text) {
        return NextResponse.json(
          { error: 'Pesan pengumuman tidak boleh kosong' },
          { status: 400 },
        );
      }
      const room = await store.get(code);
      if (!room) {
        return NextResponse.json(
          { error: 'Room tidak ditemukan' },
          { status: 404 },
        );
      }
      await store.chatAdd(code, {
        id: `admin-${Date.now()}`,
        seat: -1,
        text,
        at: Date.now(),
      });
      const chat = await store.chatList(code);
      return NextResponse.json(
        { room: summarizeRoom(room), chat },
        { headers: NO_STORE },
      );
    }

    let action: AdminAction;
    if (body.action === 'kick') {
      action = { action: 'kick', seat: Number(body.seat) };
    } else if (body.action === 'setHost') {
      action = { action: 'setHost', seat: Number(body.seat) };
    } else if (body.action === 'forceEnd') {
      action = { action: 'forceEnd' };
    } else {
      return NextResponse.json(
        { error: 'Aksi tidak dikenal' },
        { status: 400 },
      );
    }

    const room = await store.get(code);
    if (!room) {
      return NextResponse.json(
        { error: 'Room tidak ditemukan' },
        { status: 404 },
      );
    }

    const updated = await mutate(store, room, (current) =>
      applyAdminAction(current, action, Date.now()),
    );

    return NextResponse.json(
      { room: summarizeRoom(updated) },
      { headers: NO_STORE },
    );
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Context) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const store = getRoomStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Kode room tidak valid' },
      { status: 400 },
    );
  }

  await store.delete(code);
  return NextResponse.json({ deleted: code }, { headers: NO_STORE });
}
