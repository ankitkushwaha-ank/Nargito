import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError } from "./util";
import { fieldErrors } from "./validation";

export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(400, "Invalid JSON body.");
  }
  const p = schema.safeParse(raw);
  if (!p.success) throw new AppError(400, Object.values(fieldErrors(p.error))[0] ?? "Invalid input.");
  return p.data;
}

export function intParam(req: NextRequest, name: string, def: number, min = 1, max = 100000) {
  const n = Number(req.nextUrl.searchParams.get(name));
  return Number.isFinite(n) && n >= min ? Math.min(max, Math.trunc(n)) : def;
}
