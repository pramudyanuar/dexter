/**
 * Word definitions for the games, gathered from free dictionaries:
 * - English: the Free Dictionary API, falling back to English Wiktionary.
 * - Indonesian: Indonesian Wiktionary (in Indonesian), falling back to the
 *   Indonesian entries of English Wiktionary (glossed in English).
 *
 * Everything here turns whatever a source returned into plain text. Nothing is
 * ever passed on as HTML.
 */

export type DefLang = 'id' | 'en';

export interface DefEntry {
  /** "Nomina", "noun", ... or null when the source does not say */
  pos: string | null;
  definitions: string[];
}

export interface DefineResult {
  word: string;
  /** The game's language */
  lang: DefLang;
  /** The language the definitions are written in */
  defLang: DefLang;
  entries: DefEntry[];
  source: string;
  /** Where to read more */
  url: string;
  /** Nothing found because a source could not be reached (worth trying again) */
  failed?: boolean;
}

const MAX_ENTRIES = 3;
const MAX_DEFS = 3;

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

const decode = (s: string) =>
  s
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** HTML to plain text: tags dropped, entities decoded, whitespace collapsed. */
export const stripHtml = (html: string) =>
  decode(html.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** Wiki markup to plain text: templates dropped, links reduced to their label. */
export function cleanWiki(text: string): string {
  let t = text;
  // templates can nest, so peel the innermost ones until none are left
  for (let i = 0; i < 8 && t.includes('{{'); i++) {
    t = t.replace(/\{\{[^{}]*\}\}/g, '');
  }
  t = t
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, '');
  return decode(t)
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.\-–—]+/, '')
    .trim();
}

/** Keep a few entries and a few definitions each, without repeats. */
function tidy(entries: DefEntry[]): DefEntry[] {
  const merged: DefEntry[] = [];
  for (const e of entries) {
    const found = merged.find((m) => m.pos === e.pos);
    if (found) found.definitions.push(...e.definitions);
    else merged.push({ pos: e.pos, definitions: [...e.definitions] });
  }
  return merged
    .map((e) => ({
      pos: e.pos,
      definitions: [...new Set(e.definitions)]
        .filter((d) => d.length > 1)
        .slice(0, MAX_DEFS),
    }))
    .filter((e) => e.definitions.length > 0)
    .slice(0, MAX_ENTRIES);
}

const ID_POS: Record<string, string> = {
  n: 'Nomina',
  nom: 'Nomina',
  nomina: 'Nomina',
  v: 'Verba',
  verba: 'Verba',
  adj: 'Adjektiva',
  adjektiva: 'Adjektiva',
  adv: 'Adverbia',
  adverbia: 'Adverbia',
  pron: 'Pronomina',
  pronomina: 'Pronomina',
  num: 'Numeralia',
  numeralia: 'Numeralia',
  konj: 'Konjungsi',
  konjungsi: 'Konjungsi',
  prep: 'Preposisi',
  preposisi: 'Preposisi',
  int: 'Interjeksi',
  interjeksi: 'Interjeksi',
  part: 'Partikel',
  partikel: 'Partikel',
};

/** The Indonesian part of an Indonesian Wiktionary page, as entries. */
export function parseIndonesianWikitext(wikitext: string): DefEntry[] {
  // each language is a level-2 section (`==Language==`, not `===Part===`);
  // keep only the Indonesian one
  const sections = wikitext.split(/\n(?===(?!=))/);
  const section = sections.find((s) =>
    /^==\s*(\{\{bahasa\|id\}\}|Bahasa Indonesia)\s*==/i.test(s.trimStart()),
  );
  if (!section) return [];

  const entries: DefEntry[] = [];
  // undefined: inside a part that holds no definitions (derived terms, translations...)
  let pos: string | null | undefined = null;
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    const tag = line.match(/^\{\{-([a-z]+)-\|id\}\}/i);
    const heading = line.match(/^={3,}\s*([^=]+?)\s*={3,}$/);
    if (tag) {
      pos = ID_POS[tag[1].toLowerCase()];
    } else if (heading) {
      pos = ID_POS[heading[1].toLowerCase()];
    } else if (pos !== undefined && /^#(?![#*:;])/.test(line)) {
      const text = cleanWiki(line.replace(/^#\s*/, ''));
      if (text) entries.push({ pos, definitions: [text] });
    }
  }
  return tidy(entries);
}

/** Response of the Free Dictionary API (English). */
export function parseFreeDictionary(json: unknown): DefEntry[] {
  if (!Array.isArray(json)) return [];
  const entries: DefEntry[] = [];
  for (const item of json) {
    for (const meaning of item?.meanings ?? []) {
      const definitions = (meaning?.definitions ?? [])
        .map((d: { definition?: unknown }) =>
          typeof d?.definition === 'string' ? d.definition.trim() : '',
        )
        .filter(Boolean);
      entries.push({
        pos:
          typeof meaning?.partOfSpeech === 'string'
            ? meaning.partOfSpeech
            : null,
        definitions,
      });
    }
  }
  return tidy(entries);
}

/**
 * One Wiktionary sense in HTML: its own gloss, then any narrower senses nested
 * under it (a list inside the definition), each as a separate line.
 */
function senses(html: string): string[] {
  const own = stripHtml(html.split(/<(?:ul|ol)[\s>]/i)[0]);
  const nested = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
    stripHtml(m[1]),
  );
  return [own, ...nested];
}

