import Link from "next/link";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle, Table, Td } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/kit";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Pages & CMS" };

export default async function PagesAdmin() {
  await adminPage("cms.manage");
  const db = await useDb();
  const pages = await db.select().from(schema.cmsPages).orderBy(schema.cmsPages.slug);
  return (
    <>
      <AdminTitle title="Pages & CMS" description="Public pages such as About, FAQ and legal policies. Every save keeps a revision. Legal pages need legal-page permission and re-authentication, and cannot be deleted or unpublished." actions={<Link href="/admin/pages/new" className="btn-primary">New page</Link>} />
      <Table head={["Page", "Address", "Status", "Indexing", "Updated", ""]}>
        {pages.map((p) => <tr key={p.id}><Td><b>{p.title}</b> {p.isLegal && <Badge tone="warn">legal</Badge>}</Td><Td><Link className="link" href={`/${p.slug}`} target="_blank">/{p.slug}</Link></Td><Td><Badge tone={p.status === "published" ? "success" : "muted"}>{p.status}</Badge></Td><Td>{p.noindex ? "noindex" : "indexed"}</Td><Td>{formatDate(p.updatedAt, "en", { dateStyle: "medium" })}</Td><Td><Link className="btn-secondary !min-h-[30px]" href={`/admin/pages/${p.id}`}>Edit</Link></Td></tr>)}
      </Table>
    </>
  );
}
