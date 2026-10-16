"use client";
import { ActionForm, Checkbox, Field, SubmitButton } from "@/components/ui/form";
import { bulkUserAction } from "./actions";

/** Wraps the user table so checked rows are submitted with an explicit confirmation. */
export function BulkUsersForm({ children, canAct }: { children: React.ReactNode; canAct: boolean }) {
  if (!canAct) return <>{children}</>;
  return (
    <ActionForm action={bulkUserAction} className="space-y-3">
      {children}
      <fieldset className="card flex flex-wrap items-end gap-3 p-3"><legend className="px-1 text-sm font-medium">Bulk action on selected users</legend>
        <Field label="Action" name="action" as="select" options={[{ value: "warn", label: "Send warning" }, { value: "restrict", label: "Restrict for 7 days" }, { value: "suspend", label: "Suspend" }, { value: "reinstate", label: "Reinstate" }]} />
        <Field className="min-w-[220px] flex-1" label="Reason" name="reason" maxLength={300} />
        <Checkbox name="confirm" label="I confirm this applies to every selected user" />
        <SubmitButton variant="danger">Apply</SubmitButton>
      </fieldset>
    </ActionForm>
  );
}
