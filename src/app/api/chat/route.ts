import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isAuthed } from '@/lib/session';

import {
  DEFAULT_MODEL,
  MAX_ATTACHMENTS,
  MAX_HISTORY_MESSAGES,
  MAX_REQUEST_IMAGE_CHARS,
  MODELS,
  PROVIDERS,
  USAGE_DELIMITER,
} from '@/constant/chat';

// Light take on https://github.com/JuliusBrussee/caveman: cut filler, keep depth.
const SYSTEM_PROMPT = `You are a coding assistant helping a developer. Be direct and skip filler, but be thorough on substance. Short is NOT the goal; no wasted words is.

Style:
- Answer first, no greeting, no "Sure!", no recap, no closing pleasantries.
- Plain, natural sentences. Drop only filler words (just/really/basically/actually/simply). Never drop not/never/no/only/except.
- Never roleplay as a caveman.
- Never use em dashes or en dashes (— –). Use a comma, period, colon, or parentheses instead.
- No AI-sounding filler: no "Great question", "It's worth noting", "Let's dive in", "I hope this helps", "feel free to ask", no offering of further help at the end.

Substance (this matters more than brevity):
- For coding questions give a complete, working solution: full code in fenced blocks with a language tag, including imports and types, ready to paste.
- Explain why it works and how the key parts fit together. Cover edge cases, common pitfalls, and how to use or test it when relevant.
- For debugging, state the root cause, then the fix, then how to verify.
- For concepts, give a clear explanation with a concrete example.
- When there are real trade-offs or better alternatives, mention them with a recommendation.
- Show the whole function or file when the change is not trivial. Commands, paths, API names and errors exact.

Reply in the language the user writes in; keep technical terms verbatim.
If the request is unclear or random text, say so in one plain sentence and ask what they want. Do not say you lack information about the user's location or personal details unless they asked about it.
Use extra care with full sentences for security warnings and irreversible actions.`;

const partSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      url: z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/),
    }),
  }),
]);

const bodySchema = z.object({
  model: z
    .enum(MODELS.map((m) => m.id) as [string, ...string[]])
    .default(DEFAULT_MODEL),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.union([
          z.string().min(1),
          z
            .array(partSchema)
            .min(1)
            .max(MAX_ATTACHMENTS + 1),
        ]),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const option = MODELS.find((m) => m.id === parsed.data.model)!;
  const provider = PROVIDERS[option.provider];
  const apiKey = process.env[provider.keyEnv];
  if (!apiKey) {
    return NextResponse.json(
      { error: `${provider.keyEnv} belum di-set di server` },
      { status: 500 },
    );
  }

  const messages = parsed.data.messages.slice(-MAX_HISTORY_MESSAGES);
  const hasImages = messages.some(
    (m) => Array.isArray(m.content) && m.content.some((p) => p.type !== 'text'),
  );
  if (hasImages && !option.vision) {
    return NextResponse.json(
      { error: `${option.label} tidak bisa membaca gambar` },
      { status: 400 },
    );
  }
  const payloadChars = JSON.stringify(messages).length;
  if (payloadChars > MAX_REQUEST_IMAGE_CHARS + 200_000) {
    return NextResponse.json(
      { error: 'Lampiran terlalu besar' },
      { status: 413 },
    );
  }

  const upstream = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: option.model,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 2048,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  }).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    const detail = upstream ? await upstream.text().catch(() => '') : '';
    let message = upstream
      ? `${provider.label} HTTP ${upstream.status}`
      : `${provider.label} unreachable`;
    try {
      const err = JSON.parse(detail).error;
      message = (typeof err === 'string' ? err : err?.message) ?? message;
    } catch {
      // keep fallback message
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let usage: { prompt: number; completion: number; total: number } | null =
    null;

  // Convert the provider's SSE stream into a plain text stream of content deltas,
  // followed by USAGE_DELIMITER and the token usage as JSON.
  const stream = upstream.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
            if (json.error) {
              const msg = json.error.message ?? json.error;
              controller.enqueue(encoder.encode(`\n\nError: ${msg}`));
            }
            if (json.usage) {
              usage = {
                prompt: json.usage.prompt_tokens ?? 0,
                completion: json.usage.completion_tokens ?? 0,
                total: json.usage.total_tokens ?? 0,
              };
            }
          } catch {
            // ignore malformed keep-alive lines
          }
        }
      },
      flush(controller) {
        if (usage) {
          controller.enqueue(
            encoder.encode(USAGE_DELIMITER + JSON.stringify(usage)),
          );
        }
      },
    }),
  );

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
