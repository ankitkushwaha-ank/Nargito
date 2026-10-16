import { WifiOff } from "lucide-react";
import { getT } from "@/i18n/server";

export const metadata = { title: "Offline", robots: { index: false } };

export default async function Offline() {
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <WifiOff size={36} className="text-muted" aria-hidden />
      <h1 className="text-2xl">{t("offline.title")}</h1>
      <p className="text-muted">{t("offline.body")}</p>
      <a href="/" className="btn-primary">Try again</a>
    </div>
  );
}
