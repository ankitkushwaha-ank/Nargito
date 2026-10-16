"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { callApi } from "@/lib/client-api";
import { useT } from "@/i18n/client";

type S = { type: string; title: string; href: string; sub: string | null };

export function SearchBox({ className, defaultValue = "" }: { className?: string; defaultValue?: string }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [items, setItems] = useState<S[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const h = setTimeout(async () => {
      const r = await callApi<{ items: S[] }>(`/api/search/suggest?q=${encodeURIComponent(q)}`, "GET");
      if (r.ok) { setItems(r.items); setActive(-1); }
    }, 200);
    return () => clearTimeout(h);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter" && active >= 0 && items[active]) { e.preventDefault(); setOpen(false); router.push(items[active]!.href); }
  }

  return (
    <div ref={box} className={className} role="search">
      <form action="/search" method="get" className="relative" onSubmit={() => setOpen(false)}>
        <label htmlFor={id} className="sr-only">{t("common.search")}</label>
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={id} name="q" type="search" value={q} autoComplete="off" placeholder={t("nav.searchPlaceholder")} maxLength={100}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          role="combobox" aria-expanded={open && items.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
          className="input !h-11 !rounded-full !border-transparent !bg-primary-tint/60 !pl-10 hover:!border-line"
        />
        {open && items.length > 0 && (
          <ul id={`${id}-list`} role="listbox" className="card absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto p-1 shadow-lg">
            {items.map((s, i) => (
              <li key={s.href} id={`${id}-o${i}`} role="option" aria-selected={i === active}>
                <a href={s.href} className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-primary-tint ${i === active ? "bg-primary-tint" : ""}`}>
                  <span className="min-w-0"><span className="block truncate">{s.title}</span>{s.sub && <span className="block truncate text-xs text-muted">{s.sub}</span>}</span>
                  <span className="shrink-0 rounded-full bg-line/60 px-2 py-0.5 text-xs capitalize text-muted">{s.type}</span>
                </a>
              </li>
            ))}
            <li role="presentation"><a href={`/search?q=${encodeURIComponent(q)}`} className="block rounded-md px-3 py-2 text-sm text-primary hover:bg-primary-tint">Search for “{q}”</a></li>
          </ul>
        )}
      </form>
    </div>
  );
}
