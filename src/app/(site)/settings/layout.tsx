import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage("/settings/profile");
  return (
    <Container width="max-w-5xl">
      <h1 className="mb-4 text-2xl font-extrabold md:mb-5">Settings</h1>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
        <SettingsNav />
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </Container>
  );
}
