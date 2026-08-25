/**
 * Interface strings.
 *
 * A flat dictionary rather than a library: there are two locales and about
 * fifty keys, and every i18n package worth using costs more in bundle size and
 * setup than the whole feature does here. If a third locale arrives this still
 * holds; if a tenth does, revisit it.
 *
 * Object prose does not live here — that is content, and it is translated in
 * `content/id/*.json` alongside the English it overlays.
 */

export type Locale = 'en' | 'id';

export const LOCALES: { code: Locale; label: string; english: string }[] = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'id', label: 'Bahasa Indonesia', english: 'Indonesian' },
];

const en = {
  'app.tagline': 'Take things apart. Find out how they work.',
  'library.footer': '{count} objects · works offline · optional ads',
  'library.parts': '{count} parts',
  'library.icon': '3D model preview of {title}',
  'library.all': 'All',
  'library.saved': 'Saved parts',
  'library.settings': 'Settings',

  'category.Electronics': 'Electronics',
  'category.Aerospace': 'Aerospace',
  'category.Mechanical': 'Mechanical',
  'category.Appliances': 'Appliances',
  'category.Anatomy': 'Anatomy',
  'category.Music': 'Music',

  'welcome.1.kicker': 'Turn it over',
  'welcome.1.title': 'Drag to rotate.\nPinch to zoom.',
  'welcome.1.body':
    'Every object is a real 3D model. Move around it the way you would pick something up and turn it in your hands.',
  'welcome.2.kicker': 'Ask what it is',
  'welcome.2.title': 'Tap any part\nto learn its job.',
  'welcome.2.body':
    'Tap a component on the model — or a dot — and everything else fades back so you can see what you selected, with an explanation of why it is there.',
  'welcome.3.kicker': 'Look inside',
  'welcome.3.title': 'Explode it, peel it,\ncut through it.',
  'welcome.3.body':
    'Separate every part, strip away the outer layers one at a time, or slice the whole object in half. Then run the mechanism and watch it work.',
  'welcome.4.kicker': 'One last thing',
  'welcome.4.title': 'Choose your\nlanguage.',
  'welcome.4.body': 'You can change this at any time in Settings.',
  'welcome.next': 'Next',
  'welcome.skip': 'Skip',
  'welcome.start': 'Start exploring',

  'explorer.back': 'Back to library',
  'explorer.autoRotate': 'Toggle auto-rotate',
  'explorer.reset': 'Reset view',
  'explorer.loading': 'Loading {name}…',
  'explorer.notFound': 'That object is not in the library.',

  'tool.explode': 'Explode',
  'tool.peel': 'Peel',
  'tool.cut': 'Cut',
  'tool.xray': 'X-ray',
  'tool.run': 'Run',
  'tool.pause': 'Pause',
  'tool.separate': 'Separate parts',
  'tool.crossSection': 'Cross-section',
  'tool.peelAway': 'Peel away layers',
  'tool.complete': 'Complete',
  'tool.removed': '{count} removed',
  'tool.sliceAlong': 'Slice along',
  'tool.flip': 'Flip',
  'tool.focus': 'Focus',
  'tool.all': 'All',
  'tool.outer': 'Outer',
  'tool.core': 'Core',
  'tool.layer': 'Layer {n}',

  'nav.parts': 'Parts',
  'nav.story': 'How it works',
  'nav.quiz': 'Quiz',

  'part.layer': 'Layer {n}',
  'part.position': '{index} of {total}',
  'part.readMore': 'Read more',
  'part.less': 'Less',
  'part.isolate': 'Isolate',
  'part.onlyThis': 'Only this',
  'part.save': 'Save this part',
  'part.unsave': 'Remove from saved parts',
  'part.prev': 'Previous part',
  'part.next': 'Next part',
  'part.close': 'Close part details',

  'panel.parts': 'Parts',
  'panel.story': 'How it works',
  'panel.step': 'Step {index} of {total}',
  'panel.back': 'Back',
  'panel.startOver': 'Start over',
  'panel.next': 'Next',

  'quiz.question': 'Question {index} of {total}',
  'quiz.tapHint': 'Tap the part on the model. Drag to rotate.',
  'quiz.correct': 'Correct.',
  'quiz.notQuite': 'Not quite.',
  'quiz.next': 'Next',
  'quiz.seeResult': 'See result',
  'quiz.tryAgain': 'Try again',
  'quiz.done': 'Done',
  'quiz.leave': 'Leave quiz',
  'quiz.none': 'No quiz for this object yet.',
  'quiz.perfect': 'Every question. You know this object.',
  'quiz.good': 'Solid. Go back through the parts you missed.',
  'quiz.poor': 'Worth another look at how it works, then try again.',

  'saved.title': 'Saved',
  'saved.empty': 'Nothing saved yet. Tap the bookmark on any part to keep it here.',
  'saved.browse': 'Browse objects',
  'saved.remove': 'Remove from saved',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.appearance': 'Appearance',
  'settings.dark': 'Dark',
  'settings.light': 'Light',
  'settings.data': 'Data',
  'settings.clearProgress': 'Clear progress and saved parts',
  'settings.clearHint': 'Removes which objects you have opened, your quiz scores and your saved parts. Nothing leaves this device in the first place.',
  'settings.ads': 'Ads & purchases',
  'settings.removeAds': 'Remove ads',
  'settings.removeAdsHint': 'One-time purchase. Interstitial ads stay off on this device.',
  'settings.removeAdsPurchased': 'Ads removed',
  'settings.removeAdsCta': 'Remove ads · $4.99',
  'settings.restorePurchases': 'Restore purchase',
  'settings.purchaseLoading': 'Checking Google Play…',
  'settings.purchaseFailed': 'Purchase could not be completed. Try again from Google Play.',
  'settings.privacy': 'Privacy policy',
  'settings.about': 'The core library works offline. No account or tracking. Optional ads help support new objects.',

  'common.goBack': 'Go back',
  'common.close': 'Close {name}',
};

