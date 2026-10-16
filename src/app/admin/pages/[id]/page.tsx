import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { adminPage } from "@/server/admin";
import { useDb, schema } from "@/server/db";
import { AdminTitle } from "@/components/admin/admin-ui";
import { ActionForm, Checkbox, Field, SubmitButton, ConfirmSubmit } from "@/components/ui/form";
import { Badge } from "@/components/ui/kit";
import { Markdown } from "@/components/cms/markdown";
import { savePageAction, restoreRevisionAction, deletePageAction } from "../actions";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/server/util";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await adminPage("cms.manage");
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const db = await useDb();
  const p = isNew || !isUuid(id) ? null : (await db.select().from(schema.cmsPages).where(eq(schema.cmsPages.id, id)))[0];
  if (!isNew && !p) notFound();
  const revs = p ? await db.select().from(schema.cmsRevisions).where(eq(schema.cmsRevisions.pageId, p.id)).orderBy(desc(schema.cmsRevisions.createdAt)).limit(15) : [];
  const preview = revs.find((r) => r.id === sp.rev);
  return (
    <>
      <AdminTitle title={isNew ? "New page" : `Edit: ${p!.title}`} description={p?.isLegal ? "Legal page: edits require legal-page permission and re-authentication. The page stays published." : "Body supports headings (##), lists, **bold**, *italic*, [links](/url) and tables."} actions={<Link href="/admin/pages" className="btn-secondary">All pages</Link>} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ActionForm action={savePageAction} className="card space-y-4 p-5">
          {p && <input type="hidden" name="id" value={p.id} />}
          <Field label="Title" name="title" required defaultValue={p?.title} maxLength={150} />
          {isNew && <Field label="Address (slug)" name="slug" help="Leave empty to derive from the title" maxLength={60} />}
          <Field label="Body" name="body" as="textarea" rows={18} defaultValue={preview?.body ?? p?.body} />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="SEO title" name="seoTitle" defaultValue={p?.seoTitle} maxLength={150} /><Field label="Status" name="status" as="select" defaultValue={p?.status ?? "published"} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft (hidden)" }]} /></div>
          <Field label="SEO description" name="seoDescription" as="textarea" rows={2} defaultValue={p?.seoDescription} maxLength={300} />
          <Checkbox name="noindex" label="Ask search engines not to index this page" defaultChecked={p?.noindex} />
          <SubmitButton>Save page</SubmitButton>
        </ActionForm>
        <div className="space-y-5">
          {p && <section className="card p-5"><h2 className="text-lg">Preview</h2><div className="mt-2 max-h-96 overflow-auto rounded-lg border border-line p-4"><Markdown source={preview?.body ?? p.body} /></div></section>}
          {p && (
            <section className="card p-5"><h2 className="text-lg">Revision history</h2>
              {revs.length === 0 ? <p className="mt-1 text-sm text-muted">No earlier versions.</p> : <ul className="mt-2 divide-y divide-line text-sm">{revs.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{formatDate(r.createdAt, "en", { dateStyle: "medium", timeStyle: "short" })}{sp.rev === r.id && <> <Badge>previewing</Badge></>}</span><span className="flex gap-1"><Link className="btn-ghost !min-h-[28px]" href={`/admin/pages/${p.id}?rev=${r.id}`}>Preview</Link><form action={restoreRevisionAction}><input type="hidden" name="revId" value={r.id} /><button className="btn-secondary !min-h-[28px]">Restore</button></form></span></li>)}</ul>}
            </section>
          )}
          {p && !p.isLegal && <form action={deletePageAction} className="card p-5"><input type="hidden" name="id" value={p.id} /><ConfirmSubmit message="Delete this page permanently?">Delete page</ConfirmSubmit></form>}
        </div>
      </div>
    </>
  );
}
