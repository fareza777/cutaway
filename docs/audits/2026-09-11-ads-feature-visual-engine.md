# Audit Cutaway — iklan, fitur, visual, engine

Tanggal: 11 September 2026. Aplikasi: **0.17.0**, Android versionCode **22**. Audit baca-kode terhadap kondisi terkini; tidak ada perangkat Android, impresi AdMob, atau pembelian Play yang dijalankan.

## Kesimpulan

Loop edukasi 3D sudah lengkap (28 objek, 429 bagian, 154 langkah, 189 soal). Rilis 0.17.0 menutup sebagian P1 audit 5 September: consent UMP, banner pustaka, kontras teks, pencarian, pause renderer.

Peningkatan paling bernilai sekarang **bukan** menambah format iklan atau pindah engine. Kunci dulu alur interstitial, tautan Saved, picking pada mode potong, dan transparansi material. Setelah itu, mode belajar yang tetap menampilkan model, Play/Pause sungguhan, lalu art pass.

Ini rekomendasi, bukan implementasi.

## 1. Posisi iklan (yang benar-benar terpasang)

Dua format, tiga penempatan. Tidak ada app-open, rewarded, native, atau splash. SDK hanya di Android. Web tidak memuat iklan.

| Penempatan | Format | Pemicu | Tidak muncul jika |
|---|---|---|---|
| Pustaka, **bawah layar** (di luar `ScrollView`) | Banner AdMob *anchored adaptive* | Layar katalog fokus, consent `canRequestAds` | Hapus Iklan, keyboard terbuka, layar tidak aktif, non-Android |
| **Hasil kuis** | Interstitial layar penuh | 450 ms setelah kuis dinyatakan selesai, otomatis | Hapus Iklan, cooldown 8 menit, sudah 2× sesi, load gagal |
| **Keluar viewer 3D** | Interstitial yang sama | Tombol kembali header **atau** back Android, setelah objek termuat ≥ 60 detik | Sesi < 60 dtk, panel/bagian masih terbuka, kuota/cooldown, Hapus Iklan |

Aturan interstitial (`src/monetization/policy.ts`):

- Jeda 8 menit antarinterstitial; maksimum 2 per sesi proses.
- Ambang 60 detik hanya untuk keluar viewer (waktu wall-clock, bukan waktu interaksi aktif).
- Penghitung sesi **tidak** di-persist; restart mengosongkan kuota.
- Rating maksimum PG; `requestNonPersonalizedAdsOnly: true`.
- Unit uji di `__DEV__`.

Konfigurasi produksi (`app.json`):

- App ID: `ca-app-pub-6279186647593327~8674849287`
- Banner: `ca-app-pub-6279186647593327/5209257311`
- Interstitial: `ca-app-pub-6279186647593327/7776650259`
- `delayAppMeasurementInit: true`
- Produk IAP: `remove_ads`

Rujukan: [LibraryBanner](../../src/monetization/LibraryBanner.tsx), [index.tsx](../../app/index.tsx) baris banner, [quiz](../../app/quiz/[id].tsx) ~450 ms, [viewer back](../../app/object/[id].tsx) `handleViewerBack`, [ads.tsx](../../src/monetization/ads.tsx), [policy](../../src/monetization/policy.ts).

## 2. Yang sudah diperbaiki vs 5 September

Tertutup di 0.17.0:

- UMP `gatherConsent` / `canRequestAds` sebelum inisialisasi SDK; pengguna Hapus Iklan dilewati di awal `initializeAds`.
- Banner pustaka dengan slot sendiri, label “Advertisement” / “Iklan”, unmount saat keyboard atau layar tidak fokus.
- Pilihan privasi di Settings jika SDK menyatakan REQUIRED.
- `readableAccent` dipakai di kartu, chip, dock; target 4.5:1.
- `FrameLoop` + `useScreenActive`: tidak menggambar jika unfocused, background, atau viewport 0×0. Panel penuh juga men-pause viewer.
- Pencarian pustaka EN/ID (judul, subjudul, ringkasan, kategori), AND antar kata.
- Salinan UI: “contains ads” / “mengandung iklan”; hint Hapus Iklan menyebut banner dan layar penuh.

Masih terbuka (lihat bagian 3): race interstitial, deeplink Saved, picking cut, opacity material, pause animasi yang mereset pose.

## 3. Temuan terbuka

### A1 — Interstitial tanpa pengelola tunggal (P1)

Pemeriksaan kuota hanya di depan request. Tidak ada mutex. `recordInterstitial` dipanggil pada `LOADED`, sebelum `show()` berhasil. Timeout 12 detik dapat `finish(false)` meski iklan sudah tampil. Kembali dari viewer `await` iklan, jadi navigasi bisa tertahan hingga 12 detik.

Rekomendasi: satu pengelola, preload, cek ulang entitlement + layar aktif sebelum `show`, hitung pada `OPENED`/`CLOSED`, pisahkan timeout load dari durasi tampil. Jika belum siap, **lewati** dan tetap navigasi.

### A2 — Interstitial kuis muncul di atas layar hasil (P1)

