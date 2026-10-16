"use client";
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker.register("/sw.js").then((r) => {
      reg = r;
      r.addEventListener("updatefound", () => {
        const w = r.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) w.postMessage({ type: "SKIP_WAITING" });
        });
      });
    }).catch(() => {});
    const onCtl = () => { /* new worker took over; next navigation uses fresh assets */ };
    navigator.serviceWorker.addEventListener("controllerchange", onCtl);
    return () => { navigator.serviceWorker.removeEventListener("controllerchange", onCtl); void reg; };
  }, []);
  return null;
}
