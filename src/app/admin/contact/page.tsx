import { desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { adminPage, adminUser } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge, EmptyState } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";
import { eq } from "drizzle-orm";
import { audit } from "@/server/log";

export const metadata = { title: "Contact messages" };

async function setStatus(fd: FormData) {
  "use server";
  const u = await adminUser("users.read");
  const id = String(fd.get("id")); const status = String(fd.get("status")) === "done" ? "done" : "new";
  const db = await useDb();
  await db.update(schema.contactMessages).set({ status }).where(eq(schema.contactMessages.id, id));
  await audit(u.id, "contact.status", "contact", id, { status });
  revalidatePath("/admin/contact");
}

export default async function ContactAdmin() {
  await adminPage("users.read");
  const db = await useDb();
  const rows = await db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt)).limit(100);
  return (
    <>
      <AdminTitle title="Contact messages" description="Messages submitted through the public contact form." />
      {rows.length === 0 ? <EmptyState title="No messages yet" /> : (
        <ul className="space-y-3">{rows.map((m) => (
          <li key={m.id} className="card space-y-1 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{m.subject}</p><Badge tone={m.status === "new" ? "warn" : "success"}>{m.status}</Badge></div>
            <p className="text-sm text-muted">{m.name} &lt;<a className="link" href={`mailto:${m.email}`}>{m.email}</a>&gt; · {formatDate(m.createdAt, "en", { dateStyle: "medium", timeStyle: "short" })}</p>
            <p className="whitespace-pre-wrap text-sm">{m.message}</p>
            <form action={setStatus}><input type="hidden" name="id" value={m.id} /><button name="status" value={m.status === "new" ? "done" : "new"} className="btn-secondary !min-h-[30px]">{m.status === "new" ? "Mark handled" : "Reopen"}</button></form></li>
        ))}</ul>
      )}
    </>
  );
}
