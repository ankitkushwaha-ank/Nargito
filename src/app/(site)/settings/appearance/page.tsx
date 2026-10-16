import { cookies } from "next/headers";
import { requireUserPage } from "@/server/auth/guard";
import { ThemeSwitch } from "@/components/shell/prefs-switchers";
import { getSetting } from "@/server/settings";

export const metadata = { title: "Appearance" };

export default async function Appearance() {
  const u = await requireUserPage("/settings/appearance");
  const jar = await cookies();
  const def = await getSetting<string>("design.defaultTheme");
  const cur = (["light", "dark", "system"].includes(jar.get("nargito_theme")?.value ?? "") ? jar.get("nargito_theme")!.value : u.theme || def) as "light" | "dark" | "system";
  return (
    <section className="card space-y-3 p-5"><h2 className="text-lg">Theme</h2>
      <p className="text-sm text-muted">Choose light, dark, or follow your device. Saved to your account and this browser.</p>
      <ThemeSwitch initial={cur} />
    </section>
  );
}
