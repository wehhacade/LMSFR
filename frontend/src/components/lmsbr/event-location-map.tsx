"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { hexA } from "@/lib/lmsbr/data";
import { addBaseLayerControl } from "@/lib/map-tiles";

const MAP_HEIGHT = 480;
const DEFAULT_ZOOM = 17;

function markerHtml(accent: string): string {
  return `
    <div style="
      width:22px;height:22px;border-radius:50%;
      background:${accent};border:3px solid #fff;
      box-shadow:0 2px 12px ${hexA(accent, 0.5)};
    "></div>`;
}

function scheduleMapResize(map: L.Map, delays = [0, 120, 350, 700]) {
  const timers = delays.map((ms) =>
    window.setTimeout(() => map.invalidateSize({ animate: false }), ms),
  );
  return () => timers.forEach((id) => window.clearTimeout(id));
}

export function EventLocationMap({
  latitude,
  longitude,
  accent,
  layerLabels,
}: {
  latitude: number;
  longitude: number;
  accent: string;
  layerLabels?: { street: string; satellite: string };
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refreshMapSize = useCallback(() => {
    mapRef.current?.invalidateSize({ animate: false });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      } else {
        await shell.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by the browser.
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = shellRef.current === document.fullscreenElement;
      setIsFullscreen(active);
      window.setTimeout(refreshMapSize, 50);
      window.setTimeout(refreshMapSize, 250);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [refreshMapSize]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    const latLng: L.LatLngExpression = [latitude, longitude];

    const map = L.map(el, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      preferCanvas: false,
    });

    addBaseLayerControl(map, layerLabels);

    L.marker(latLng, {
      icon: L.divIcon({
        className: "event-location-marker",
        html: markerHtml(accent),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 1000,
    }).addTo(map);

    map.setView(latLng, DEFAULT_ZOOM);
    mapRef.current = map;

    const clearResizeTimers = scheduleMapResize(map);

    const ro = new ResizeObserver(() => {
      if (!disposed) window.requestAnimationFrame(refreshMapSize);
    });
    ro.observe(el);

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) scheduleMapResize(map);
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    return () => {
      disposed = true;
      clearResizeTimers();
      ro.disconnect();
      io.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, accent, layerLabels?.street, layerLabels?.satellite, refreshMapSize]);

  return (
    <div
      ref={shellRef}
      className="survey-map-shell event-location-map-shell"
      style={{
        width: "100%",
        height: MAP_HEIGHT,
        borderRadius: 14,
        overflow: "hidden",
        background: "#dde3ea",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <button
        type="button"
        className="survey-map-fullscreen-btn"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        title={isFullscreen ? "Exit full screen" : "Full screen"}
      >
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 9H5V5M15 9h4V5M9 15H5v4M15 15h4v4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M8 5H5v3M16 5h3v3M8 19H5v-3M16 19h3v-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
