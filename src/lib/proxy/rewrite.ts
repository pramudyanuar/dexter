import * as cheerio from 'cheerio';

/**
 * Rewrites a fetched page so it can be shown through /api/proxy. Scripts are
 * removed on purpose: code from other sites must never run on our origin.
 */

export interface RewriteContext {
  /** Page URL, the base for relative links */
  base: string;
  /** Proxy access token appended to every rewritten URL */
  token: string;
  /** CSP nonce for the one script we add */
  nonce: string;
}

/** Turns a URL found in a page into a URL that goes through the proxy. */
export function proxify(
  raw: string,
  ctx: Pick<RewriteContext, 'base' | 'token'>,
) {
  const value = raw.trim();
  if (!value || value.startsWith('#')) return raw;
  if (/^data:image\//i.test(value)) return raw;

  try {
    const abs = new URL(value, ctx.base);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return '#';
    const hash = abs.hash;
    abs.hash = '';
    return `/api/proxy?url=${encodeURIComponent(abs.href)}&t=${ctx.token}${hash}`;
  } catch {
    return '#';
  }
}

export function rewriteCss(
  css: string,
  ctx: Pick<RewriteContext, 'base' | 'token'>,
) {
  return css
    .replace(
      /url\(\s*(['"]?)(.*?)\1\s*\)/gi,
      (match, _quote: string, url: string) =>
        url.trim() ? `url("${proxify(url, ctx)}")` : match,
    )
    .replace(
      /@import\s+(['"])(.*?)\1/gi,
      (_m, _quote: string, url: string) => `@import "${proxify(url, ctx)}"`,
    );
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function rewriteSrcset(
  value: string,
  ctx: Pick<RewriteContext, 'base' | 'token'>,
) {
  return value
    .split(',')
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      return url ? [proxify(url, ctx), ...descriptor].join(' ') : '';
    })
    .filter(Boolean)
    .join(', ');
}

const URL_ATTRS: [string, string][] = [
  ['a', 'href'],
  ['area', 'href'],
  ['link', 'href'],
  ['img', 'src'],
  ['source', 'src'],
  ['video', 'src'],
  ['video', 'poster'],
  ['audio', 'src'],
  ['track', 'src'],
  ['input[type=image]', 'src'],
];

const REMOVED = [
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'base',
  'meta[charset]',
  'meta[http-equiv=content-type i]',
  'meta[http-equiv=content-security-policy i]',
  'link[rel~=preload]',
  'link[rel~=prefetch]',
  'link[rel~=modulepreload]',
  'link[rel~=preconnect]',
  'link[rel~=dns-prefetch]',
].join(',');

const STRIPPED_ATTRS = [
  'integrity',
  'crossorigin',
  'nonce',
  'target',
  'ping',
  'referrerpolicy',
  'srcdoc',
];

export function rewriteHtml(html: string, ctx: RewriteContext): string {
  // scriptingEnabled: false keeps <noscript> content as real elements
  const $ = cheerio.load(html, { scriptingEnabled: false });

  $(REMOVED).remove();
  $('noscript').each((_, el) => {
    $(el).replaceWith($(el).contents());
  });

  // event handlers and attributes that would not survive the proxy
  $('*').each((_, el) => {
    if (el.type !== 'tag') return;
    for (const name of Object.keys(el.attribs)) {
      if (name.startsWith('on') || STRIPPED_ATTRS.includes(name)) {
        $(el).removeAttr(name);
      }
    }
  });

  for (const [selector, attr] of URL_ATTRS) {
    $(`${selector}[${attr}]`).each((_, el) => {
      $(el).attr(attr, proxify($(el).attr(attr) ?? '', ctx));
    });
  }

  // lazy-loaded images need script to fill in `src`; do it up front
  $('img').each((_, el) => {
    const img = $(el);
    const lazy = img.attr('data-src') ?? img.attr('data-original');
    if (!img.attr('src') && lazy) img.attr('src', proxify(lazy, ctx));
  });

  $('img[srcset], source[srcset]').each((_, el) => {
    $(el).attr('srcset', rewriteSrcset($(el).attr('srcset') ?? '', ctx));
  });

  // GET forms (search boxes) go through the proxy; anything else is refused
  $('form').each((_, el) => {
    const form = $(el);
    const isGet = (form.attr('method') ?? 'get').toLowerCase() === 'get';
    let action: string | null = null;
    try {
      const abs = new URL(form.attr('action') || ctx.base, ctx.base);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') {
        abs.hash = '';
        action = abs.href;
      }
    } catch {
      // leave action null: the form is refused below
    }

    const hidden = (name: string, value: string) =>
      `<input type="hidden" name="${name}" value="${escapeAttr(value)}">`;

    form.attr('action', '/api/proxy').attr('method', 'get');
    form.prepend(
      isGet && action
        ? hidden('t', ctx.token) + hidden('__form', '1') + hidden('url', action)
        : hidden('__unsupported', '1'),
    );
  });

  $('[style]').each((_, el) => {
    $(el).attr('style', rewriteCss($(el).attr('style') ?? '', ctx));
  });
  $('style').each((_, el) => {
    $(el).text(rewriteCss($(el).text(), ctx));
  });

  $('meta[http-equiv=refresh i]').each((_, el) => {
    const content = $(el).attr('content') ?? '';
    const match = content.match(/^\s*(\d+)\s*;\s*url\s*=\s*(.+)$/i);
    if (match) {
      $(el).attr('content', `${match[1]}; url=${proxify(match[2], ctx)}`);
    }
  });

  $('head').prepend(
    '<meta charset="utf-8"><meta name="referrer" content="no-referrer">',
  );

  // tells the parent page which URL is showing, so the address bar follows
  const url = JSON.stringify(ctx.base).replace(/</g, '\\u003c');
  $('body').append(
    `<script nonce="${ctx.nonce}">addEventListener('load',function(){parent.postMessage({type:'dexter-proxy',url:${url},title:document.title},'*')})</script>`,
  );

  return $.html();
}
