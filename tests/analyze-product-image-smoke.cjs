const assert = require('node:assert/strict');
process.env.ERSYA_GEMINI_API_KEY = 'test-gemini-key';
process.env.ERSYA_GEMINI_MODEL = 'gemini-test';
const moduleUnderTest = require('../netlify/functions/analyze-product-image.js');
const originalFetch = global.fetch;
const requests = [];

global.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  requests.push({ url, init });
  if (url.pathname === '/auth/v1/user') {
    if ((init.headers || {}).Authorization !== 'Bearer admin-token') return new Response('{}', { status: 401 });
    return new Response(JSON.stringify({ id: 'user-admin' }), { status: 200 });
  }
  if (url.pathname === '/rest/v1/profiles') {
    const role = process.env.TEST_PROFILE_ROLE || 'admin';
    return new Response(JSON.stringify([{ role }]), { status: 200 });
  }
  if (url.hostname === 'res.cloudinary.com') {
    if (process.env.TEST_OVERSIZE_IMAGE === '1') {
      // Deliberately omit Content-Length to verify the streaming cap.
      return new Response(new Uint8Array(5 * 1024 * 1024 + 1), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    }
    return new Response(Buffer.from('small-test-image'), { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '16' } });
  }
  if (url.hostname === 'generativelanguage.googleapis.com') {
    assert.equal(init.headers['x-goog-api-key'], 'test-gemini-key');
    const body = JSON.parse(init.body);
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
    assert.equal(url.pathname, '/v1beta/models/gemini-test:generateContent');
    assert.ok(!Object.hasOwn(body.generationConfig || {}, 'temperature'), 'deprecated sampling temperature is not sent');
    assert.ok(body.contents[0].parts[1].inlineData.data, 'image bytes are passed to Gemini');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      name: 'Kursi Cafe Rangka Besi dan Dudukan Kayu',
      category: 'Kursi Cafe',
      material: 'Besi & Kayu',
      description: 'Kursi cafe dengan rangka dan dudukan yang tampak pada foto. Hubungi ERSYA MEBEL untuk konsultasi pesanan.',
      seo_title: 'Kursi Cafe Besi Kayu | ERSYA MEBEL',
      seo_description: 'Kursi cafe besi dan kayu dari ERSYA MEBEL. Konsultasikan model dan pesanan melalui WhatsApp.',
      seo_keywords: ['kursi cafe besi kayu', 'kursi cafe Jepara'],
      image_alt: 'Kursi cafe dengan rangka besi dan dudukan kayu',
      visual_summary: 'Kursi cafe dengan rangka ramping dan dudukan kayu.'
    }) }] } }] }), { status: 200 });
  }
  throw new Error(`Unexpected request ${url.href}`);
};

(async () => {
  const event = {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer admin-token', origin: 'https://ersya-mebel-staging.netlify.app' },
    body: JSON.stringify({ imageUrl: 'https://res.cloudinary.com/ngj31ef6/image/upload/test.jpg', category: 'Kursi Cafe', material: 'Besi & Kayu', city: 'Jepara' })
  };
  const result = await moduleUnderTest.handler(event);
  assert.equal(result.statusCode, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.ok, true);
  assert.equal(body.data.name, 'Kursi Cafe Rangka Besi dan Dudukan Kayu');
  assert.ok(body.data.seo_title.length <= 60);
  assert.ok(body.data.seo_description.length <= 160);
  assert.equal(body.data.image_alt, 'Kursi cafe dengan rangka besi dan dudukan kayu');
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'https://ersya-mebel-staging.netlify.app');
  assert.ok(requests.some(r => r.url.hostname === 'generativelanguage.googleapis.com'));

  const ready = await moduleUnderTest.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer admin-token' } });
  assert.equal(ready.statusCode, 200, 'authenticated Admin can check whether AI is configured before uploading images');
  assert.equal(JSON.parse(ready.body).configured, true);

  const badUrl = await moduleUnderTest.handler({ ...event, body: JSON.stringify({ imageUrl: 'https://example.com/not-an-image.jpg' }) });
  assert.equal(badUrl.statusCode, 400, 'only approved Cloudinary image URLs can be analyzed');

  process.env.TEST_OVERSIZE_IMAGE = '1';
  const oversized = await moduleUnderTest.handler(event);
  assert.equal(oversized.statusCode, 413, 'image responses over 5 MB are rejected even when Content-Length is absent');
  delete process.env.TEST_OVERSIZE_IMAGE;

  process.env.TEST_PROFILE_ROLE = 'cashier';
  const denied = await moduleUnderTest.handler(event);
  assert.equal(denied.statusCode, 403, 'cashier role must not call image analysis');
  delete process.env.TEST_PROFILE_ROLE;

  console.log('AI image analysis smoke tests passed: admin JWT/profile check, Cloudinary URL allowlist, Gemini image input, bounded SEO fields, and cashier denial.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
