import type { SessionUser } from "@/server/auth/session";
import { LeftSidebar } from "./left-sidebar";
import { RightSidebar } from "./right-sidebar";
import { cn } from "@/lib/cn";

/** Signed-in layout: profile/navigation card, content, and a discovery rail. Guests get content + rail. */
export function ThreeColumn({ user, children, right = true }: { user: SessionUser | null; children: React.ReactNode; right?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-shell px-4 py-5 pb-32 sm:px-6 md:pb-10">
      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-6", user ? (right ? "lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_330px]" : "lg:grid-cols-[270px_minmax(0,1fr)]") : right ? "xl:grid-cols-[minmax(0,1fr)_330px]" : "")}>
        {user && <aside className="hidden lg:block"><div className="sticky top-[88px] max-h-[calc(100vh-100px)] overflow-y-auto pb-4 no-scrollbar"><LeftSidebar user={user} /></div></aside>}
        <div className="min-w-0 space-y-4">{children}</div>
        {right && <aside className="hidden xl:block"><div className="sticky top-[88px] max-h-[calc(100vh-100px)] space-y-4 overflow-y-auto pb-4 no-scrollbar"><RightSidebar userId={user?.id ?? null} /></div></aside>}
      </div>
    </div>
  );
}

export function Container({ children, className, width = "max-w-5xl" }: { children: React.ReactNode; className?: string; width?: string }) {
  return <div className={cn("mx-auto w-full min-w-0 px-4 py-6 pb-32 sm:px-6 md:pb-10", width, className)}>{children}</div>;
}
