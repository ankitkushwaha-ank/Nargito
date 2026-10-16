import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import en from "@/i18n/en";
import { builtinMessages } from "@/i18n/server";
import { AdminTitle } from "@/components/admin/admin-ui";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Pager } from "@/components/ui/kit";
import { saveTranslationsAction } from "../actions";
import { cn } from "@/lib/cn";

export const metadata = { title: "Translate" };
const PAGE = 40;

export default async function TranslatePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("languages.manage");
  const { code } = await params;
  const sp = await searchParams;
  const db = await useDb();
  const [lang] = await db.select().from(schema.languages).where(eq(schema.languages.code, code));
  if (!lang) notFound();
  const all = await db.select().from(schema.translations);
  const ovr = (loc: string) => new Map(all.filter((o) => o.locale === loc).map((o) => [o.key, o.value]));
  const enOv = ovr("en"); const cur = ovr(code);
  const base = { ...en, ...Object.fromEntries(enOv) } as Record<string, string>;
  const file = builtinMessages[code] ?? {};
  const value = (k: string) => cur.get(k) ?? file[k] ?? "";
  let keys = Object.keys(base).sort();
  const q = (sp.q ?? "").toLowerCase();
  if (q) keys = keys.filter((k) => k.toLowerCase().includes(q) || base[k]!.toLowerCase().includes(q) || value(k).toLowerCase().includes(q));
  if (sp.missing === "1") keys = keys.filter((k) => !value(k));
  const page = Math.max(1, Number(sp.page) || 1);
  const shown = keys.slice((page - 1) * PAGE, page * PAGE);
  const missingTotal = Object.keys(base).filter((k) => !value(k)).length;
  return (
    <>
      <AdminTitle title={`Translate: ${lang.nativeName}`} description={`${missingTotal} of ${Object.keys(base).length} keys are missing. Saved values override the built-in text immediately. Clear a field to remove an override.`} actions={<Link className="btn-secondary" href="/admin/languages">All languages</Link>} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3" role="search"><div className="flex-1"><label className="label" htmlFor="tq">Search keys or text</label><input id="tq" name="q" defaultValue={sp.q} className="input" /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="missing" value="1" defaultChecked={sp.missing === "1"} className="accent-primary" />Missing only</label><button className="btn-primary">Filter</button></form>
      <ActionForm action={saveTranslationsAction} className="space-y-3">
        <input type="hidden" name="locale" value={code} />
        <div className="card divide-y divide-line">
          {shown.map((k) => (
            <div key={k} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div><code className="text-xs text-muted">{k}</code><p className="text-sm">{base[k]}</p></div>
              <div><label className="sr-only" htmlFor={`t-${k}`}>{code} translation for {k}</label><textarea id={`t-${k}`} name={`k:${k}`} defaultValue={value(k)} rows={2} lang={code} className={cn("input", !value(k) && "border-warn")} /><input type="hidden" name={`b:${k}`} value={value(k)} /></div>
            </div>
          ))}
          {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">No keys match.</p>}
        </div>
        <SubmitButton>Save translations</SubmitButton>
      </ActionForm>
      <Pager page={page} hasMore={keys.length > page * PAGE} basePath={`/admin/languages/${code}`} params={{ q: sp.q, missing: sp.missing }} />
    </>
  );
}
