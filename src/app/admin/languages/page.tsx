import Link from "next/link";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import en from "@/i18n/en";
import { builtinMessages } from "@/i18n/server";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { addKeyAction, addLanguageAction, languageAction } from "./actions";

export const metadata = { title: "Languages" };

export default async function LanguagesPage() {
  await adminPage("languages.manage");
  const db = await useDb();
  const [langs, overrides] = await Promise.all([db.select().from(schema.languages).orderBy(schema.languages.code), db.select().from(schema.translations)]);
  const baseKeys = new Set([...Object.keys(en), ...overrides.filter((o) => o.locale === "en").map((o) => o.key)]);
  const missing = (code: string) => {
    const covered = new Set([...Object.keys(builtinMessages[code] ?? {}), ...overrides.filter((o) => o.locale === code).map((o) => o.key)]);
    return [...baseKeys].filter((k) => !covered.has(k)).length;
  };
  return (
    <>
      <AdminTitle title="Languages" description="English and Hindi ship built-in. Add languages, translate keys, and choose the default and fallback. Missing translations fall back to the fallback language, then English." />
      <Table head={["Language", "Code", "Status", "Fallback", "Missing keys", "Actions"]}>
        {langs.map((l) => { const miss = missing(l.code); return (
          <tr key={l.code}>
            <Td><b>{l.nativeName}</b> <span className="text-muted">({l.name})</span></Td><Td><code>{l.code}</code></Td>
            <Td><div className="flex gap-1">{l.enabled ? <Badge tone="success">enabled</Badge> : <Badge tone="muted">disabled</Badge>}{l.isDefault && <Badge>default</Badge>}</div></Td>
            <Td><form action={languageAction} className="flex items-center gap-1"><input type="hidden" name="code" value={l.code} /><input type="hidden" name="intent" value="fallback" /><label className="sr-only" htmlFor={`fb-${l.code}`}>Fallback for {l.name}</label><select id={`fb-${l.code}`} name="fallback" defaultValue={l.fallback ?? ""} className="input !w-auto !py-1"><option value="">none</option>{langs.filter((x) => x.code !== l.code).map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</select><button className="btn-ghost !min-h-[30px]">Set</button></form></Td>
            <Td>{miss === 0 ? <Badge tone="success">complete</Badge> : <Badge tone="warn">{miss} missing</Badge>}</Td>
            <Td><div className="flex flex-wrap gap-1">
              <Link className="btn-secondary !min-h-[30px]" href={`/admin/languages/${l.code}`}>Translate</Link>
              <form action={languageAction}><input type="hidden" name="code" value={l.code} />{l.enabled ? (!l.isDefault && l.code !== "en" && <button name="intent" value="disable" className="btn-ghost !min-h-[30px]">Disable</button>) : <button name="intent" value="enable" className="btn-ghost !min-h-[30px]">Enable</button>}{l.enabled && !l.isDefault && <button name="intent" value="default" className="btn-ghost !min-h-[30px]">Make default</button>}</form>
            </div></Td>
          </tr>
        ); })}
      </Table>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ActionForm action={addLanguageAction} className="card space-y-3 p-5" resetOnSuccess><h2 className="text-lg">Add a language</h2>
          <Field label="Code" name="code" required placeholder="fr or pt-BR" maxLength={8} /><Field label="Name (English)" name="name" required maxLength={60} /><Field label="Native name" name="nativeName" maxLength={60} placeholder="Français" />
          <SubmitButton>Add language</SubmitButton></ActionForm>
        <ActionForm action={addKeyAction} className="card space-y-3 p-5" resetOnSuccess><h2 className="text-lg">Add or override a translation key</h2>
          <Field label="Key" name="key" required placeholder="custom.welcomeBanner" /><Field label="English text" name="en" as="textarea" rows={2} required /><Field label="Hindi text (optional)" name="hi" as="textarea" rows={2} />
          <SubmitButton>Save key</SubmitButton></ActionForm>
      </div>
    </>
  );
}
