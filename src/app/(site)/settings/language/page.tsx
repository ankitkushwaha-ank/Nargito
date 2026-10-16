import { requireUserPage } from "@/server/auth/guard";
import { enabledLocales } from "@/i18n/server";
import { LocaleSwitch } from "@/components/shell/prefs-switchers";

export const metadata = { title: "Language" };

export default async function LanguageSettings() {
  await requireUserPage("/settings/language");
  const locales = await enabledLocales();
  return (
    <section className="card space-y-3 p-5"><h2 className="text-lg">Language</h2>
      <p className="text-sm text-muted">Choose the language for menus, buttons and messages. Dates and numbers follow the selected language.</p>
      <LocaleSwitch locales={locales} />
      <ul className="text-sm text-muted">{locales.map((l) => <li key={l.code}>{l.nativeName} ({l.name})</li>)}</ul>
    </section>
  );
}
