import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { adminPage, adminUserStepUp } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { PERMISSIONS } from "@/server/permissions-def";
import { AdminTitle } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { audit } from "@/server/log";
import { slugify } from "@/server/util";

export const metadata = { title: "Roles & permissions" };

async function saveRole(fd: FormData) {
  "use server";
  const admin = await adminUserStepUp("roles.manage", "/admin/roles");
  const db = await useDb();
  const id = String(fd.get("id") ?? "");
  const perms = fd.getAll("perm").map(String).filter((p) => PERMISSIONS.some((x) => x.key === p));
  if (id) {
    const [r] = await db.select().from(schema.roles).where(eq(schema.roles.id, id));
    if (!r || r.name === "superadmin") return; // the super administrator role is fixed
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, id));
    if (perms.length) await db.insert(schema.rolePermissions).values(perms.map((p) => ({ roleId: id, permissionKey: p })));
    await audit(admin.id, "role.update", "role", r.name, { permissions: perms.length });
  } else {
    const name = slugify(String(fd.get("name") ?? ""), 30).replace(/-/g, "_");
    if (!name || name === "superadmin") return;
    const [r] = await db.insert(schema.roles).values({ name, description: String(fd.get("description") ?? "").slice(0, 200) || null }).onConflictDoNothing().returning();
    if (r && perms.length) await db.insert(schema.rolePermissions).values(perms.map((p) => ({ roleId: r.id, permissionKey: p })));
    await audit(admin.id, "role.create", "role", name);
  }
  revalidatePath("/admin/roles");
}
async function deleteRole(fd: FormData) {
  "use server";
  const admin = await adminUserStepUp("roles.manage", "/admin/roles");
  const db = await useDb();
  const [r] = await db.select().from(schema.roles).where(eq(schema.roles.id, String(fd.get("id"))));
  if (!r || r.isSystem) return;
  await db.delete(schema.roles).where(eq(schema.roles.id, r.id));
  await audit(admin.id, "role.delete", "role", r.name);
  revalidatePath("/admin/roles");
}

export default async function RolesPage() {
  await adminPage("roles.manage");
  const db = await useDb();
  const [roles, rp, counts] = await Promise.all([db.select().from(schema.roles).orderBy(schema.roles.name), db.select().from(schema.rolePermissions), db.select({ roleId: schema.userRoles.roleId, n: sql<number>`count(*)::int` }).from(schema.userRoles).groupBy(schema.userRoles.roleId)]);
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];
  const PermGrid = ({ id, held, locked }: { id: string; held: Set<string>; locked?: boolean }) => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{groups.map((g) => (
      <fieldset key={g} className="rounded-lg border border-line p-3"><legend className="px-1 text-xs font-semibold uppercase text-muted">{g}</legend>
        {PERMISSIONS.filter((p) => p.group === g).map((p) => <label key={p.key} className="flex items-start gap-2 py-0.5 text-sm"><input type="checkbox" name="perm" value={p.key} defaultChecked={held.has(p.key)} disabled={locked} className="mt-1 accent-primary" /><span>{p.description}<code className="ml-1 text-[11px] text-muted">{p.key}</code></span></label>)}
      </fieldset>))}<input type="hidden" name="id" value={id} /></div>
  );
  return (
    <>
      <AdminTitle title="Roles & permissions" description="Granular, server-enforced permissions. The superadmin role is fixed and always holds every permission. Changes require re-authentication and are audited. Assign roles to people from their user page." />
      <div className="space-y-5">
        {roles.map((r) => {
          const held = new Set(rp.filter((x) => x.roleId === r.id).map((x) => x.permissionKey));
          const locked = r.name === "superadmin";
          return (
            <details key={r.id} className="card p-4" open={false}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2"><span className="text-lg font-semibold">{r.name}</span>{r.isSystem && <Badge tone="muted">system</Badge>}<Badge>{counts.find((c) => c.roleId === r.id)?.n ?? 0} member(s)</Badge><span className="text-sm text-muted">{r.description}</span></summary>
              <form action={saveRole} className="mt-4 space-y-3"><PermGrid id={r.id} held={held} locked={locked} />
                {locked ? <p className="text-sm text-muted">This role cannot be edited.</p> : <div className="flex gap-2"><button className="btn-primary">Save permissions</button></div>}</form>
              {!r.isSystem && <form action={deleteRole} className="mt-2"><input type="hidden" name="id" value={r.id} /><button className="btn-ghost text-danger">Delete role</button></form>}
            </details>
          );
        })}
        <details className="card p-4"><summary className="cursor-pointer text-lg font-semibold">Create a custom role</summary>
          <form action={saveRole} className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="rn">Name</label><input id="rn" name="name" required className="input" maxLength={30} /></div><div><label className="label" htmlFor="rd">Description</label><input id="rd" name="description" className="input" maxLength={200} /></div></div><PermGrid id="" held={new Set(["admin.access"])} /><button className="btn-primary">Create role</button></form></details>
      </div>
    </>
  );
}
