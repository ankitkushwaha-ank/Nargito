import { requireUserPage } from "@/server/auth/guard";
import { LocationControls } from "./location-controls";
import { CITIES } from "@/server/cities";
import { getSettings } from "@/server/settings";
import { Notice } from "@/components/ui/kit";

export const metadata = { title: "Location settings" };

export default async function LocationSettings() {
  const u = await requireUserPage("/settings/location");
  const s = await getSettings(["location.enabled", "location.cellSizeKm"]);
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-lg">Approximate location</h2>
      <p className="text-sm text-muted">Used only to show businesses and trips near you. We convert your position into a coarse area of about {String(s["location.cellSizeKm"])} km immediately; your exact coordinates are never stored, shown to others or logged. You can turn this off any time.</p>
      {!s["location.enabled"] ? <Notice tone="warn">Nearby discovery is turned off by the platform.</Notice> : (
        <LocationControls enabled={u.locationSharing} hasArea={!!u.geoCell} label={u.locationLabel} cities={CITIES.map((c) => c.name)} />
      )}
    </section>
  );
}
