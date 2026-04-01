import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outputDir = path.join(root, 'store-assets', 'google-play');
const screenshotDir = path.join(outputDir, 'phone-screenshots');
const tablet7Dir = path.join(outputDir, 'tablet-7-inch-screenshots');
const tablet10Dir = path.join(outputDir, 'tablet-10-inch-screenshots');

const iconBuffer = await fs.readFile(path.join(root, 'assets', 'icon.png'));
const iconDataUri = `data:image/png;base64,${iconBuffer.toString('base64')}`;

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function mulberry32(seed) {
  let t = seed;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createStars(width, height, seed, count) {
  const rand = mulberry32(seed);
  const stars = [];
  for (let index = 0; index < count; index += 1) {
    const x = Math.round(rand() * width);
    const y = Math.round(rand() * height);
    const radius = 0.8 + rand() * 2.2;
    const opacity = 0.18 + rand() * 0.72;
    stars.push(
      `<circle cx="${x}" cy="${y}" r="${radius.toFixed(2)}" fill="white" opacity="${opacity.toFixed(2)}" />`
    );
  }
  return stars.join('');
}

function backgroundSvg(width, height, seed) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glowA" cx="18%" cy="14%" r="52%">
          <stop offset="0%" stop-color="#7287ff" stop-opacity="0.26" />
          <stop offset="100%" stop-color="#7287ff" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="82%" cy="18%" r="34%">
          <stop offset="0%" stop-color="#61c2ff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#61c2ff" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowC" cx="50%" cy="50%" r="26%">
          <stop offset="0%" stop-color="#6673ea" stop-opacity="0.10" />
          <stop offset="100%" stop-color="#6673ea" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#090c15" />
      <rect width="${width}" height="${height}" fill="url(#glowA)" />
      <rect width="${width}" height="${height}" fill="url(#glowB)" />
      <rect width="${width}" height="${height}" fill="url(#glowC)" />
      ${createStars(width, height, seed, Math.max(36, Math.round((width * height) / 42000)))}
    </svg>
  `;
}

function logoImage(x, y, size) {
  return `<image href="${iconDataUri}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`;
}

function featureGraphicSvg() {
  const width = 1024;
  const height = 500;
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${backgroundSvg(width, height, 11).replace('<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">', '').replace('</svg>', '')}
      <rect x="40" y="40" width="944" height="420" rx="36" fill="rgba(11,17,31,0.76)" stroke="rgba(190,210,255,0.11)" />
      <ellipse cx="780" cy="150" rx="220" ry="120" fill="rgba(104,120,255,0.10)" />
      ${logoImage(90, 100, 128)}
      <text x="90" y="286" fill="#f7f9ff" font-size="56" font-family="Georgia, serif" font-weight="700">Keep people in your orbit.</text>
      <text x="90" y="334" fill="#aeb9d6" font-size="24" font-family="Georgia, serif">Private personal CRM for remembering context and follow-ups.</text>
      <rect x="90" y="370" width="224" height="50" rx="25" fill="rgba(255,255,255,0.06)" stroke="rgba(190,210,255,0.16)" />
      <text x="122" y="402" fill="#e9efff" font-size="21" font-family="Georgia, serif" font-weight="700">Coming soon</text>
      <text x="640" y="400" fill="#d7e1ff" font-size="30" font-family="Georgia, serif" font-weight="700">Orbit</text>
    </svg>
  `;
}

function phoneScreenshotSvg({ title, body, bullets, accent, seed, kicker }) {
  const width = 1080;
  const height = 1920;
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${backgroundSvg(width, height, seed).replace('<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">', '').replace('</svg>', '')}
      <rect x="48" y="48" width="984" height="1824" rx="52" fill="rgba(8,13,24,0.76)" stroke="rgba(197,215,255,0.10)" />
      <rect x="86" y="86" width="908" height="1748" rx="42" fill="rgba(10,16,30,0.56)" stroke="rgba(255,255,255,0.03)" />
      <rect x="122" y="138" width="240" height="54" rx="27" fill="rgba(255,255,255,0.06)" stroke="rgba(190,210,255,0.12)" />
      <text x="162" y="174" fill="#e5ecff" font-size="24" font-family="Georgia, serif" font-weight="700">${escapeXml(kicker)}</text>
      ${logoImage(122, 244, 164)}
      <text x="122" y="524" fill="#f7f9ff" font-size="88" font-family="Georgia, serif" font-weight="700">${escapeXml(title)}</text>
      <text x="122" y="592" fill="#acb8d8" font-size="34" font-family="Georgia, serif">${escapeXml(body)}</text>
      <rect x="122" y="690" width="836" height="806" rx="40" fill="rgba(14,22,39,0.94)" stroke="rgba(190,210,255,0.10)" />
      <circle cx="206" cy="826" r="18" fill="${accent}" opacity="0.95" />
      <text x="250" y="838" fill="#f3f7ff" font-size="40" font-family="Georgia, serif" font-weight="700">${escapeXml(bullets[0])}</text>
      <line x1="188" y1="900" x2="892" y2="900" stroke="rgba(190,210,255,0.10)" />
      <circle cx="206" cy="1046" r="18" fill="${accent}" opacity="0.78" />
      <text x="250" y="1058" fill="#f3f7ff" font-size="40" font-family="Georgia, serif" font-weight="700">${escapeXml(bullets[1])}</text>
      <line x1="188" y1="1120" x2="892" y2="1120" stroke="rgba(190,210,255,0.10)" />
      <circle cx="206" cy="1266" r="18" fill="${accent}" opacity="0.64" />
      <text x="250" y="1278" fill="#f3f7ff" font-size="40" font-family="Georgia, serif" font-weight="700">${escapeXml(bullets[2])}</text>
      <rect x="122" y="1542" width="836" height="182" rx="34" fill="rgba(255,255,255,0.04)" />
      <text x="170" y="1622" fill="#e8eeff" font-size="30" font-family="Georgia, serif">Orbit</text>
      <text x="170" y="1670" fill="#9eaecd" font-size="26" font-family="Georgia, serif">Keep people in your orbit.</text>
      <text x="170" y="1712" fill="#9eaecd" font-size="26" font-family="Georgia, serif">Coming soon to Play Store and App Store.</text>
    </svg>
  `;
}

