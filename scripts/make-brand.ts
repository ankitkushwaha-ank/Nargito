import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Builds the transparent "Nargito" wordmark from the supplied typography reference
 * (Assets/Glossy Blue Connection App Icon and Typography-1.png) in navy (light theme) and white (dark theme).
 */
const SRC = path.resolve("Assets", "Glossy Blue Connection App Icon and Typography-1.png");
const OUT = path.resolve("public", "brand");
mkdirSync(OUT, { recursive: true });

async function build(color: [number, number, number], file: string) {
  const { data, info } = await sharp(SRC).extract({ left: 70, top: 1030, width: 500, height: 180 }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i++) {
    const lum = data[i]!;
    // navy glyphs are dark, the card background is near white
    const a = Math.max(0, Math.min(1, (238 - lum) / (238 - 40)));
    rgba[i * 4] = color[0]; rgba[i * 4 + 1] = color[1]; rgba[i * 4 + 2] = color[2]; rgba[i * 4 + 3] = Math.round(a * 255);
  }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 5 }).resize({ height: 96 }).png({ compressionLevel: 9 }).toFile(path.join(OUT, file));
}

async function main() {
await build([11, 21, 55], "wordmark.png");
await build([243, 246, 252], "wordmark-light.png");
const m = await sharp(path.join(OUT, "wordmark.png")).metadata();
console.log("wordmark", m.width, "x", m.height);
}
main().catch((e) => { console.error(e); process.exit(1); });
