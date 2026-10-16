// Smoke test: node scripts/smoke.mjs [baseUrl]
const base = process.argv[2] ?? "http://localhost:3000";
const routes = [
  ["/", 200], ["/login", 200], ["/register", 200], ["/forgot-password", 200], ["/about", 200], ["/privacy", 200], ["/terms", 200], ["/faq", 200], ["/contact", 200],
  ["/explore", 200], ["/search?q=trek", 200], ["/trips", 200], ["/shops", 200], ["/products", 200], ["/services", 200], ["/companies", 200], ["/groups", 200], ["/people", 200], ["/pricing", 200],
  ["/api/health", 200], ["/manifest.webmanifest", 200], ["/robots.txt", 200], ["/sitemap.xml", 200], ["/offline", 200], ["/sw.js", 200], ["/icons/icon-192.png", 200], ["/favicon.ico", 200],
  ["/does-not-exist", 404],
  // protected: must not be reachable anonymously
  ["/home", 307], ["/admin", 307], ["/messages", 307], ["/settings/profile", 307], ["/my/posts", 307], ["/api/admin/export?metric=summary", 403], ["/api/cron/due", 405],
];
let failed = 0;
for (const [path, expect] of routes) {
  try {
    const r = await fetch(base + path, { redirect: "manual" });
    const ok = r.status === expect || (expect === 307 && [302, 303, 307, 308].includes(r.status)) || (expect === 403 && [401, 403].includes(r.status));
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${String(r.status).padEnd(4)} (expected ${expect}) ${path}${r.headers.get("location") ? " -> " + r.headers.get("location") : ""}`);
  } catch (e) { failed++; console.log(`FAIL ERR  ${path} ${e.message}`); }
}
console.log(failed ? `\n${failed} route check(s) failed` : "\nAll route checks passed");
process.exit(failed ? 1 : 0);
