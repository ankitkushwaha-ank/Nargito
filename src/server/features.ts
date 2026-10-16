import "server-only";
import { useDb, schema } from "./db";
import { AppError } from "./util";

export const FEATURES: { key: string; label: string; description: string; critical?: boolean }[] = [
  { key: "profiles", label: "User profiles", description: "Public profile pages and editing." },
  { key: "connections", label: "Connections & follows", description: "Follow people and send connection requests." },
  { key: "posts", label: "Posts", description: "Publishing and the home feed." },
  { key: "comments", label: "Comments", description: "Commenting on posts." },
  { key: "reactions", label: "Reactions", description: "Liking posts." },
  { key: "groups", label: "Groups", description: "Communities and group pages." },
  { key: "trips", label: "Trips", description: "Trip planning and sharing." },
  { key: "companies", label: "Companies", description: "Company pages." },
  { key: "shops", label: "Shops", description: "Shop pages and catalogues." },
  { key: "products", label: "Products", description: "Product listings." },
  { key: "services", label: "Services", description: "Service listings." },
  { key: "search", label: "Search & discovery", description: "Unified search and Explore." },
  { key: "messaging", label: "Private messaging", description: "Conversations and enquiries chat." },
  { key: "notifications", label: "Notifications", description: "In-app notifications." },
  { key: "verification", label: "Verification", description: "Verification requests and badges." },
  { key: "promotions", label: "Promotions & ads", description: "Sponsored content." },
  { key: "pro", label: "Pro membership", description: "Premium plans." },
  { key: "saved", label: "Saved items", description: "Bookmarks." },
  { key: "polls", label: "Polls", description: "Polls inside posts." },
  { key: "categories", label: "Categories", description: "Category taxonomies." },
  { key: "pwa", label: "PWA installation", description: "Install prompt and service worker." },
  { key: "ai", label: "AI integrations", description: "Optional AI assistance (needs provider key)." },
  { key: "authentication", label: "Authentication", description: "Sign in / registration. Cannot be disabled.", critical: true },
  { key: "audit", label: "Audit logging", description: "Records privileged actions. Cannot be disabled.", critical: true },
];

type Cache = { at: number; map: Map<string, boolean> };
const g = globalThis as unknown as { __featureCache?: Cache };

async function load() {
  const c = g.__featureCache;
  if (c && Date.now() - c.at < 3000) return c.map;
  const db = await useDb();
  const rows = await db.select().from(schema.featureFlags);
  const map = new Map(rows.map((r) => [r.key, r.enabled]));
  g.__featureCache = { at: Date.now(), map };
  return map;
}
export function invalidateFeatures() {
  g.__featureCache = undefined;
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const f = FEATURES.find((x) => x.key === key);
  if (f?.critical) return true;
  const map = await load();
  return map.has(key) ? map.get(key)! : true;
}

export async function allFeatureStates() {
  const map = await load();
  return FEATURES.map((f) => ({ ...f, enabled: f.critical ? true : map.has(f.key) ? map.get(f.key)! : true }));
}

/** Server-side gate used by actions, route handlers and pages. Throws AppError(404) when disabled. */
export async function requireFeature(key: string) {
  if (!(await isFeatureEnabled(key))) throw new AppError(404, "This feature is currently unavailable.", "feature_disabled");
}
