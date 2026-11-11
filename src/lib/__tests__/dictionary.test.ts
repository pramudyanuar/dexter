/** @jest-environment node */
import {
  cleanWiki,
  define,
  parseEnWiktionary,
  parseFreeDictionary,
  parseIndonesianWikitext,
  stripHtml,
} from '@/lib/dictionary';

// real page shapes, trimmed
const RUMAH = `=={{bahasa|id}}==
{{gambar
|Jalan Cecawi 6-28B.jpg|rumah
}}
{{kepala|id}}
: {{pemenggalan|id|ru|mah}} {{suara|id|LL-Q9240.wav}}
{{-n-|id}}
# [[tempat]] atau [[bangunan]] untuk [[hunian]]
#* {{RQ:20 Mei Pelopor
|text=Dalam bulan Puasa, '''rumah''' Dr. Wahidin mendjadi pusat pertemuan.
}}
# [[badan]] atau [[lembaga]]; ''kiasan''
#: contoh kalimat yang bukan definisi

{{-turunan-|id}}
* [[rumah hijau]]
* [[rumah makan]]

=={{bahasa|bjn}}==
{{-n-|bjn}}
# tebal di bahasa lain`;

const KAPAL = `=={{bahasa|id}}==
{{kepala|id}}

{{-n-|id}}
# {{rfdef|id}}

{{-turunan-|id}}
* [[kapal api]]

=={{bahasa|bqr}}==
{{-adj-|bqr}}
# [[tebal]]

=={{bahasa|pgu}}==
{{-n-|pgu}}
# kapal
# kapal uap`;

describe('cleaning text', () => {
  it('turns wiki markup into plain text', () => {
    expect(
      cleanWiki("[[tempat]] atau [[bangunan|gedung]] untuk '''hunian'''"),
    ).toBe('tempat atau gedung untuk hunian');
    expect(
      cleanWiki('{{lb|id|kasar}} {{n|{{x}}}} makan [https://a.b situs]'),
    ).toBe('makan situs');
    expect(cleanWiki('{{rfdef|id}}')).toBe('');
  });

  it('turns HTML into plain text, never passing tags through', () => {
    expect(
      stripHtml(
        '<a href="/wiki/house" title="house">house</a> <span>(abode)</span> &amp; more',
      ),
    ).toBe('house (abode) & more');
    expect(stripHtml('<script>alert(1)</script>safe')).toBe('alert(1)safe');
  });
});

describe('Indonesian Wiktionary', () => {
  it('reads the numbered senses of the Indonesian section only', () => {
    expect(parseIndonesianWikitext(RUMAH)).toEqual([
      {
        pos: 'Nomina',
        definitions: [
          'tempat atau bangunan untuk hunian',
          'badan atau lembaga; kiasan',
        ],
      },
    ]);
  });

  it('ignores other languages and entries that only ask for a definition', () => {
    expect(parseIndonesianWikitext(KAPAL)).toEqual([]);
  });

  it('returns nothing for a page without an Indonesian section', () => {
    expect(
      parseIndonesianWikitext('=={{bahasa|jv}}==\n{{-n-|jv}}\n# omah'),
    ).toEqual([]);
  });
});

describe('Free Dictionary API', () => {
  it('groups senses by part of speech and keeps a few', () => {
    const json = [
      {
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [
              { definition: 'A fighter.' },
              { definition: 'A dog.' },
              { definition: 'A short.' },
              { definition: 'A fourth, dropped.' },
            ],
          },
          { partOfSpeech: 'verb', definitions: [{ definition: 'To box.' }] },
        ],
      },
      {
        meanings: [
          { partOfSpeech: 'noun', definitions: [{ definition: 'A fighter.' }] },
        ],
      },
    ];
    expect(parseFreeDictionary(json)).toEqual([
      { pos: 'noun', definitions: ['A fighter.', 'A dog.', 'A short.'] },
      { pos: 'verb', definitions: ['To box.'] },
    ]);
  });

  it('copes with the not-found reply', () => {
    expect(parseFreeDictionary({ title: 'No Definitions Found' })).toEqual([]);
  });
});

