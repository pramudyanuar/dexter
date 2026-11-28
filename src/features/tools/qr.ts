/**
 * Minimal, zero-dependency QR Code (Byte mode, ECC Level M, Versions 1-10) encoder.
 * Produces a boolean matrix where `true` represents a dark module.
 */

// Total data codewords & ECC codewords per block for Level M, versions 1..10 (1 block for v1-v4, 2 blocks for v5-v10)
const VERSION_INFO: Record<
  number,
  { totalData: number; eccPerBlock: number; blocks: number }
> = {
  1: { totalData: 16, eccPerBlock: 10, blocks: 1 },
  2: { totalData: 28, eccPerBlock: 16, blocks: 1 },
  3: { totalData: 44, eccPerBlock: 26, blocks: 1 },
  4: { totalData: 64, eccPerBlock: 18, blocks: 2 },
  5: { totalData: 86, eccPerBlock: 24, blocks: 2 },
  6: { totalData: 108, eccPerBlock: 16, blocks: 4 },
  7: { totalData: 124, eccPerBlock: 18, blocks: 4 },
  8: { totalData: 154, eccPerBlock: 22, blocks: 4 },
  9: { totalData: 182, eccPerBlock: 22, blocks: 5 },
  10: { totalData: 216, eccPerBlock: 26, blocks: 5 },
};

const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// GF(256) with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGeneratorPoly(eccLen);
  const res = new Uint8Array(data.length + eccLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

function pushBits(bits: number[], value: number, len: number) {
  for (let i = len - 1; i >= 0; i--) {
    bits.push((value >> i) & 1);
  }
}

function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    const capBits = VERSION_INFO[v].totalData * 8;
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + byteLen * 8 <= capBits) return v;
  }
  throw new Error('Teks terlalu panjang (maksimal ~210 byte UTF-8).');
}

function encodeData(bytes: Uint8Array, version: number): Uint8Array {
  const info = VERSION_INFO[version];
  const bits: number[] = [];
  const countBits = version < 10 ? 8 : 16;

  // Mode 0100 (Byte)
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, countBits);
  for (const b of bytes) pushBits(bits, b, 8);

  const maxBits = info.totalData * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(bits, 0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(info.totalData);
  for (let i = 0; i < bits.length / 8; i++) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | bits[i * 8 + j];
    data[i] = val;
  }
  const pad = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < info.totalData; i++, p++) {
    data[i] = pad[p & 1];
  }

  // Split into blocks & interleave
  const { blocks, eccPerBlock } = info;
  const shortLen = Math.floor(info.totalData / blocks);
  const longBlocks = info.totalData % blocks;
  const shortBlocks = blocks - longBlocks;

  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < blocks; b++) {
    const len = b < shortBlocks ? shortLen : shortLen + 1;
    const slice = data.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(slice);
    eccBlocks.push(rsEncode(slice, eccPerBlock));
  }

  const out: number[] = [];
  const maxDataLen = shortLen + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) out.push(blk[i]);
    }
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (const blk of eccBlocks) {
      out.push(blk[i]);
    }
  }
  return new Uint8Array(out);
}

function buildMatrix(version: number, codewords: Uint8Array): boolean[][] {
  const size = version * 4 + 17;
  const grid: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array<boolean | null>(size).fill(null),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );

  const setModule = (r: number, c: number, val: boolean, lock = true) => {
    grid[r][c] = val;
    if (lock) reserved[r][c] = true;
  };

  const placeFinder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inBorder = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const dark =
          !inBorder &&
          (dr === 0 ||
            dr === 6 ||
            dc === 0 ||
            dc === 6 ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setModule(r, c, dark);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const align = ALIGNMENT_POSITIONS[version];
  for (const r of align) {
    for (const c of align) {
      if (reserved[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          setModule(r + dr, c + dc, dark);
        }
      }
    }
  }

  // Dark module
  setModule(4 * version + 9, 8, true);

  // Reserve format info
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = true;
    if (!reserved[i][8]) reserved[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }

  // Reserve version info for v >= 7
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true;
        reserved[size - 11 + j][i] = true;
      }
    }
  }

  // Place data bits
  const totalBits = codewords.length * 8;
  let bitIdx = 0;
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let rowStep = 0; rowStep < size; rowStep++) {
      const r = up ? size - 1 - rowStep : rowStep;
      for (const c of [col, col - 1]) {
        if (reserved[r][c]) continue;
        const bit =
          bitIdx < totalBits
            ? ((codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1
            : false;
        grid[r][c] = bit;
        bitIdx++;
      }
    }
    up = !up;
  }

  // Apply best mask (0..7)
  const maskFn = (mask: number, r: number, c: number): boolean => {
    switch (mask) {
      case 0:
        return (r + c) % 2 === 0;
      case 1:
        return r % 2 === 0;
      case 2:
        return c % 3 === 0;
      case 3:
        return (r + c) % 3 === 0;
      case 4:
        return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5:
        return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6:
        return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default:
        return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  };

  let bestMask = 0;
  let bestScore = Infinity;
  let bestMatrix: boolean[][] = [];

  for (let mask = 0; mask < 8; mask++) {
    const m: boolean[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => {
        const val = Boolean(grid[r][c]);
        return reserved[r][c] ? val : val !== maskFn(mask, r, c);
      }),
    );
    placeFormatInfo(m, mask);
    if (version >= 7) placeVersionInfo(m, version);
    const score = penaltyScore(m);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestMatrix = m;
    }
  }
  void bestMask;
  return bestMatrix;
}

function formatBitsFor(mask: number): number {
  // ECC Level M = 00
  const data = (0b00 << 3) | mask;
  let rem = data << 10;
  const poly = 0b10100110111;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= poly << (i - 10);
  }
  return ((data << 10) | rem) ^ 0b101010000010010;
}

function placeFormatInfo(m: boolean[][], mask: number) {
  const size = m.length;
  const bits = formatBitsFor(mask);
  const bit = (i: number) => ((bits >> i) & 1) === 1;

  for (let i = 0; i <= 5; i++) m[8][i] = bit(14 - i);
  m[8][7] = bit(8);
  m[8][8] = bit(7);
  m[7][8] = bit(6);
  for (let i = 0; i <= 5; i++) m[5 - i][8] = bit(5 - i);

  for (let i = 0; i <= 6; i++) m[size - 1 - i][8] = bit(14 - i);
  for (let i = 0; i <= 7; i++) m[8][size - 8 + i] = bit(7 - i);
}

function placeVersionInfo(m: boolean[][], version: number) {
  const size = m.length;
  let rem = version << 12;
  const poly = 0b1111100100101;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) rem ^= poly << (i - 12);
  }
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const val = ((bits >> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = size - 11 + (i % 3);
    m[r][c] = val;
    m[c][r] = val;
  }
}

function penaltyScore(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) {
      if (m[r][c] === m[r][c - 1]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if (m[r][c] === m[r - 1][c]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) {
        score += 3;
      }
    }
  }
  return score;
}

function toUtf8Bytes(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }
  const encoded = encodeURIComponent(text);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return new Uint8Array(bytes);
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = toUtf8Bytes(text);
  const version = pickVersion(bytes.length);
  const codewords = encodeData(bytes, version);
  return buildMatrix(version, codewords);
}

export function qrToSvg(
  matrix: boolean[][],
  fg = '#111111',
  bg = '#ffffff',
  margin = 4,
): string {
  const size = matrix.length;
  const full = size + margin * 2;
  let paths = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        paths += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"><rect width="${full}" height="${full}" fill="${bg}"/><path d="${paths}" fill="${fg}"/></svg>`;
}
