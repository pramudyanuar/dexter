'use client';

import {
  Circle,
  Eraser,
  Minus,
  Pencil,
  Redo2,
  SkipForward,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import * as React from 'react';

import styles from '@/app/games/pictionary/pictionary.module.css';

import {
  COLORS,
  COORD_MAX,
  ERASER,
  Stroke,
  STROKE_BATCH_LIMIT,
  WIDTHS,
} from '@/lib/games/pictionary';

import ConfirmDialog from '@/components/ConfirmDialog';

const W = 960;
const H = 540;

const tools = [
  { id: 'pen', label: 'Pensil', Icon: Pencil },
  { id: 'eraser', label: 'Penghapus', Icon: Eraser },
  { id: 'line', label: 'Garis lurus', Icon: Minus },
  { id: 'rectangle', label: 'Persegi panjang', Icon: Square },
  { id: 'ellipse', label: 'Elips', Icon: Circle },
] as const;

const names = [
  'Hitam',
  'Merah',
  'Biru',
  'Hijau',
  'Kuning',
  'Ungu',
  'Putih',
  'Jingga',
  'Merah muda',
  'Cokelat',
  'Abu-abu',
  'Toska',
  'Biru tua',
];
const brushSizes = [3, 0, 1, 2, 4] as const;

type Tool = (typeof tools)[number]['id'];
type Point = [number, number];
type HistoryAction = 'undo' | 'redo' | 'clear';
export type DrawingMove =
  ({ type: 'stroke' } & Stroke) | { type: HistoryAction | 'next' };
type Gesture = { pointer: number; tool: Tool; start: Point; stroke: Stroke };

function paint(canvas: HTMLCanvasElement | null, strokes: readonly Stroke[]) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const { color, width, pts } of strokes) {
    ctx.strokeStyle = ctx.fillStyle = COLORS[color];
    ctx.lineWidth = WIDTHS[width] * (W / COORD_MAX) * 1.2;
    const x = (i: number) => (pts[i] / COORD_MAX) * W;
    const y = (i: number) => (pts[i + 1] / COORD_MAX) * H;
    ctx.beginPath();
    if (pts.length === 2) {
      ctx.arc(x(0), y(0), ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(x(0), y(0));
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(x(i), y(i));
      ctx.stroke();
    }
  }
}

function shape(tool: Tool, [x, y]: Point, [endX, endY]: Point) {
  if (x === endX && y === endY) return [x, y];
  if (tool === 'rectangle') return [x, y, endX, y, endX, endY, x, endY, x, y];
  if (tool === 'ellipse') {
    const rx = (endX - x) / 2;
    const ry = (endY - y) / 2;
    const points: number[] = [];
    for (let segment = 0; segment <= 48; segment++) {
      const angle = (segment / 48) * 2 * Math.PI;
      points.push(
        Math.round(x + rx + rx * Math.cos(angle)),
        Math.round(y + ry + ry * Math.sin(angle)),
      );
    }
    return points;
  }
  return [x, y, endX, endY];
}

function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  const clamp = (n: number) => Math.min(COORD_MAX, Math.max(0, Math.round(n)));
  return [
    clamp(((event.clientX - rect.left) / rect.width) * COORD_MAX),
    clamp(((event.clientY - rect.top) / rect.height) * COORD_MAX),
  ];
}

const freehand = (tool: Tool) => tool === 'pen' || tool === 'eraser';

