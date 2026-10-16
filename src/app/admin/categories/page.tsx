import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { adminPage, adminUser } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { slugify } from "@/server/util";
import { audit } from "@/server/log";
import { FeatureGate } from "@/components/ui/feature-gate";

export const metadata = { title: "Categories" };
const TYPES = ["product", "service", "trip", "company", "shop", "group"];

async function add(fd: FormData) {
  "use server";
  const u = await adminUser("content.moderate");
  const type = String(fd.get("type")); const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (!TYPES.includes(type) || !name) return;
  const db = await useDb();
  await db.insert(schema.categories).values({ type, name, slug: slugify(name), sortOrder: 99 }).onConflictDoNothing();
  await audit(u.id, "category.add", "category", name, { type });
  revalidatePath("/admin/categories");
}
async function toggle(fd: FormData) {
  "use server";
  const u = await adminUser("content.moderate");
  const id = String(fd.get("id")); const db = await useDb();
  const [c] = await db.select().from(schema.categories).where(eq(schema.categories.id, id));
  if (!c) return;
  await db.update(schema.categories).set({ active: !c.active }).where(eq(schema.categories.id, id));
  await audit(u.id, "category.toggle", "category", id, { active: !c.active });
  revalidatePath("/admin/categories");
}
async function remove(fd: FormData) {
  "use server";
  const u = await adminUser("content.moderate");
  const id = String(fd.get("id")); const db = await useDb();
  await db.delete(schema.categories).where(and(eq(schema.categories.id, id)));
  await audit(u.id, "category.delete", "category", id);
  revalidatePath("/admin/categories");
}

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("content.moderate");
  const sp = await searchParams;
  const type = TYPES.includes(sp.type ?? "") ? sp.type! : "product";
  const db = await useDb();
  const rows = await db.select().from(schema.categories).where(eq(schema.categories.type, type)).orderBy(schema.categories.sortOrder, schema.categories.name);
  return (
    <FeatureGate feature="categories">
      <AdminTitle title="Categories" description="Categories feed filters and forms. Deleting a category does not change existing listings that use its name." />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Category type">{TYPES.map((t) => <a key={t} href={`/admin/categories?type=${t}`} aria-current={type === t ? "page" : undefined} className={`rounded-full border border-line px-3 py-1 text-sm capitalize ${type === t ? "bg-primary text-white" : "bg-surface text-muted"}`}>{t}</a>)}</nav>
      <form action={add} className="card mb-4 flex flex-wrap items-end gap-3 p-3"><input type="hidden" name="type" value={type} /><div className="flex-1"><label className="label" htmlFor="cn">New {type} category</label><input id="cn" name="name" required maxLength={60} className="input" /></div><button className="btn-primary">Add</button></form>
      <Table head={["Name", "Slug", "Status", "Actions"]} empty={rows.length ? undefined : "No categories."}>
        {rows.map((c) => <tr key={c.id}><Td>{c.name}</Td><Td><code className="text-xs">{c.slug}</code></Td><Td><Badge tone={c.active ? "success" : "muted"}>{c.active ? "active" : "hidden"}</Badge></Td>
          <Td><div className="flex gap-1"><form action={toggle}><input type="hidden" name="id" value={c.id} /><button className="btn-secondary !min-h-[30px]">{c.active ? "Hide" : "Show"}</button></form><form action={remove}><input type="hidden" name="id" value={c.id} /><button className="btn-ghost !min-h-[30px] text-danger">Delete</button></form></div></Td></tr>)}
      </Table>
    </FeatureGate>
  );
}
