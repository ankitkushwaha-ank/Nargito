import { getSetting } from "@/server/settings";
import { LogoView } from "./logo-view";

/** Server component: reads the optional "App name text" setting and renders the logo lock-up. */
export async function Logo(props: { size?: number; withWordmark?: boolean; href?: string | null; className?: string; onDark?: boolean }) {
  let text = "";
  try { text = String(await getSetting("brand.wordmarkText")); } catch { /* no database yet: use the image */ }
  return <LogoView {...props} text={text} />;
}
