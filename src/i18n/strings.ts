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
  'library.footer': '{count} objects · works offline · no ads',
  'library.parts': '{count} parts',
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
  'settings.about': 'Everything works offline. No account, no ads, no tracking.',

  'common.goBack': 'Go back',
  'common.close': 'Close {name}',
};

type Key = keyof typeof en;

const id: Record<Key, string> = {
  // Written in Indonesian rather than translated from the English above. The
  // first pass read as terjemahan: English sentence rhythm, stacked subordinate
  // clauses, and "ia" used over and over for inanimate things, which is stiff
  // and faintly literary in a way no interface should be. Short sentences, the
  // noun repeated or the subject dropped, and everyday words.
  'app.tagline': 'Bongkar isinya. Pahami cara kerjanya.',
  'library.footer': '{count} objek · bisa dipakai offline · tanpa iklan',
  'library.parts': '{count} bagian',
  'library.all': 'Semua',
  'library.saved': 'Bagian tersimpan',
  'library.settings': 'Pengaturan',

  'category.Electronics': 'Elektronik',
  'category.Aerospace': 'Dirgantara',
  'category.Mechanical': 'Mekanik',
  'category.Appliances': 'Peralatan Rumah',
  'category.Anatomy': 'Anatomi',
  'category.Music': 'Musik',

  'welcome.1.kicker': 'Putar dulu',
  'welcome.1.title': 'Geser untuk memutar.\nCubit untuk memperbesar.',
  'welcome.1.body':
    'Semua objek di sini model 3D betulan. Putar sesuka Anda, seperti memungut sesuatu lalu membolak-baliknya di tangan.',
  'welcome.2.kicker': 'Penasaran itu apa?',
  'welcome.2.title': 'Ketuk bagian mana pun\nuntuk tahu fungsinya.',
  'welcome.2.body':
    'Ketuk salah satu bagian, atau titik penandanya. Bagian lain langsung meredup supaya yang Anda pilih menonjol, lengkap dengan penjelasan kenapa bagian itu ada di sana.',
  'welcome.3.kicker': 'Lihat ke dalam',
  'welcome.3.title': 'Uraikan, kupas,\nbelah isinya.',
  'welcome.3.body':
    'Pisahkan semua bagiannya, kupas lapisan luar satu per satu, atau belah objeknya jadi dua. Setelah itu jalankan mekanismenya dan lihat sendiri cara kerjanya.',
  'welcome.4.kicker': 'Satu lagi',
  'welcome.4.title': 'Pilih\nbahasa Anda.',
  'welcome.4.body': 'Bisa diganti kapan saja lewat Pengaturan.',
  'welcome.next': 'Lanjut',
  'welcome.skip': 'Lewati',
  'welcome.start': 'Mulai jelajahi',

  'explorer.back': 'Kembali ke koleksi',
  'explorer.autoRotate': 'Putar otomatis',
  'explorer.reset': 'Kembalikan tampilan',
  'explorer.loading': 'Memuat {name}…',
  'explorer.notFound': 'Objek itu tidak ada di koleksi.',

  'tool.explode': 'Uraikan',
  'tool.peel': 'Kupas',
  'tool.cut': 'Belah',
  // "Tembus" on its own reads as an unfinished word. Everyone here knows what
  // a rontgen is.
  'tool.xray': 'Rontgen',
  'tool.run': 'Jalankan',
  'tool.pause': 'Jeda',
  'tool.separate': 'Pisahkan bagian',
  'tool.crossSection': 'Potongan melintang',
  'tool.peelAway': 'Kupas lapisan',
  'tool.complete': 'Utuh',
  'tool.removed': '{count} dilepas',
  'tool.sliceAlong': 'Belah di sumbu',
  'tool.flip': 'Balik',
  'tool.focus': 'Fokus',
  'tool.all': 'Semua',
  'tool.outer': 'Luar',
  'tool.core': 'Inti',
  'tool.layer': 'Lapis {n}',

  'nav.parts': 'Bagian',
  'nav.story': 'Cara kerja',
  'nav.quiz': 'Kuis',

  'part.layer': 'Lapis {n}',
  'part.position': '{index} dari {total}',
  'part.readMore': 'Selengkapnya',
  'part.less': 'Ringkas',
  'part.isolate': 'Sendirikan',
  'part.onlyThis': 'Hanya ini',
  'part.save': 'Simpan bagian ini',
  'part.unsave': 'Hapus dari simpanan',
  'part.prev': 'Bagian sebelumnya',
  'part.next': 'Bagian berikutnya',
  'part.close': 'Tutup detail bagian',

  'panel.parts': 'Daftar Bagian',
  'panel.story': 'Cara Kerja',
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
  'quiz.perfect': 'Semua benar. Anda sudah paham objek ini.',
  'quiz.good': 'Lumayan. Tengok lagi bagian yang terlewat.',
  'quiz.poor': 'Baca lagi bagian cara kerjanya, lalu coba sekali lagi.',

  'saved.title': 'Tersimpan',
  'saved.empty': 'Belum ada yang disimpan. Ketuk ikon penanda di bagian mana pun, dan bagian itu muncul di sini.',
  'saved.browse': 'Lihat koleksi',
  'saved.remove': 'Hapus dari simpanan',

  'settings.title': 'Pengaturan',
  'settings.language': 'Bahasa',
  'settings.appearance': 'Tampilan',
  'settings.dark': 'Gelap',
  'settings.light': 'Terang',
  'settings.data': 'Data',
  'settings.clearProgress': 'Hapus progres dan bagian tersimpan',
  'settings.clearHint': 'Menghapus catatan objek yang pernah dibuka, nilai kuis, dan bagian yang Anda simpan. Semua data itu memang tidak pernah keluar dari perangkat ini.',
  'settings.about': 'Semuanya berjalan offline. Tanpa akun, tanpa iklan, tanpa pelacakan.',

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
