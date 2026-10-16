export type ApiResult<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function callApi<T = Record<string, unknown>>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "POST", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json) return { ok: false, error: res.ok ? "Unexpected response." : `Request failed (${res.status}).` };
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    return json;
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}

export async function uploadFiles(files: File[], purpose = "post", alt?: string) {
  const fd = new FormData();
  for (const f of files) fd.append("file", f);
  fd.set("purpose", purpose);
  if (alt) fd.set("alt", alt);
  try {
    const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "same-origin" });
    const json = (await res.json()) as { ok: boolean; error?: string; files?: { id: string; url: string; thumbUrl: string | null; kind: string; mime: string }[] };
    return json;
  } catch {
    return { ok: false, error: "Upload failed. Check your connection." } as { ok: boolean; error?: string; files?: never };
  }
}