function tabletScreenshotSvg({ title, body, bullets, accent, seed, kicker, width, height }) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${backgroundSvg(width, height, seed).replace(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`, '').replace('</svg>', '')}
      <rect x="36" y="36" width="${width - 72}" height="${height - 72}" rx="40" fill="rgba(8,13,24,0.76)" stroke="rgba(197,215,255,0.10)" />
      <rect x="72" y="72" width="${width - 144}" height="${height - 144}" rx="30" fill="rgba(10,16,30,0.56)" stroke="rgba(255,255,255,0.03)" />
      <rect x="110" y="108" width="220" height="46" rx="23" fill="rgba(255,255,255,0.06)" stroke="rgba(190,210,255,0.12)" />
      <text x="146" y="139" fill="#e5ecff" font-size="20" font-family="Georgia, serif" font-weight="700">${escapeXml(kicker)}</text>
      ${logoImage(width - 320, 110, 180)}
      <text x="110" y="260" fill="#f7f9ff" font-size="72" font-family="Georgia, serif" font-weight="700">${escapeXml(title)}</text>
      <text x="110" y="318" fill="#acb8d8" font-size="28" font-family="Georgia, serif">${escapeXml(body)}</text>
      <rect x="110" y="392" width="${width - 220}" height="${height - 520}" rx="28" fill="rgba(14,22,39,0.94)" stroke="rgba(190,210,255,0.10)" />
      <circle cx="158" cy="486" r="14" fill="${accent}" opacity="0.95" />
      <text x="194" y="496" fill="#f3f7ff" font-size="34" font-family="Georgia, serif" font-weight="700">${escapeXml(bullets[0])}</text>
      <line x1="144" y1="548" x2="${width - 144}" y2="548" stroke="rgba(190,210,255,0.10)" />
      <circle cx="158" cy="642" r="14" fill="${accent}" opacity="0.78" />
      <text x="194" y="652" fill="#f3f7ff" font-size="34" font-family="Georgia, serif" font-weight="700">${escapeXml(bullets[1])}</text>
      <line x1="144" y1="704" x2="${width - 144}" y2="704" stroke="rgba(190,210,255,0.10)" />
      <circle cx="158" cy="798" r="14" fill="${accent}" opacity="0.64" />
      <text x="194" y="808" fill="#f3f7ff" font-size="34" font-family="Georgia, serif" font-weight="700">${escapeXml(bullets[2])}</text>
      <rect x="110" y="${height - 176}" width="${width - 220}" height="88" rx="24" fill="rgba(255,255,255,0.04)" />
      <text x="146" y="${height - 122}" fill="#e8eeff" font-size="24" font-family="Georgia, serif">Orbit</text>
      <text x="${width - 408}" y="${height - 122}" fill="#9eaecd" font-size="22" font-family="Georgia, serif">Coming soon to Play Store and App Store.</text>
    </svg>
  `;
}

async function writePng(filePath, svg, width, height) {
  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toFile(filePath);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(screenshotDir, { recursive: true });
await fs.mkdir(tablet7Dir, { recursive: true });
await fs.mkdir(tablet10Dir, { recursive: true });

const iconSvg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    ${logoImage(0, 0, 512)}
  </svg>
`;

const phoneScreenshots = [
  {
    name: '01-keep-people-in-your-orbit.png',
    kicker: 'What it is',
    title: 'Keep people in your orbit.',
    body: 'A personal CRM built for real relationships.',
    bullets: [
      'Remember people, context, and conversations',
      'Keep useful notes in one place',
      'Track who needs a follow-up next',
    ],
    accent: '#8b80ff',
    seed: 101,
  },
  {
    name: '02-save-context-fast.png',
    kicker: 'How it works',
    title: 'Save context fast.',
    body: 'Capture details right after you meet someone.',
    bullets: [
      'Add a person in seconds',
      'Write quick notes after conversations',
      'Stay organized without extra noise',
    ],
    accent: '#65a8ff',
    seed: 202,
  },
  {
    name: '03-follow-up-with-intention.png',
    kicker: 'Stay thoughtful',
    title: 'Follow up with intention.',
    body: 'Keep important relationships from slipping away.',
    bullets: [
      'Set clear follow-up reminders',
      'See who needs attention next',
      'Build consistency without extra noise',
    ],
    accent: '#9d88ff',
    seed: 303,
  },
  {
    name: '04-private-by-default.png',
    kicker: 'Privacy',
    title: 'Private by default.',
    body: 'Orbit is designed to feel calm, simple, and local-first.',
    bullets: [
      'No account required',
      'No ads or social feed',
      'Designed to keep your data on-device',
    ],
    accent: '#7ea4ff',
    seed: 404,
  },
];

const tabletScreenshots = [
  {
    name: '01-what-orbit-does.png',
    kicker: 'What it is',
    title: 'Keep people in your orbit.',
    body: 'A personal CRM built for real relationships.',
    bullets: [
      'Remember people, context, and conversations',
      'Keep useful notes in one place',
      'Track who needs a follow-up next',
    ],
    accent: '#8b80ff',
    seed: 505,
  },
  {
    name: '02-how-orbit-works.png',
    kicker: 'How it works',
    title: 'Save context fast.',
    body: 'Capture details right after you meet someone.',
    bullets: [
      'Add a person in seconds',
      'Write quick notes after conversations',
      'Stay organized without extra noise',
    ],
    accent: '#65a8ff',
    seed: 606,
  },
];

await writePng(path.join(outputDir, 'icon-512.png'), iconSvg, 512, 512);
await writePng(path.join(outputDir, 'feature-graphic-1024x500.png'), featureGraphicSvg(), 1024, 500);

for (const screenshot of phoneScreenshots) {
  await writePng(
    path.join(screenshotDir, screenshot.name),
    phoneScreenshotSvg(screenshot),
    1080,
    1920
  );
}

for (const screenshot of tabletScreenshots) {
  await writePng(
    path.join(tablet7Dir, screenshot.name),
    tabletScreenshotSvg({ ...screenshot, width: 1600, height: 900 }),
    1600,
    900
  );
  await writePng(
    path.join(tablet10Dir, screenshot.name),
    tabletScreenshotSvg({ ...screenshot, width: 1920, height: 1080 }),
    1920,
    1080
  );
}

console.log(`Generated store assets in ${outputDir}`);