export default function DrawingBoard({
  strokes,
  canDraw,
  canRedo,
  onMove,
}: {
  strokes: Stroke[];
  canDraw: boolean;
  canRedo: boolean;
  onMove: (move: DrawingMove, signal: AbortSignal) => Promise<void>;
}) {
  const [tool, setTool] = React.useState<Tool>('pen');
  const [color, setColor] = React.useState(0);
  const [width, setWidth] = React.useState(1);
  const [working, setWorking] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [error, setError] = React.useState('');
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const local = React.useRef<Stroke[]>(strokes);
  const gesture = React.useRef<Gesture | null>(null);
  const queue = React.useRef<Stroke[]>([]);
  const sending = React.useRef(false);
  const managing = React.useRef(false);
  const lifetime = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    if (!canDraw || !working) paint(canvas.current, strokes);
  }, [strokes, working, canDraw]);

  function addPoints(stroke: Stroke, pts: number[]) {
    const tail = queue.current.at(-1);
    if (tail?.id === stroke.id) tail.pts.push(...pts);
    else queue.current.push({ ...stroke, pts: [...pts] });
  }

  async function flush() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || sending.current) return;
    sending.current = true;
    try {
      while (queue.current.length && !signal.aborted) {
        const stroke = queue.current[0];
        const pts = stroke.pts.splice(0, STROKE_BATCH_LIMIT);
        if (!stroke.pts.length) queue.current.shift();
        await onMove({ ...stroke, type: 'stroke', pts }, signal);
      }
    } catch (error) {
      if (signal.aborted) return;
      queue.current = [];
      gesture.current = null;
      setError(
        error instanceof Error ? error.message : 'Goresan gagal dikirim.',
      );
    } finally {
      sending.current = false;
      if (!signal.aborted && !gesture.current) setWorking(false);
    }
  }

  const flushPending = React.useEffectEvent(() => {
    if (queue.current.length) void flush();
  });

  React.useEffect(() => {
    if (!canDraw) return;
    const timer = setInterval(() => flushPending(), 160);
    return () => clearInterval(timer);
  }, [canDraw]);

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (
      !canDraw ||
      !event.isPrimary ||
      event.button !== 0 ||
      gesture.current ||
      managing.current
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    if (!sending.current && !queue.current.length) local.current = strokes;
    const start = point(event);
    const stroke = {
      id: Math.random().toString(36).slice(2, 14),
      color: tool === 'eraser' ? ERASER : color,
      width,
      pts: [...start],
    };
    gesture.current = { start, stroke, tool, pointer: event.pointerId };
    setWorking(true);
    setError('');
    if (freehand(tool)) {
      local.current = [...local.current, stroke];
      addPoints(stroke, start);
    }
    paint(
      canvas.current,
      freehand(tool) ? local.current : [...local.current, stroke],
    );
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const end = point(event);
    const { stroke } = active;
    if (!freehand(active.tool)) {
      stroke.pts = shape(active.tool, active.start, end);
      paint(canvas.current, [...local.current, stroke]);
      return;
    }
    const n = stroke.pts.length;
    if (Math.hypot(end[0] - stroke.pts[n - 2], end[1] - stroke.pts[n - 1]) < 3)
      return;
    stroke.pts.push(...end);
    addPoints(stroke, end);
    paint(canvas.current, local.current);
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    gesture.current = null;
    if (!freehand(active.tool)) {
      if (event.type === 'pointerup') {
        active.stroke.pts = shape(active.tool, active.start, point(event));
        local.current = [...local.current, active.stroke];
        addPoints(active.stroke, active.stroke.pts);
      }
      paint(canvas.current, local.current);
    }
    void flush();
  }

  async function changeBoard(type: HistoryAction | 'next') {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || working || managing.current) return;
    managing.current = true;
    setWorking(true);
    setError('');
    try {
      await onMove({ type }, signal);
    } catch (error) {
      if (!signal.aborted)
        setError(
          error instanceof Error ? error.message : 'Perubahan gagal dikirim.',
        );
    } finally {
      managing.current = false;
      if (!signal.aborted) setWorking(false);
    }
  }

  return (
    <div
      className={styles.drawingBoard}
      onKeyDown={(event) => {
        if (!canDraw || confirmClear || !(event.ctrlKey || event.metaKey))
          return;
        const key = event.key.toLowerCase();
        if (key !== 'z' && key !== 'y') return;
        event.preventDefault();
        const redo = key === 'y' || event.shiftKey;
        if (redo ? canRedo : strokes.length > 0)
          void changeBoard(redo ? 'redo' : 'undo');
      }}
    >
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-label='Kanvas gambar'
        data-testid='canvas'
        tabIndex={canDraw ? 0 : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        className={
          canDraw
            ? `${styles.canvas} cursor-crosshair touch-none`
            : styles.canvas
        }
      />
      {canDraw && (
        <div className={styles.toolbar} role='group' aria-label='Alat gambar'>
          <div className={styles.toolRow}>
            <div
              className={styles.toolGroup}
              role='group'
              aria-label='Jenis alat'
            >
              {tools.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type='button'
                  aria-label={label}
                  title={label}
                  aria-pressed={tool === id}
                  className={styles.tool}
                  onClick={() => setTool(id)}
                >
                  <Icon size={19} aria-hidden='true' />
                </button>
              ))}
            </div>
            <div
              className={styles.toolGroup}
              role='group'
              aria-label='Riwayat gambar'
            >
              <button
                type='button'
                className={styles.tool}
                onClick={() => changeBoard('undo')}
                disabled={working || !strokes.length}
                title='Urungkan (Ctrl+Z)'
                aria-label='Urungkan'
              >
                <Undo2 size={19} aria-hidden='true' />
              </button>
              <button
                type='button'
                className={styles.tool}
                onClick={() => changeBoard('redo')}
                disabled={working || !canRedo}
                title='Ulangi (Ctrl+Shift+Z)'
                aria-label='Ulangi'
              >
                <Redo2 size={19} aria-hidden='true' />
              </button>
              <button
                type='button'
                className={styles.tool}
                onClick={() => setConfirmClear(true)}
                disabled={working || !strokes.length}
                title='Hapus kanvas'
                aria-label='Hapus kanvas'
              >
                <Trash2 size={18} aria-hidden='true' />
              </button>
              <button
                type='button'
                className={styles.tool}
                onClick={() => changeBoard('next')}
                disabled={working}
                title='Lewati kata'
                aria-label='Lewati kata'
              >
                <SkipForward size={18} aria-hidden='true' />
              </button>
            </div>
          </div>
          <div className={styles.toolRow}>
            <div className={styles.toolGroup} role='group' aria-label='Warna'>
              {COLORS.map(
                (value, i) =>
                  i !== ERASER && (
                    <button
                      key={value}
                      type='button'
                      aria-label={names[i]}
                      title={names[i]}
                      aria-pressed={i === color}
                      className={styles.tool}
                      onClick={() => {
                        setColor(i);
                        if (tool === 'eraser') setTool('pen');
                      }}
                    >
                      <span
                        className={styles.swatch}
                        style={{ backgroundColor: value }}
                      />
                    </button>
                  ),
              )}
            </div>
            <div
              className={styles.toolGroup}
              role='group'
              aria-label='Tebal garis'
            >
              {brushSizes.map((i) => (
                <button
                  key={i}
                  type='button'
                  aria-label={`Ketebalan ${WIDTHS[i]}`}
                  title={`Ketebalan ${WIDTHS[i]}`}
                  aria-pressed={i === width}
                  className={styles.tool}
                  onClick={() => setWidth(i)}
                >
                  <span
                    className={styles.brush}
                    style={{
                      width: Math.min(22, WIDTHS[i]),
                      height: Math.min(22, WIDTHS[i]),
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p role='alert' className={styles.inputError}>
              {error}
            </p>
          )}
        </div>
      )}
      {confirmClear && (
        <ConfirmDialog
          title='Hapus seluruh gambar?'
          message='Kanvas akan dikosongkan untuk semua pemain.'
          confirmLabel='Hapus'
          cancelLabel='Batal'
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            void changeBoard('clear');
          }}
        />
      )}
    </div>
  );
}
