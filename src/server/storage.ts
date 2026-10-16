import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { useDb, schema } from "./db";
import { invalidateSettings } from "./settings";

/**
 * Media storage. "local" writes under UPLOAD_DIR. "r2" uses Cloudflare R2 (S3 compatible).
 * Settings are edited at /admin/storage and kept in site_settings under the key `storage.config`.
 * Files saved to R2 are marked in the media row by a `r2:` prefix on `path`, so old local files keep working
 * after switching provider.
 */
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? ".data/uploads");
export const R2_PREFIX = "r2:";
const KEY = "storage.config";

export type StorageConfig = {
  provider: "local" | "r2";
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string; // decrypted, server only
  bucket: string;
  publicUrl: string;
  prefix: string;
};

const secretKey = () => createHash("sha256").update(process.env.APP_SECRET || process.env.CRON_SECRET || process.env.DATABASE_URL || "nargito-storage").digest();
function enc(plain: string) {
  if (!plain) return "";
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${body.toString("base64")}`;
}
function dec(s: string) {
  if (!s) return "";
  try {
    const [iv, tag, body] = s.split(".").map((x) => Buffer.from(x, "base64"));
    const d = createDecipheriv("aes-256-gcm", secretKey(), iv!);
    d.setAuthTag(tag!);
    return Buffer.concat([d.update(body!), d.final()]).toString("utf8");
  } catch { return ""; }
}

type Stored = Omit<StorageConfig, "secretAccessKey"> & { secretEnc: string };
const g = globalThis as unknown as { __storageCfg?: { at: number; cfg: StorageConfig }; __s3?: { sig: string; client: import("@aws-sdk/client-s3").S3Client } };

export async function getStorageConfig(): Promise<StorageConfig> {
  const c = g.__storageCfg;
  if (c && Date.now() - c.at < 5000) return c.cfg;
  let st: Partial<Stored> = {};
  try {
    const db = await useDb();
    const [row] = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, KEY)).limit(1);
    st = (row?.value as Partial<Stored>) ?? {};
  } catch { /* database not ready: fall back to env */ }
  const e = process.env;
  const cfg: StorageConfig = {
    provider: (st.provider ?? (e.STORAGE_PROVIDER === "r2" ? "r2" : "local")) as "local" | "r2",
    accountId: st.accountId ?? e.R2_ACCOUNT_ID ?? "",
    accessKeyId: st.accessKeyId ?? e.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: st.secretEnc ? dec(st.secretEnc) : e.R2_SECRET_ACCESS_KEY ?? "",
    bucket: st.bucket ?? e.R2_BUCKET ?? "",
    publicUrl: (st.publicUrl ?? e.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
    prefix: (st.prefix ?? "").replace(/^\/+|\/+$/g, ""),
  };
  g.__storageCfg = { at: Date.now(), cfg };
  return cfg;
}

/** Saves settings. A blank secret keeps the stored one. */
export async function saveStorageConfig(actorId: string, input: Partial<StorageConfig>) {
  const cur = await getStorageConfig();
  const next: StorageConfig = {
    provider: input.provider === "r2" ? "r2" : "local",
    accountId: (input.accountId ?? "").trim(),
    accessKeyId: (input.accessKeyId ?? "").trim(),
    secretAccessKey: input.secretAccessKey?.trim() ? input.secretAccessKey.trim() : cur.secretAccessKey,
    bucket: (input.bucket ?? "").trim(),
    publicUrl: (input.publicUrl ?? "").trim().replace(/\/$/, ""),
    prefix: (input.prefix ?? "").trim().replace(/^\/+|\/+$/g, ""),
  };
  const { secretAccessKey, ...rest } = next;
  const value = { ...rest, secretEnc: enc(secretAccessKey) };
  const db = await useDb();
  await db.insert(schema.siteSettings).values({ key: KEY, value: value as never, updatedBy: actorId })
    .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value: value as never, updatedBy: actorId, updatedAt: new Date() } });
  g.__storageCfg = undefined; g.__s3 = undefined;
  invalidateSettings();
  return next;
}

export const r2Ready = (c: StorageConfig) => !!(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket);

async function s3(c: StorageConfig) {
  const sig = [c.accountId, c.accessKeyId, c.secretAccessKey, c.bucket].join("|");
  if (g.__s3?.sig === sig) return g.__s3.client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    forcePathStyle: true,
  });
  g.__s3 = { sig, client };
  return client;
}
const rkey = (c: StorageConfig, rel: string) => (c.prefix ? `${c.prefix}/` : "") + rel.replace(/\\/g, "/");

/** Writes a file with the active provider. Returns the value to store in media.path. */
export async function putFile(rel: string, data: Buffer, mime: string): Promise<string> {
  const c = await getStorageConfig();
  if (c.provider === "r2") {
    if (!r2Ready(c)) throw new Error("Cloudflare R2 is selected but not fully configured. Open Admin > Storage.");
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3(c)).send(new PutObjectCommand({ Bucket: c.bucket, Key: rkey(c, rel), Body: data, ContentType: mime, CacheControl: "public, max-age=31536000, immutable" }));
    return R2_PREFIX + rel.replace(/\\/g, "/");
  }
  const abs = path.resolve(UPLOAD_ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
  return rel;
}

export async function getFile(stored: string): Promise<Buffer | null> {
  try {
    if (stored.startsWith(R2_PREFIX)) {
      const c = await getStorageConfig();
      if (!r2Ready(c)) return null;
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const r = await (await s3(c)).send(new GetObjectCommand({ Bucket: c.bucket, Key: rkey(c, stored.slice(R2_PREFIX.length)) }));
      return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
    }
    const abs = path.resolve(UPLOAD_ROOT, stored);
    if (!abs.startsWith(UPLOAD_ROOT)) return null;
    return await fs.readFile(abs);
  } catch { return null; }
}

export async function removeFile(stored: string) {
  try {
    if (stored.startsWith(R2_PREFIX)) {
      const c = await getStorageConfig();
      if (!r2Ready(c)) return;
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await (await s3(c)).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: rkey(c, stored.slice(R2_PREFIX.length)) }));
    } else {
      const abs = path.resolve(UPLOAD_ROOT, stored);
      if (abs.startsWith(UPLOAD_ROOT)) await fs.rm(abs, { force: true });
    }
  } catch { /* ignore */ }
}

/** Public CDN URL for an R2 file, when a public URL is configured. */
export async function publicFileUrl(stored: string): Promise<string | null> {
  if (!stored.startsWith(R2_PREFIX)) return null;
  const c = await getStorageConfig();
  if (!c.publicUrl) return null;
  return `${c.publicUrl}/${rkey(c, stored.slice(R2_PREFIX.length))}`;
}

/** Writes, reads and deletes a tiny object using the given (unsaved) settings. */
export async function testStorage(input: StorageConfig): Promise<{ ok: boolean; message: string }> {
  try {
    if (input.provider === "local") {
      await fs.mkdir(UPLOAD_ROOT, { recursive: true });
      const p = path.join(UPLOAD_ROOT, `.test-${Date.now()}`);
      await fs.writeFile(p, "ok"); await fs.readFile(p); await fs.rm(p);
      return { ok: true, message: `Local folder is writable: ${UPLOAD_ROOT}` };
    }
    if (!r2Ready(input)) return { ok: false, message: "Fill in Account ID, Access Key ID, Secret Access Key and Bucket first." };
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: "auto", endpoint: `https://${input.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: input.accessKeyId, secretAccessKey: input.secretAccessKey }, forcePathStyle: true });
    const Key = rkey(input, `.nargito-test-${Date.now()}.txt`);
    await client.send(new PutObjectCommand({ Bucket: input.bucket, Key, Body: Buffer.from("ok"), ContentType: "text/plain" }));
    await client.send(new GetObjectCommand({ Bucket: input.bucket, Key }));
    await client.send(new DeleteObjectCommand({ Bucket: input.bucket, Key }));
    return { ok: true, message: `Connected. Wrote, read and deleted a test file in bucket "${input.bucket}".` };
  } catch (e) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : "unknown error"}` };
  }
}
