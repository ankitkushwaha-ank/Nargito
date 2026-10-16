"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** "Don't have an account? Join" / "Already a member? Sign in" pill shown top-right on desktop. */
export function AuthSwitch() {
  const path = usePathname();
  const login = path.startsWith("/login");
  return (
    <p className="hidden items-center gap-3 text-sm text-muted lg:flex">
      {login ? "Don't have an account?" : "Already a member?"}
      <Link href={login ? "/register" : "/login"} className="btn-primary !min-h-[42px] !px-5">{login ? "Join Nargito" : "Sign in"}</Link>
    </p>
  );
}
