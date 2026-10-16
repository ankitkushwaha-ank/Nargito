"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crosshair, MapPinOff } from "lucide-react";
import { callApi } from "@/lib/client-api";

export function LocationControls({ enabled, hasArea, label, cities }: { enabled: boolean; hasArea: boolean; label: string | null; cities: string[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [city, setCity] = useState(cities[0] ?? "");
  const [busy, setBusy] = useState(false);

  async function useBrowser() {
    setErr(null); setMsg(null);
    if (!("geolocation" in navigator)) { setErr("Your browser does not support location. Choose a city instead."); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const r = await callApi("/api/location", "POST", { enabled: true, lat: pos.coords.latitude, lng: pos.coords.longitude });
      setBusy(false);
      if (r.ok) { setMsg("Approximate area saved. Your exact position was discarded."); router.refresh(); } else setErr(r.error);
    }, (e) => { setBusy(false); setErr(e.code === 1 ? "Permission denied. You can choose a city instead." : "Could not determine your location."); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }
  async function chooseCity() {
    setBusy(true); setErr(null);
    const r = await callApi("/api/location", "POST", { enabled: true, city });
    setBusy(false);
    if (r.ok) { setMsg(`Location set to ${city}.`); router.refresh(); } else setErr(r.error);
  }
  async function turnOff() {
    const r = await callApi("/api/location", "POST", { enabled: false });
    if (r.ok) { setMsg("Nearby discovery is off and your area was removed."); router.refresh(); } else setErr(r.error);
  }
  return (
    <div className="space-y-4">
      <p className="text-sm">Status: <b>{enabled && hasArea ? `On${label ? ` (${label})` : ""}` : "Off"}</b></p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={useBrowser}><Crosshair size={16} aria-hidden />Use my approximate location</button>
        {enabled && <button type="button" className="btn-secondary" onClick={turnOff}><MapPinOff size={16} aria-hidden />Turn off</button>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div><label htmlFor="city" className="label">Or choose a city</label><select id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)}>{cities.map((c) => <option key={c}>{c}</option>)}</select></div>
        <button type="button" className="btn-secondary" disabled={busy} onClick={chooseCity}>Set city</button>
      </div>
      <div aria-live="polite">{msg && <p className="text-sm text-success">{msg}</p>}{err && <p className="text-sm text-danger" role="alert">{err}</p>}</div>
    </div>
  );
}
