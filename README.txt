ERSYA MEBEL V24.1.4 — ANTI-BASE64 + AUTOPILOT MASSAL + SEO PRODUK INDIVIDUAL

PERBAIKAN V24.1.4
- Build Netlify menyematkan konteks `CONTEXT` ke modul Functions sehingga produk/sitemap dapat mengizinkan indexing hanya di production.
- Tes build mensimulasikan `CONTEXT=production` dan `CONTEXT=deploy-preview`; tes browser dan layanan live tetap belum selesai.

Paket kandidat source untuk dihubungkan ke Netlify. Ini bukan paket statis untuk Netlify Drop.

FITUR INTI
- Homepage katalog tetap di https://ersyafurniture.netlify.app/.
- Panel Admin dan Auto Pilot massal hingga 100 foto per batch.
- Foto dikompresi sebagai Blob dan diunggah ke Cloudinary; Supabase menerima URL gambar dan metadata produk.
- Antrean jadwal ada di Supabase; worker Cron server memproses publikasi. Auto Pilot produksi tetap nonaktif.
- SEO produk individual `/produk/<slug>/`, Product/Breadcrumb structured data, dan sitemap dinamis.

ANTI-BASE64
- Jalur foto baru tidak menggunakan `canvas.toDataURL()` dan tidak menyimpan payload foto di localStorage.
- Penulisan katalog localStorage membuang data:image secara rekursif, imageData, Blob, object URL, dan flag migrasi sementara. Renderer Admin juga membuat argumen tombol dari objek yang telah disanitasi agar payload Base64 lama tidak terduplikasi ke DOM.
- Foto Base64 versi lama dimigrasikan ke IndexedDB sebagai Blob sebelum localStorage dibersihkan. Jika migrasi gagal, simpan, sinkronisasi massal, impor, dan pemulihan yang berisiko menghilangkan satu-satunya salinan ditahan.
- Ekspor backup ditunda saat foto pending upload; impor backup yang membawa data:image ditolak.
- Beranda hanya menyimpan URL gambar HTTP(S) dari Supabase, tidak menimpa cache lama yang masih berisi Base64 sebelum migrasi Admin, serta mempertahankan produk lokal berstatus pending. Fungsi SEO mengganti `data:image`/`blob:` dengan logo situs.
- Tes anti-Base64 menjadi bagian wajib `npm run verify`.

STRUKTUR
- `public/`: homepage, admin.html, aset dan robots.txt.
- `netlify/functions/`: halaman produk server-rendered dan sitemap dinamis.
- `netlify.toml`: fungsi dan routing Netlify.
- `scripts/`, `tests/`, `package.json`: pemeriksaan otomatis build.
- `SQL-ERSYA-MEBEL-AUTOPILOT-MASSAL.txt`: SQL dokumentasi/replikasi.

PENTING SEBELUM DEPLOY
- Jangan hanya unggah `public/` lewat Netlify Drop; Functions butuh Git-connected Netlify atau Netlify CLI.
- Jangan menimpa repository GitHub lama; gunakan repository khusus ERSYA jika diperlukan.
- Jangan masukkan service_role/secret key ke frontend atau repository.
- Tidak perlu mengandalkan `CONTEXT` saat runtime Functions: skrip build menyematkan nilai build ke fungsi. `ERSYA_DEPLOY_CONTEXT` hanya dipakai jika sengaja mengatur override di scope Functions.
- Aktifkan Leaked Password Protection di Supabase Dashboard.
- Uji login Admin, upload Cloudinary, penyimpanan Supabase, jadwal/Cron, halaman detail dan sitemap pada Deploy Preview sebelum deployment produksi.

STATUS
Pemeriksaan otomatis lokal lulus. Browser headless timeout dan integrasi online end-to-end belum selesai. Paket belum dideploy dan belum dinyatakan siap produksi; Auto Pilot produksi tetap nonaktif. Baca `BACA-SEBELUM-DEPLOY.txt`, `LAPORAN-PENGUJIAN.txt`, `LAPORAN-FINALISASI-PREDEPLOY.txt`, dan `CATATAN-PERBAIKAN-AUDIT-V24.1.4.txt`.
