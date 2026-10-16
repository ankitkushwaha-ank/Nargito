"use client";
import { createContext, useActionState, useContext, useId, useState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

export type FormState = { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; data?: unknown } | null;
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const FormCtx = createContext<FormState>(null);

/** Wraps a server action with pending state, inline errors and a polite live region. */
export function ActionForm({ action, children, className, resetOnSuccess }: { action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <FormCtx.Provider value={state}>
      <form ref={ref} action={formAction} className={className} noValidate={false}>
        {children}
        <div aria-live="polite" role="status" className="mt-3 empty:hidden">
          {state && !state.ok && state.error && !Object.keys(state.fieldErrors ?? {}).length && (
            <p className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"><AlertCircle size={16} className="mt-0.5 shrink-0" />{state.error}</p>
          )}
          {state?.ok && state.message && (
            <p className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{state.message}</p>
          )}
        </div>
      </form>
    </FormCtx.Provider>
  );
}

export function useFormState() {
  return useContext(FormCtx);
}

export function SubmitButton({ children, className, variant = "primary", pendingLabel }: { children: React.ReactNode; className?: string; variant?: "primary" | "secondary" | "danger" | "ghost"; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const cls = variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : variant === "ghost" ? "btn-ghost" : "btn-secondary";
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cn(cls, className)}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function Field({
  label, name, type = "text", required, defaultValue, placeholder, help, as = "input", rows = 4, options, maxLength, autoComplete, className, min, max, step, pattern, inputMode,
}: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null; placeholder?: string; help?: string;
  as?: "input" | "textarea" | "select"; rows?: number; options?: { value: string; label: string }[]; maxLength?: number; autoComplete?: string; className?: string;
  min?: number | string; max?: number | string; step?: number | string; pattern?: string; inputMode?: "numeric" | "text" | "decimal" | "email" | "tel";
}) {
  const id = useId();
  const state = useContext(FormCtx);
  const err = state?.fieldErrors?.[name];
  const [show, setShow] = useState(false);
  const t = useT();
  const common = {
    id, name, required, "aria-invalid": !!err, "aria-describedby": err ? `${id}-err` : help ? `${id}-help` : undefined,
    className: cn("input", err && "border-danger", type === "password" && "pr-10"),
  };
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}{required && <span className="text-danger" aria-hidden> *</span>}</label>
      {as === "textarea" ? (
        <textarea {...common} rows={rows} defaultValue={defaultValue ?? ""} placeholder={placeholder} maxLength={maxLength} />
      ) : as === "select" ? (
        <select {...common} defaultValue={defaultValue ?? ""}>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "password" ? (
        <div className="relative">
          <input {...common} type={show ? "text" : "password"} autoComplete={autoComplete} defaultValue={defaultValue ?? ""} placeholder={placeholder} maxLength={maxLength} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      ) : (
        <input {...common} type={type} autoComplete={autoComplete} defaultValue={defaultValue ?? ""} placeholder={placeholder} maxLength={maxLength} min={min} max={max} step={step} pattern={pattern} inputMode={inputMode} />
      )}
      {help && !err && <p id={`${id}-help`} className="mt-1 text-xs text-muted">{help}</p>}
      {err && <p id={`${id}-err`} className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

export function Checkbox({ name, label, defaultChecked, className }: { name: string; label: React.ReactNode; defaultChecked?: boolean; className?: string }) {
  const id = useId();
  const state = useContext(FormCtx);
  const err = state?.fieldErrors?.[name];
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm">
        <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-4 w-4 rounded border-line accent-primary" />
        <span>{label}</span>
      </label>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}

/** Button that asks for confirmation before submitting its form (destructive actions). */
export function ConfirmSubmit({ children, message, className, variant = "danger" }: { children: React.ReactNode; message: string; className?: string; variant?: "danger" | "secondary" | "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  const cls = variant === "danger" ? "btn-danger" : variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn-secondary";
  return (
    <button type="submit" disabled={pending} className={cn(cls, className)} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
