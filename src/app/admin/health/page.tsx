import { adminPage } from "@/server/admin";
import { HealthView } from "@/components/admin/health-view";

export const metadata = { title: "System health" };

export default async function Health() {
  await adminPage("health.read");
  return <HealthView title="System health" />;
}
