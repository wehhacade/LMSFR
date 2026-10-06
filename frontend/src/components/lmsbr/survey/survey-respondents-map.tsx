"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { hexA } from "@/lib/lmsbr/data";
import { addBaseLayerControl } from "@/lib/map-tiles";
import type { SurveyRespondentMapLocation, SurveyRespondentMapPinItem } from "@/types/surveys";

const DEFAULT_CENTER: L.LatLngExpression = [2.0469, 45.3182];
const DEFAULT_ZOOM = 14;
const MAP_HEIGHT = 480;

function respondentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) {
    const w = parts[0];
    if (/^\d+$/.test(w)) return "#";
    return w.slice(0, 2).toUpperCase();
  }
  return "?";
}

function markerHtml(initials: string, accent: string, selected: boolean): string {
  const size = selected ? 44 : 34;
  const bg = selected ? accent : hexA(accent, 0.82);
  const ring = selected
    ? `0 0 0 4px ${hexA(accent, 0.32)}`
    : `0 2px 8px ${hexA(accent, 0.3)}`;
  return `
    <div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};color:#fff;font-weight:700;font-size:${selected ? 13 : 11}px;
      display:flex;align-items:center;justify-content:center;
      font-family:var(--font-outfit),sans-serif;
      border:2px solid #fff;box-shadow:${ring};
      cursor:pointer;letter-spacing:.02em;
      opacity:${selected ? 1 : 0.92};
    ">${initials}</div>`;
}

function popupHtml(item: SurveyRespondentMapPinItem): string {
  const districts = item.districts.length
    ? item.districts.slice(0, 4).join(", ") + (item.districts.length > 4 ? "…" : "")
    : "—";
  return `
    <div style="font-family:var(--font-outfit),sans-serif;min-width:180px;line-height:1.45">
      <div style="font-weight:700;font-size:14px;margin-bottom:8px">${item.display_name}</div>
      <div style="font-size:12px;color:#4b5563">
        <div><strong>${item.submission_count}</strong> response${item.submission_count === 1 ? "" : "s"}</div>
        <div><strong>${item.district_count}</strong> degmo${item.district_count === 1 ? "" : "oyin"}</div>
        <div style="margin-top:4px">${districts}</div>
      </div>
    </div>`;
}

export function SurveyRespondentsMap({
  respondents,
  selectedKey,
  selectedLocations,
  accent,
  onSelect,
}: {
  respondents: SurveyRespondentMapPinItem[];
  selectedKey: string | null;
  selectedLocations: SurveyRespondentMapLocation[];
  accent: string;
  onSelect: (key: string) => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const trailsLayerRef = useRef<L.LayerGroup | null>(null);
  const markerByKeyRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const prevSelectedKeyRef = useRef<string | null>(null);
  const prevRespondentsKeyRef = useRef("");

  onSelectRef.current = onSelect;

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
      // Fullscreen may be blocked by the browser or unsupported.
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
    let resizeTimer: number | undefined;
    let ro: ResizeObserver | null = null;

    const map = L.map(el, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
    });

    addBaseLayerControl(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    trailsLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const refreshSize = () => {
      if (disposed || !mapRef.current) return;
      mapRef.current.invalidateSize({ animate: false });
    };

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    resizeTimer = window.setTimeout(refreshSize, 100);
    ro = new ResizeObserver(() => window.requestAnimationFrame(refreshSize));
    ro.observe(el);

    return () => {
      disposed = true;
      if (resizeTimer) window.clearTimeout(resizeTimer);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      trailsLayerRef.current = null;
      markerByKeyRef.current.clear();
      prevSelectedKeyRef.current = null;
      prevRespondentsKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const trailsLayer = trailsLayerRef.current;
    if (!map || !markersLayer || !trailsLayer) return;

    if (respondents.length === 0) {
      markersLayer.clearLayers();
      trailsLayer.clearLayers();
      markerByKeyRef.current.clear();
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const markerByKey = markerByKeyRef.current;
    const bounds = L.latLngBounds([]);
    const selected = respondents.find((r) => r.key === selectedKey) ?? null;
    const nextKeys = new Set(respondents.map((r) => r.key));

    for (const item of respondents) {
      const isSelected = item.key === selectedKey;
      const latLng: L.LatLngExpression = [item.latitude, item.longitude];
      bounds.extend(latLng);

      const icon = L.divIcon({
        className: "survey-map-marker",
        html: markerHtml(respondentInitials(item.display_name), accent, isSelected),
        iconSize: isSelected ? [44, 44] : [34, 34],
        iconAnchor: isSelected ? [22, 22] : [17, 17],
      });
      const existing = markerByKey.get(item.key);
      if (existing) {
        existing.setLatLng(latLng);
        existing.setIcon(icon);
        existing.setZIndexOffset(isSelected ? 1000 : 0);
        existing.setPopupContent(popupHtml(item));
      } else {
        const marker = L.marker(latLng, {
          icon,
          zIndexOffset: isSelected ? 1000 : 0,
        });
        marker.bindPopup(popupHtml(item), { closeButton: true, maxWidth: 260 });
        marker.on("click", () => onSelectRef.current(item.key));
        marker.addTo(markersLayer);
        markerByKey.set(item.key, marker);
      }
    }

    for (const [key, marker] of markerByKey) {
      if (!nextKeys.has(key)) {
        markersLayer.removeLayer(marker);
        markerByKey.delete(key);
      }
    }

    trailsLayer.clearLayers();
    if (selected) {
      for (const loc of selectedLocations) {
        const locLatLng: L.LatLngExpression = [loc.latitude, loc.longitude];
        bounds.extend(locLatLng);
        const dot = L.circleMarker(locLatLng, {
          radius: selectedLocations.length === 1 ? 8 : 6,
          color: accent,
          weight: 2,
          fillColor: "#fff",
          fillOpacity: 0.95,
        });
        dot.bindTooltip(loc.sub_county_name || selected.display_name, { direction: "top" });
        trailsLayer.addLayer(dot);
      }
      if (selectedLocations.length > 1) {
        trailsLayer.addLayer(
          L.polyline(
            selectedLocations.map((l) => [l.latitude, l.longitude] as L.LatLngExpression),
            { color: hexA(accent, 0.55), weight: 2, dashArray: "4 6" },
          ),
        );
      }
    }

    const respondentsKey = respondents.map((r) => r.key).join(",");
    const filterChanged = prevRespondentsKeyRef.current !== respondentsKey;
    const selectionChanged = prevSelectedKeyRef.current !== selectedKey;
    prevRespondentsKeyRef.current = respondentsKey;
    prevSelectedKeyRef.current = selectedKey;

    map.invalidateSize({ animate: false });

    if (filterChanged && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 });
      return;
    }

    if (selectionChanged && selected) {
      const focusBounds = L.latLngBounds([]);
      for (const loc of selectedLocations) {
        focusBounds.extend([loc.latitude, loc.longitude]);
      }
      focusBounds.extend([selected.latitude, selected.longitude]);
      if (focusBounds.isValid() && selectedLocations.length > 1) {
        map.flyToBounds(focusBounds, { padding: [56, 56], maxZoom: 18, duration: 0.5 });
      } else {
        map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 16), { duration: 0.45 });
      }
    }
  }, [respondents, selectedKey, selectedLocations, accent]);

  return (
    <div
      ref={shellRef}
      className="survey-map-shell"
      style={{
        width: "100%",
        height: MAP_HEIGHT,
        borderRadius: 12,
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
