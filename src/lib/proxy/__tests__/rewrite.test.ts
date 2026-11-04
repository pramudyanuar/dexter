/** @jest-environment node */
import { proxify, rewriteCss, rewriteHtml } from '@/lib/proxy/rewrite';

const ctx = {
  base: 'https://site.test/dir/page.html',
  token: 'TOK',
  nonce: 'N0NCE',
};
const enc = encodeURIComponent;

describe('proxify', () => {
  it('resolves relative urls against the base and adds the token', () => {
    expect(proxify('../img/a.png', ctx)).toBe(
      `/api/proxy?url=${enc('https://site.test/img/a.png')}&t=TOK`,
    );
    expect(proxify('//cdn.test/x.css', ctx)).toBe(
      `/api/proxy?url=${enc('https://cdn.test/x.css')}&t=TOK`,
    );
  });

  it('keeps the fragment out of the target url', () => {
    expect(proxify('/p#sec', ctx)).toBe(
      `/api/proxy?url=${enc('https://site.test/p')}&t=TOK#sec`,
    );
  });

  it('leaves anchors and inline images alone, neutralises other schemes', () => {
    expect(proxify('#top', ctx)).toBe('#top');
    expect(proxify('data:image/png;base64,AAAA', ctx)).toBe(
      'data:image/png;base64,AAAA',
    );
    expect(proxify('javascript:alert(1)', ctx)).toBe('#');
    expect(proxify('mailto:a@b.c', ctx)).toBe('#');
    expect(proxify('data:text/html,<script>1</script>', ctx)).toBe('#');
  });
});

describe('proxify unwraps search engine tracking redirects', () => {
  const target = 'https://www.rust-lang.org/learn?x=1&y=2';
  const u = 'a1' + Buffer.from(target).toString('base64url');

  it('goes straight to the real target', () => {
    const link = `https://www.bing.com/ck/a?!&&p=abc&ptn=3&u=${u}&ntb=1`;
    expect(proxify(link, ctx)).toBe(`/api/proxy?url=${enc(target)}&t=TOK`);
  });

  it('leaves other bing links and undecodable ones alone', () => {
    expect(proxify('https://www.bing.com/images/search?q=x', ctx)).toBe(
      `/api/proxy?url=${enc('https://www.bing.com/images/search?q=x')}&t=TOK`,
    );
    const bad = 'https://www.bing.com/ck/a?u=zzz';
    expect(proxify(bad, ctx)).toBe(`/api/proxy?url=${enc(bad)}&t=TOK`);
  });
});

describe('proxify unwraps Yahoo tracking redirects', () => {
  it('goes straight to the real target', () => {
    const link =
      'https://r.search.yahoo.com/_ylt=A2RTiDqj/RV=2/RE=1794993571/RO=10/RU=https%3a%2f%2frust-lang.org%2flearn%3fa%3d1/RK=2/RS=abc-';
    expect(proxify(link, ctx)).toBe(
      `/api/proxy?url=${enc('https://rust-lang.org/learn?a=1')}&t=TOK`,
    );
  });

  it('refuses to unwrap to a non-http target', () => {
    const link =
      'https://r.search.yahoo.com/RV=2/RU=javascript%3aalert(1)/RK=2';
    // falls back to the original link, which the proxy then fetches as normal
    expect(proxify(link, ctx)).toBe(`/api/proxy?url=${enc(link)}&t=TOK`);
  });
});

describe('rewriteCss', () => {
  it('rewrites url() and @import', () => {
    const out = rewriteCss(
      `@import "/base.css"; a{background:url(/i.png)} b{background:url('x.png')}`,
      ctx,
    );
    expect(out).toContain(
      `@import "/api/proxy?url=${enc('https://site.test/base.css')}`,
    );
    expect(out).toContain(
      `url("/api/proxy?url=${enc('https://site.test/i.png')}&t=TOK")`,
    );
    expect(out).toContain(
      `url("/api/proxy?url=${enc('https://site.test/dir/x.png')}&t=TOK")`,
    );
  });
});

describe('rewriteHtml', () => {
  const html = `<!doctype html><html><head>
    <meta charset="latin1"><base href="https://evil.test/">
    <link rel="stylesheet" href="s.css" integrity="sha256-x" crossorigin>
    <link rel="preload" href="big.js" as="script">
    <style>p{background:url(/bg.png)}</style>
    <script>steal(document.cookie)</script>
    <meta http-equiv="refresh" content="3; url=/next">
  </head><body onload="evil()">
    <a href="/about#x" target="_blank" onclick="evil()">about</a>
    <img src="a.png" srcset="a.png 1x, b.png 2x" onerror="evil()">
    <img data-src="lazy.png">
    <iframe src="https://evil.test"></iframe>
    <div style="background:url(/d.png)">x</div>
    <noscript><p id="fallback">no js</p></noscript>
    <form action="/search"><input name="q"></form>
    <form method="post" action="/login"><input name="pw"></form>
  </body></html>`;

  const out = rewriteHtml(html, ctx);

  it('removes everything that can run code or escape the proxy', () => {
    expect(out).not.toContain('steal(');
    expect(out).not.toMatch(/onload|onclick|onerror/);
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('evil.test');
    expect(out).not.toContain('integrity');
    expect(out).not.toContain('preload');
    expect(out).not.toContain('target=');
  });

  it('routes links, images, css and refresh through the proxy', () => {
    expect(out).toContain(
      `href="/api/proxy?url=${enc('https://site.test/about')}&amp;t=TOK#x"`,
    );
    expect(out).toContain(
      `src="/api/proxy?url=${enc('https://site.test/dir/a.png')}&amp;t=TOK"`,
    );
    expect(out).toContain(
      `url("/api/proxy?url=${enc('https://site.test/bg.png')}`,
    );
    expect(out).toContain(
      `url(&quot;/api/proxy?url=${enc('https://site.test/d.png')}`,
    );
    expect(out).toContain(
      `url=/api/proxy?url=${enc('https://site.test/next')}`,
    );
    // lazy image got a real src
    expect(out).toContain(enc('https://site.test/dir/lazy.png'));
  });

  it('unwraps noscript content', () => {
    expect(out).toContain('id="fallback"');
    expect(out).not.toContain('<noscript');
  });

  it('sends GET forms through the proxy and refuses POST forms', () => {
    expect(out).toContain('name="__form" value="1"');
    expect(out).toContain(`name="url" value="https://site.test/search"`);
    expect(out).toContain('name="__unsupported"');
  });

  it('adds only our own nonce script, with the url safely escaped', () => {
    expect(out.match(/<script/g)).toHaveLength(1);
    expect(out).toContain('nonce="N0NCE"');
    const tricky = rewriteHtml('<p>x</p>', {
      ...ctx,
      base: 'https://a.test/</script><b>',
    });
    expect(tricky).not.toContain('</script><b>');
  });
});
