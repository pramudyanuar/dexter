import { buildImagesPdf } from '@/features/tools/pdf';

describe('buildImagesPdf', () => {
  it('builds a valid PDF 1.4 binary with xref and EOF', () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildImagesPdf(
      [
        { jpegBytes: fakeJpeg, width: 800, height: 600 },
        { jpegBytes: fakeJpeg, width: 600, height: 900 },
      ],
      { pageSize: 'a4', orientation: 'auto', marginPt: 24 },
    );

    const text = Buffer.from(pdf).toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain('xref\n0 9');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('throws when given no pages', () => {
    expect(() =>
      buildImagesPdf([], { pageSize: 'a4', orientation: 'auto', marginPt: 0 }),
    ).toThrow();
  });
});
