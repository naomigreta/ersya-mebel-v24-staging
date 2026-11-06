const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('public/admin.html', 'utf8');
assert.match(html, /const idArg=esc\(JSON\.stringify\(String\(p\.id\)\)\);const obj=esc\(JSON\.stringify\(stripTransientImagePayload\(p\)\)\)/, 'product IDs and objects inserted into inline HTML attributes must be escaped');
assert.doesNotMatch(html, /const obj=JSON\.stringify\(p\)\.replace\(/, 'legacy ineffective JSON escaping must not return');
assert.doesNotMatch(html, /onclick="(?:editProduct|duplicateProduct|togglePublish|removeProduct)\('\$\{p\.id\}'\)"/, 'raw product IDs must not be interpolated into inline JavaScript strings');
assert.match(html, /\["dashboard","products","add","autopilot","settings","seo","users","tools","go-live"\]/, 'Admin form panel must be eligible for restoration after Android gallery switching');
assert.match(html, /function saveAdminProductFormDraft\(\)/, 'Product form draft must be saved locally while entering data');
assert.match(html, /function restoreAdminProductFormDraft\(\)/, 'Product form draft must be restored after a PWA reload');
assert.match(html, /addEventListener\("pagehide",saveAdminProductFormDraft\)/, 'Product form draft must be saved when the PWA page is hidden or unloaded');

const start = html.indexOf('function esc(s){');
const end = html.indexOf('\n', start);
assert.notEqual(start, -1, 'HTML escaping helper must exist');
assert.notEqual(end, -1, 'escaping helper boundary must exist');
const esc = vm.runInNewContext(`${html.slice(start, end)}; esc`);
const hostile = { id: 'p1', name: `Dining chair' onclick='alert(1)`, desc: `</script><img src=x onerror=alert(1)> & more` };
const encoded = esc(JSON.stringify(hostile));
assert.ok(!encoded.includes("'"), 'attribute apostrophes must be encoded');
assert.ok(!encoded.includes('<'), 'less-than characters must be encoded');
assert.ok(!encoded.includes('>'), 'greater-than characters must be encoded');
assert.ok(!encoded.replace(/&(?:amp|lt|gt|#39|quot);/g, '').includes('&'), 'ampersands must appear only as valid HTML entities');
assert.match(encoded, /&quot;/, 'JSON quotes should be safely encoded for HTML attributes');

console.log('Admin rendering security smoke test passed: JSON values are escaped for HTML attribute context.');
