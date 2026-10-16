import { TopNav } from "@/components/shell/top-nav";
import { Footer } from "@/components/shell/footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
