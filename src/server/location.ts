import "server-only";
import { getSetting } from "./settings";

/**
 * Privacy-preserving location helpers.
 * Precise coordinates are converted to a coarse grid cell immediately and are never persisted, returned or logged.
 */
export async function cellSizeKm() {
  return getSetting<number>("location.cellSizeKm");
}

export function cellFor(lat: number, lng: number, km: number) {
  const step = km / 111;
  return `${Math.round(lat / step)}:${Math.round(lng / step)}`;
}

export async function snapToCell(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (!(await getSetting<boolean>("location.enabled"))) return null;
  return cellFor(lat, lng, await cellSizeKm());
}

export function cellDistanceKm(a: string | null | undefined, b: string | null | undefined, km: number) {
  if (!a || !b) return null;
  const [ax, ay] = a.split(":").map(Number);
  const [bx, by] = b.split(":").map(Number);
  if ([ax, ay, bx, by].some((n) => !Number.isFinite(n))) return null;
  return Math.hypot(ax! - bx!, ay! - by!) * km;
}

/** Only coarse buckets are ever shown, never a computed distance. */
export function distanceBucket(distKm: number | null) {
  if (distKm === null) return null;
  if (distKm <= 15) return "Within 15 km";
  if (distKm <= 50) return "Within 50 km";
  if (distKm <= 150) return "Within 150 km";
  return "Further away";
}

/** SQL-friendly set of neighbouring cells within `radiusCells`. */
export function neighbourCells(cell: string, radiusCells = 2) {
  const [x, y] = cell.split(":").map(Number);
  const out: string[] = [];
  for (let dx = -radiusCells; dx <= radiusCells; dx++) for (let dy = -radiusCells; dy <= radiusCells; dy++) out.push(`${x! + dx}:${y! + dy}`);
  return out;
}
