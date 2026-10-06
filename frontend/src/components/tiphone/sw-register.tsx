"use client";

import { useEffect } from "react";

export function TipPhoneSwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // A first-time install also swaps the controller; only a replacement needs a reload.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    function onControllerChange() {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // SW is served from /api/tiphone/sw.js so its default scope covers the PWA route.
    navigator.serviceWorker
      .register("/api/tiphone/sw.js", { scope: "/api/tiphone" })
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
