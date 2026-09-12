# Audit Cutaway — fitur, visual, engine, dan iklan

Tanggal: 5 September 2026. Aplikasi: 0.16.0, Android versionCode 21. Acuan kode: commit `5d83815`, termasuk perubahan lokal yang sudah ada ketika audit dimulai.

## Kesimpulan

Cutaway sudah memiliki fondasi aplikasi edukasi 3D yang cukup lengkap. Peningkatan paling bernilai sekarang bukan menambah jumlah objek atau mengganti seluruh engine, melainkan membuat objek yang ada lebih nyaman dipelajari, konsisten secara visual, dan hemat sumber daya.

Prioritas sebelum rilis berikutnya: alur iklan dan privasi, render layar tersembunyi, transparansi material, pemilihan bagian pada mode potong, tautan bagian tersimpan, serta kontras tema terang. Setelah itu, tingkatkan mode belajar terpandu, kontrol animasi, pencarian, dan progres belajar.

Ini audit dan rekomendasi, bukan implementasi perbaikan. Kode aplikasi dan perubahan pengguna tidak diubah; tidak ada push, pembelian, atau penayangan iklan produksi selama audit.

## 1. Kondisi saat ini

| Area | Yang sudah tersedia |
|---|---|
| Katalog | 28 objek, 429 bagian, 154 langkah penjelasan, 189 pertanyaan kuis |
| Bahasa | Dokumen Inggris dan Indonesia untuk seluruh 28 objek; pemeriksaan registrasi, kelengkapan, dan kebocoran bahasa lulus |
| Eksplorasi | Putar dan zoom, pilih komponen, hotspot, exploded view, kupas lapisan, potong X/Y/Z dan balik arah, X-ray, isolasi, fokus lapisan, animasi mekanisme |
| Pembelajaran | Panel fungsi komponen, langkah “Cara kerja”, kuis pilihan ganda dan identifikasi bagian |
| Penyimpanan | Bagian tersimpan, penanda objek pernah dibuka, skor terbaik; tersimpan lokal |
| Tampilan | Tema terang/gelap, ikon spesifik objek, onboarding; orientasi aplikasi dikunci portrait |
| Offline | Model dan konten inti dibundel; tidak perlu akun untuk belajar |
| Platform | React Native/Expo, Three.js melalui expo-gl; monetisasi pembelian saat ini khusus Android |

Dua objek aerospace baru, helikopter turboshaft dan satelit observasi Bumi, sudah terdaftar dan memiliki pengujian model khusus. Namun, “lulus tes” belum sama dengan seluruh sudut kamera, bahan, dan interaksinya sudah mencapai kualitas AAA.

Data inventaris lengkap: [hasil pemeriksaan model](<C:/How it works 3D/.logs/audit-2026-09-05/runtime-findings.json>).

## 2. Iklan yang sudah ada: jenis dan lokasi persis

**Satu format iklan, dua penempatan: interstitial AdMob, yaitu iklan layar penuh.** Kedua penempatan memakai unit iklan yang sama.

| Penempatan | Pemicu saat ini | Keterangan |
|---|---|---|
| Hasil kuis | Sekitar 450 ms setelah kuis dinyatakan selesai | Otomatis, tidak perlu menekan “Tonton iklan”; tidak mensyaratkan skor tertentu |
| Keluar dari layar objek 3D | Menekan kembali setelah objek selesai dimuat dan waktu berlalu minimal 60 detik | Berlaku pada tombol kembali di header dan tombol kembali Android; menunggu alur iklan sebelum navigasi kembali |
| Banner di pustaka/menu | Tidak ada | Sudah dihapus pada commit terbaru |
| Rewarded, native, app-open, splash ad | Tidak ditemukan implementasinya | Tidak ada tombol menonton iklan untuk mendapatkan hadiah |

Catatan navigasi: tombol kembali Android terlebih dahulu menutup panel atau pilihan komponen yang masih terbuka. Iklan viewer baru dipertimbangkan ketika benar-benar meninggalkan layar tersebut. Membuka kuis dari viewer tidak memicu iklan keluar viewer. Ini penempatan pada perpindahan layar dalam aplikasi, bukan sengaja pada penutupan aplikasi.

Aturan bersama yang dirancang:

