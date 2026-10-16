import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { adminPage, adminUser } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { runJob } from "@/server/jobs/runner";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge, Notice } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { audit } from "@/server/log";
import { syncJobRegistry } from "@/server/jobs/runner";

export const metadata = { title: "Cron jobs" };

async function run(fd: FormData) {
  "use server";
  const u = await adminUser("jobs.manage");
  await runJob(String(fd.get("key")), { manual: true, actorId: u.id });
  revalidatePath("/admin/cron");
}
async function update(fd: FormData) {
  "use server";
  const u = await adminUser("jobs.manage");
  const key = String(fd.get("key")); const minutes = Math.min(10080, Math.max(5, Number(fd.get("interval")) || 60));
  const db = await useDb();
  await db.update(schema.scheduledJobs).set({ enabled: fd.get("enabled") === "on", intervalMinutes: minutes, retries: Math.min(5, Math.max(0, Number(fd.get("retries")) || 0)) }).where(eq(schema.scheduledJobs.key, key));
  await audit(u.id, "job.update", "job", key, { minutes });
  revalidatePath("/admin/cron");
}

export default async function CronAdmin() {
  await adminPage("jobs.manage");
  await syncJobRegistry();
  const db = await useDb();
  const jobs = await db.select().from(schema.scheduledJobs).orderBy(schema.scheduledJobs.key);
  const cronOn = (process.env.CRON_SECRET?.length ?? 0) >= 16;
  return (
    <>
      <AdminTitle title="Scheduled jobs" description="Jobs run in the background worker (npm run worker) or when an external scheduler calls POST /api/cron/due with the CRON_SECRET bearer token. They never depend on a browser being open." />
      {!cronOn && <div className="mb-4"><Notice tone="warn">CRON_SECRET is not set (16+ characters), so the HTTP cron endpoint is disabled. The worker process can still run jobs.</Notice></div>}
      <Table head={["Job", "Schedule & policy", "Last run", "Next run", "Result", "Actions"]}>
        {jobs.map((j) => (
          <tr key={j.key}><Td className="max-w-xs"><p className="font-medium">{j.name}</p><p className="text-xs text-muted">{j.description}</p><code className="text-xs">{j.key}</code></Td>
            <Td><form action={update} className="flex flex-wrap items-center gap-2 text-xs"><input type="hidden" name="key" value={j.key} /><label className="flex items-center gap-1"><input type="checkbox" name="enabled" defaultChecked={j.enabled} className="accent-primary" />On</label><label>every <input name="interval" type="number" min={5} defaultValue={j.intervalMinutes} className="input !inline-block !w-20 !py-0.5" aria-label={`Interval minutes for ${j.name}`} /> min</label><label>retries <input name="retries" type="number" min={0} max={5} defaultValue={j.retries} className="input !inline-block !w-14 !py-0.5" aria-label={`Retries for ${j.name}`} /></label><button className="btn-secondary !min-h-[28px]">Save</button></form></Td>
            <Td className="text-xs">{j.lastRunAt ? formatDate(j.lastRunAt, "en", { dateStyle: "short", timeStyle: "medium" }) : "never"}{j.lastDurationMs != null && <span className="block text-muted">{j.lastDurationMs} ms</span>}</Td>
            <Td className="text-xs">{j.enabled && j.nextRunAt ? formatDate(j.nextRunAt, "en", { dateStyle: "short", timeStyle: "short" }) : "-"}</Td>
            <Td>{j.lastStatus ? <Badge tone={j.lastStatus === "success" ? "success" : "danger"}>{j.lastStatus}</Badge> : <Badge tone="muted">pending</Badge>}{j.lastError && <p className="mt-1 max-w-xs break-words text-xs text-danger">{j.lastError}</p>}</Td>
            <Td>{j.safeManual ? <form action={run}><input type="hidden" name="key" value={j.key} /><button className="btn-secondary !min-h-[28px]">Run now</button></form> : <span className="text-xs text-muted">Scheduled only</span>}</Td></tr>
        ))}
      </Table>
    </>
  );
}
