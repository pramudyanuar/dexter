import { NextRequest, NextResponse } from 'next/server';

const BUNDLES: Record<string, string> = {
  doom: 'https://v8.js-dos.com/bundles/doom.jsdos',
  doom2: 'https://cdn.dos.zone/custom/dos/doom2.jsdos?anonymous=1',
  wolf3d:
    'https://cdn.dos.zone/original/2X/a/ac888d1660aa253f0ed53bd6c962c894125aaa19.jsdos?anonymous=1',
};

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const target = BUNDLES[id];
  if (!target) {
    return NextResponse.json(
      { error: 'Bundle tidak dikenal' },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(target, { cache: 'force-cache' });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Gagal mengunduh bundle (${upstream.status})` },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal mengambil file game dari server' },
      { status: 502 },
    );
  }
}