/** English Wiktionary's REST definitions for one language code (HTML inside). */
export function parseEnWiktionary(
  json: unknown,
  code: string,
  languageName?: string,
): DefEntry[] {
  const data = json as Record<string, unknown> | null;
  let list = data?.[code];
  // languages without a code of their own are listed under "other", by name
  if (!Array.isArray(list) && languageName && Array.isArray(data?.other)) {
    list = (data.other as { language?: string }[]).filter(
      (i) => i.language === languageName,
    );
  }
  if (!Array.isArray(list)) return [];
  const entries: DefEntry[] = [];
  for (const item of list) {
    const definitions = (item?.definitions ?? [])
      .flatMap((d: { definition?: unknown }) =>
        typeof d?.definition === 'string' ? senses(d.definition) : [],
      )
      .filter(Boolean);
    entries.push({
      pos: typeof item?.partOfSpeech === 'string' ? item.partOfSpeech : null,
      definitions,
    });
  }
  return tidy(entries);
}

type Fetcher = (url: string) => Promise<Response>;

/** Looks a word up. `entries` is empty when no source knows it. */
export async function define(
  word: string,
  lang: DefLang,
  fetcher: Fetcher,
): Promise<DefineResult> {
  const w = encodeURIComponent(word);
  // a missing word (404) is an answer; a source that errors or throttles is not
  let errors = 0;
  const json = async (_: Fetcher, url: string): Promise<unknown | null> => {
    try {
      const res = await fetcher(url);
      if (res.ok) return await res.json();
      if (res.status !== 404) errors++;
      return null;
    } catch {
      errors++;
      return null;
    }
  };
  const enWiktionary = `https://en.wiktionary.org/api/rest_v1/page/definition/${w}`;

  if (lang === 'en') {
    const free = parseFreeDictionary(
      await json(
        fetcher,
        `https://api.dictionaryapi.dev/api/v2/entries/en/${w}`,
      ),
    );
    if (free.length) {
      return {
        word,
        lang,
        defLang: 'en',
        entries: free,
        source: 'Free Dictionary API',
        url: `https://en.wiktionary.org/wiki/${w}`,
      };
    }
    const wikt = parseEnWiktionary(await json(fetcher, enWiktionary), 'en');
    return {
      word,
      lang,
      defLang: 'en',
      entries: wikt,
      source: 'Wiktionary',
      url: `https://en.wiktionary.org/wiki/${w}`,
      failed: wikt.length === 0 && errors > 0,
    };
  }

  const idPage = (await json(
    fetcher,
    `https://id.wiktionary.org/w/api.php?action=parse&page=${w}&prop=wikitext&format=json&redirects=1`,
  )) as { parse?: { wikitext?: { '*'?: string } } } | null;
  const own = parseIndonesianWikitext(idPage?.parse?.wikitext?.['*'] ?? '');
  if (own.length) {
    return {
      word,
      lang,
      defLang: 'id',
      entries: own,
      source: 'Wiktionary Indonesia',
      url: `https://id.wiktionary.org/wiki/${w}`,
    };
  }
  // many Indonesian words are only covered on English Wiktionary, with English glosses
  const english = parseEnWiktionary(
    await json(fetcher, enWiktionary),
    'id',
    'Indonesian',
  );
  return {
    word,
    lang,
    defLang: 'en',
    entries: english,
    source: 'Wiktionary',
    url: `https://kbbi.kemdikbud.go.id/entri/${w}`,
    failed: english.length === 0 && errors > 0,
  };
}
