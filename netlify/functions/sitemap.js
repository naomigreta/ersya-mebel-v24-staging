// ERSYA MEBEL — sitemap generated from published Supabase products.
const BUILD_DEPLOY_CONTEXT = require('../deploy-context.js');
const SUPABASE_URL = 'https://waartnvrptyzqfufpmcs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xTIrqu3MrPg9w_4La7CMbA_xxk7oOYA';
const SITE_ORIGIN = 'https://ersyafurniture.netlify.app';
function xml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function reply(statusCode, body) {
  const production = (process.env.ERSYA_DEPLOY_CONTEXT || BUILD_DEPLOY_CONTEXT) === 'production';
  return {statusCode, headers:{'Content-Type':'application/xml; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':production?'index, follow':'noindex, nofollow','Cache-Control':statusCode===200?'public, max-age=0, s-maxage=60':'no-store'},body};
}
async function shouldIndex() {
  try {
    const u = new URL(`${SUPABASE_URL}/rest/v1/site_settings`);
    u.searchParams.set('select','allow_index'); u.searchParams.set('limit','1');
    const r = await fetch(u,{headers:{'apikey':SUPABASE_ANON_KEY,'Accept':'application/json'}});
    if (!r.ok) return true;
    const rows = await r.json();
    return !(Array.isArray(rows)&&rows[0]&&rows[0].allow_index===false);
  } catch (_) { return true; }
}
exports.handler = async function() {
  try {
    const urls = [`  <url><loc>${SITE_ORIGIN}/</loc></url>`];
    if (await shouldIndex()) {
      const endpoint = new URL(`${SUPABASE_URL}/rest/v1/products`);
      endpoint.searchParams.set('select','slug,updated_at');
      endpoint.searchParams.set('published','eq.true');
      endpoint.searchParams.set('slug','not.is.null');
      endpoint.searchParams.set('order','updated_at.desc');
      endpoint.searchParams.set('limit','1000');
      for (let offset=0; offset<50000; offset+=1000) {
        endpoint.searchParams.set('offset', String(offset));
        const r = await fetch(endpoint,{headers:{'apikey':SUPABASE_ANON_KEY,'Accept':'application/json'}});
        if (!r.ok) throw new Error(`Supabase REST HTTP ${r.status}`);
        const rows = await r.json();
        if (!Array.isArray(rows) || !rows.length) break;
        for (const p of rows) {
          const slug = String(p.slug || '').trim();
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) continue;
          const loc = `${SITE_ORIGIN}/produk/${encodeURIComponent(slug)}/`;
          const lastmod = p.updated_at && !Number.isNaN(Date.parse(p.updated_at)) ? `<lastmod>${new Date(p.updated_at).toISOString()}</lastmod>` : '';
          if (urls.length >= 50000) break;
          urls.push(`  <url><loc>${xml(loc)}</loc>${lastmod}</url>`);
        }
        if (rows.length < 1000 || urls.length >= 50000) break;
      }
    }
    return reply(200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
  } catch (error) {
    console.error('ERSYA sitemap error:', error && error.message || error);
    return reply(503, '<?xml version="1.0" encoding="UTF-8"?><error>Sitemap is temporarily unavailable.</error>');
  }
};
