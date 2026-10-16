import Link from "next/link";
import { Globe2, MapPinned, MessagesSquare, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/shell/prefs-switchers";
import { getT } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const points = [[Globe2, "Share trips and meet fellow travellers"], [MapPinned, "Discover shops and services nearby"], [MessagesSquare, "Chat with sellers about the exact listing"], [ShieldCheck, "Approximate location only. Your privacy first."]] as const;
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* desktop artwork panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/brand/hero" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[78%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/55 to-transparent" aria-hidden />
        <div className="relative"><Logo size={46} /></div>
        <div className="relative max-w-md text-slate-900">
          <h2 className="text-4xl font-extrabold leading-tight">Real People.<br /><span className="text-primary">Real Places.</span></h2>
          <p className="mt-3 text-lg text-slate-600">{t("landing.heroSubtitle")}</p>
          <ul className="mt-8 grid gap-2.5 text-sm font-medium">
            {points.map(([Icon, text]) => <li key={text} className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-black/5 backdrop-blur"><Icon size={18} className="text-primary" aria-hidden />{text}</li>)}
          </ul>
        </div>
        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} Nargito</p>
      </aside>

      <div className="flex min-h-screen flex-col bg-bg">
        {/* mobile banner */}
        <div className="relative h-40 overflow-hidden lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/brand/hero-mobile" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[75%_40%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/30 to-transparent" aria-hidden />
          <div className="relative flex items-center justify-between px-4 pt-4"><Logo size={38} /><ThemeToggle /></div>
        </div>
        <main id="main" className="relative z-10 -mt-8 flex flex-1 flex-col items-center px-4 pb-10 lg:mt-0 lg:justify-center lg:px-10">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl sm:p-8 lg:shadow-lg">{children}</div>
          <p className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted"><Link href="/terms" className="hover:text-primary">Terms</Link><Link href="/privacy" className="hover:text-primary">Privacy</Link><Link href="/help" className="hover:text-primary">Help</Link><Link href="/" className="hover:text-primary">Back to home</Link></p>
        </main>
      </div>
    </div>
  );
}