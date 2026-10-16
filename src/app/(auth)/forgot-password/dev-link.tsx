"use client";
import { useFormState } from "@/components/ui/form";

/** Shown only when the server returned a link because no email provider is configured (non-production). */
export function DevLink() {
  const s = useFormState();
  const link = (s?.data as { devLink?: string } | undefined)?.devLink;
  if (!link) return null;
  return (
    <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
      Development mode (no email provider configured): <a className="underline" href={link}>open the reset link</a>.
    </p>
  );
}
