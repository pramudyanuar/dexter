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