450 ms setelah `finished` — pengguna sedang membaca skor. Google memperingatkan interstitial yang muncul terlambat setelah halaman baru. Lebih aman: tombol “Selesai / Kembali ke pustaka” yang memicu iklan pada transisi, atau tampilkan hanya saat meninggalkan layar hasil (dengan cooldown yang sama).

### F1 — Saved tidak membuka bagian (P1)

`app/saved.tsx` mengirim `/object/${id}?part=${partId}`. Explorer membaca `initialPart` dan menaruhnya di deps `onReady`, tetapi **tidak pernah** `select()`. Bookmark membuka objek tanpa panel komponen.

### E1 — Bagian terpotong masih bisa dipilih (P1)

`Assembly.raycast` hanya menolak mesh `visible === false`. Titik benturan di sisi bidang clipping tetap dipilih.

### E2 — Transparansi GLB ditimpa (P1)

`Assembly.setOpacity` menulis `opacity`, `transparent`, dan `depthWrite` setiap frame alat. `partOpacity()` memakai `part.opacity` dari JSON, bukan material sumber. Wadah transparan tanpa field JSON jadi opak.

### E3 — Pause animasi mereset pose (P2)

`setRunning(false)` memanggil `clearMotion()`, kembali ke quaternion istirahat, bukan membekukan siklus.

### V1 — Panel belajar menutup dan mematikan model (P2)

`Viewport active={!panelOpen}`. Overlay “Cara kerja” hampir penuh **dan** loop berhenti. Komentar di `Panels.tsx` (“model never just decoration”) tidak sesuai perilaku.

## 4. Rekomendasi fitur

| Urutan | Fitur | Bentuk | Usaha |
|---|---|---|---|
| 1 | Kunci iklan + Saved | Mutex/preload/OPENED; back tidak menunggu; `select(part)` setelah load | Kecil |
| 2 | Belajar terpandu | Model atas, lembar langkah bawah; kamera/sorot/animasi mengikuti langkah | Sedang |
| 3 | Play/Pause sungguhan | Freeze pose; Reset terpisah; kecepatan 0,25–2× | Kecil–sedang |
| 4 | Cari bagian + lanjutkan | Indeks nama bagian EN/ID; buka + pilih; objek terakhir | Kecil |
| 5 | Progres penguasaan | Langkah selesai, kuis, latihan ulang; undo hapus data | Sedang |

Jangan menambah rewarded atau app-open. Banner tetap hanya di pustaka, bukan di viewer/kuis.

Pencarian sekarang tidak mencakup nama bagian. Reset progres di Settings masih tanpa konfirmasi.

## 5. Rekomendasi visual

- Ganti panel penuh menjadi lembar ~40% tinggi; biarkan viewer `active` selama panel terbuka.
- Play/Pause selalu di viewport, bukan di ujung rail 390 px.
- Target sentuh ≥ 48 dp; hotspot hanya set terfokus + pilihan aktif.
- Art pass material (logam/plastik/karet/kaca) lebih berharga daripada menambah segitiga.
- Seragamkan kamera, skala, dan margin ikon katalog.
- Framing kamera harus aman saat auto-rotate (rotor helikopter).

Katalog: Appliances 6, Anatomy 7, Electronics 4, Mechanical 6, Aerospace 4, Music 1.

## 6. Rekomendasi engine

Tetap Three.js / expo-gl. Tidak ada bukti perlu pindah Unity/Unreal.

| P | Perbaikan |
|---|---|
| P1 | Saring raycast terhadap bidang cut; lanjut ke hit berikutnya |
| P1 | Kalikan opacity alat dengan opacity GLB, jangan timpa |
| P2 | Pause = freeze; Reset terpisah |
| P2 | Cap/hatching pada bidang potong |
| P2 | Profil kualitas di atas budget tetap 1,15 juta piksel |
| P2 | Deduplikasi GLB `assets/` vs `res/` di AAB (~19 MB terkompresi, bukan jaminan unduhan Play identik) |
| P3 | Cache scene terbatas; instancing hanya setelah profiling |

Model sumber 56.267.736 byte (~53,7 MiB). Terbesar: satelit 6,06 MB, helikopter 5,78 MB, vacuum 5,44 MB.

`RenderScale` masih budget tetap. Cache `AssetManager` 2 buffer, parse ulang tiap scene. Tidak ada shadow map (pilihan mobile yang masuk akal).

## 7. Monetisasi & rilis (bukan blocker belajar)

- iOS: tidak ada `iosAppId` AdMob; billing hanya Android.
- Privacy policy masih URL GitHub raw (`text/plain`).
- Harga cadangan `$4.99` / `$4,99` jika Play belum mengembalikan harga lokal.
- Fill rate, Data Safety, app-ads.txt, dan pembelian live tidak diverifikasi di audit ini.

## 8. Urutan kerja

1. Pengelola interstitial + Saved deeplink + picking cut + opacity asli.
2. Story sebagai lembar bawah; Play/Pause freeze.
3. Cari bagian, lanjutkan belajar, konfirmasi hapus data.
4. Art pass material/ikon, cap cutaway, profil kualitas, deduplikasi AAB.
