const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('public/admin.html', 'utf8');
const oneLineFunction = name => {
  const line = html.split(/\r?\n/).find(value => value.startsWith(`function ${name}(`));
  assert.ok(line, `function ${name} must exist`);
  return line;
};

const helpers = [
  oneLineFunction('isDataImagePayload'),
  oneLineFunction('inlineImageValue'),
  oneLineFunction('hasInlineImagePayload'),
  oneLineFunction('stripTransientImagePayload'),
  oneLineFunction('persistableProducts'),
  '({isDataImagePayload,inlineImageValue,hasInlineImagePayload,stripTransientImagePayload,persistableProducts})'
].join('\n');
const api = vm.runInNewContext(helpers, {});
const legacyDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
const record = {
  id: 'p_legacy',
  name: 'Kursi Legacy',
  imageData: legacyDataUrl,
  img: legacyDataUrl,
  image_path: legacyDataUrl,
  metadata: { nested: { preview: legacyDataUrl } },
  imageBlob: { size: 1234 },
  previewUrl: 'blob:https://example.invalid/abc',
  localPhotoPending: true,
  seoTitle: 'Kursi Legacy | ERSYA MEBEL'
};
assert.equal(api.hasInlineImagePayload(record), true, 'legacy payload detector must catch data-image URLs');
const safe = api.stripTransientImagePayload(record);
assert.equal('imageData' in safe, false, 'localStorage-safe record must not contain imageData');
assert.equal('imageBlob' in safe, false, 'Blob is transient and must not be JSON-persisted');
assert.equal('previewUrl' in safe, false, 'object URLs are transient and must not be JSON-persisted');
assert.equal('localPhotoPending' in safe, false, 'local migration state must not leak into localStorage');
assert.equal('img' in safe, false, 'data:image stored in img must be removed');
assert.equal('image_path' in safe, false, 'data:image stored in image_path must be removed');
assert.equal('metadata' in safe, true, 'non-image metadata should remain');
assert.deepEqual(JSON.parse(JSON.stringify(safe.metadata)), { nested: {} }, 'nested data:image values must be stripped recursively');
assert.equal(api.hasInlineImagePayload(safe), false, 'nested data:image payloads must also be removed');
assert.equal(safe.name, 'Kursi Legacy');
assert.equal(safe.seoTitle, 'Kursi Legacy | ERSYA MEBEL');
const arraySafe = api.persistableProducts([record]);
assert.equal(arraySafe.length, 1);
assert.equal(api.hasInlineImagePayload(arraySafe[0]), false, 'persistable catalogue must never retain a top-level data:image field');

