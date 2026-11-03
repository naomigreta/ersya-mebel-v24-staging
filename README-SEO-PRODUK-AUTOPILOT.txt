ERSYA MEBEL V24 — SEO PRODUK INDIVIDUAL + AUTO PILOT MASSAL

Halaman produk individual menggunakan Netlify Functions, sehingga deployment harus menjalankan Netlify Build dari repository Git (atau Netlify CLI). Jangan hanya mengunggah folder public/ sebagai website statis.

Fitur:
- Homepage lama tetap di https://ersyafurniture.netlify.app/.
- /produk/<slug>/ menyajikan HTML server-rendered dengan metadata SEO dan Product JSON-LD.
- /sitemap.xml dibangun dinamis dari produk published.
- Admin Auto Pilot memasukkan foto massal ke antrean terjadwal di Supabase, dengan foto Cloudinary.
- `npm run verify` memeriksa file penting, sintaks JavaScript, JSON-LD, asset, rute Netlify, dan smoke test fungsi.

Migrasi inti dan worker Cron sudah diterapkan pada proyek Supabase ERSYA aktif. Pengaturan Auto Pilot masih nonaktif sampai front-end di-deploy dan diuji. Gunakan BACA-SEBELUM-DEPLOY.txt untuk urutan pemasangan.

Versi 24.2 menambahkan analisis foto Gemini di server Netlify (secret `ERSYA_GEMINI_API_KEY`), hasil AI SEO yang dapat ditinjau per foto, alt text tersimpan, dan jadwal tanggal/jam khusus per produk di dalam batch. Lihat `PANDUAN-AI-VISION-DAN-JADWAL-INDIVIDUAL.txt`; AI belum aktif sampai API key ditambahkan pada Netlify dan deploy ulang.
