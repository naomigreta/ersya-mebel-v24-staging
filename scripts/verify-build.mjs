import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const root = process.cwd();
const required = [
  'public/index.html',
  'public/admin.html',
  'public/ersya-supabase-config.js',
  'public/supabase-lite.js',
  'tests/supabase-lite-smoke.cjs',
  'tests/base64-storage-regression-smoke.cjs',
  'public/robots.txt',
  'netlify.toml',
  'netlify/functions/product-page.js',
  'netlify/functions/sitemap.js',
  'SQL-ERSYA-MEBEL-AUTOPILOT-MASSAL.txt'
];
const failures = [];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`File wajib tidak ada: ${rel}`);
}

function verifyHtml(rel) {
  if (!fs.existsSync(path.join(root, rel))) return;
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const markupOnly = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
  const ids = [...markupOnly.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) failures.push(`${rel}: ID statis duplikat: ${id}`);
    seen.add(id);
  }
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  for (let i = 0; i < scripts.length; i++) {
    const attrs = scripts[i][1] || '';
    const content = scripts[i][2] || '';
    if (/\bsrc\s*=/.test(attrs) || !content.trim()) continue;
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) {
      try { JSON.parse(content); }
      catch (e) { failures.push(`${rel}: JSON-LD #${i + 1} tidak valid: ${e.message}`); }
      continue;
    }
    try { new vm.Script(content, { filename: `${rel}:inline-${i + 1}` }); }
    catch (e) { failures.push(`${rel}: JavaScript inline #${i + 1} tidak valid: ${e.message}`); }
  }
  const assetMatches = [...html.matchAll(/(?:src|href)=["'](assets\/[^"']+)["']/g)];
  for (const m of assetMatches) {
    if (!fs.existsSync(path.join(root, 'public', m[1]))) failures.push(`${rel}: aset tidak ditemukan: ${m[1]}`);
  }
}

verifyHtml('public/index.html');
verifyHtml('public/admin.html');
const productFunction = fs.readFileSync(path.join(root, 'netlify/functions/product-page.js'), 'utf8');
if (!productFunction.includes('seo_keywords') || !productFunction.includes('name=\"keywords\"')) {
  failures.push('Halaman SEO produk belum membaca/merender kata kunci produk.');
}
for (const rel of ['netlify/functions/product-page.js', 'netlify/functions/sitemap.js']) {
  const r = spawnSync(process.execPath, ['--check', rel], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) failures.push(`${rel}: syntax error\n${r.stderr || r.stdout}`);
}
const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
for (const requiredText of ['publish = "public"', 'directory = "netlify/functions"', 'from = "/sitemap.xml"', 'from = "/produk/:slug/"']) {
  if (!config.includes(requiredText)) failures.push(`netlify.toml: pengaturan wajib hilang: ${requiredText}`);
}
const adminHtml = fs.readFileSync(path.join(root, 'public/admin.html'), 'utf8');
for (const feature of ['panel-autopilot', 'apPhotos', 'enqueueAutoPilotPhotos', 'scheduled_at']) {
  if (!adminHtml.includes(feature)) failures.push(`Autopilot: fitur tidak ditemukan: ${feature}`);
}
const publicHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
if (!publicHtml.includes('/produk/')) failures.push('Homepage belum memiliki tautan produk individual.');
const liteClient = fs.readFileSync(path.join(root, 'public/supabase-lite.js'), 'utf8');
if (!/limit\(n\)/.test(liteClient)) failures.push('Klien Supabase ringan belum mendukung .limit(n), yang dibutuhkan halaman Admin.');
if (!/onConflict:'key'/.test(adminHtml) || !/key:'main'/.test(adminHtml) || !/eq\('key','main'\)/.test(adminHtml)) failures.push('Penyimpanan dan pembacaan site_settings harus memakai kunci utama key=main.');


if (!/const obj=esc\(JSON\.stringify\(stripTransientImagePayload\(p\)\)\)/.test(adminHtml)) failures.push('Render Admin harus menghapus payload gambar sementara sebelum escaping JSON untuk atribut HTML.');
if (/\.toDataURL\s*\(/.test(adminHtml)) failures.push('Regresi Base64: admin tidak boleh membangun data URL via canvas.toDataURL.');
if (!adminHtml.includes('persistableProducts(products)') || !adminHtml.includes('canvas.toBlob(') || !adminHtml.includes('ersya-photo-blobs-v1')) failures.push('Proteksi penyimpanan foto harus memakai sanitizer, Blob, dan migrasi IndexedDB.');
if (adminHtml.includes('const obj=JSON.stringify(p).replace(/</g,"\\u003c")')) failures.push('Render Admin masih memakai pola escaping JSON yang tidak aman untuk atribut HTML.');
if (!productFunction.includes("require('../deploy-context.js')") || !productFunction.includes("process.env.ERSYA_DEPLOY_CONTEXT || BUILD_DEPLOY_CONTEXT")) failures.push('Halaman produk harus memakai konteks yang disematkan pada build dan mendukung override runtime.');
const sitemapFunction = fs.readFileSync(path.join(root, 'netlify/functions/sitemap.js'), 'utf8');
if (!sitemapFunction.includes("require('../deploy-context.js')") || !sitemapFunction.includes("process.env.ERSYA_DEPLOY_CONTEXT || BUILD_DEPLOY_CONTEXT") || !sitemapFunction.includes("'X-Robots-Tag':production?'index, follow':'noindex, nofollow'")) failures.push('Sitemap harus memakai konteks yang disematkan pada build dan menghalangi indexing pada preview.');
if (!fs.existsSync(path.join(root, 'scripts/inject-deploy-context.cjs')) || !fs.existsSync(path.join(root, 'netlify/deploy-context.js'))) failures.push('Build context injector dan nilai default fungsi serverless harus tersedia.');
const netlifyConfig = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
if (!netlifyConfig.includes('command = "npm run build"')) failures.push('Build Netlify harus menyematkan konteks deploy sebelum membundel fungsi.');

if (failures.length) {
  console.error('ERSYA MEBEL verification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('ERSYA MEBEL verification PASSED');
console.log('- File wajib tersedia');
console.log('- JavaScript inline dan Netlify Functions valid secara sintaks');
console.log('- JSON-LD statis valid');
console.log('- Tidak ada ID statis duplikat');
console.log('- Aset lokal utama ditemukan');
console.log('- Rute Netlify Functions dan Auto Pilot terdeteksi');