- Jeda minimal 8 menit antarinterstitial; maksimal 2 per sesi proses aplikasi.
- Ambang 60 detik hanya untuk keluar viewer, bukan untuk kuis. Pengukuran ini waktu berlalu, bukan waktu interaksi aktif.
- Pengguna yang memiliki pembelian Hapus Iklan dilewati oleh pemeriksaan awal.
- Penghitung sesi dan waktu iklan terakhir tidak disimpan permanen; restart proses memulai hitungan baru.
- Permintaan menggunakan iklan non-personalisasi dan rating maksimum PG.
- Versi pengembangan memakai unit uji; web tidak menampilkan iklan.
- Kesalahan atau tidak tersedianya iklan mengembalikan hasil gagal, tetapi alur yang sudah dimulai memiliki batas waktu 12 detik. Batas waktu ini belum dibedakan dengan benar dari durasi iklan yang sedang terbuka.

Konfigurasi produksi yang sudah terpasang:

- AdMob App ID: `ca-app-pub-6279186647593327~8674849287`.
- Unit interstitial: `ca-app-pub-6279186647593327/7776650259`.
- Pengaturan → Iklan & pembelian: produk Google Play sekali beli `remove_ads`, beserta pemulihan pembelian.
- Harga menggunakan harga lokal dari Google Play bila tersedia. Jika belum tersedia, UI menampilkan cadangan `$4.99` / `$4,99`; angka cadangan ini **bukan bukti harga atau produk sudah aktif di Play Console**.

Rujukan kode: [pemicu kuis](<C:/How it works 3D/app/quiz/[id].tsx:115>), [keluar viewer](<C:/How it works 3D/app/object/[id].tsx:70>), [batas frekuensi](<C:/How it works 3D/src/monetization/policy.ts:9>), [status tersimpan](<C:/How it works 3D/src/state/monetization.ts:34>), [pengaturan pembelian](<C:/How it works 3D/app/settings.tsx:155>).

## 3. Temuan prioritas tinggi

P1 berarti perlu didahulukan sebelum rilis lebih luas. P2 berarti penting pada iterasi setelah stabilisasi. Tingkat ini adalah prioritas produk/teknis, bukan klaim semua temuan adalah celah keamanan.

### P1 — Persetujuan privasi iklan belum diintegrasikan

SDK iklan langsung diinisialisasi saat pengaturan selesai dimuat. Tidak ditemukan alur UMP/AdsConsent, pemeriksaan boleh meminta iklan, atau pengaturan ulang pilihan privasi. Manifest release yang tersedia juga memiliki `DELAY_APP_MEASUREMENT_INIT=false`. Simulasi menunjukkan pengguna Hapus Iklan pun masih menjalankan inisialisasi SDK.

