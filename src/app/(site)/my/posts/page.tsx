import Link from "next/link";
import { requireUserPage } from "@/server/auth/guard";
import { ThreeColumn } from "@/components/shell/frames";
import { getMyPosts } from "@/server/services/posts";
import { PostCard } from "@/components/social/post-card";
import { EmptyState, PageHeader, Pager } from "@/components/ui/kit";
import { cn } from "@/lib/cn";

export const metadata = { title: "My posts" };

export default async function MyPosts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("/my/posts");
  const sp = await searchParams;
  const status = sp.status === "draft" ? "draft" : "published";
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, hasMore } = await getMyPosts(user.id, status, page);
  return (
    <ThreeColumn user={user} right={false}>
      <PageHeader title="My posts" />
      <nav className="flex gap-2" aria-label="Post status">
        {(["published", "draft"] as const).map((s) => <Link key={s} href={`/my/posts?status=${s}`} aria-current={status === s ? "page" : undefined} className={cn("rounded-full border border-line px-3 py-1.5 text-sm capitalize", status === s ? "bg-primary text-white" : "bg-surface text-muted")}>{s === "draft" ? "Drafts" : "Published"}</Link>)}
      </nav>
      {items.length === 0 ? <EmptyState title={status === "draft" ? "No drafts" : "You haven't posted yet"} action={<Link href="/home" className="btn-primary">Write a post</Link>} /> : <div className="space-y-4">{items.map((p) => <PostCard key={p.id} post={p} />)}</div>}
      <Pager page={page} hasMore={hasMore} basePath="/my/posts" params={{ status }} />
    </ThreeColumn>
  );
}
