import original from './atlas.json';
import extras from './party-atlas.json';

export const seatsArt = [
  { name: 'Miso', color: '#59b9a5', tint: '#ffffff', face: 'head', mark: '1' },
  {
    name: 'Pip',
    color: '#ecab65',
    tint: '#ffffff',
    face: 'fox-head',
    mark: '2',
  },
  { name: 'Miso', color: '#b7b9ef', tint: '#c5c7fd', face: 'head', mark: '3' },
  {
    name: 'Pip',
    color: '#a7d478',
    tint: '#d0eda9',
    face: 'fox-head',
    mark: '4',
  },
] as const;

export const artSheets = [
  { ...original, file: '/games/trap-tails/cutouts.webp' },
  { ...extras, file: '/games/trap-tails/party-cutouts.webp' },
] as const;

export function spriteFrame(name: string) {
  const index = Object.hasOwn(original.frames, name) ? 0 : 1;
  const sheet = artSheets[index];
  const [x, y, w, h] = (sheet.frames as Record<string, number[]>)[name];
  return { index, x, y, w, h, size: sheet.size, file: sheet.file };
}
