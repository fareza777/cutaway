import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'marketing', 'store-listing');
const sourceDir = path.join(root, '.shots');

const WIDTH = 1080;
const HEIGHT = 1920;
const CARD = { left: 90, top: 470, width: 900, height: 1240 };

const screenshots = [
  {
    file: '01-discover-library.png',
    source: 'library-5.png',
    cropTop: 110,
    cropHeight: 1800,
    kicker: '01 / DISCOVER',
    title: 'A library of things\nto take apart.',
    subtitle: 'Explore real objects in interactive 3D.',
    accent: '#58C7F0',
  },
  {
    file: '02-explore-in-3d.png',
    source: 'fridge.png',
    cropTop: 100,
    cropHeight: 2050,
    kicker: '02 / EXPLORE',
    title: 'Turn it over.\nSee every angle.',
    subtitle: 'Drag to rotate. Pinch to zoom. Stay curious.',
    accent: '#5ED9D8',
  },
  {
    file: '03-follow-the-motion.png',
    source: 'washer.png',
    cropTop: 100,
    cropHeight: 2050,
    kicker: '03 / UNDERSTAND',
    title: 'Watch the\nmechanism move.',
    subtitle: 'Run a model and see the parts work together.',
    accent: '#7EACFF',
  },
  {
    file: '04-explode-the-object.png',
    source: '09-explode-framed.png',
    cropTop: 100,
    cropHeight: 1660,
    kicker: '04 / DECONSTRUCT',
    title: 'Explode the\nwhole object.',
    subtitle: 'Separate layers until the hidden structure makes sense.',
    accent: '#FF9F45',
  },
  {
    file: '05-see-inside.png',
    source: '10-xray.png',
    cropTop: 100,
    cropHeight: 1850,
    kicker: '05 / LOOK INSIDE',
    title: 'Cut through\nthe surface.',
    subtitle: 'Peel, slice, and use X-ray view to reveal the core.',
    accent: '#FF7C6B',
  },
  {
    file: '06-learn-every-part.png',
    source: '12-parts.png',
    cropTop: 100,
    cropHeight: 2040,
    kicker: '06 / LEARN',
    title: 'Every part has\na job to do.',
    subtitle: 'Tap a component for a clear explanation of its role.',
    accent: '#C88BFF',
  },
  {
    file: '07-follow-the-story.png',
    source: '13-story.png',
    cropTop: 100,
    cropHeight: 2040,
    kicker: '07 / CONNECT THE DOTS',
    title: 'Follow the story\nfrom input to output.',
    subtitle: 'Step through the chain that makes each object work.',
    accent: '#F5C65D',
  },
  {
    file: '08-test-your-understanding.png',
    source: '15-quiz.png',
    cropTop: 800,
    cropHeight: 1300,
    kicker: '08 / MAKE IT STICK',
    title: 'Learn by doing.\nThen test yourself.',
    subtitle: 'Interactive quizzes turn curiosity into understanding.',
    accent: '#FF9F45',
  },
];

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function lines(text) {
  return text.split('\n');
}

function textBlock(text, x, y, size, fill, weight = 600, lineHeight = size * 1.08, family = 'Arial, sans-serif') {
  return lines(text)
    .map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`)
    .join('');
}

function overlaySvg(config) {
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#111923" stop-opacity=".7" />
          <stop offset="1" stop-color="#07090D" stop-opacity="0" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000000" flood-opacity=".45" />
        </filter>
      </defs>
      <circle cx="980" cy="120" r="220" fill="${config.accent}" opacity=".08" />
      <circle cx="980" cy="120" r="148" fill="none" stroke="${config.accent}" stroke-width="2" opacity=".3" />
      <path d="M0 405 H480" stroke="${config.accent}" stroke-width="3" opacity=".65" />
      <rect x="${CARD.left - 8}" y="${CARD.top - 8}" width="${CARD.width + 16}" height="${CARD.height + 16}" rx="44" fill="none" stroke="#101620" stroke-width="16" filter="url(#shadow)" />
      <rect x="${CARD.left}" y="${CARD.top}" width="${CARD.width}" height="${CARD.height}" rx="38" fill="none" stroke="${config.accent}" stroke-opacity=".38" stroke-width="2" />
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)" opacity=".28" />
      ${textBlock(config.kicker, 90, 112, 22, config.accent, 700, 25)}
      ${textBlock(config.title, 90, 190, 68, '#F4F7FA', 700, 75)}
      ${textBlock(config.subtitle, 90, 365, 30, '#A7B4C5', 400, 36)}
      <text x="90" y="1800" fill="#6E7D90" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">CUTAWAY / 3D OBJECTS</text>
      <circle cx="980" cy="1792" r="8" fill="${config.accent}" />
    </svg>
  `);
}

async function buildScreenshot(config) {
  const inputPath = path.join(sourceDir, config.source);
  const source = await sharp(inputPath)
    .extract({ left: 0, top: config.cropTop, width: 1080, height: config.cropHeight })
    .resize({ width: CARD.width, height: CARD.height, fit: 'cover', position: config.position ?? 'top' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: '#07090D',
    },
  })
    .composite([
      { input: source, left: CARD.left, top: CARD.top },
      { input: overlaySvg(config), left: 0, top: 0 },
    ])
    .png()
    .toFile(path.join(outputDir, config.file));
}

async function buildFeatureGraphic() {
  const icon = await sharp(path.join(root, 'assets', 'icon.png')).resize(190, 190).png().toBuffer();
  const background = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#111C2A" />
          <stop offset="1" stop-color="#07090D" />
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#bg)" />
      <circle cx="900" cy="90" r="270" fill="#FF9F45" opacity=".10" />
      <circle cx="900" cy="90" r="180" fill="none" stroke="#FF9F45" stroke-width="2" opacity=".35" />
      <path d="M0 430 H1024" stroke="#FF9F45" stroke-width="3" opacity=".45" />
      <text x="315" y="208" fill="#F4F7FA" font-family="Arial, sans-serif" font-size="58" font-weight="700">Cutaway</text>
      <text x="315" y="272" fill="#A7B4C5" font-family="Arial, sans-serif" font-size="32" font-weight="400">3D Objects</text>
      <text x="315" y="354" fill="#FF9F45" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="3">LOOK INSIDE EVERYTHING</text>
    </svg>
  `);
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: '#07090D' } })
    .composite([{ input: background, left: 0, top: 0 }, { input: icon, left: 84, top: 155 }])
    .png()
    .toFile(path.join(outputDir, 'feature-graphic.png'));
}

await mkdir(outputDir, { recursive: true });
await Promise.all(screenshots.map(buildScreenshot));
await buildFeatureGraphic();
console.log(`Created ${screenshots.length} store screenshots and one feature graphic in ${path.relative(root, outputDir)}.`);
