import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import sharp from "sharp";
import { useDb, schema } from "./db";
import { getSettings } from "./settings";
import { AppError } from "./util";
import { logSystem } from "./log";

import { putFile, getFile, removeFile, publicFileUrl, UPLOAD_ROOT } from "./storage";

export { UPLOAD_ROOT };

type Sniffed = { mime: string; ext: string; kind: "image" | "video" | "document" } | null;

/** Detect the real file type from magic bytes. The client-declared type is never trusted. */
export function sniff(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png", kind: "image" };
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return { mime: "image/gif", ext: "gif", kind: "image" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") return { mime: "video/mp4", ext: "mp4", kind: "video" };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: "video/webm", ext: "webm", kind: "video" };
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return { mime: "application/pdf", ext: "pdf", kind: "document" };
  return null;
}

export type UploadResult = { id: string; url: string; thumbUrl: string | null; kind: string; mime: string };

export async function saveUpload(
  userId: string,
  file: File,
  opts: { alt?: string; isPrivate?: boolean; only?: Array<"image" | "video" | "document"> } = {},
): Promise<UploadResult> {
  const s = await getSettings();
  if (!s["upload.enabled"]) throw new AppError(503, "Uploads are temporarily disabled.");
  const buf = Buffer.from(await file.arrayBuffer());
  const t = sniff(buf);
  if (!t) throw new AppError(415, "Unsupported or unrecognised file type.");
  if (opts.only && !opts.only.includes(t.kind)) throw new AppError(415, `Only ${opts.only.join(", ")} files are allowed here.`);
  const allowed = (s[t.kind === "image" ? "upload.allowedImageTypes" : t.kind === "video" ? "upload.allowedVideoTypes" : "upload.allowedDocTypes"] as string[]);
  if (!allowed.includes(t.mime)) throw new AppError(415, `${t.mime} files are not allowed.`);
  if (t.kind === "video" && !s["posts.allowVideo"]) throw new AppError(403, "Video uploads are disabled.");
  if (t.kind === "document" && !s["posts.allowDocuments"]) throw new AppError(403, "Document uploads are disabled.");
  const maxMb = Number(s[t.kind === "image" ? "upload.maxImageMb" : t.kind === "video" ? "upload.maxVideoMb" : "upload.maxDocMb"]);
  if (buf.length > maxMb * 1024 * 1024) throw new AppError(413, `File exceeds the ${maxMb} MB limit.`);

  const db = await useDb();
  const since = new Date(Date.now() - 86400_000);
  const [{ used }] = await db.select({ used: sql<number>`coalesce(sum(${schema.media.size}),0)::int` }).from(schema.media)
    .where(and(eq(schema.media.ownerId, userId), gte(schema.media.createdAt, since)));
  if ((used + buf.length) / 1048576 > Number(s["upload.dailyQuotaMb"])) throw new AppError(429, "Daily upload quota reached.");

  const id = randomUUID();
  const now = new Date();
  const ym = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let out = buf;
  let ext = t.ext;
  let width: number | null = null;
  let height: number | null = null;
  let thumbRel: string | null = null;

  if (t.kind === "image") {
    try {
      const maxDim = Number(s["upload.imageMaxDimension"]);
      const meta = await sharp(buf, { animated: t.mime === "image/gif" }).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      if (t.mime !== "image/gif") {
        // re-encode: drops EXIF/GPS metadata and any appended payloads, applies orientation
        let p = sharp(buf).rotate().resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true });
        p = t.mime === "image/png" ? p.png() : t.mime === "image/webp" ? p.webp({ quality: 85 }) : p.jpeg({ quality: 85, mozjpeg: true });
        out = await p.toBuffer();
        const m2 = await sharp(out).metadata();
        width = m2.width ?? width;
        height = m2.height ?? height;
      }
      if (s["upload.thumbnails"]) {
        const thumb = await sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        thumbRel = await putFile(`${ym}/${id}.thumb.webp`, thumb, "image/webp");
      }
    } catch (e) {
      await logSystem("error", "storage", "saveUpload", "Image processing failed", { error: e instanceof Error ? e.message : "unknown" });
      throw new AppError(422, "That image could not be processed.");
    }
  }
  let rel: string;
  try { rel = await putFile(`${ym}/${id}.${ext}`, out, t.mime); } catch (e) {
    await logSystem("error", "storage", "saveUpload", "Storage write failed", { error: e instanceof Error ? e.message : "unknown" });
    throw new AppError(502, "The file could not be saved to storage. Please try again later.");
  }
  await db.insert(schema.media).values({
    id, ownerId: userId, kind: t.kind, mime: t.mime, size: out.length, path: rel, thumbPath: thumbRel, width, height,
    alt: opts.alt?.slice(0, 300) ?? null, isPrivate: !!opts.isPrivate,
  });
  return { id, url: `/api/media/${id}`, thumbUrl: thumbRel ? `/api/media/${id}?thumb=1` : null, kind: t.kind, mime: t.mime };
}

export async function readMedia(id: string, thumb: boolean) {
  const db = await useDb();
  const [m] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  if (!m) return null;
  const rel = thumb && m.thumbPath ? m.thumbPath : m.path;
  if (!m.isPrivate) {
    const redirect = await publicFileUrl(rel);
    if (redirect) return { m, data: null, mime: m.mime, redirect };
  }
  const data = await getFile(rel);
  if (!data) return null;
  return { m, data, mime: thumb && m.thumbPath ? "image/webp" : m.mime, redirect: null as string | null };
}

export async function deleteMediaFiles(ids: string[]) {
  const db = await useDb();
  for (const id of ids) {
    const [m] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
    if (!m) continue;
    for (const rel of [m.path, m.thumbPath]) if (rel) await removeFile(rel);
    await db.delete(schema.media).where(eq(schema.media.id, id));
  }
}
