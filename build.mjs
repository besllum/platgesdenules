// Build estàtic de platgesdenules.es — sense dependències (només Node).
// Genera /dist amb una versió per idioma de cada pàgina (valencià a l'arrel, castellà a /es).
// Ús: node build.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const PUB = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');

const site = readJSON(path.join(SRC, 'site.json'));
const dicts = Object.fromEntries(Object.keys(site.langs).map(l => [l, readJSON(path.join(SRC, 'i18n', `${l}.json`))]));
const today = new Date().toISOString().slice(0, 10);

function readJSON(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- URLs ----------
function pageUrl(pageKey, lang) {
  const slug = site.pages[pageKey].slug[lang];
  const prefix = site.langs[lang].prefix;
  const p = [prefix, slug].filter(Boolean).join('/');
  return p ? (p.startsWith('/') ? p : '/' + p) : '/';
}
const absUrl = p => site.baseUrl + (p === '/' ? '/' : p);
function outFile(pageKey, lang) {
  const u = pageUrl(pageKey, lang);
  if (u === '/') return 'index.html';
  if (u === site.langs[lang].prefix) return u.slice(1) + '/index.html';
  return u.slice(1) + '.html';
}

// ---------- image sizes (PNG / JPEG / WebP headers) ----------
const sizeCache = {};
function imgSize(file) {
  if (sizeCache[file] !== undefined) return sizeCache[file];
  let r = null;
  try {
    const b = fs.readFileSync(file);
    if (b.slice(1, 4).toString() === 'PNG') r = [b.readUInt32BE(16), b.readUInt32BE(20)];
    else if (b.slice(0, 4).toString() === 'RIFF') {
      const t = b.slice(12, 16).toString();
      if (t === 'VP8 ') r = [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      else if (t === 'VP8L') { const n = b.readUInt32LE(21); r = [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
      else if (t === 'VP8X') r = [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    } else if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1], len = b.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { r = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
        i += 2 + len;
      }
    }
  } catch { r = null; }
  return (sizeCache[file] = r);
}

// ---------- template engine ----------
function getPath(obj, p) { return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

function render(tpl, ctx, depth = 0) {
  if (depth > 5) throw new Error('Partials massa niats');
  // partials
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => render(fs.readFileSync(path.join(SRC, 'partials', name + '.html'), 'utf8'), ctx, depth + 1));
  // raw {{{ path }}}
  tpl = tpl.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, p) => { const v = getPath(ctx, p); if (v === undefined) warn(ctx, p); return v ?? ''; });
  // json attr {{json path}}
  tpl = tpl.replace(/\{\{json\s+([\w.]+)\s*\}\}/g, (_, p) => esc(JSON.stringify(getPath(ctx, p) ?? null)));
  // escaped {{ path }}
  tpl = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
    const v = typeof ctx.fn[p] === 'function' ? ctx.fn[p]() : getPath(ctx, p);
    if (v === undefined) warn(ctx, p);
    return esc(v ?? '');
  });
  return tpl;
}
function warn(ctx, p) { console.warn(`  ⚠ [${ctx.lang}/${ctx.page}] falta el text: ${p}`); }

// style-hover / style-focus -> classes CSS
function hoverClasses(html) {
  const rules = new Map();
  html = html.replace(/<([a-z0-9]+)([^>]*?)\sstyle-(hover|focus)="([^"]*)"([^>]*)>/gi, function rep(m, tag, a, kind, decl, b) {
    let attrs = a + b;
    // pot haver-hi dos atributs (hover i focus) al mateix tag
    const extra = attrs.match(/\sstyle-(hover|focus)="([^"]*)"/i);
    const list = [[kind, decl]];
    if (extra) { list.push([extra[1], extra[2]]); attrs = attrs.replace(extra[0], ''); }
    const classes = list.map(([k, d]) => {
      const key = k + '|' + d;
      if (!rules.has(key)) rules.set(key, (k === "hover" ? "hv" : "fc") + rules.size);
      return rules.get(key);
    });
    if (/\sclass="/.test(attrs)) attrs = attrs.replace(/\sclass="([^"]*)"/, (_, c) => ` class="${c} ${classes.join(' ')}"`);
    else attrs = ` class="${classes.join(' ')}"` + attrs;
    return `<${tag}${attrs}>`;
  });
  const css = [...rules].map(([key, cls]) => {
    const [k, d] = key.split('|');
    const decls = d.split(';').filter(x => x.trim()).map(x => x.trim() + ' !important').join(';');
    return k === 'hover' ? `.${cls}:hover,.${cls}:focus-visible{${decls}}` : `.${cls}:focus{${decls}}`;
  }).join('\n');
  return { html, css };
}

