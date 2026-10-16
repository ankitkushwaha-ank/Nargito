import Link from "next/link";
import { Compass, Store, Plane } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/shell/prefs-switchers";
import { AuthSwitch } from "./auth-switch";

const POINTS = [[Plane, "Find travel companions"], [Store, "Discover local shops & services"], [Compass, "Share your trips and experiences"]] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#f5f8ff] to-[#e8efff] lg:flex dark:from-bg dark:via-bg dark:to-bg">
      {/* desktop: photo panel with headline */}
      <aside className="relative hidden w-[52%] max-w-[860px] shrink-0 overflow-hidden rounded-r-[4.5rem] lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/brand/login-banner" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[60%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/35 to-transparent" aria-hidden />
        <div className="relative flex h-full min-h-screen flex-col p-10 xl:p-14">
          <Logo size={44} />
          <h2 className="mt-16 max-w-[460px] text-[2.6rem] font-extrabold leading-[1.1] tracking-tight text-slate-900 xl:text-5xl">People, journeys and local businesses — <span className="text-primary">all in one place.</span></h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-600">Connect with travellers, explore amazing places, discover local businesses and share your own experiences.</p>
          <ul className="mt-7 space-y-3">
            {POINTS.map(([Icon, text]) => <li key={text} className="flex items-center gap-3 font-medium text-slate-800"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md"><Icon size={20} className="text-primary" aria-hidden /></span>{text}</li>)}
          </ul>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* mobile: banner with brand + tagline */}
        <div className="relative h-56 shrink-0 overflow-hidden lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/brand/login-banner-mobile" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[70%_40%] opacity-90 saturate-[.85]" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/50 to-transparent" aria-hidden />
          <div className="relative flex flex-col items-center gap-2 px-4 pt-5 text-center">
            <div className="flex w-full items-center justify-end"><ThemeToggle /></div>
            <div className="-mt-9"><Logo size={44} /></div>
            <p className="text-sm font-medium text-slate-700">People · Trips · Local Businesses<br />All in one place.</p>
          </div>
        </div>

        <div className="hidden items-center justify-end px-10 pt-6 lg:flex"><AuthSwitch /></div>
        <main id="main" className="relative z-10 -mt-12 flex flex-1 flex-col items-center rounded-t-[2.25rem] bg-surface px-5 pb-10 pt-8 shadow-[0_-12px_30px_rgba(18,80,245,0.08)] lg:mt-0 lg:justify-center lg:rounded-none lg:bg-transparent lg:px-10 lg:pt-4 lg:shadow-none">
          <div className="w-full max-w-[460px] lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-9 lg:shadow-xl">{children}</div>
          <p className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted"><Link href="/terms" className="hover:text-primary">Terms</Link><Link href="/privacy" className="hover:text-primary">Privacy</Link><Link href="/help" className="hover:text-primary">Help</Link><Link href="/" className="hover:text-primary">Back to home</Link></p>
        </main>
      </div>
    </div>
  );
}