type Key = keyof typeof en;

const id: Record<Key, string> = {
  'app.tagline': 'Bongkar. Temukan cara kerjanya.',
  'library.footer': '{count} objek · tanpa internet · iklan opsional',
  'library.parts': '{count} bagian',
  'library.icon': 'Pratinjau model 3D {title}',
  'library.all': 'Semua',
  'library.saved': 'Bagian tersimpan',
  'library.settings': 'Pengaturan',

  'category.Electronics': 'Elektronik',
  'category.Aerospace': 'Dirgantara',
  'category.Mechanical': 'Mekanik',
  'category.Appliances': 'Peralatan Rumah Tangga',
  'category.Anatomy': 'Anatomi',
  'category.Music': 'Musik',

  'welcome.1.kicker': 'Putar objeknya',
  'welcome.1.title': 'Geser untuk memutar.\nCubit untuk memperbesar.',
  'welcome.1.body':
    'Setiap objek adalah model 3D utuh. Amati dari segala sisi, seperti memegang dan membalik benda di tangan.',
  'welcome.2.kicker': 'Kenali setiap bagian',
  'welcome.2.title': 'Ketuk bagian mana pun\nuntuk melihat fungsinya.',
  'welcome.2.body':
    'Ketuk komponen atau titik penandanya. Bagian lain akan meredup agar pilihan Anda terlihat jelas, lengkap dengan penjelasan fungsinya.',
  'welcome.3.kicker': 'Lihat ke dalam',
  'welcome.3.title': 'Uraikan, kupas,\ndan potong.',
  'welcome.3.body':
    'Pisahkan komponennya, buka lapisan luar satu per satu, atau lihat penampangnya. Jalankan mekanisme untuk menyaksikan cara kerjanya.',
  'welcome.4.kicker': 'Terakhir',
  'welcome.4.title': 'Pilih\nbahasa.',
  'welcome.4.body': 'Pilihan ini dapat diubah kapan saja di Pengaturan.',
  'welcome.next': 'Lanjut',
  'welcome.skip': 'Lewati',
  'welcome.start': 'Mulai menjelajah',

  'explorer.back': 'Kembali ke pustaka',
  'explorer.autoRotate': 'Aktifkan atau nonaktifkan rotasi otomatis',
  'explorer.reset': 'Atur ulang tampilan',
  'explorer.loading': 'Memuat {name}…',
  'explorer.notFound': 'Objek ini tidak ditemukan di pustaka.',

  'tool.explode': 'Uraikan',
  'tool.peel': 'Kupas',
  'tool.cut': 'Potong',
  'tool.xray': 'Rontgen',
  'tool.run': 'Jalankan',
  'tool.pause': 'Jeda',
  'tool.separate': 'Pisahkan bagian',
  'tool.crossSection': 'Penampang',
  'tool.peelAway': 'Kupas lapisan',
  'tool.complete': 'Utuh',
  'tool.removed': '{count} dilepas',
  'tool.sliceAlong': 'Potong sepanjang',
  'tool.flip': 'Balik',
  'tool.focus': 'Fokus',
  'tool.all': 'Semua',
  'tool.outer': 'Luar',
  'tool.core': 'Inti',
  'tool.layer': 'Lapisan {n}',

  'nav.parts': 'Bagian',
  'nav.story': 'Cara kerja',
  'nav.quiz': 'Kuis',

  'part.layer': 'Lapisan {n}',
  'part.position': '{index} dari {total}',
  'part.readMore': 'Selengkapnya',
  'part.less': 'Tampilkan lebih sedikit',
  'part.isolate': 'Tampilkan sendiri',
  'part.onlyThis': 'Hanya bagian ini',
  'part.save': 'Simpan bagian ini',
  'part.unsave': 'Hapus dari bagian tersimpan',
  'part.prev': 'Bagian sebelumnya',
  'part.next': 'Bagian berikutnya',
  'part.close': 'Tutup detail bagian',

  'panel.parts': 'Bagian',
  'panel.story': 'Cara kerja',
  'panel.step': 'Langkah {index} dari {total}',
  'panel.back': 'Kembali',
  'panel.startOver': 'Ulang dari awal',
  'panel.next': 'Lanjut',

  'quiz.question': 'Soal {index} dari {total}',
  'quiz.tapHint': 'Ketuk bagiannya di model. Geser untuk memutar.',
  'quiz.correct': 'Benar.',
  'quiz.notQuite': 'Belum tepat.',
  'quiz.next': 'Lanjut',
  'quiz.seeResult': 'Lihat hasil',
  'quiz.tryAgain': 'Coba lagi',
  'quiz.done': 'Selesai',
  'quiz.leave': 'Keluar dari kuis',
  'quiz.none': 'Belum ada kuis untuk objek ini.',
  'quiz.perfect': 'Semua jawaban benar. Anda memahami objek ini.',
  'quiz.good': 'Bagus. Tinjau kembali bagian yang belum dikuasai.',
  'quiz.poor': 'Pelajari lagi cara kerjanya, lalu coba lagi.',

  'saved.title': 'Tersimpan',
  'saved.empty': 'Belum ada bagian tersimpan. Ketuk ikon penanda pada suatu bagian untuk menyimpannya di sini.',
  'saved.browse': 'Jelajahi objek',
  'saved.remove': 'Hapus dari bagian tersimpan',

  'settings.title': 'Pengaturan',
  'settings.language': 'Bahasa',
  'settings.appearance': 'Tampilan',
  'settings.dark': 'Gelap',
  'settings.light': 'Terang',
  'settings.data': 'Data',
  'settings.clearProgress': 'Hapus progres dan bagian tersimpan',
  'settings.clearHint': 'Tindakan ini menghapus riwayat objek yang dibuka, nilai kuis, dan semua bagian tersimpan. Data hanya tersimpan di perangkat ini.',
  'settings.ads': 'Iklan & pembelian',
  'settings.removeAds': 'Hapus iklan',
  'settings.removeAdsHint': 'Pembelian satu kali. Iklan interstitial tidak akan tampil lagi di perangkat ini.',
  'settings.removeAdsPurchased': 'Iklan sudah dihapus',
  'settings.removeAdsCta': 'Hapus iklan · $4,99',
  'settings.restorePurchases': 'Pulihkan pembelian',
  'settings.purchaseLoading': 'Memeriksa Google Play…',
  'settings.purchaseFailed': 'Pembelian belum selesai. Coba lagi melalui Google Play.',
  'settings.privacy': 'Kebijakan privasi',
  'settings.about': 'Pustaka utama dapat digunakan tanpa internet. Tanpa akun atau pelacakan. Iklan opsional membantu mendukung objek baru.',

  'common.goBack': 'Kembali',
  'common.close': 'Tutup {name}',
};

const TABLES: Record<Locale, Record<Key, string>> = { en, id };

/** Looks up a string and fills `{placeholders}` from `values`. */
export function translate(locale: Locale, key: Key, values?: Record<string, string | number>) {
  const template = TABLES[locale][key] ?? TABLES.en[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}

/**
 * Category names come from content, not from this file, so a category added to
 * a JSON without a string here should read as itself rather than as a raw key.
 */
export function translateCategory(locale: Locale, category: string) {
  const key = `category.${category}` as Key;
  return key in en ? translate(locale, key) : category;
}

export type TranslationKey = Key;
