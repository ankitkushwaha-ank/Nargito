"use client";
import { useState } from "react";
import { Plus, Trash2, Lock } from "lucide-react";

type Item = { day: number; title: string; details: string; isPrivate: boolean };

export function ItineraryField({ initial = [] }: { initial?: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const upd = (i: number, patch: Partial<Item>) => setItems((x) => x.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <fieldset>
      <legend className="label">Itinerary</legend>
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="card space-y-2 p-3">
            <div className="flex gap-2">
              <div className="w-20"><label className="sr-only" htmlFor={`it-d-${i}`}>Day</label><input id={`it-d-${i}`} type="number" min={1} max={60} className="input" value={it.day} onChange={(e) => upd(i, { day: Number(e.target.value) || 1 })} /></div>
              <div className="flex-1"><label className="sr-only" htmlFor={`it-t-${i}`}>Title</label><input id={`it-t-${i}`} className="input" placeholder="What happens?" value={it.title} maxLength={120} onChange={(e) => upd(i, { title: e.target.value })} /></div>
              <button type="button" className="btn-ghost" aria-label="Remove item" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
            </div>
            <label className="sr-only" htmlFor={`it-x-${i}`}>Details</label>
            <textarea id={`it-x-${i}`} className="input" rows={2} placeholder="Details" value={it.details} maxLength={1000} onChange={(e) => upd(i, { details: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={it.isPrivate} onChange={(e) => upd(i, { isPrivate: e.target.checked })} className="accent-primary" /><Lock size={12} aria-hidden />Private: only confirmed participants can see this</label>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-secondary mt-2" onClick={() => setItems((x) => [...x, { day: (x[x.length - 1]?.day ?? 0) + (x.length ? 0 : 1), title: "", details: "", isPrivate: false }])}><Plus size={16} aria-hidden />Add item</button>
      <input type="hidden" name="itinerary" value={JSON.stringify(items.filter((i) => i.title.trim()))} />
    </fieldset>
  );
}
