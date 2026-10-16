import { notFound } from "next/navigation";
import Link from "next/link";
import { Power } from "lucide-react";
import { isFeatureEnabled } from "@/server/features";
import { getT } from "@/i18n/server";
import { Container } from "@/components/shell/frames";

/** Page-level feature gate. Server actions and APIs enforce the same flag independently. */
export async function FeatureGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  if (await isFeatureEnabled(feature)) return <>{children}</>;
  const t = await getT();
  return (
    <Container width="max-w-xl">
      <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center" role="status">
        <Power size={28} className="text-muted" aria-hidden />
        <h1 className="text-xl">{t("disabled.title")}</h1>
        <p className="text-sm text-muted">{t("disabled.body")}</p>
        <Link href="/home" className="btn-secondary">{t("nav.home")}</Link>
      </div>
    </Container>
  );
}

export { notFound };
