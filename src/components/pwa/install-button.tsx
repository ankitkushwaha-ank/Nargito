"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useT } from "@/i18n/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Only renders when the browser reports the app is installable (beforeinstallprompt). */
export function InstallButton() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const t = useT();
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", h);
    const done = () => setEvt(null);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", h); window.removeEventListener("appinstalled", done); };
  }, []);
  if (!evt) return null;
  return (
    <button type="button" className="btn-secondary" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>
      <Download size={16} aria-hidden />{t("pwa.install")}
    </button>
  );
}