assert.doesNotMatch(html, /\.toDataURL\s*\(/, 'new photo processing must not produce Base64 data URLs with canvas.toDataURL');
assert.match(html, /canvas\.toBlob\s*\(/, 'photo compression must produce a Blob');
assert.match(html, /createObjectStore\("photos",\{keyPath:"id"\}\)/, 'legacy data URLs must migrate to Blob storage in IndexedDB');
assert.match(html, /localStorage\.setItem\(KEY,JSON\.stringify\(persistableProducts\(products\)\)\)/, 'catalog localStorage writes must use the sanitized serializer');
assert.match(html, /const obj=esc\(JSON\.stringify\(stripTransientImagePayload\(p\)\)\)/, 'admin-rendered button arguments must never duplicate a Base64 payload into the DOM');
assert.match(html, /if\(!photoStoragePrepared&&\(products\|\|\[\]\)\.some\(hasInlineImagePayload\)\)throw new Error\('Sinkronisasi ditahan/, 'bulk sync must be blocked when legacy photo migration has failed');
assert.match(html, /localStorage\.setItem\('ersya_products_v4',JSON\.stringify\(persistableProducts\(products\)\)\)/, 'Supabase bridge localStorage writes must use the sanitized serializer');
assert.match(html, /async function apCompressedBlob\(file\)/, 'Auto Pilot must use a Blob-based photo path');
assert.doesNotMatch(html, /apCompressedDataUrl/, 'Auto Pilot must not build a Base64 data URL for each photo');
assert.match(html, /p\?\.imageBlob instanceof Blob/, 'Cloudinary upload must accept Blob-backed images');
assert.match(html, /some\(p=>p\?\.imageBlob\|\|hasInlineImagePayload\(p\)\)/, 'backup must be blocked while a photo is pending upload');
assert.match(html, /cleaned\.some\(p=>hasInlineImagePayload\(p\)\)/, 'backup import must reject Base64 photo payloads');
assert.match(html, /await putPhotoBlob\(product\.id,blob\)/, 'legacy Base64 photos must be written as Blob before localStorage is sanitized');
const saveProductBody = html.slice(html.indexOf('async function saveProduct()'), html.indexOf('function exportData()'));
assert.ok(saveProductBody.indexOf('await putPhotoBlob(p.id,p.imageBlob)') < saveProductBody.indexOf('await window.ersyaSyncProductById(p.id)'), 'new/edit product photos must be durably staged in IndexedDB before online upload');
assert.match(saveProductBody, /if\(photoStaged&&productCheckpointSaved\)[\s\S]*?p\.syncState="pending";save\(\);render\(\);/, 'failed online photo saves must retain the staged product for recovery instead of deleting its only local record');
assert.ok(html.indexOf('await putPhotoBlob(p.id,imageBlob)') < html.indexOf('await window.ersyaSyncProductById(p.id)', html.indexOf('async function enqueueAutoPilotPhotos()')), 'Auto Pilot photos must be persisted to IndexedDB before upload');
assert.match(html, /async function deletePhotoBlob\(id\)\{let db=null;[\s\S]*?finally\{try\{db\?\.close\(\)/, 'IndexedDB cleanup must close connections after successful and failed deletions');
assert.match(html, /clearInlineImagePayloads\(product\)/, 'all nested legacy data:image values must be cleared after durable Blob migration');
assert.match(html, /if\(!product\.imageBlob&&stored\.blob\)\{product\.imageBlob=stored\.blob/, 'pending image Blobs must be restored from IndexedDB on a later session');
assert.ok(html.includes(String.raw`function src(p){const image=String(p?.img||"").trim(),preview=String(p?.previewUrl||"").trim();return (/^blob:/i.test(preview)?preview:"")||ASSET[image]||(/^https?:\/\//i.test(image)?image:"")}`), "admin render must only use Blob object URLs or validated image URLs");
assert.match(html, /const local=localBefore\.find\(p=>p&&String\(p\.id\)===String\(remoteProduct\.id\)&&hasPendingPhoto\(p\)\)/, 'pending local Blob must survive a database refresh even when the product ID already exists remotely');

console.log('Base64 storage regression tests passed: sanitized catalog persistence, Blob compression, IndexedDB legacy migration, Auto Pilot Blob path, and backup/import guards.');
const homepage = fs.readFileSync("public/index.html", "utf8");
assert.ok(homepage.includes(String.raw`function imgSrc(p){const img=String(p?.img||"").trim();if(/^https?:\/\//i.test(img))return img;`), "public catalog must normalize and reject invalid image sources");
assert.ok(homepage.includes(String.raw`img:/^https?:\/\//i.test(String(p.image_path||'').trim())?String(p.image_path).trim():''`), "public sync must persist only HTTP(S) image URLs");
assert.ok(homepage.includes('if(!localCache.some(hasDataImagePayloadDeep))'), 'public hydration must not overwrite legacy Base64 cache before Admin migrates it to IndexedDB');
assert.ok(homepage.includes("const pendingById=new Map(localCache.filter(p=>p&&p.syncState==='pending')"), 'public hydration must preserve pending local product records while refreshing the remote catalog');
assert.ok(homepage.includes('const cleanPending=p=>{const out={...p};delete out.imageData;delete out.imageBlob;delete out.previewUrl;delete out.localPhotoPending;return out}'), 'public cache must not persist transient Blob/object URL fields from pending records');
const productFunction = fs.readFileSync("netlify/functions/product-page.js", "utf8");
assert.ok(productFunction.includes('data:image') && productFunction.includes('blob:') && productFunction.includes('SITE_ORIGIN}/ersya-logo.jpg'), 'SEO product pages must fall back to logo for data:image/blob sources');
