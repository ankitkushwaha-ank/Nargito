"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Detail = { urls: string[]; index: number; alts?: string[] };

/** Open the in-site image viewer from anywhere on the client. */
export function openLightbox(urls: string[], index = 0, alts?: string[]) {
  window.dispatchEvent(new CustomEvent<Detail>("nargito:zoom", { detail: { urls, index, alts } }));
}

/**
 * Mounted once in the root layout. Opens a full-screen viewer for `nargito:zoom` events and for clicks on
 * any element carrying `data-zoom="<full-size url>"` (optionally grouped with `data-zoom-group`).
 */
export function LightboxRoot() {
  const [state, setState] = useState<Detail | null>(null);
  const close = useCallback(() => setState(null), []);
  const step = useCallback((d: number) => setState((s) => (s ? { ...s, index: (s.index + d + s.urls.length) % s.urls.length } : s)), []);

  useEffect(() => {
    const onEvent = (e: Event) => setState((e as CustomEvent<Detail>).detail);
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-zoom]");
      if (!el || e.defaultPrevented) return;
      e.preventDefault();
      const group = el.dataset.zoomGroup;
      const nodes = group ? Array.from(document.querySelectorAll<HTMLElement>(`[data-zoom][data-zoom-group="${CSS.escape(group)}"]`)) : [el];
      const urls = nodes.map((n) => n.dataset.zoom!).filter(Boolean);
      setState({ urls, index: Math.max(0, nodes.indexOf(el)), alts: nodes.map((n) => n.getAttribute("alt") ?? "") });
    };
    window.addEventListener("nargito:zoom", onEvent);
    document.addEventListener("click", onClick);
    return () => { window.removeEventListener("nargito:zoom", onEvent); document.removeEventListener("click", onClick); };
  }, []);

  useEffect(() => {
    if (!state) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [state, close, step]);

  if (!state) return null;
  const multi = state.urls.length > 1;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={close}>
      <button type="button" aria-label="Close image" onClick={close} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 sm:right-6 sm:top-6"><X size={22} aria-hidden /></button>
      {multi && <button type="button" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 sm:left-6"><ChevronLeft size={24} aria-hidden /></button>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.urls[state.index]} alt={state.alts?.[state.index] ?? ""} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
      {multi && <button type="button" aria-label="Next image" onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 sm:right-6"><ChevronRight size={24} aria-hidden /></button>}
      {multi && <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">{state.index + 1} / {state.urls.length}</p>}
    </div>
  );
}