describe('English Wiktionary', () => {
  const html = (t: string) => `<a rel="mw:WikiLink" href="/wiki/x">${t}</a>`;

  it('reads a language by its code', () => {
    const json = {
      en: [
        { partOfSpeech: 'Noun', definitions: [{ definition: html('boat') }] },
      ],
    };
    expect(parseEnWiktionary(json, 'en')).toEqual([
      { pos: 'Noun', definitions: ['boat'] },
    ]);
  });

  it('lists narrower senses nested under a gloss as separate lines', () => {
    const json = {
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [
            {
              definition: `${html('ship')}<ol><li>a water-borne vessel</li><li>a <b>fictional</b> pairing</li></ol>`,
            },
          ],
        },
      ],
    };
    expect(parseEnWiktionary(json, 'en')).toEqual([
      {
        pos: 'Noun',
        definitions: ['ship', 'a water-borne vessel', 'a fictional pairing'],
      },
    ]);
  });

  it('finds Indonesian under "other" when it has no code of its own', () => {
    const json = {
      other: [
        {
          language: 'Banjarese',
          partOfSpeech: 'Noun',
          definitions: [{ definition: 'banjar' }],
        },
        {
          language: 'Indonesian',
          partOfSpeech: 'Noun',
          definitions: [{ definition: html('ship') }],
        },
      ],
    };
    expect(parseEnWiktionary(json, 'id', 'Indonesian')).toEqual([
      { pos: 'Noun', definitions: ['ship'] },
    ]);
  });
});

const reply = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    json: async () => data,
  } as Response);

describe('looking a word up', () => {
  it('uses Indonesian Wiktionary for Indonesian words', async () => {
    const urls: string[] = [];
    const result = await define('rumah', 'id', (url) => {
      urls.push(url);
      return reply({ parse: { wikitext: { '*': RUMAH } } });
    });
    expect(result.defLang).toBe('id');
    expect(result.source).toBe('Wiktionary Indonesia');
    expect(result.entries[0].definitions[0]).toBe(
      'tempat atau bangunan untuk hunian',
    );
    expect(urls).toHaveLength(1); // no need to ask anyone else
  });

  it('falls back to English glosses when Indonesian Wiktionary has no sense', async () => {
    const result = await define('kapal', 'id', (url) =>
      url.includes('id.wiktionary')
        ? reply({ parse: { wikitext: { '*': KAPAL } } })
        : reply({
            other: [
              {
                language: 'Indonesian',
                partOfSpeech: 'Noun',
                definitions: [{ definition: 'ship' }],
              },
            ],
          }),
    );
    expect(result.defLang).toBe('en');
    expect(result.entries).toEqual([{ pos: 'Noun', definitions: ['ship'] }]);
    expect(result.failed).toBeFalsy();
  });

  it('uses the Free Dictionary API for English, then Wiktionary', async () => {
    const free = await define('boxer', 'en', () =>
      reply([
        {
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [{ definition: 'A fighter.' }],
            },
          ],
        },
      ]),
    );
    expect(free.source).toBe('Free Dictionary API');

    const wikt = await define('psalm', 'en', (url) =>
      url.includes('dictionaryapi')
        ? reply({ title: 'No Definitions Found' }, 404)
        : reply({
            en: [
              {
                partOfSpeech: 'Noun',
                definitions: [{ definition: 'a sacred song' }],
              },
            ],
          }),
    );
    expect(wikt.source).toBe('Wiktionary');
    expect(wikt.entries[0].definitions).toEqual(['a sacred song']);
  });

  it('tells "no such word" from "could not ask"', async () => {
    const missing = await define('zzzzz', 'en', () => reply({}, 404));
    expect(missing.entries).toEqual([]);
    expect(missing.failed).toBe(false);

    const throttled = await define('boxer', 'en', () => reply({}, 429));
    expect(throttled.failed).toBe(true);

    const offline = await define('boxer', 'en', () =>
      Promise.reject(new Error('down')),
    );
    expect(offline.failed).toBe(true);
  });

  it('encodes the word in the request', async () => {
    const urls: string[] = [];
    await define('a b', 'en', (url) => {
      urls.push(url);
      return reply({}, 404);
    });
    expect(urls.every((u) => u.includes('a%20b'))).toBe(true);
  });
});
