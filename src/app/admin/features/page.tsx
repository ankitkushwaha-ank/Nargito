import { adminPage } from "@/server/admin";
import { allFeatureStates } from "@/server/features";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { toggleFeatureAction } from "./actions";
import { Lock } from "lucide-react";

export const metadata = { title: "Manage features" };

export default async function FeaturesPage() {
  await adminPage("features.manage");
  const features = await allFeatureStates();
  return (
    <>
      <AdminTitle title="Manage features" description="Turning a feature off removes its menus and blocks its pages, server actions and APIs immediately. Critical features cannot be disabled." />
      <ul className="card divide-y divide-line">
        {features.map((f) => (
          <li key={f.key} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="flex items-center gap-2 font-medium">{f.label}{f.critical && <Badge tone="muted"><Lock size={10} aria-hidden />protected</Badge>}</p><p className="text-sm text-muted">{f.description}</p></div>
            <Badge tone={f.enabled ? "success" : "danger"}>{f.enabled ? "Enabled" : "Disabled"}</Badge>
            {!f.critical && (
              <form action={toggleFeatureAction}><input type="hidden" name="key" value={f.key} /><input type="hidden" name="enabled" value={f.enabled ? "false" : "true"} />
                <button className={f.enabled ? "btn-secondary !min-h-[34px]" : "btn-primary !min-h-[34px]"} aria-label={`${f.enabled ? "Disable" : "Enable"} ${f.label}`}>{f.enabled ? "Disable" : "Enable"}</button></form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
