// ERSYA MEBEL — per-product SEO HTML endpoint.
// Uses only the public Supabase publishable key; public-row visibility remains enforced by RLS.
const BUILD_DEPLOY_CONTEXT = require('../deploy-context.js');
const SUPABASE_URL = 'https://waartnvrptyzqfufpmcs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xTIrqu3MrPg9w_4La7CMbA_xxk7oOYA';
const SITE_ORIGIN = 'https://ersyafurniture.netlify.app';
// Deploy previews and local/dev contexts must never be indexable.
function isProductionContext() { return (process.env.ERSYA_DEPLOY_CONTEXT || BUILD_DEPLOY_CONTEXT) === 'production'; }
const WHATSAPP = '6285803133261';

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
function absoluteImage(value) {
  const image = String(value || '').trim();
  if (!image) return `${SITE_ORIGIN}/ersya-logo.jpg`;
  if (/^https?:\/\//i.test(image)) return image;
  if (/^(?:data:image\/|blob:)/i.test(image)) return `${SITE_ORIGIN}/ersya-logo.jpg`;
  return `${SITE_ORIGIN}/${image.replace(/^\/+/, '')}`;
}
function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': statusCode === 200 ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' : 'no-store',
      ...extraHeaders
    },
    body
  };
}
function pageShell({title, description, canonical, robots, body, image, schema, keywords = []}) {
  const jsonLd = schema ? `<script type="application/ld+json">${safeJson(schema)}</script>` : '';
  const keywordsMeta = Array.isArray(keywords) && keywords.length
    ? `<meta name="keywords" content="${esc(keywords.join(', '))}">`
    : '';
  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">${keywordsMeta}
<meta name="robots" content="${esc(robots)}"><meta name="googlebot" content="${esc(robots)},max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}"><meta name="author" content="ERSYA MEBEL">
<meta name="theme-color" content="#214a36"><meta property="og:site_name" content="ERSYA MEBEL">
<meta property="og:locale" content="id_ID"><meta property="og:type" content="product">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
<style>
:root{--ink:#20271f;--muted:#687168;--cream:#f7f2e8;--green:#214a36;--wood:#9b651f;--line:#e7e0d3}*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}header{border-bottom:1px solid var(--line);background:#fff}.wrap{width:min(1060px,calc(100% - 32px));margin:auto}.nav{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:900;text-decoration:none;display:flex;align-items:center;gap:10px}.mark{width:42px;height:42px;display:grid;place-items:center;background:var(--green);color:#fff;border-radius:12px}.navlinks{display:flex;gap:20px;font-size:14px;font-weight:700}.navlinks a{text-decoration:none}.crumbs{font-size:13px;color:var(--muted);padding:22px 0}.crumbs a{color:var(--green)}main{padding-bottom:44px}.product{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:38px;align-items:start}.product-image{width:100%;aspect-ratio:4/3;object-fit:contain;background:var(--cream);border-radius:22px;border:1px solid var(--line)}.eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:11px;font-weight:900;color:var(--wood)}h1{font-size:clamp(32px,5vw,48px);line-height:1.08;margin:10px 0 14px}p{color:var(--muted)}.description{font-size:17px;white-space:pre-line}.chips{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.chip{padding:6px 11px;border:1px solid var(--line);border-radius:999px;font-size:12px;font-weight:800}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.btn{display:inline-flex;align-items:center;justify-content:center;padding:13px 18px;border-radius:12px;font-weight:800;text-decoration:none}.primary{background:var(--green);color:white}.secondary{background:var(--cream)}.notes{border-top:1px solid var(--line);margin-top:34px;padding-top:20px;font-size:13px;color:var(--muted)}footer{border-top:1px solid var(--line);padding:25px 0;color:var(--muted);font-size:13px}@media(max-width:720px){.product{grid-template-columns:1fr;gap:20px}.navlinks{gap:12px}.product-image{border-radius:16px}.crumbs{padding:15px 0}}
</style>${jsonLd}</head><body>
<header><div class="wrap nav"><a class="brand" href="/"><span class="mark">E</span><span>ERSYA MEBEL<br><small>FURNITURE BESI &amp; KAYU</small></span></a><nav class="navlinks"><a href="/#produk">Katalog</a><a href="/#tentang">Tentang</a><a href="/#kontak">Kontak</a></nav></div></header>
<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Beranda</a> › <a href="/#produk">Katalog Produk</a> › <span>${esc(title.replace(/\s*\|\s*ERSYA MEBEL\s*$/i,''))}</span></nav>
${body}</div><footer><div class="wrap">© ${new Date().getFullYear()} ERSYA MEBEL · Furniture besi dan kayu Jepara · <a href="/">Kembali ke katalog</a></div></footer>
</body></html>`;
}

async function shouldIndex() {
  try {
    const u = new URL(`${SUPABASE_URL}/rest/v1/site_settings`);
    u.searchParams.set('select', 'allow_index');
    u.searchParams.set('limit', '1');
    const r = await fetch(u, {headers: {'apikey': SUPABASE_ANON_KEY, 'Accept': 'application/json'}});
    if (!r.ok) return true;
    const rows = await r.json();
    return !(Array.isArray(rows) && rows[0] && rows[0].allow_index === false);
  } catch (_) { return true; }
}

exports.handler = async function(event) {
  const rawSlug = String(event.queryStringParameters && event.queryStringParameters.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)) {
    return response(404, pageShell({title:'Produk tidak ditemukan | ERSYA MEBEL',description:'Produk yang dicari tidak ditemukan di katalog ERSYA MEBEL.',canonical:`${SITE_ORIGIN}/produk/${encodeURIComponent(rawSlug)}/`,robots:'noindex,nofollow',image:`${SITE_ORIGIN}/ersya-logo.jpg`,body:'<main><h1>Produk tidak ditemukan</h1><p>Produk ini tidak tersedia atau belum dipublikasikan.</p><p><a href="/">Kembali ke katalog ERSYA MEBEL</a></p></main>'}));
  }
  try {
    const u = new URL(`${SUPABASE_URL}/rest/v1/products`);
    u.searchParams.set('select', 'id,name,category,material,description,slug,seo_title,seo_description,seo_keywords,image_path,published,updated_at');
    u.searchParams.set('slug', `eq.${rawSlug}`);
    u.searchParams.set('published', 'eq.true');
    u.searchParams.set('limit', '1');
    const r = await fetch(u, {headers: {'apikey': SUPABASE_ANON_KEY, 'Accept': 'application/json'}});
    if (!r.ok) throw new Error(`Supabase REST HTTP ${r.status}`);
    const rows = await r.json();
    const p = Array.isArray(rows) ? rows[0] : null;
    if (!p) {
      return response(404, pageShell({title:'Produk tidak ditemukan | ERSYA MEBEL',description:'Produk yang dicari tidak ditemukan di katalog ERSYA MEBEL.',canonical:`${SITE_ORIGIN}/produk/${rawSlug}/`,robots:'noindex,nofollow',image:`${SITE_ORIGIN}/ersya-logo.jpg`,body:'<main><h1>Produk tidak ditemukan</h1><p>Produk ini mungkin belum diterbitkan atau sudah tidak tersedia.</p><p><a href="/">Kembali ke katalog ERSYA MEBEL</a></p></main>'}));
    }
    const name = String(p.name || 'Produk Furniture ERSYA MEBEL').trim();
    const category = String(p.category || 'Furniture').trim();
    const material = String(p.material || 'Besi dan kayu').trim();
    const description = String(p.seo_description || p.description || `${name} dari ERSYA MEBEL. Hubungi kami untuk informasi ukuran, bahan, dan ketersediaan.`).trim().slice(0, 320);
    const title = String(p.seo_title || `${name} | ERSYA MEBEL`).trim().slice(0, 60);
    const slug = String(p.slug || rawSlug).trim();
    const canonical = `${SITE_ORIGIN}/produk/${encodeURIComponent(slug)}/`;
    const image = absoluteImage(p.image_path);
    const keywords = Array.isArray(p.seo_keywords)
      ? [...new Set(p.seo_keywords.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 12)
      : [];
    const indexAllowed = await shouldIndex();
    const robots = indexAllowed && isProductionContext() ? 'index,follow' : 'noindex,nofollow';
    const fullDescription = String(p.description || description).trim();
    const waText = `Halo ERSYA MEBEL, saya tertarik dengan produk ${name}. Mohon informasi harga, ukuran, bahan, dan ketersediaannya.`;
    const schema = {
      '@context':'https://schema.org',
      '@type':'Product',
      '@id':`${canonical}#product`,
      name,
      description: fullDescription || description,
      image:[image],
      sku:String(p.id || slug),
      category,
      material,
      ...(keywords.length ? {keywords} : {}),
      brand:{'@type':'Brand','name':'ERSYA MEBEL'},
      url:canonical,
      mainEntityOfPage:{'@type':'WebPage','@id':canonical}
    };
    const breadcrumb = {
      '@context':'https://schema.org',
      '@type':'BreadcrumbList',
      itemListElement:[
        {'@type':'ListItem','position':1,'name':'Beranda','item':`${SITE_ORIGIN}/`},
        {'@type':'ListItem','position':2,'name':'Katalog Produk','item':`${SITE_ORIGIN}/#produk`},
        {'@type':'ListItem','position':3,'name':name,'item':canonical}
      ]
    };
    const body = `<main><article class="product"><div><img class="product-image" src="${esc(image)}" alt="${esc(name)} — ${esc(category)} ${esc(material)}" width="900" height="675" fetchpriority="high"></div><div><div class="eyebrow">ERSYA MEBEL · ${esc(category)}</div><h1>${esc(name)}</h1><p class="description">${esc(fullDescription || description)}</p><div class="chips"><span class="chip">${esc(category)}</span><span class="chip">${esc(material)}</span><span class="chip">Bisa konsultasi custom</span></div><p>Untuk informasi harga, ukuran, pilihan bahan, dan ketersediaan produk, hubungi ERSYA MEBEL secara langsung.</p><div class="actions"><a class="btn primary" href="https://wa.me/${WHATSAPP}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener noreferrer">Tanya via WhatsApp</a><a class="btn secondary" href="/#produk">Lihat katalog</a></div><div class="notes">SKU/ID produk: ${esc(p.id || slug)} · Informasi dapat dikonfirmasi kembali melalui WhatsApp.</div></div></article></main><script type="application/ld+json">${safeJson(breadcrumb)}</script>`;
    return response(200, pageShell({title,description,canonical,robots,image,body,schema,keywords}));
  } catch (error) {
    console.error('ERSYA product-page error:', error && error.message || error);
    return response(503, pageShell({title:'Halaman produk sedang tidak tersedia | ERSYA MEBEL',description:'Data produk sedang tidak dapat dimuat. Silakan kembali ke katalog ERSYA MEBEL.',canonical:`${SITE_ORIGIN}/produk/${rawSlug}/`,robots:'noindex,nofollow',image:`${SITE_ORIGIN}/ersya-logo.jpg`,body:'<main><h1>Halaman produk sedang tidak tersedia</h1><p>Data katalog sedang tidak dapat dimuat. Silakan coba kembali beberapa saat lagi.</p><p><a href="/">Kembali ke katalog ERSYA MEBEL</a></p></main>'}));
  }
};