Rekomendasi: tambahkan pengelolaan consent sesuai wilayah distribusi, tunda pengukuran/inisialisasi yang relevan, dan sediakan pilihan privasi ketika diwajibkan. Non-personalisasi bukan pengganti seluruh kebutuhan persetujuan. Ini gap implementasi untuk wilayah yang menerapkannya, bukan kesimpulan bahwa semua instalasi pasti melanggar hukum. Google meminta pembaruan informasi consent tiap peluncuran dan pemeriksaan `canRequestAds` sebelum permintaan iklan. [Panduan UMP Google](https://developers.google.com/admob/android/privacy), [panduan integrasi React Native](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent).

Bukti: [inisialisasi saat startup](<C:/How it works 3D/app/_layout.tsx:30>), [inisialisasi SDK](<C:/How it works 3D/src/monetization/ads.tsx:39>).

### P1 — Alur iklan berpotensi bertabrakan atau muncul terlambat

Pemeriksaan frekuensi dan Hapus Iklan hanya dilakukan sebelum proses asynchronous. Belum ada pengunci global satu iklan aktif, pengecekan ulang ketika iklan siap, atau pembatalan berdasarkan layar aktif.

Simulasi memakai kode iklan asli dengan SDK tiruan, tanpa permintaan iklan nyata, membuktikan:

- Tiga pemanggilan bersamaan dapat memanggil penayangan tiga kali meskipun batas sesi dua. Ini uji kondisi bersamaan, bukan klaim pengguna normal selalu melihat tiga iklan.
- Pembelian Hapus Iklan yang selesai ketika iklan sedang dimuat tidak mencegah penayangan yang sudah tertunda.
- Timer 12 detik dapat menyelesaikan promise dengan hasil `false` walaupun iklan sudah ditampilkan dan belum mengirim peristiwa ditutup.
- Penghitung iklan bertambah pada peristiwa dimuat, sebelum keberhasilan tampil diketahui.

Pada kuis, perpindahan layar setelah permintaan dimulai tidak membatalkannya. Pada viewer, tombol kembali dapat terasa tertahan saat jaringan lambat.

Rekomendasi: satu pengelola iklan, preload, pengecekan layar aktif dan entitlement sebelum tampil, penghitungan pada peristiwa benar-benar terbuka, serta pisahkan batas waktu pemuatan dari penutupan iklan. Bila iklan belum siap, lewati; jangan menahan navigasi. Untuk kuis, pertimbangkan transisi eksplisit “Selesai/Kembali”. Google juga memperingatkan iklan yang muncul terlambat setelah halaman baru dibuka. [Panduan interstitial AdMob](https://support.google.com/admob/answer/6201362?hl=en).

Bukti: [alur request/show](<C:/How it works 3D/src/monetization/ads.tsx:61>), bagian `adDiagnostics` pada [hasil simulasi](<C:/How it works 3D/.logs/audit-2026-09-05/runtime-findings.json>).

### P1 — Keterangan iklan dan privasi tidak konsisten

UI menyebut “iklan opsional” dan “tanpa pelacakan”, padahal interstitial muncul otomatis dan SDK iklan tetap digunakan. Dokumen kebijakan privasi menjelaskan pemrosesan SDK, sehingga wording singkat UI tidak selaras. Tautan kebijakan saat ini mengarah ke GitHub raw dengan tipe respons `text/plain`, bukan halaman HTML yang nyaman dibaca.

Rekomendasi: gunakan “Mengandung iklan; tersedia pembelian satu kali untuk menghapus iklan”, jelaskan data SDK secara akurat, dan terbitkan halaman privasi EN/ID yang benar-benar dirender. Selaraskan Data Safety, kelompok usia sasaran, dan listing dengan konfigurasi nyata. README juga masih menyebut banner dan ID produksi belum tersedia, padahal kode sudah berbeda.

Bukti: [teks UI](<C:/How it works 3D/src/i18n/strings.ts:139>), [listing](<C:/How it works 3D/docs/play-store-listing.md:37>), [tautan kebijakan](<C:/How it works 3D/app.json:69>), [README lama](<C:/How it works 3D/README.md:397>).

### P1 — Viewer tersembunyi masih menggambar 3D

Saat kuis dibuka, viewer sebelumnya tetap berada di stack. Pada pengujian web, canvas viewer tersebut sudah berukuran tampilan 0 × 0, tetapi penghitung draw call bertambah dari 13.465 menjadi 17.228 dalam 1,2 detik. Panel Cara kerja yang menutup model juga tidak menghentikan render di belakangnya.

Rekomendasi: pause/resume berdasarkan fokus layar, status aplikasi di background, ukuran viewport, dan panel yang benar-benar menutup model. Jangan menggambar dua viewer ketika hanya satu yang terlihat. Demand rendering yang ada sudah dapat berhenti menggambar saat benar-benar idle, tetapi auto-rotate mengaktifkannya kembali.

Angka tersebut adalah jumlah pemanggilan menggambar, **bukan FPS atau pengukuran baterai Android**. Dampak panas/baterai perlu diukur di perangkat nyata.

Bukti: [siklus Viewport](<C:/How it works 3D/src/ui/Viewport.tsx:53>), [loop engine](<C:/How it works 3D/src/engine/CutawayViewer.ts:691>), [hasil interaksi browser](<C:/How it works 3D/.logs/audit-2026-09-05/ui-findings.json>).

### P1 — Material transparan asli dapat berubah menjadi opak

Jalur visibility menimpa opacity dan sifat transparan setiap material. Wadah debu vacuum yang memiliki opacity asli 0,27 berubah menjadi 1,0 dan tidak transparan. Material jewel jam juga berubah dari 0,9 ke 1,0. Kaca helikopter dan kaca jam tetap transparan karena mempunyai pengaturan opacity bagian; jadi masalah ini tidak mengenai semua kaca secara identik.

Rekomendasi: pertahankan nilai asli material, lalu gabungkan dengan opacity dari alat/fokus. Jangan menyamaratakan sisi material, roughness, dan depth-write tanpa alasan per bahan. Tes hasil setelah dimuat engine, bukan hanya memeriksa file GLB.

Bukti: [pengaturan material](<C:/How it works 3D/src/engine/Assembly.ts:160>), [penimpaan opacity](<C:/How it works 3D/src/engine/Assembly.ts:368>), [tampilan vacuum](<C:/How it works 3D/.logs/audit-2026-09-05/vacuum-light.png>).

### P1 — Bagian yang sudah dipotong masih bisa terpilih

Pemilihan lewat raycast hanya memeriksa mesh yang visible, bukan apakah titik benturannya dibuang oleh bidang potong. Uji Assembly dengan sebuah kubus yang seluruhnya berada di sisi terpotong masih mengembalikan pilihan kubus.

Rekomendasi: saring setiap hasil benturan berdasarkan bidang potong aktif; jika benturan pertama tidak terlihat, lanjutkan ke benturan berikutnya. Aturan hotspot juga harus konsisten dengan potongan dan visibilitas.

Bukti: [raycast](<C:/How it works 3D/src/engine/Assembly.ts:408>), bagian `clippedPicking` pada hasil runtime.

### P1 — Bagian tersimpan tidak membuka bagian yang dimaksud

Daftar tersimpan mengirim parameter `?part=...`, tetapi viewer tidak memilih bagian itu setelah model dimuat. Pengujian tautan langsung ke kompresor helikopter membuka objek tanpa panel komponen.

Rekomendasi: validasi ID bagian dan lakukan pemilihan setelah pemuatan selesai. Uji alur simpan → buka kembali, termasuk bahasa Indonesia dan objek berbeda.

Bukti: [tautan daftar tersimpan](<C:/How it works 3D/app/saved.tsx:79>), [parameter viewer](<C:/How it works 3D/app/object/[id].tsx:33>), [bukti layar](<C:/How it works 3D/.logs/audit-2026-09-05/saved-part-deeplink.png>).

### P1 — Kontras tema terang perlu diperbaiki

Pengukuran pada preview mobile menemukan label kategori Electronics sekitar 1,73:1, teks sekunder 3,06:1 di kartu putih, dan pilihan aktif All pada satelit 1,38:1. Ini teks kecil yang aktif, bukan dekorasi atau tombol nonaktif.

Rekomendasi: pisahkan warna dekoratif objek dari warna teks yang terbaca; buat pasangan foreground/background khusus terang dan gelap. Helper `readableAccent` sudah ada tetapi belum digunakan. Target teks kecil minimal 4,5:1 mengacu pada WCAG; warna aksen pastel bisa tetap dipakai untuk latar dan detail dekoratif. [Panduan kontras W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Bukti: [token tema](<C:/How it works 3D/src/ui/theme.ts:45>), [helper yang belum dipakai](<C:/How it works 3D/src/ui/theme.ts:117>), [pustaka Indonesia](<C:/How it works 3D/.logs/audit-2026-09-05/library-id-light-390.png>).

## 4. Rekomendasi peningkatan fitur

Urutan berikut memprioritaskan manfaat belajar dibanding menambah kerumitan aplikasi.

| Urutan | Fitur | Bentuk yang disarankan | Usaha relatif |
|---|---|---|---|
| 1 | Belajar terpandu yang tetap menampilkan model | Model di bagian atas, lembar langkah di bawah; kamera, sorotan, dan animasi sesuai langkah | Sedang |
| 2 | Cari dan lanjutkan belajar | Pencarian nama objek/komponen dalam EN/ID, riwayat terakhir, kembali ke langkah terakhir | Kecil–sedang |
| 3 | Kontrol animasi lengkap | Play/Pause selalu terlihat; pause mempertahankan posisi, Reset terpisah, kecepatan 0,25–2× dan penggeser waktu | Sedang |
| 4 | Progres yang bermakna | Langkah selesai, riwayat kuis, penjelasan jawaban salah, latihan ulang bagian yang belum dipahami | Sedang |
| 5 | Anotasi dan berbagi | Label ringkas pada komponen terpilih; bagikan gambar dengan nama bagian dan bahasa aktif | Sedang |
| 6 | Mode kelas/tablet | Landscape, model dan teks berdampingan, ukuran teks lebih besar; narasi opsional tahap berikutnya | Sedang–besar |

Progres saat ini hanya kunjungan dan skor terbaik, bukan penguasaan materi. Simpan progres lokal terlebih dahulu; akun/cloud tidak perlu menjadi prasyarat fitur belajar dasar. Tambahkan konfirmasi atau undo sebelum menghapus seluruh progres dan bagian tersimpan, yang sekarang langsung direset.

Bahasa Indonesia: struktur dan kelengkapan konten sudah jauh lebih baik daripada tidak adanya terjemahan, tetapi tes otomatis belum membuktikan seluruh kalimat alami atau seluruh fakta ilmiah akurat. Masih ada label aksesibilitas Inggris di Saved, tombol sumbu potong, dan langkah cerita. Gunakan glosarium teknis EN/ID, konsistensi “bagian/komponen/lapisan”, serta tinjauan editorial manusia pada konten yang paling banyak dibuka. Hindari menggambar tulisan terjemahan ke dalam gambar; tetap gunakan teks aplikasi.

## 5. Rekomendasi visual

### Layout dan kontrol

- Panel Cara kerja sekarang menutup hampir seluruh area model. Pada layar uji setinggi 844 px, panel mulai sekitar y=56 hingga bawah. Ganti dengan lembar bawah yang menjaga model terlihat, bukan artikel layar penuh di atas animasi. [Bukti layar](<C:/How it works 3D/.logs/audit-2026-09-05/helicopter-story.png>).
- Header satelit/vacuum memotong judul dan subjudul karena bersaing dengan beberapa tombol. Pindahkan kontrol sekunder ke menu ringkas dan sediakan judul lengkap saat dibutuhkan.
- Kontrol Run berada di luar bagian awal rel horizontal pada layar 390 px. Jadikan Play/Pause tindakan utama yang selalu terlihat.
- Kurangi kepadatan titik hotspot: tampilkan sesuai kelompok/fokus, beri label hanya pada pilihan aktif, dan perhatikan komponen yang tertutup.
- Perbesar area sentuh tombol 32–38 menjadi sedikitnya 48 dp tanpa harus memperbesar ikon. Slider perlu nilai, peran, dan aksi aksesibilitas; tambahkan dukungan pembesaran teks dan pengurangan gerak. [Rekomendasi target sentuh Android](https://support.google.com/accessibility/android/answer/7101858?hl=en).

### Kualitas objek dan ikon

Helikopter dan satelit sudah memiliki bentuk yang dapat dikenali serta detail mekanis lebih padat. Yang menurunkan kesan premium sekarang adalah hasil bahan saat runtime, penataan kamera, dan konsistensi antarobjek. Pada salah satu sudut auto-rotate helikopter, ujung rotor keluar batas layar; framing perlu memperhitungkan rotasi, bukan hanya ukuran sumbu awal.

Lakukan art pass terarah: bevel kecil, perbedaan logam/plastik/karet/kaca, bayangan kontak yang konsisten, sambungan yang masuk akal, serta detail permukaan seperlunya. Banyak poligon tanpa perbaikan siluet, material, dan pencahayaan tidak otomatis terlihat realistis. Model sekarang tidak memakai tekstur; tekstur normal/roughness dapat dieksplorasi secara selektif dengan anggaran memori mobile.

Ikon objek tersedia untuk semua 28 entri, tetapi sudut kamera dan keterbacaan pada ukuran kecil tidak seragam. Ikon ponsel tampak seperti lempeng gelap, sementara helikopter lebih mudah dikenali. Tetapkan kamera, skala, margin, dan pencahayaan yang konsisten; pilih sisi objek yang paling informatif.

Ikon aplikasi saat ini adalah simbol potongan balok berlapis. Konsepnya sesuai Cutaway, tetapi penilaian desain saya: identitasnya masih generik. Pertahankan ide penampang, sederhanakan tumpukan bentuk, kuatkan satu siluet dan satu aksen, lalu uji ukuran 48 px serta mask ikon Android. Tidak perlu menaruh objek fotorealistis yang terlalu rumit di ikon aplikasi. [Ikon saat ini](<C:/How it works 3D/assets/icon.png>).

## 6. Rekomendasi engine dan ukuran aplikasi

**Tidak ada bukti bahwa proyek perlu pindah ke Unity/Unreal saat ini.** Three.js yang digunakan sudah cukup untuk pengalaman ini; lakukan perbaikan terukur pada jalur render dan aset lebih dahulu.

| Prioritas | Peningkatan | Alasan dan ukuran keberhasilan |
|---|---|---|
| P1 | Lifecycle renderer | Tidak ada draw call tambahan saat layar ditinggalkan atau aplikasi di background; kembali tanpa kehilangan keadaan |
| P1 | Kontrak material dan picking | Transparansi asli bertahan; komponen yang dibuang bidang potong tidak dapat dipilih |
| P2 | Kualitas adaptif | Profil hemat/seimbang/tinggi, resolusi berdasarkan frame time; ukur perangkat Android kelas rendah/menengah, bukan hanya desktop |
| P2 | Cache dan pemuatan | Cache terbatas yang dapat dipakai lintas viewer, batalkan beban yang kedaluwarsa dan bersihkan scene; hindari parse dan pembuatan lingkungan berulang |
| P2 | Potongan tertutup | Tambahkan permukaan penutup/hatching pada bidang potong agar benda tidak terlihat seperti kulit kosong; sediakan fallback hemat |
| P2 | Pengemasan aset | Hilangkan duplikasi GLB bila jalur pemuatan offline tetap terjamin; selaraskan verifier dan pipeline |
| P3 | Detail permukaan dan batching | Uji tekstur terkompresi, berbagi tekstur hotspot, instancing/batching hanya setelah profiling menunjukkan manfaat |

Fakta ukuran:

- Model sumber total 56.267.736 byte, sekitar 53,66 MiB. Total katalog 1.109.460 segitiga; angka ini **bukan** jumlah yang dirender sekaligus.
- Satelit sekitar 6,06 MB/96.760 segitiga; helikopter 5,78 MB/98.446; vacuum 5,44 MB/75.268.
- AAB lokal yang sudah ada, bertanggal 25 Agustus, berukuran 113.688.710 byte. Audit ZIP menemukan dua keluarga masing-masing 28 GLB: satu dalam assets, satu dalam resources.
- Total GLB dalam AAB menjadi 112.535.472 byte sebelum kompresi. Satu keluarga duplikat mewakili sekitar 18,86 MB data terkompresi; ini peluang penghematan, **bukan jaminan pengurangan ukuran unduhan Play dengan angka identik**.

Cache sekarang menyimpan dua buffer per instance AssetManager dan tetap menyalin serta mem-parse ulang saat memuat scene. RenderScale memakai batas tetap 1.150.000 piksel, belum profil kualitas adaptif. Renderer memakai ACES dan lingkungan studio, tanpa shadow map; ini pilihan yang masuk akal untuk mobile. Mode cut belum menyediakan cap/stencil. Tombol berhenti animasi memanggil `clearMotion`, sehingga kembali ke pose dasar, bukan benar-benar membekukan pose.

Rujukan: [AssetManager](<C:/How it works 3D/src/engine/AssetManager.ts:56>), [RenderScale](<C:/How it works 3D/src/engine/RenderScale.ts:26>), [kontrol animasi](<C:/How it works 3D/src/engine/CutawayViewer.ts:559>), [framing kamera](<C:/How it works 3D/src/engine/CutawayViewer.ts:259>).

## 7. Pembelian, dependensi, dan kesiapan rilis

Pembelian sudah memeriksa status selesai dan mencoba finalisasi transaksi; token pembelian tidak sengaja dicetak dalam jalur yang diperiksa. Namun belum ada verifikasi server, rekonsiliasi refund/revocation, dan penanganan lengkap error/pending pembelian. Jangan mencabut hak pengguna hanya karena perangkat sedang offline; rancang rekonsiliasi yang membedakan gagal koneksi dari pembatalan sah. Google merekomendasikan verifikasi pembelian melalui backend yang aman. [Keamanan Google Play Billing](https://developer.android.com/google/play/billing/security?hl=en).

UI pembelian juga muncul pada platform yang tidak didukung. Gunakan label “harga belum tersedia” ketika produk belum termuat, bukan harga USD cadangan yang terlihat final. Pisahkan hasil batal, pending, gagal, dan tidak ada pembelian untuk dipulihkan.

Pemeriksaan dependensi melaporkan 21 entri rentan: 5 high, 16 moderate, tanpa critical. Sebagian besar high berasal dari rantai tool pemrosesan gambar/build Metro; bukan lima kerentanan runtime aplikasi yang terbukti dapat dieksploitasi. Lakukan pembaruan kompatibel dan penilaian jalur input yang terkena; jangan menjalankan perbaikan paksa yang menurunkan versi Expo secara membabi buta. Contoh advisori sumber: [image-size](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

iOS belum siap dipasarkan dari konfigurasi ini: integrasi billing dibatasi Android dan AdMob belum memiliki iosAppId. Status aktivasi produk Play, fill rate, pendapatan iklan, pengaturan consent di konsol, Data Safety, serta app-ads.txt pada situs pengembang belum terverifikasi oleh audit lokal ini.

## 8. Rencana peningkatan yang disarankan

1. **Stabilisasi sebelum rilis:** perbaiki consent dan pengelola iklan, transparansi, picking potongan, tautan Saved, pause renderer, dan kontras. Tambahkan tes regresi yang mereproduksi kasus audit.
2. **Peningkatan pengalaman belajar:** mode terpandu dengan model tetap terlihat, Play/Pause sejati, pencarian, lanjutkan belajar, bahasa aksesibilitas lengkap, dan target sentuh nyaman.
3. **Poles premium:** art pass lintas katalog, framing aman semua sudut, ikon konsisten, material berbeda jelas, cap penampang, profil kualitas perangkat, dan deduplikasi aset.
4. **Pengembangan jangka berikutnya:** progres penguasaan, latihan ulang, mode tablet/kelas, berbagi anotasi, kemudian narasi atau sinkronisasi bila kebutuhan pengguna membenarkannya.

Monetisasi: pertahankan area belajar bebas banner; perbaiki kualitas dua titik interstitial yang ada sebelum menambah format. Pisahkan unit atau penandaan penempatan untuk mengevaluasi hasil kuis vs keluar viewer. Pengukuran tambahan perlu selaras dengan janji privasi. Jangan menambahkan app-open atau rewarded hanya untuk menambah jumlah iklan tanpa manfaat jelas bagi pengguna.

## 9. Verifikasi dan batas audit

- Rangkaian `npm run check` lulus: tipe, kebijakan iklan, konten, smoke, penulisan model, enam suite objek khusus, katalog/bahasa/ikon, dan tes alur script build. Tes alur build **bukan** pembuatan APK baru pada audit ini.
- Masih ada peringatan overlap bounding-box pada delapan objek lama: kamera, motor listrik, mata, hard disk, kunci, loudspeaker, turbofan, dan mesin cuci. Total 13 pasangan perkiraan; bounding-box overlap belum membuktikan tabrakan geometri yang terlihat.
- Diperiksa 13 tampilan/skenario browser, termasuk EN/ID, tema terang/gelap, lebar 360/390, viewer, panel, kuis, Saved, dan Settings. Tidak ada page error pada sampel tersebut.
- Pengujian runtime material/picking memakai implementasi Assembly asli; pengujian race iklan memakai implementasi aplikasi asli dengan SDK dan timer tiruan. Tidak menghubungi layanan iklan untuk menghasilkan impresi.
- Tidak ada perangkat Android terhubung. FPS native, konsumsi baterai, suhu, kestabilan perangkat kelas rendah, iklan live, serta beli/pulihkan Google Play belum diuji langsung.
- Artefak AAB yang diperiksa adalah build lokal yang sudah ada, bukan bukti seluruh perubahan lokal terbaru sudah terpaket. Audit bukan sertifikasi keamanan menyeluruh, persetujuan Play Store, atau validasi ilmiah seluruh isi 28 objek.
- Server preview dan browser sementara audit sudah dihentikan; proses lain tidak disentuh.

Bukti utama: [hasil model dan simulasi](<C:/How it works 3D/.logs/audit-2026-09-05/runtime-findings.json>) dan [hasil UI/interaksi](<C:/How it works 3D/.logs/audit-2026-09-05/ui-findings.json>). Screenshot pendukung ditautkan pada temuan terkait.
