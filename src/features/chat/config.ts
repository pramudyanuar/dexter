/**
 * Providers speak the OpenAI-compatible chat completions API and have a free
 * tier. A provider is usable once its key env var is set on the server.
 */
export const PROVIDERS = {
  groq: {
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
  },
  openrouter: {
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'OPENROUTER_API_KEY',
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

export interface ModelOption {
  /** Unique across providers: `${provider}:${model}` */
  id: string;
  provider: ProviderId;
  /** Model id as the provider knows it */
  model: string;
  label: string;
  /** Accepts image input */
  vision: boolean;
}

// Groq: https://console.groq.com/docs/models
// OpenRouter free models: https://openrouter.ai/models?max_price=0
export const MODELS: readonly ModelOption[] = [
  {
    id: 'groq:openai/gpt-oss-120b',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    vision: false,
  },
  {
    id: 'groq:qwen/qwen3.8-27b',
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    label: 'Qwen3.8 27B',
    vision: true,
  },
  {
    id: 'groq:openai/gpt-oss-20b',
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B (cepat)',
    vision: false,
  },
  {
    id: 'openrouter:google/gemma-4-31b-it:free',
    provider: 'openrouter',
    model: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B',
    vision: true,
  },
  {
    id: 'openrouter:thinkingmachines/inkling:free',
    provider: 'openrouter',
    model: 'thinkingmachines/inkling:free',
    label: 'Inkling',
    vision: true,
  },
  {
    id: 'openrouter:nvidia/nemotron-3-ultra-550b-a55b:free',
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron 3 Ultra 550B',
    vision: false,
  },
  {
    id: 'openrouter:cohere/north-mini-code:free',
    provider: 'openrouter',
    model: 'cohere/north-mini-code:free',
    label: 'North Mini Code',
    vision: false,
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

/** Only the most recent messages are sent, to save tokens. */
export const MAX_HISTORY_MESSAGES = 20;

/** Separates reply text from the trailing token-usage JSON in the stream. */
export const USAGE_DELIMITER = '\u0000';

// Attachment limits. Vercel rejects request bodies over 4.5 MB.
export const MAX_ATTACHMENTS = 4;
export const MAX_TEXT_FILE_BYTES = 100_000;
export const MAX_IMAGE_DIMENSION = 1280;
export const MAX_REQUEST_IMAGE_CHARS = 3_500_000;