// <img>: width/height automàtics + lazy per defecte
function enhanceImages(html) {
  return html.replace(/<img\b([^>]*?)\/?>/g, (m, attrs) => {
    const src = (attrs.match(/\ssrc="([^"]+)"/) || [])[1];
    if (src && src.startsWith('/') && !/\swidth=/.test(attrs)) {
      const s = imgSize(path.join(PUB, src));
      if (s) attrs += ` width="${s[0]}" height="${s[1]}"`;
      else console.warn(`  ⚠ imatge no trobada: ${src}`);
    }
    if (!/\sloading=/.test(attrs) && !/fetchpriority="high"/.test(attrs)) attrs += ' loading="lazy"';
    if (!/\sdecoding=/.test(attrs)) attrs += ' decoding="async"';
    return `<img${attrs}>`;
  });
}

// ---------- SEO head ----------
function jsonLd(pageKey, lang, t) {
  const org = {
    '@type': 'NGO', '@id': site.baseUrl + '/#org',
    name: site.orgName, alternateName: site.siteName, url: site.baseUrl + '/',
    logo: { '@type': 'ImageObject', url: site.baseUrl + '/icon-512.png', width: 512, height: 512 },
    image: site.baseUrl + '/img/og-inici.jpg',
    email: site.email,
    description: t.common.footAbout,
    sameAs: [site.instagram, site.facebook],
    areaServed: { '@type': 'Place', name: 'Nules, Castelló, España' },
    memberOf: { '@type': 'Organization', name: 'Mar Nostra · Federació per la Protecció i Regeneració de la Costa', url: 'https://marnostra.org/' },
    contactPoint: { '@type': 'ContactPoint', email: site.email, contactType: 'customer support', availableLanguage: ['ca', 'es'] }
  };
  const website = { '@type': 'WebSite', '@id': site.baseUrl + '/#website', url: site.baseUrl + '/', name: site.siteName, publisher: { '@id': org['@id'] }, inLanguage: ['ca-ES', 'es-ES'] };
  const url = absUrl(pageUrl(pageKey, lang));
  const meta = site.pages[pageKey].meta[lang];
  const webpage = {
    '@type': 'WebPage', '@id': url + '#webpage', url, name: meta.title, description: meta.description,
    inLanguage: site.langs[lang].hreflang, isPartOf: { '@id': website['@id'] }, about: { '@id': org['@id'] },
    primaryImageOfPage: { '@type': 'ImageObject', url: site.baseUrl + site.pages[pageKey].image }
  };
  const graph = [org, website, webpage];
  if (pageKey !== 'home') {
    graph.push({
      '@type': 'BreadcrumbList', '@id': url + '#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: site.siteName, item: absUrl(pageUrl('home', lang)) },
        { '@type': 'ListItem', position: 2, name: meta.title.split(/[|:·]/)[0].trim(), item: url }
      ]
    });
    webpage.breadcrumb = { '@id': url + '#breadcrumb' };
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
}

function head(pageKey, lang, t, extraCss) {
  const pg = site.pages[pageKey], meta = pg.meta[lang], L = site.langs[lang];
  const url = absUrl(pageUrl(pageKey, lang));
  const alts = Object.entries(site.langs).map(([l, cfg]) => `<link rel="alternate" hreflang="${cfg.hreflang}" href="${absUrl(pageUrl(pageKey, l))}">`).join('\n');
  const xdef = `<link rel="alternate" hreflang="x-default" href="${absUrl(pageUrl(pageKey, site.defaultLang))}">`;
  const otherLocales = Object.entries(site.langs).filter(([l]) => l !== lang).map(([, c]) => `<meta property="og:locale:alternate" content="${c.ogLocale}">`).join('\n');
  const img = site.baseUrl + pg.image;
  const s = imgSize(path.join(PUB, pg.image)) || [1200, 630];
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<meta name="robots" content="${pg.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">
<link rel="canonical" href="${url}">
${alts}
${xdef}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.siteName)}">
<meta property="og:locale" content="${L.ogLocale}">
${otherLocales}
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="${s[0]}">
<meta property="og:image:height" content="${s[1]}">
<meta property="og:image:alt" content="${esc(site.siteName)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${img}">
<meta name="theme-color" content="#f5f2ec">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/jost-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/cormorant-garamond-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=${BUILD_ID}">
${extraCss ? `<style>${extraCss}</style>` : ''}
${jsonLd(pageKey, lang, t)}`;
}

const BUILD_ID = Date.now().toString(36);

// ---------- pobles (Mar Nostra) ----------
function poblesHtml(lang) {
  const t = dicts[lang];
  return site.pobles.map((p, i) => {
    const jo = !!p.nosaltres;
    return `<li style="display:flex;flex-direction:column;border-bottom:1px solid #ddd8cd">
          <button type="button" data-acc="poble-${i}" aria-expanded="false" aria-controls="poble-${i}" style="display:flex;justify-content:space-between;align-items:center;gap:16px;width:100%;padding:16px 0;background:transparent;border:0;cursor:pointer;font-family:Jost,sans-serif;font-weight:300;color:#1a1a18;text-align:left">
            <span style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;font-weight:${jo ? 600 : 300};color:${jo ? '#37798f' : '#1a1a18'}">${esc(p.nom)}</span>
            <span style="display:flex;align-items:center;gap:12px;color:#8a857c;font-size:12px;letter-spacing:.1em">${String(p.assoc.length).padStart(2, '0')}<span class="rot" style="display:inline-block;font-size:14px;line-height:1;color:#37798f" aria-hidden="true">+</span></span>
          </button>
          <ul id="poble-${i}" hidden style="margin:0 0 18px;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px">
            ${p.assoc.map(a => `<li style="font-size:14px;line-height:1.6;letter-spacing:.02em;color:#4a4740">${esc(a)}</li>`).join('\n            ')}
          </ul>
        </li>`;
  }).join('\n        ');
}

// ---------- build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUB, DIST, { recursive: true });

const sitemapUrls = [];
let count = 0;
for (const lang of Object.keys(site.langs)) {
  const t = dicts[lang];
  for (const [pageKey, pg] of Object.entries(site.pages)) {
    const tplFile = path.join(SRC, 'pages', pg.template);
    const otherLang = Object.keys(site.langs).find(l => l !== lang);
    const url = Object.fromEntries(Object.keys(site.pages).map(k => [k, pageUrl(k, lang)]));
    const ctx = {
      lang, page: pageKey, site, url,
      t: { ...t.common, ...(t[pageKey] || {}), alt: t.alt, common: t.common },
      L: site.langs[lang],
      other: { label: site.langs[otherLang].label, url: pageUrl(pageKey, otherLang), hreflang: site.langs[otherLang].hreflang, lang: otherLang },
      me: { label: site.langs[lang].label },
      active: Object.fromEntries(Object.keys(site.pages).map(k => [k, k === pageKey ? 'is-active' : ''])),
      fn: { pobles: () => '' }
    };
    let body = render(fs.readFileSync(tplFile, 'utf8'), ctx);
    body = body.replace('<!--POBLES-->', poblesHtml(lang));
    const hv = hoverClasses(body);
    body = enhanceImages(hv.html);
    const html = `<!DOCTYPE html>
