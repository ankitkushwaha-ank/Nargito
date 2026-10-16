import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve("Assets", "nargito_logo.png");
const OUT = path.resolve("public", "icons");
mkdirSync(OUT, { recursive: true });

async function png(size: number, file: string) {
  const buf = await sharp(SRC).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(path.join(OUT, file), buf);
  return buf;
}

async function main() {
  const sizes = [16, 32, 48, 64, 128, 192, 256, 512];
  const bufs: Record<number, Buffer> = {};
  for (const s of sizes) bufs[s] = await png(s, `icon-${s}.png`);
  await png(180, "apple-touch-icon.png");
  // maskable icon: logo at ~78% on the brand blue so platform masks never crop the artwork
  const inner = await sharp(SRC).resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const masked = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0A3BD9" } })
    .composite([{ input: inner, gravity: "center" }]).png().toBuffer();
  writeFileSync(path.join(OUT, "icon-maskable-512.png"), masked);

  // favicon.ico with embedded PNG images (16, 32, 48)
  const imgs = [16, 32, 48].map((s) => ({ s, b: bufs[s]! }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
  let offset = 6 + imgs.length * 16;
  const dirs: Buffer[] = [];
  for (const { s, b } of imgs) {
    const d = Buffer.alloc(16);
    d.writeUInt8(s, 0); d.writeUInt8(s, 1); d.writeUInt8(0, 2); d.writeUInt8(0, 3);
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(b.length, 8); d.writeUInt32LE(offset, 12);
    offset += b.length; dirs.push(d);
  }
  writeFileSync(path.resolve("src", "app", "favicon.ico"), Buffer.concat([header, ...dirs, ...imgs.map((i) => i.b)]));
  // brand mark used in-app (next/image)
  mkdirSync(path.resolve("public", "brand"), { recursive: true });
  writeFileSync(path.resolve("public", "brand", "nargito-mark.png"), bufs[256]!);
  console.log("icons generated");
}
main().catch((e) => { console.error(e); process.exit(1); });
