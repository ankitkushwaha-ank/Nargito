import { adminPage } from "@/server/admin";
import { HealthView } from "@/components/admin/health-view";

export const metadata = { title: "Debugger & health" };

export default async function Debugger() {
  await adminPage("health.read");
  return <HealthView title="Debugger & health" />;
}