<html lang="${site.langs[lang].htmlLang}">
<head>
${head(pageKey, lang, ctx.t, hv.css)}
</head>
<body data-lang="${lang}">
<a class="skip" href="#contingut">${esc(t.common.skip)}</a>
${body}
<script src="/js/site.js?v=${BUILD_ID}" defer></script>
</body>
</html>
`;
    const out = path.join(DIST, outFile(pageKey, lang));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    count++;
    if (!pg.noindex) sitemapUrls.push({ pageKey, lang });
  }
}

// 404 bilingüe
{
  const ca = dicts.ca.common, es = dicts.es.common;
  fs.writeFileSync(path.join(DIST, '404.html'), `<!DOCTYPE html>
<html lang="ca-ES-valencia"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 · ${esc(ca.lang404t)} · Platges de Nules</title><meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="stylesheet" href="/css/site.css?v=${BUILD_ID}"></head>
<body><main style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:40px;text-align:center">
<a href="/"><img src="/img/logo-platges-nules.webp" alt="Platges de Nules" width="135" height="52" style="display:block;height:52px;width:auto;filter:invert(.74)"></a>
<p style="margin:0;font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#37798f">404</p>
<h1 style="margin:0;font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(32px,4.4vw,54px);line-height:1.1">${esc(ca.lang404t)}</h1>
<p style="margin:0;max-width:46ch;font-size:16px;line-height:1.85;color:#4a4740">${esc(ca.lang404p)}<br><span lang="es">${esc(es.lang404p)}</span></p>
<p style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin:8px 0 0">
<a href="/" style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#f5f2ec;background:#37798f;padding:15px 32px;border-radius:999px">${esc(ca.lang404cta)}</a>
<a href="/es" lang="es" style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#f5f2ec;background:#37798f;padding:15px 32px;border-radius:999px">${esc(es.lang404cta)}</a></p>
</main></body></html>
`);
}

// sitemap.xml amb alternatives hreflang
{
  const items = sitemapUrls.map(({ pageKey, lang }) => {
    const alts = Object.entries(site.langs).map(([l, c]) => `    <xhtml:link rel="alternate" hreflang="${c.hreflang}" href="${absUrl(pageUrl(pageKey, l))}"/>`).join('\n');
    return `  <url>
    <loc>${absUrl(pageUrl(pageKey, lang))}</loc>
    <lastmod>${today}</lastmod>
    <priority>${site.pages[pageKey].priority || '0.5'}</priority>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="${absUrl(pageUrl(pageKey, site.defaultLang))}"/>
  </url>`;
  }).join('\n');
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${items}
</urlset>
`);
}

fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${site.baseUrl}/sitemap.xml
`);

fs.writeFileSync(path.join(DIST, 'site.webmanifest'), JSON.stringify({
  name: site.siteName, short_name: site.siteName, lang: 'ca', start_url: '/', display: 'browser',
  background_color: '#f5f2ec', theme_color: '#37798f',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }]
}, null, 2));

console.log(`✓ ${count} pàgines generades a /dist (${today})`);
