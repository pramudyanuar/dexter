export interface PdfImagePage {
  jpegBytes: Uint8Array;
  width: number;
  height: number;
}

export type PageSize = 'a4' | 'letter' | 'fit';
export type Orientation = 'auto' | 'portrait' | 'landscape';

export interface PdfBuildOptions {
  pageSize: PageSize;
  orientation: Orientation;
  marginPt: number;
}

// Standard PDF points (72 pt = 1 inch)
const PAGE_DIMS: Record<'a4' | 'letter', [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

function asciiBytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function computePageLayout(
  imgW: number,
  imgH: number,
  opts: PdfBuildOptions,
): {
  pageW: number;
  pageH: number;
  drawW: number;
  drawH: number;
  x: number;
  y: number;
} {
  const margin = Math.max(0, opts.marginPt);
  if (opts.pageSize === 'fit') {
    const pageW = imgW + margin * 2;
    const pageH = imgH + margin * 2;
    return { pageW, pageH, drawW: imgW, drawH: imgH, x: margin, y: margin };
  }

  const [baseW, baseH] = PAGE_DIMS[opts.pageSize];
  const isLandscape =
    opts.orientation === 'landscape' ||
    (opts.orientation === 'auto' && imgW > imgH);
  const pageW = isLandscape ? baseH : baseW;
  const pageH = isLandscape ? baseW : baseH;

  const availW = Math.max(10, pageW - margin * 2);
  const availH = Math.max(10, pageH - margin * 2);
  const scale = Math.min(availW / imgW, availH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  return { pageW, pageH, drawW, drawH, x, y };
}

/**
 * Builds a valid PDF 1.4 document embedding each JPEG page via /DCTDecode.
 */
export function buildImagesPdf(
  pages: PdfImagePage[],
  opts: PdfBuildOptions,
): Uint8Array {
  if (pages.length === 0) {
    throw new Error('Minimal 1 gambar diperlukan untuk membuat PDF.');
  }

  // Object numbering:
  // 1 = Catalog
  // 2 = Pages
  // For page i (0..N-1):
  //   pageObj = 3 + i * 3
  //   contentObj = 4 + i * 3
  //   imageObj = 5 + i * 3
  const chunks: Uint8Array[] = [];
  const offsets: number[] = []; // 1-indexed via offsets[objNum]
  let cursor = 0;

  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    cursor += bytes.length;
  };
  const pushStr = (s: string) => push(asciiBytes(s));

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const beginObj = (num: number) => {
    offsets[num] = cursor;
    pushStr(`${num} 0 obj\n`);
  };
  const endObj = () => pushStr('\nendobj\n');

  const kidRefs = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');

  // 1: Catalog
  beginObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  // 2: Pages
  beginObj(2);
  pushStr(`<< /Type /Pages /Kids [ ${kidRefs} ] /Count ${pages.length} >>`);
  endObj();

  pages.forEach((page, i) => {
    const pageObj = 3 + i * 3;
    const contentObj = 4 + i * 3;
    const imageObj = 5 + i * 3;

    const { pageW, pageH, drawW, drawH, x, y } = computePageLayout(
      page.width,
      page.height,
      opts,
    );

    const stream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;

    // Page object
    beginObj(pageObj);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im0 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`,
    );
    endObj();

    // Content stream object
    beginObj(contentObj);
    pushStr(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    endObj();

    // Image XObject
    beginObj(imageObj);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`,
    );
    push(page.jpegBytes);
    pushStr('\nendstream');
    endObj();
  });

  const totalObjs = 2 + pages.length * 3;
  const xrefStart = cursor;
  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjs; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  return concatChunks(chunks);
}
