import Image from "next/image";

/** Short logo reveal shown once per browser session (suppressed on later navigations/reloads by the inline script in the root layout). */
export function Splash() {
  return (
    <div id="splash" className="splash fixed inset-0 z-[100] flex items-center justify-center bg-surface" aria-hidden="true">
      <div className="splash-logo flex items-center gap-4">
        <Image src="/api/brand/logo" unoptimized alt="" width={72} height={72} priority />
        <Image src="/api/brand/wordmark" unoptimized alt="" width={190} height={56} priority className="dark:hidden" style={{ height: 42, width: "auto" }} />
        <Image src="/api/brand/wordmark-light" unoptimized alt="" width={190} height={56} priority className="hidden dark:block" style={{ height: 42, width: "auto" }} />
      </div>
    </div>
  );
}
