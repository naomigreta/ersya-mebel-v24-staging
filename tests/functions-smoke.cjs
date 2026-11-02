const assert = require('node:assert/strict');
const productModule = require('../netlify/functions/product-page.js');
const sitemapModule = require('../netlify/functions/sitemap.js');
const originalFetch = global.fetch;
const apiRequests = [];
const priorDeployContext = process.env.ERSYA_DEPLOY_CONTEXT;
const product = {
  id: 'p_test_1',
  name: 'Kursi Cafe Besi',
  category: 'Kursi Cafe',
  material: 'Besi & Kayu',
  description: 'Kursi cafe besi dan kayu ERSYA MEBEL.',
  slug: 'kursi-cafe-besi',
  seo_title: 'Kursi Cafe Besi | ERSYA MEBEL',
  seo_description: 'Kursi cafe besi dan kayu untuk ruang usaha.',
  seo_keywords: ['kursi cafe besi', 'mebel jepara', 'ersya mebel'],
  image_path: 'https://res.cloudinary.com/ngj31ef6/image/upload/example.jpg',
  published: true,
  updated_at: '2026-10-27T10:00:00Z'
};

global.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  apiRequests.push({ url: url.href, headers: init.headers || {} });
  if (url.pathname.endsWith('/site_settings')) {
    return new Response(JSON.stringify([{ allow_index: true }]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.pathname.endsWith('/products')) {
    if (url.searchParams.get('slug') === 'eq.kursi-cafe-besi') {
      return new Response(JSON.stringify([product]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.searchParams.get('select') === 'slug,updated_at') {
      return new Response(JSON.stringify([{ slug: 'kursi-cafe-besi', updated_at: product.updated_at }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`Unexpected endpoint ${url.href}`);
};

(async () => {
  process.env.ERSYA_DEPLOY_CONTEXT = 'production';
  const page = await productModule.handler({ queryStringParameters: { slug: 'kursi-cafe-besi' } });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /<title>Kursi Cafe Besi \| ERSYA MEBEL<\/title>/);
  assert.match(page.body, /<meta name="robots" content="index,follow">/, 'production product pages can be indexable when site settings allow it');
  assert.match(page.body, /https:\/\/ersyafurniture\.netlify\.app\/produk\/kursi-cafe-besi\//);
  assert.match(page.body, /<script type="application\/ld\+json">[\s\S]*"@type":"Product"/);
  assert.match(page.body, /res\.cloudinary\.com\/ngj31ef6/);
  assert.match(page.body, /<meta name="keywords" content="kursi cafe besi, mebel jepara, ersya mebel">/);
  assert.match(page.body, /"keywords":\["kursi cafe besi","mebel jepara","ersya mebel"\]/);
  const goodImage = product.image_path;
  product.image_path = 'data:image/jpeg;base64,/9j/TEST-PAYLOAD';
  const unsafeImagePage = await productModule.handler({ queryStringParameters: { slug: 'kursi-cafe-besi' } });
  assert.doesNotMatch(unsafeImagePage.body, /data:image\/jpeg;base64/, 'server-rendered SEO page must not expose Base64 data URLs');
  assert.match(unsafeImagePage.body, /ersyafurniture\.netlify\.app\/ersya-logo\.jpg/, 'invalid data:image path must fall back to site logo');
  product.image_path = goodImage;

  const missing = await productModule.handler({ queryStringParameters: { slug: 'produk-tidak-ada' } });
  assert.equal(missing.statusCode, 404);
  assert.match(missing.body, /noindex,nofollow/);

  const sitemap = await sitemapModule.handler({});
  assert.equal(sitemap.statusCode, 200);
  assert.equal(sitemap.headers['X-Robots-Tag'], 'index, follow');
  assert.match(sitemap.body, /<loc>https:\/\/ersyafurniture\.netlify\.app\/produk\/kursi-cafe-besi\/<\/loc>/);
  assert.match(sitemap.body, /<lastmod>2026-10-27T10:00:00\.000Z<\/lastmod>/);

  process.env.ERSYA_DEPLOY_CONTEXT = 'deploy-preview';
  const previewPage = await productModule.handler({ queryStringParameters: { slug: 'kursi-cafe-besi' } });
  assert.equal(previewPage.statusCode, 200);
  assert.match(previewPage.body, /<meta name="robots" content="noindex,nofollow">/, 'deploy preview product pages must be noindex');
  const previewSitemap = await sitemapModule.handler({});
  assert.equal(previewSitemap.headers['X-Robots-Tag'], 'noindex, nofollow', 'deploy preview sitemap must not be indexed');

  assert.ok(apiRequests.length >= 6, 'product and sitemap functions should call Supabase REST');
  for (const request of apiRequests) {
    assert.ok(request.headers.apikey, 'Supabase requests must include the publishable key in apikey');
    assert.ok(!Object.keys(request.headers).some(name => name.toLowerCase() === 'authorization'), 'publishable API keys must not be sent as Bearer user JWTs');
  }

  console.log('Function smoke tests passed: product page metadata/JSON-LD/image, 404 + noindex, dynamic sitemap/lastmod, build-stamped Netlify production/preview context indexing, and publishable-key header handling.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  global.fetch = originalFetch;
  if (priorDeployContext === undefined) delete process.env.ERSYA_DEPLOY_CONTEXT; else process.env.ERSYA_DEPLOY_CONTEXT = priorDeployContext;
});
