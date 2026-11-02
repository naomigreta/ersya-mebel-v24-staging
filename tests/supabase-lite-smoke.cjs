const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Response, URL, AbortController } = global;

const requests = [];
const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
const mockFetch = async (input, options = {}) => {
  const url = String(input);
  requests.push({ url, options });
  const method = String(options.method || 'GET').toUpperCase();
  if (method === 'GET') {
    const parsed = new URL(url);
    const rows = parsed.pathname.endsWith('/site_settings')
      ? [{ key: 'main', id: 1, brand: 'ERSYA MEBEL' }, { key: 'other', id: 2, brand: 'Other' }]
      : [];
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    return new Response(JSON.stringify([body]), { status: 201, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'DELETE') {
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected test HTTP method ${method}`);
};

const window = {
  ERSYA_SUPABASE: {
    url: 'https://project-example.supabase.co',
    anonKey: 'sb_publishable_test_key'
  }
};
const context = {
  window,
  localStorage,
  fetch: mockFetch,
  Response,
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  console,
  JSON,
  String,
  Number,
  Array,
  Object,
  Promise,
  Error,
  atob: global.atob
};
vm.runInNewContext(fs.readFileSync('public/supabase-lite.js', 'utf8'), context, { filename: 'public/supabase-lite.js' });

(async () => {
  const client = window.supabase.createClient();

  const limited = await client.from('site_settings').select('*').limit(1).maybeSingle();
  assert.equal(limited.error, null, 'limit(1).maybeSingle() must not throw');
  assert.equal(limited.data.key, 'main', 'maybeSingle should return the first result');
  assert.equal(new URL(requests[0].url).searchParams.get('limit'), '1', 'limit should be sent to PostgREST');

  const upsert = await client.from('site_settings').upsert({ key: 'main', id: 1, brand: 'ERSYA MEBEL' }, { onConflict: 'key' });
  assert.equal(upsert.error, null);
  assert.equal(new URL(requests[1].url).searchParams.get('on_conflict'), 'key', 'upsert must use the real primary key');
  assert.match(requests[1].options.headers.Prefer, /resolution=merge-duplicates/);
  assert.equal(JSON.parse(requests[1].options.body).key, 'main');

  const deleted = await client.from('seo_keywords').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  assert.equal(deleted.error, null, 'delete().neq() should remain supported');
  assert.match(requests[2].url, /id=neq\.00000000-0000-0000-0000-000000000000/);
  assert.equal(String(requests[2].options.method).toUpperCase(), 'DELETE');

  console.log('Supabase-lite regression tests passed: limit/single query, primary-key upsert, and filtered delete.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
