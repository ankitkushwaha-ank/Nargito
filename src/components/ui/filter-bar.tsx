import { Search } from "lucide-react";

type Opt = { value: string; label: string };
/** GET-based filter form (works without JavaScript, shareable URLs). */
export function FilterBar({ action, q, fields, extra }: { action: string; q?: string; fields?: { name: string; label: string; value?: string; options?: Opt[]; type?: string; placeholder?: string }[]; extra?: React.ReactNode }) {
  return (
    <form action={action} method="get" role="search" className="card mb-5 flex flex-wrap items-end gap-3 p-3">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="f-q" className="label">Search</label>
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><input id="f-q" name="q" defaultValue={q} className="input !pl-9" placeholder="Keywords" maxLength={100} /></div>
      </div>
      {fields?.map((f) => (
        <div key={f.name} className="min-w-[140px]">
          <label htmlFor={`f-${f.name}`} className="label">{f.label}</label>
          {f.options ? (
            <select id={`f-${f.name}`} name={f.name} defaultValue={f.value ?? ""} className="input"><option value="">Any</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          ) : (
            <input id={`f-${f.name}`} name={f.name} type={f.type ?? "text"} defaultValue={f.value} placeholder={f.placeholder} className="input" />
          )}
        </div>
      ))}
      {extra}
      <button className="btn-primary">Apply</button>
      <a href={action} className="btn-ghost">Reset</a>
    </form>
  );
}
