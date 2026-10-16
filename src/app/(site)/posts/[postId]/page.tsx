import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/server/auth/session";
import { getPostView } from "@/server/services/posts";
import { ThreeColumn } from "@/components/shell/frames";
import { PostCard } from "@/components/social/post-card";
import { FeatureGate } from "@/components/ui/feature-gate";

export async function generateMetadata({ params }: { params: Promise<{ postId: string }> }): Promise<Metadata> {
  const { postId } = await params;
  const p = await getPostView(null, postId); // anonymous view: only public posts are indexable
  if (!p) return { title: "Post", robots: { index: false, follow: false } };
  return { title: `${p.author.displayName}: ${p.body.slice(0, 60)}`, description: p.body.slice(0, 160), openGraph: { type: "article", title: p.author.displayName, description: p.body.slice(0, 160), images: [p.media.find((m) => m.kind === "image")?.url ?? "/api/brand/og"] }, twitter: { card: "summary_large_image", images: [p.media.find((m) => m.kind === "image")?.url ?? "/api/brand/og"] } };
}

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const user = await getSessionUser();
  const post = await getPostView(user?.id ?? null, postId);
  if (!post) notFound();
  return (
    <FeatureGate feature="posts">
      <ThreeColumn user={user}><PostCard post={post} full /></ThreeColumn>
    </FeatureGate>
  );
}
