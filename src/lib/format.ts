export function timeAgo(d: Date | string, locale = "en") {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "hi" ? "hi-IN" : "en", { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(Math.round(s), "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return date.toLocaleDateString(locale === "hi" ? "hi-IN" : "en-IN", { dateStyle: "medium" });
}

export function formatDate(d: Date | string | null | undefined, locale = "en", opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00" : d) : d;
  return date.toLocaleString(locale === "hi" ? "hi-IN" : "en-IN", opts);
}

export function formatMoney(amount: string | number | null | undefined, currency = "INR", locale = "en") {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(n: number, locale = "en") {
  return new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { notation: n >= 10000 ? "compact" : "standard" }).format(n);
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "N";
}
