import { z } from "zod";
import { fail } from "./util";

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Parse FormData / plain objects with a zod schema and return a typed result or a ready-to-return failure. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown):
  | { ok: true; data: z.infer<S> }
  | { ok: false; result: ReturnType<typeof fail> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fe = fieldErrors(parsed.error);
  return { ok: false, result: fail(Object.values(fe)[0] ?? "Invalid input.", fe) };
}

export function formToObject(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    if (k in o) o[k] = ([] as unknown[]).concat(o[k], v);
    else o[k] = v;
  }
  return o;
}

export const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
export const optStr = (max: number) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
export const reqStr = (min: number, max: number) => z.string().trim().min(min).max(max);
export const optUrl = z.preprocess(emptyToUndef, z.string().trim().max(300).url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL").optional());
export const optNum = z.preprocess(emptyToUndef, z.coerce.number().min(0).max(1_000_000_000).optional());
export const optDate = z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional());
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
