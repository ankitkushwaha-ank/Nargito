import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

async function assertPublicHost(url: URL) {
  if (!/^https?:$/.test(url.protocol)) throw new Error("bad protocol");
  if (url.port && !["80", "443", ""].includes(url.port)) throw new Error("bad port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("blocked address");
}

const meta = (html: string, prop: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
};
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** SSRF-safe Open Graph fetch: public hosts only, max 3 redirects (re-validated), 4s timeout, 400 KB cap. */
export async function fetchLinkPreview(raw: string) {
  let url = new URL(raw);
  for (let i = 0; i < 4; i++) {
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000), headers: { "User-Agent": "NargitoLinkPreview/1.0", Accept: "text/html" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) throw new Error("not html");
    const reader = res.body?.getReader();
    let html = "";
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      html += new TextDecoder().decode(value, { stream: true });
      if (size > 400_000 || /<\/head>/i.test(html)) { await reader.cancel(); break; }
    }
    const title = decode(meta(html, "og:title") || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "")).trim();
    const description = decode(meta(html, "og:description") || meta(html, "description")).trim();
    let image = meta(html, "og:image");
    try { image = image ? new URL(image, url).toString() : ""; } catch { image = ""; }
    if (!/^https:\/\//.test(image)) image = "";
    return { url: url.toString(), title: title.slice(0, 200), description: description.slice(0, 300), image: image.slice(0, 500) };
  }
  throw new Error("too many redirects");
}
