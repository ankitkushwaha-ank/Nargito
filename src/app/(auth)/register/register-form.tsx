"use client";
import Link from "next/link";
import { useState } from "react";
import { Building2, User } from "lucide-react";
import { registerAction } from "../actions";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";
export function RegisterForm() {
  const t = useT();
  const [type, setType] = useState<"personal" | "business">("personal");
  return (
    <ActionForm action={registerAction} className="space-y-4">
      <fieldset>
        <legend className="label">I am joining as</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["personal", "A person", "Share, travel, connect", User], ["business", "A business", "Shop or company", Building2]] as const).map(([v, title, sub, Icon]) => (
            <label key={v} className={cn("flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 transition-colors", type === v ? "border-primary bg-primary-tint" : "border-line hover:border-primary/40")}>
              <input type="radio" name="accountType" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", type === v ? "bg-primary text-white" : "bg-bg text-muted")}><Icon size={18} aria-hidden /></span>
              <span className="min-w-0"><span className="block text-sm font-bold leading-tight">{title}</span><span className="block text-xs text-muted">{sub}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={type === "business" ? "Your name" : t("auth.name")} name="displayName" required autoComplete="name" maxLength={60} />
      <Field label={t("auth.username")} name="username" required autoComplete="username" maxLength={30} pattern="[A-Za-z0-9_]{3,30}" help="Letters, numbers and underscore." />
      <Field label={t("auth.email")} name="email" type="email" required autoComplete="email" />
      <Field label={t("auth.password")} name="password" type="password" required autoComplete="new-password" help="At least 10 characters with letters and a number." />
      <Checkbox name="acceptTerms" label={<>{t("auth.acceptTerms")} (<Link className="link" href="/terms" target="_blank">Terms</Link>, <Link className="link" href="/privacy" target="_blank">Privacy</Link>)</>} />
      <SubmitButton className="w-full !min-h-[48px] text-base" pendingLabel={t("common.loading")}>{t("auth.registerButton")}</SubmitButton>
    </ActionForm>
  );
}