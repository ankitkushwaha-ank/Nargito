import { promises as fs } from "node:fs";
import { adminPage } from "@/server/admin";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge, Notice } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { UPLOAD_ROOT } from "@/server/media";

export const metadata = { title: "Backup status" };

export default async function Backups() {
  await adminPage("health.read");
  const marker = process.env.BACKUP_LAST_RUN_FILE;
  let last: Date | null = null; let readable = false;
  if (marker) { try { last = (await fs.stat(marker)).mtime; readable = true; } catch { readable = false; } }
  const pg = !!(process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL));
  const age = last ? Math.round((Date.now() - last.getTime()) / 3600_000) : null;
  return (
    <>
      <AdminTitle title="Backup status" description="Nargito does not create backups itself. This page reads the marker file you configure so you can see whether your own backup job is running." />
      <div className="mb-5">{!marker ? <Notice tone="warn">BACKUP_LAST_RUN_FILE is not set, so backup freshness cannot be measured. Status: <b>unknown</b>.</Notice> : !readable ? <Notice tone="danger">The marker file cannot be read. Check the path and permissions.</Notice> : <Notice tone={age! > 36 ? "warn" : "success"}>Last backup marker updated {formatDate(last, "en", { dateStyle: "medium", timeStyle: "short" })} ({age} hour{age === 1 ? "" : "s"} ago) <Badge tone={age! > 36 ? "warn" : "success"}>{age! > 36 ? "stale" : "fresh"}</Badge></Notice>}</div>
      {process.env.BACKUP_DESCRIPTION && <p className="mb-4 text-sm"><b>Policy:</b> {process.env.BACKUP_DESCRIPTION}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2 p-5 text-sm"><h2 className="text-lg">Database</h2>
          {pg ? <><p>PostgreSQL detected. Take encrypted logical backups on a schedule:</p><pre className="overflow-x-auto rounded-lg bg-bg p-3 text-xs">pg_dump --format=custom --file nargito-$(date +%F).dump "$DATABASE_URL"</pre><p>Restore: <code>pg_restore --clean --if-exists --dbname &quot;$DATABASE_URL&quot; nargito-YYYY-MM-DD.dump</code></p></> : <><p>The embedded PGlite database stores its files in the data directory (default <code>.data/pglite</code>). Stop the app, copy that directory, then start it again. Use PostgreSQL for production.</p></>}
        </section>
        <section className="card space-y-2 p-5 text-sm"><h2 className="text-lg">Uploaded media</h2><p>Files live in <code>{UPLOAD_ROOT.split(/[\\/]/).slice(-2).join("/")}</code> (UPLOAD_DIR). Back this volume up with the database so media rows and files stay consistent.</p></section>
        <section className="card space-y-2 p-5 text-sm md:col-span-2"><h2 className="text-lg">Recommended routine</h2><ul className="list-disc space-y-1 pl-5"><li>Daily database dump plus daily media snapshot; encrypt at rest and restrict access to administrators.</li><li>After each backup run <code>touch /path/to/marker</code> and set BACKUP_LAST_RUN_FILE to that path.</li><li>Test a restore into a scratch database at least quarterly.</li></ul></section>
      </div>
    </>
  );
}
