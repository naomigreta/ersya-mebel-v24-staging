'use strict';

const SUPABASE_URL = String(process.env.ERSYA_SUPABASE_URL || 'https://waartnvrptyzqfufpmcs.supabase.co').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.ERSYA_SUPABASE_ANON_KEY || 'sb_publishable_xTIrqu3MrPg9w_4La7CMbA_xxk7oOYA';
const GEMINI_MODEL = process.env.ERSYA_GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_API_KEY = process.env.ERSYA_GEMINI_API_KEY || '';
const CLOUDINARY_CLOUD_NAME = process.env.ERSYA_CLOUDINARY_CLOUD_NAME || 'ngj31ef6';
const ALLOWED_CATEGORIES = ['Kursi Cafe', 'Meja Cafe', 'Kursi Teras', 'Kursi Bar', 'Set Cafe', 'Custom'];
const ALLOWED_MATERIALS = ['Besi & Kayu', 'Besi', 'Kayu', 'Custom', 'Belum dipastikan'];

function reply(statusCode, data, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (origin && /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.netlify\.app$/i.test(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return { statusCode, headers, body: JSON.stringify(data) };
}
function plain(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function parseModelJson(value) {
  const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('AI mengembalikan format yang tidak terbaca. Coba analisis sekali lagi.');
  return JSON.parse(raw.slice(first, last + 1));
}
function normalizeResult(value, city) {
  const name = plain(value.name, 100);
  if (!name) throw new Error('AI belum berhasil memberi nama produk yang jelas.');
  const categoryValue = plain(value.category, 40);
  const materialValue = plain(value.material, 40);
  const category = ALLOWED_CATEGORIES.includes(categoryValue) ? categoryValue : 'Custom';
  const material = ALLOWED_MATERIALS.includes(materialValue) ? materialValue : 'Belum dipastikan';
  let description = plain(value.description, 600);
  if (!description) description = `${name} dari ERSYA MEBEL. Hubungi kami untuk konsultasi model dan pesanan.`;
  let seoTitle = plain(value.seo_title, 100);
  const brandSuffix = ' | ERSYA MEBEL';
  if (!seoTitle) seoTitle = name;
  seoTitle = /\|\s*ERSYA MEBEL$/i.test(seoTitle)
    ? `${seoTitle.replace(/\s*\|\s*ERSYA MEBEL$/i, '').trim().slice(0, 60 - brandSuffix.length)}${brandSuffix}`
    : `${seoTitle.slice(0, 60 - brandSuffix.length).trim()}${brandSuffix}`;
  seoTitle = seoTitle.slice(0, 60);
  let seoDescription = plain(value.seo_description, 160);
  if (!seoDescription) seoDescription = plain(`${name} dari ERSYA MEBEL${city ? `, ${city}` : ''}. Konsultasi model dan pesanan melalui WhatsApp.`, 160);
  const keywords = Array.isArray(value.seo_keywords) ? value.seo_keywords : [];
  const seen = new Set();
  const seoKeywords = keywords.map(item => plain(item, 55)).filter(item => {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
  if (!seoKeywords.length) {
    for (const candidate of [name, category, material, `${category} ${city}`, `furniture ${city}`, 'ERSYA MEBEL']) {
      const keyword = plain(candidate, 55), key = keyword.toLowerCase();
      if (keyword && !seen.has(key)) { seen.add(key); seoKeywords.push(keyword); }
      if (seoKeywords.length >= 8) break;
    }
  }
  const imageAlt = plain(value.image_alt, 180) || `${name} — ERSYA MEBEL`;
  const visualSummary = plain(value.visual_summary, 240);
  return { name, category, material, description, seo_title: seoTitle, seo_description: seoDescription, seo_keywords: seoKeywords, image_alt: imageAlt, visual_summary: visualSummary };
}
async function requireAdmin(token) {
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  if (!auth.ok) throw Object.assign(new Error('Sesi login tidak valid. Silakan masuk kembali sebagai Admin.'), { statusCode: 401 });
  const user = await auth.json();
  if (!user || !user.id) throw Object.assign(new Error('Akun login tidak ditemukan.'), { statusCode: 401 });
  const profileUrl = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  profileUrl.searchParams.set('id', `eq.${user.id}`);
  profileUrl.searchParams.set('select', 'role');
  profileUrl.searchParams.set('limit', '1');
  const profile = await fetch(profileUrl, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  if (!profile.ok) throw Object.assign(new Error('Hak akses Admin tidak dapat diverifikasi.'), { statusCode: 403 });
  const rows = await profile.json();
  if (!Array.isArray(rows) || String(rows[0]?.role || '').toLowerCase() !== 'admin') {
    throw Object.assign(new Error('Fitur analisis foto hanya tersedia untuk Admin.'), { statusCode: 403 });
  }
}
function validateCloudinaryUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch (_) { throw Object.assign(new Error('Alamat foto tidak valid.'), { statusCode: 400 }); }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${CLOUDINARY_CLOUD_NAME}/image/upload/`)) {
    throw Object.assign(new Error('Foto harus berasal dari penyimpanan Cloudinary ERSYA.'), { statusCode: 400 });
  }
  return url;
}
const MAX_ANALYSIS_IMAGE_BYTES = 5 * 1024 * 1024;
async function readBoundedImageBody(response, maxBytes) {
  // Enforce the limit while streaming: a missing/incorrect Content-Length must
  // not allow an authenticated request to buffer an unbounded remote response.
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        const chunk = Buffer.from(item.value);
        total += chunk.length;
        if (total > maxBytes) {
          try { await reader.cancel(); } catch (_) {}
          throw Object.assign(new Error('Ukuran foto melebihi batas analisis 5 MB.'), { statusCode: 413 });
        }
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock(); } catch (_) {}
    }
    return Buffer.concat(chunks, total);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw Object.assign(new Error('Ukuran foto melebihi batas analisis 5 MB.'), { statusCode: 413 });
  return bytes;
}
async function fetchImageAsInlineData(imageUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(imageUrl, {
      redirect: 'error',
      signal: controller.signal,
      headers: { Accept: 'image/jpeg,image/png,image/webp' }
    });
    if (!response.ok) throw Object.assign(new Error(`Foto Cloudinary tidak dapat dibaca (HTTP ${response.status}).`), { statusCode: 400 });
    const mimeType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw Object.assign(new Error('Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.'), { statusCode: 415 });
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_ANALYSIS_IMAGE_BYTES) throw Object.assign(new Error('Foto terlalu besar untuk dianalisis. Pilih foto yang lebih kecil.'), { statusCode: 413 });
    const bytes = await readBoundedImageBody(response, MAX_ANALYSIS_IMAGE_BYTES);
    if (!bytes.length) throw Object.assign(new Error('Foto Cloudinary kosong atau tidak dapat dibaca.'), { statusCode: 400 });
    return { mimeType, data: bytes.toString('base64') };
  } catch (error) {
    if (error && error.statusCode) throw error;
    if (error && error.name === 'AbortError') throw Object.assign(new Error('Mengambil foto Cloudinary melewati batas waktu. Coba lagi.'), { statusCode: 504 });
    throw Object.assign(new Error('Foto Cloudinary tidak dapat diambil. Periksa URL dan koneksi penyimpanan.'), { statusCode: 502 });
  } finally {
    clearTimeout(timer);
  }
}
async function callGemini(image, context) {
  if (!GEMINI_API_KEY) throw Object.assign(new Error('Kunci Gemini belum dipasang di Netlify. Tambahkan environment variable ERSYA_GEMINI_API_KEY, lalu deploy ulang.'), { statusCode: 503 });
  const city = plain(context.city || 'Jepara', 60);
  const categoryHint = plain(context.category || 'Custom', 40);
  const materialHint = plain(context.material || 'Belum dipastikan', 40);
  const extra = plain(context.extraDescription || '', 400);
  const prompt = `Kamu adalah ahli katalog furniture dan SEO e-commerce Indonesia untuk ERSYA MEBEL. Lihat foto produk yang dilampirkan dengan teliti. Jangan gunakan nama file sebagai petunjuk karena nama file tidak diberikan. Buat satu objek JSON valid saja dengan field: name, category, material, description, seo_title, seo_description, seo_keywords (array string), image_alt, visual_summary.\n\nAturan penting:\n- Kenali bentuk dan fungsi utama produk dari gambar. Buat nama produk spesifik dan wajar, bukan nama generik.\n- category wajib salah satu: ${ALLOWED_CATEGORIES.join(', ')}.\n- material wajib salah satu: ${ALLOWED_MATERIALS.join(', ')}. Jangan menebak jenis kayu/logam atau bahan yang tidak jelas. Jika ragu gunakan "Belum dipastikan".\n- Konteks kategori batch: ${categoryHint}. Konteks material batch: ${materialHint}. Ini petunjuk dari pemilik, bukan bukti visual mutlak.\n- Catatan pemilik: ${extra || '(tidak ada)'}. Jangan menambahkan fakta yang tidak didukung foto/catatan. Jangan mengarang ukuran, harga, stok, garansi, ketahanan, jenis kayu, atau fitur teknis.\n- Buat deskripsi bahasa Indonesia 2–3 kalimat yang faktual dan membantu calon pembeli.\n- seo_title maksimal 60 karakter dan sebut ERSYA MEBEL. seo_description maksimal 160 karakter, alami, tidak menumpuk kata kunci.\n- seo_keywords berisi 5–8 frasa pencarian relevan, tanpa duplikasi atau keyword stuffing; boleh memuat lokasi ${city} bila alami.\n- image_alt mendeskripsikan apa yang benar-benar tampak di foto, singkat dan aksesibel.\n- visual_summary satu kalimat ringkas tentang yang terlihat.\nKembalikan hanya JSON tanpa markdown.`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }],
        generationConfig: { maxOutputTokens: 1200, responseMimeType: 'application/json' }
      })
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw Object.assign(new Error('Analisis AI melewati batas waktu. Coba lagi dengan koneksi lebih stabil.'), { statusCode: 504 });
    throw Object.assign(new Error('Layanan AI tidak dapat dihubungi. Periksa koneksi Netlify.'), { statusCode: 502 });
  } finally { clearTimeout(timer); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = plain(payload?.error?.message || '', 220);
    const status = response.status === 429 ? 429 : 502;
    throw Object.assign(new Error(status === 429 ? 'Batas penggunaan Gemini sedang tercapai. Tunggu sebentar lalu coba lagi.' : `Gemini menolak analisis foto${providerMessage ? `: ${providerMessage}` : ` (HTTP ${response.status})`}.`), { statusCode: status });
  }
  const text = (payload?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('\n');
  if (!text) throw Object.assign(new Error('Gemini tidak mengembalikan hasil teks. Coba foto lain.'), { statusCode: 502 });
  return parseModelJson(text);
}
exports.handler = async function (event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  if (event.httpMethod === 'OPTIONS') return reply(204, {}, origin);
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return reply(405, { ok: false, error: 'Gunakan metode GET atau POST.' }, origin);
  try {
    const authorization = event.headers?.authorization || event.headers?.Authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) throw Object.assign(new Error('Sesi Admin tidak ditemukan. Silakan masuk kembali.'), { statusCode: 401 });
    await requireAdmin(match[1]);
    if (event.httpMethod === 'GET') {
      if (!GEMINI_API_KEY) throw Object.assign(new Error('Kunci Gemini belum dipasang di Netlify. Tambahkan environment variable ERSYA_GEMINI_API_KEY, lalu deploy ulang.'), { statusCode: 503 });
      return reply(200, { ok: true, configured: true, model: GEMINI_MODEL }, origin);
    }
    if (!GEMINI_API_KEY) throw Object.assign(new Error('Kunci Gemini belum dipasang di Netlify. Tambahkan environment variable ERSYA_GEMINI_API_KEY, lalu deploy ulang.'), { statusCode: 503 });
    let body;
    try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}')); }
    catch (_) { throw Object.assign(new Error('Data permintaan tidak valid.'), { statusCode: 400 }); }
    validateCloudinaryUrl(body.imageUrl);
    const image = await fetchImageAsInlineData(body.imageUrl);
    const city = plain(body.city || 'Jepara', 60);
    const result = normalizeResult(await callGemini(image, body), city);
    return reply(200, { ok: true, data: result }, origin);
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    if (status >= 500) console.error('ERSYA image analysis error:', error?.message || error);
    return reply(status, { ok: false, error: plain(error?.message || 'Analisis foto gagal.', 320) }, origin);
  }
};
