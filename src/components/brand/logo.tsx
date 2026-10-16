import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Official lock-up: the Nargito app mark (Assets/nargito_logo.png) beside the Nargito wordmark
 * (cropped from the supplied Poppins typography reference). The wordmark switches to white in dark mode.
 */
export function Logo({ size = 36, withWordmark = true, href = "/", className, onDark }: { size?: number; withWordmark?: boolean; href?: string | null; className?: string; onDark?: boolean }) {
  const wmH = Math.round(size * 0.58);
  const wmW = Math.round(wmH * (326 / 96));
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/api/brand/logo" unoptimized alt={withWordmark ? "" : "Nargito"} width={size} height={size} priority className="shrink-0 drop-shadow-sm" />
      {withWordmark && (
        <>
          <Image src={onDark ? "/api/brand/wordmark-light" : "/api/brand/wordmark"} unoptimized alt="Nargito" width={wmW} height={wmH} priority className={cn(!onDark && "dark:hidden")} style={{ height: wmH, width: "auto" }} />
          {!onDark && <Image src="/api/brand/wordmark-light" unoptimized alt="" aria-hidden width={wmW} height={wmH} priority className="hidden dark:block" style={{ height: wmH, width: "auto" }} />}
        </>
      )}
    </span>
  );
  if (href === null) return inner;
  return (
    <Link href={href} aria-label="Nargito home" className="inline-flex rounded-lg">
      {inner}
    </Link>
  );
}
