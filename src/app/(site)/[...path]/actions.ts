"use server";
import { z } from "zod";
import { run, type SAResult } from "@/server/action";
import { enforceRateLimit } from "@/server/ratelimit";
import { formToObject, parseInput } from "@/server/validation";
import { useDb, schema } from "@/server/db";
import { ok } from "@/server/util";

const schemaC = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(254),
  subject: z.string().trim().min(3, "Enter a subject.").max(120),
  message: z.string().trim().min(10, "Please write a few more words.").max(4000),
  website: z.string().max(0).optional(), // honeypot
});

export async function contactAction(_: SAResult, fd: FormData): Promise<SAResult> {
  return run(async () => {
    await enforceRateLimit("contact", 5, 3600);
    const p = parseInput(schemaC, formToObject(fd));
    if (!p.ok) return p.result;
    const { website: _w, ...d } = p.data;
    void _w;
    const db = await useDb();
    await db.insert(schema.contactMessages).values(d);
    return ok(undefined, "Thanks! Your message has been received. We'll reply by email.");
  });
}
