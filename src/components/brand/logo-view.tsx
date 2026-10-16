import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Logo lock-up: app mark plus the name. The name is the wordmark image, or plain text when the admin sets
 * "App name text" (Admin > Website information). Text uses the same height and bold weight as the image.
 */
export function LogoView({ size = 36, withWordmark = true, href = "/", className, onDark, text = "" }: { size?: number; withWordmark?: boolean; href?: string | null; className?: string; onDark?: boolean; text?: string }) {
  const wmH = Math.round(size * 0.58);
  const wmW = Math.round(wmH * (326 / 96));
  const label = text.trim();
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/api/brand/logo" unoptimized alt={withWordmark ? "" : label || "Nargito"} width={size} height={size} priority className="shrink-0 drop-shadow-sm" />
      {withWordmark && (label ? (
        <span className={cn("whitespace-nowrap font-extrabold leading-none tracking-tight", onDark ? "text-white" : "text-slate-900 dark:text-white")} style={{ fontSize: Math.round(wmH * 1.05) }}>{label}</span>
      ) : (
        <>
          <Image src={onDark ? "/api/brand/wordmark-light" : "/api/brand/wordmark"} unoptimized alt="Nargito" width={wmW} height={wmH} priority className={cn(!onDark && "dark:hidden")} style={{ height: wmH, width: "auto" }} />
          {!onDark && <Image src="/api/brand/wordmark-light" unoptimized alt="" aria-hidden width={wmW} height={wmH} priority className="hidden dark:block" style={{ height: wmH, width: "auto" }} />}
        </>
      ))}
    </span>
  );
  if (href === null) return inner;
  return (
    <Link href={href} aria-label={`${label || "Nargito"} home`} className="inline-flex rounded-lg">
      {inner}
    </Link>
  );
}
