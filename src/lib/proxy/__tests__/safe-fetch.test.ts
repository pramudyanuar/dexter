/** @jest-environment node */
import {
  assertPublicUrl,
  isPrivateAddress,
  ProxyError,
} from '@/lib/proxy/safe-fetch';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe', // 169.254.169.254 in hex form
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.0.1',
    '172.32.0.1',
    '2606:4700::1111',
  ])('allows public %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  it('accepts normal public urls', () => {
    expect(assertPublicUrl('https://example.com/a?b=1').hostname).toBe(
      'example.com',
    );
    expect(assertPublicUrl('http://example.com:8080/').port).toBe('8080');
  });

  it.each([
    'file:///etc/passwd',
    'ftp://example.com',
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'https://example.com:22',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.5:8080/',
    'http://[::ffff:127.0.0.1]/',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => assertPublicUrl(url)).toThrow(ProxyError);
  });
});
