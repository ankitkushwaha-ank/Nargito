import { adminPage } from "@/server/admin";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { ActionForm, Field } from "@/components/ui/form";
import { getStorageConfig, r2Ready, UPLOAD_ROOT } from "@/server/storage";
import { storageAction } from "./actions";

export const metadata = { title: "Media storage" };
export const dynamic = "force-dynamic";

export default async function StoragePage() {
  await adminPage("settings.uploads");
  const c = await getStorageConfig();
  return (
    <>
      <AdminTitle title="Media storage" description="Choose where uploaded photos, videos and documents are kept. Switching only affects new uploads. Older files keep loading from where they were saved." />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        Active: <Badge tone="success">{c.provider === "r2" ? "Cloudflare R2" : "This server (local disk)"}</Badge>
        {c.provider === "r2" && !r2Ready(c) && <Badge tone="warn">R2 details incomplete</Badge>}
      </div>
      <ActionForm action={storageAction} className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">Storage type</h2>
          <Field label="Where should files be stored?" name="provider" as="select" defaultValue={c.provider}
            options={[{ value: "local", label: "Local: this server's disk" }, { value: "r2", label: "Cloudflare R2" }]}
            help={`Local folder on this server: ${UPLOAD_ROOT}. To change it, set UPLOAD_DIR in the server environment.`} />
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">Cloudflare R2 details</h2>
          <p className="text-sm text-muted">Cloudflare dashboard → R2 → create a bucket → Manage R2 API Tokens → create a token with “Object Read &amp; Write”. Copy the values here. Only needed when R2 is selected above.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account ID" name="accountId" defaultValue={c.accountId} placeholder="e.g. 1a2b3c4d5e..." help="Shown on the R2 overview page." autoComplete="off" />
            <Field label="Bucket name" name="bucket" defaultValue={c.bucket} placeholder="nargito-media" autoComplete="off" />
            <Field label="Access Key ID" name="accessKeyId" defaultValue={c.accessKeyId} autoComplete="off" />
            <Field label="Secret Access Key" name="secretAccessKey" type="password" autoComplete="new-password"
              placeholder={c.secretAccessKey ? "•••••••• saved (leave blank to keep)" : ""} help="Stored encrypted on the server and never shown again." />
            <Field label="Public URL (optional)" name="publicUrl" defaultValue={c.publicUrl} placeholder="https://media.nargito.in" help="If your bucket has a public domain or r2.dev URL, public images load straight from it (faster). Leave empty to serve files through the site." />
            <Field label="Folder prefix (optional)" name="prefix" defaultValue={c.prefix} placeholder="nargito" help="Keeps files inside a folder in the bucket." />
          </div>
        </section>
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="intent" value="save" className="btn-primary">Save settings</button>
          <button type="submit" name="intent" value="test" className="btn-secondary">Test connection</button>
        </div>
        <p className="text-xs text-muted">Saving with R2 selected runs a connection test first, so a wrong key can never break uploads. Logo and banner images stay on the server's local disk.</p>
      </ActionForm>
    </>
  );
}
