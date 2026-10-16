// Renames the supplied resource images, optimises them into public/images,
// and files the design reference screens under design/reference.
// Originals are kept (renamed) in design/original-resources.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'public/resources';
const OUT = 'public/images';
const ORIG = 'design/original-resources';
const REF = 'design/reference';
for (const d of [OUT, ORIG, REF]) fs.mkdirSync(d, { recursive: true });

const photos = {
  'Alpine Sunrise Lake Adventure Banner.png': ['hero-landing', 2000],
  'Alpine Lake Hiker Panorama.png': ['hero-trips', 1800],
  'Bakery cover banner.jpg': ['shop-bakery-cover', 1400],
  'Bakery profile avatar.jpg': ['shop-bakery-avatar', 600],
  'Chocolate truffle cake.jpg': ['product-chocolate-truffle-cake', 800],
  'Custom birthday cake.jpg': ['product-custom-birthday-cake', 800],
  'Festive cookie hamper.jpg': ['product-festive-cookie-hamper', 900],
  'Gift hamper update.jpg': ['update-gift-hamper', 1000],
  'Strawberry cake update.jpg': ['update-strawberry-cake', 1000],
  'andaman.jpg': ['trip-andaman', 1000],
  'goa.jpg': ['trip-goa', 1000],
  'gokarna.jpg': ['trip-gokarna', 1000],
  'haridwar.jpg': ['trip-haridwar', 1000],
  'ladakh.jpg': ['trip-kashmir-great-lakes', 1000],
  'leh ladakh.jpg': ['trip-leh-ladakh', 1000],
  'manali.jpg': ['trip-manali', 1000],
  'rishikesh.jpg': ['trip-rishikesh', 1000],
  'Spiti Valley.jpg': ['trip-spiti-valley', 1000],
  'tawang.jpg': ['trip-tawang', 1000],
  'udaipur.jpg': ['trip-udaipur', 1000],
  'valley of flowers.jpg': ['trip-valley-of-flowers', 1000],
};
const refs = {
  'Nargito_ Real People, Real Places.png': 'ref-landing-desktop.png',
  'Where Journeys and People Connect.png': 'ref-landing-mobile.png',
  'Nargito Himalayan Travel Feed.png': 'ref-feed-mobile.png',
  'Nargito Travel Profile Dashboard.png': 'ref-profile-desktop.png',
  'Nargito Travel Together Trips Dashboard.png': 'ref-trips-desktop.png',
  'Weekend Cycling Loop to Lavasa.png': 'ref-trip-detail-desktop.png',
  'Nargito Mountain Bike Marketplace Chat.png': 'ref-messages-desktop.png',
  'Ananya’s Bakehouse Profile Page.png': 'ref-shop-profile.png',
  'Nargito Admin Dashboard Overview.png': 'ref-admin-dashboard.png',
};

for (const [file, [name, width]] of Object.entries(photos)) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) { console.log('missing', file); continue; }
  await sharp(src).resize({ width, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, name + '.jpg'));
  fs.renameSync(src, path.join(ORIG, name + path.extname(file)));
  console.log('image', file, '->', name + '.jpg');
}
for (const [file, name] of Object.entries(refs)) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) { console.log('missing', file); continue; }
  fs.renameSync(src, path.join(REF, name));
  console.log('ref', file, '->', name);
}
// duplicates "(1)" are byte-identical copies of files handled above
for (const f of fs.readdirSync(SRC)) {
  if (/\(1\)\.png$/.test(f)) { fs.unlinkSync(path.join(SRC, f)); console.log('removed duplicate', f); }
}
console.log('left in resources:', fs.readdirSync(SRC));
