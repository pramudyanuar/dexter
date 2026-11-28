export const ROOM_STICKERS = [
  {
    id: 'lol',
    art: '😂',
    label: { id: 'WKWK', en: 'LOL' },
    keywords: 'ketawa ngakak lucu laugh funny',
  },
  {
    id: 'gg',
    art: '🏆',
    label: { id: 'GG!', en: 'GG!' },
    keywords: 'menang juara keren good game win trophy ggwp',
  },
  {
    id: 'love',
    art: '💖',
    label: { id: 'Sayang!', en: 'Love!' },
    keywords: 'hati cinta suka heart like gemas',
  },
  {
    id: 'hello',
    art: '👋',
    label: { id: 'Halo!', en: 'Hi!' },
    keywords: 'hai sapa dadah hello wave bye',
  },
  {
    id: 'cry',
    art: '😭',
    label: { id: 'Huhu…', en: 'Sob…' },
    keywords: 'nangis sedih cry sad tears',
  },
  {
    id: 'shock',
    art: '😱',
    label: { id: 'Lho?!', en: 'Whoa?!' },
    keywords: 'kaget syok shock surprise what',
  },
  {
    id: 'fire',
    art: '🔥',
    label: { id: 'Menyala!', en: 'On fire!' },
    keywords: 'api panas semangat fire hype mantap',
  },
  {
    id: 'party',
    art: '🎉',
    label: { id: 'Asyik!', en: 'Hooray!' },
    keywords: 'pesta selamat perayaan party celebrate congrats',
  },
  {
    id: 'ok',
    art: '👍',
    label: { id: 'Siap!', en: 'Okay!' },
    keywords: 'oke setuju jempol yes sure thumbs up ready',
  },
  {
    id: 'think',
    art: '🤔',
    label: { id: 'Hmm…', en: 'Hmm…' },
    keywords: 'mikir bingung pikir think confused',
  },
  {
    id: 'sleep',
    art: '😴',
    label: { id: 'Zzz…', en: 'Zzz…' },
    keywords: 'ngantuk tidur sleepy tired sleep',
  },
  {
    id: 'respect',
    art: '👏',
    label: { id: 'Salut!', en: 'Respect!' },
    keywords: 'tepuk tangan bagus applause clap nice',
  },
];

export type RoomSticker = (typeof ROOM_STICKERS)[number];

export function getRoomSticker(id: unknown) {
  return ROOM_STICKERS.find((sticker) => sticker.id === id);
}
