import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <h1 className="text-2xl">Page not found</h1>
      <p className="max-w-md text-muted">The page you are looking for does not exist, is private, or has been removed.</p>
      <Link href="/" className="btn-primary">Go to Nargito</Link>
    </main>
  );
}
