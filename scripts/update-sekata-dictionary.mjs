import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import {
  SEKATA_ABBR,
  SEKATA_FOREIGN,
  SEKATA_NONSTANDARD,
  SEKATA_PLACE,
  SEKATA_PROPER,
  SEKATA_REGIONAL,
  SEKATA_SLANG,
  SEKATA_STANDARD,
} from '../src/constant/sekata-words.ts';
import { WORDLE_VALID_WORDS } from '../src/constant/wordle-valid.ts';
import { WORDLE_ANSWERS } from '../src/constant/wordle-words.ts';

const [malindoFile, hunspellFile] = process.argv.slice(2);

async function readPinned(url, expectedHash, file) {
  let source;
  if (file) {
    source = readFileSync(file);
  } else {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    source = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(source).digest('hex') !== expectedHash)
    throw new Error(`Unexpected dictionary file: ${url}`);
  return source.toString('utf8');
}

const [malindo, hunspell] = await Promise.all([
  readPinned(
    'https://raw.githubusercontent.com/matbahasa/MALINDO_Morph/e3ab07c435343d39d6ab3cb87cd9ba57c27f49d3/malindo_dic_2024.tsv',
    '3c3379e889d3cc74446de709935fca5e0de80154f1a5e8e5b37d9b47180e4c73',
    malindoFile,
  ),
  readPinned(
    'https://raw.githubusercontent.com/titoBouzout/Dictionaries/65e552e7216cecab2b497c898a9a7ee1e2e2de11/Indonesia.dic',
    '83a63fe811db2db9d1c71350de32b5762c6ef4639d9e82063ed8e17d5809416f',
    hunspellFile,
  ),
]);

const split = (text) => text.trim().split(/\s+/);
const tagged = split(
  [
    SEKATA_ABBR,
    SEKATA_FOREIGN,
    SEKATA_PLACE,
    SEKATA_PROPER,
    SEKATA_REGIONAL,
    SEKATA_SLANG,
  ].join(' '),
);
const nonstandard = split(SEKATA_NONSTANDARD);
const standard = new Set([...split(WORDLE_VALID_WORDS), ...WORDLE_ANSWERS]);
for (const word of tagged) standard.delete(word);
for (const word of split(SEKATA_STANDARD)) standard.add(word);
for (const word of nonstandard) standard.delete(word);
const existing = new Set([...standard, ...tagged, ...nonstandard]);

const singleWord = /^[a-z]{2,}$/;

// A licensed di- form supplies the stem for the corresponding agent clitics.
function addPassiveForms(forms, stem) {
  forms.add(`di${stem}`).add(`di${stem}nya`);
  forms.add(`ku${stem}`).add(`kau${stem}`);
}

const diksi = new Set();
const hunspellRoots = new Set();
for (const row of hunspell.trim().split(/\r?\n/).slice(1)) {
  const [word, rawFlags] = row.split(/\s+/, 1)[0].split('/');
  if (!singleWord.test(word)) continue;
  const flags = new Set(rawFlags?.match(/.{2}/g));
  if (existing.has(word) && !standard.has(word)) continue;
  hunspellRoots.add(word);
  // A2 is NEEDAFFIX in Indonesia.aff. These stems require a supported affix.
  if (flags.has('A2')) continue;
  diksi.add(word);
  // Only use the clitic flags from the original dictionary's FLAG long table.
  if (flags.has('o0')) {
    diksi.add(`${word}ku`).add(`${word}mu`).add(`${word}nya`);
  } else if (flags.has('n0') || flags.has('nl')) {
    diksi.add(`${word}nya`);
  }
  if (flags.has('l0') || flags.has('nl')) {
    diksi.add(`${word}lah`).add(`${word}kah`);
  }
  if (flags.has('O0') || flags.has('O1')) {
    diksi.add(`ku${word}`).add(`kau${word}`);
  }
  // Indonesia.aff permits these passive patterns on specifically tagged roots.
  if (flags.has('D0')) addPassiveForms(diksi, word);
  if (flags.has('Di')) addPassiveForms(diksi, `${word}i`);
  if (flags.has('Dk')) addPassiveForms(diksi, `${word}kan`);
  if (flags.has('Du')) {
    const prefix = word.startsWith('r') ? 'pe' : 'per';
    addPassiveForms(diksi, `${prefix}${word}kan`);
  }
}
const kamusWords = [...diksi].filter((word) => !existing.has(word));

const forms = new Set();
for (const row of malindo.split(/\r?\n/)) {
  const [id, root, form, prefix, , , , origin] = row.split('\t');
  // MALINDO combines KBBI V and Kamus Dewan. Use checked dictionary records
  // whose roots occur in our standard list or the Indonesian spellchecker.
  if (
    !id.startsWith('cc-') ||
    origin !== 'Kamus' ||
    (!standard.has(root) && !hunspellRoots.has(root)) ||
    !singleWord.test(form) ||
    (existing.has(form) && !standard.has(form))
  ) {
    continue;
  }
  forms.add(form);
  if (prefix.split('+', 1)[0] === 'di-' && form.startsWith('di'))
    addPassiveForms(forms, form.slice(2));
}
const malindoWords = [...forms].filter(
  (word) => !existing.has(word) && !diksi.has(word),
);

function writeList(file, name, words, notice) {
  const lines = [];
  let line = '';
  for (const word of words.sort()) {
    if (line.length + word.length + 1 > 88) {
      lines.push(line);
      line = '';
    }
    line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  writeFileSync(
    new URL(`../src/constant/${file}.ts`, import.meta.url),
    `/**\n${notice}\n * Regenerate with \`node scripts/update-sekata-dictionary.mjs\`.\n */\nexport const ${name} = \`\n${lines.join('\n')}\n\`;\n`,
  );
  console.log(`Wrote ${words.length} forms to ${file}.ts`);
}

writeList(
  'sekata-hunspell',
  'SEKATA_HUNSPELL_FORMS',
  kamusWords,
  ` * SPDX-License-Identifier: MPL-2.0
 * Adapted from Kamus Indonesia for LibreOffice, copyright 2004 and 2014 Benitius Brevoort.
 * This file is subject to the Mozilla Public License, v. 2.0.
 * https://mozilla.org/MPL/2.0/
 * https://listarchives.libreoffice.org/global/dev/2014/msg03708.html
 * https://github.com/titoBouzout/Dictionaries/blob/65e552e7216cecab2b497c898a9a7ee1e2e2de11/Indonesia.txt
 * Contains single-word entries and forms based on the source's passive and clitic flags.`,
);
writeList(
  'sekata-malindo',
  'SEKATA_MALINDO_FORMS',
  malindoWords,
  ` * Adapted from MALINDO Morph (2024) by Hiroki Nomoto, Hannah Choi,
 * David Moeljadi and Francis Bond, licensed under CC BY 4.0.
 * https://creativecommons.org/licenses/by/4.0/
 * https://github.com/matbahasa/MALINDO_Morph/tree/e3ab07c435343d39d6ab3cb87cd9ba57c27f49d3
 * Contains checked single-word forms with roots supported by our Indonesian sources.
 * Also includes agent clitics generated from recorded di- forms.`,
);
