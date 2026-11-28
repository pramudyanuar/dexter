import { encodeQrMatrix, qrToSvg } from '@/features/tools/qr';

describe('QR encoder', () => {
  it('produces a valid square matrix with finder patterns', () => {
    const matrix = encodeQrMatrix('https://example.com');
    const n = matrix.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === n)).toBe(true);

    // Top-left finder pattern corner and center should be dark
    expect(matrix[0][0]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    expect(matrix[6][6]).toBe(true);
    // White separator around top-left finder
    expect(matrix[7][0]).toBe(false);
    expect(matrix[0][7]).toBe(false);
  });

  it('renders valid SVG output', () => {
    const matrix = encodeQrMatrix('halo');
    const svg = qrToSvg(matrix);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('<path d=');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('throws on overly long text', () => {
    expect(() => encodeQrMatrix('a'.repeat(500))).toThrow();
  });
});
