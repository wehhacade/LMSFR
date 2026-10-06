"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { useAmnigaUserTrackMap } from "@/hooks/use-amniga";
import { ShimmerBlock } from "./shimmer";
import { AmnigaAgentPicker } from "./amniga-agent-picker";
import type { AccountsThemeColors } from "./accounts-shared";
import type maplibregl from "maplibre-gl";

type ThemeColors = AccountsThemeColors & {
  cardBdr: string;
  panelBg: string;
  panelShadow: string;
  txtMuted: string;
  txtPrimary: string;
  inputBg: string;
  inputBdr: string;
};

const DEFAULT_CENTER: [number, number] = [2.0469, 45.3182];
const DEFAULT_ZOOM = 12;
const MAP_GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

function agentDisplayName(name: string, idLast4?: string | null, userCode?: string) {
  const last4 = (idLast4 || "").trim()
    || String(userCode || "").replace(/\D/g, "").slice(-4)
    || String(userCode || "").slice(-4);
  const label = (name || "").trim() || userCode || "";
  return last4 ? `${label} · ${last4}` : label;
}

const SATELLITE_STYLE = {
  version: 8,
  glyphs: MAP_GLYPHS,
  sources: {
    esri_satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles © Esri",
      maxzoom: 18,
    },
    esri_labels: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Labels © Esri",
      maxzoom: 18,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "esri_satellite" },
    { id: "labels", type: "raster", source: "esri_labels" },
  ],
};

const STREET_STYLE = {
  version: 8,
  glyphs: MAP_GLYPHS,
  sources: {
    carto_street: {
      type: "raster",
      tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
      maxzoom: 18,
    },
  },
  layers: [{ id: "street", type: "raster", source: "carto_street" }],
};

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function trackDistanceKm(points: Array<{ latitude: number; longitude: number }>): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineKm(
      [points[i - 1].latitude, points[i - 1].longitude],
      [points[i].latitude, points[i].longitude],
    );
  }
  return total;
}

export function AmnigaTrackMapPage({
  C,
  accent,
  isDark,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const t = getDict(lang);

  const [selectedUserRef, setSelectedUserRef] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [hours, setHours] = useState<number>(0);
  const [agentFilter, setAgentFilter] = useState<"all" | "on_duty" | "gps" | "field">("gps");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"satellite" | "street">("satellite");
  const [styleRevision, setStyleRevision] = useState(0);
  const { data, isLoading, isFetching } = useAmnigaUserTrackMap({
    userId: selectedUserRef,
    hours,
    search: userSearch,
  }, true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapShellRef = useRef<HTMLDivElement>(null);
  const maplibreRef = useRef<typeof maplibregl | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const blinkTimerRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const ensureTrackLayers = (map: maplibregl.Map) => {
    if (!map.getSource("track")) {
      map.addSource("track", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer("track-line")) {
      map.addLayer({
        id: "track-line",
        type: "line",
        source: "track",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ef4444", "line-width": 4, "line-opacity": 0.95 },
        filter: ["==", ["geometry-type"], "LineString"],
      });
    }
    if (map.getLayer("track-area")) {
      map.removeLayer("track-area");
    }
    if (!map.getLayer("track-points")) {
      map.addLayer({
        id: "track-points",
        type: "circle",
        source: "track",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "is_last"], 1], 9,
            ["==", ["get", "is_first"], 1], 8,
            5.5,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "is_last"], 1], "#22c55e",
            ["==", ["get", "is_first"], 1], "#3b82f6",
            "#ef4444",
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
        filter: ["==", ["geometry-type"], "Point"],
      });
    }
    try {
      if (!map.getLayer("track-label")) {
        map.addLayer({
          id: "track-label",
          type: "symbol",
          source: "track",
          filter: ["==", ["get", "is_last"], 1],
          layout: {
            "text-field": ["get", "label"],
            "text-font": ["Open Sans Regular"],
            "text-size": 13,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#111111",
            "text-halo-width": 1.5,
          },
        });
      }
    } catch {
      /* glyphs optional — dots/track still render */
    }
    if (!map.getSource("agents")) {
      map.addSource("agents", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer("agent-dots")) {
      map.addLayer({
        id: "agent-dots",
        type: "circle",
        source: "agents",
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], 1], 10, 7],
          "circle-color": [
            "case",
            ["==", ["get", "in_field"], 1], "#22c55e",
            ["==", ["get", "on_duty"], 1], "#e6b25c",
            "#64748b",
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
      });
    }
    try {
    if (!map.getLayer("agent-labels")) {
      map.addLayer({
        id: "agent-labels",
        type: "symbol",
        source: "agents",
        layout: {
          "text-field": ["concat", ["get", "name"], " · ", ["get", "id_last4"]],
          "text-font": ["Open Sans Regular"],
          "text-size": ["case", ["==", ["get", "selected"], 1], 13, 11],
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-optional": true,
          "text-allow-overlap": false,
          "text-padding": 2,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#111111",
          "text-halo-width": 1.4,
        },
      });
    }
    } catch {
      /* glyphs optional — dots/track still render */
    }
  };

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;
    let disposed = false;
    let map: maplibregl.Map | null = null;

    void (async () => {
      const mod = await import("maplibre-gl");
      if (disposed) return;
      const maplibre = mod.default;
      maplibreRef.current = maplibre;
      map = new maplibre.Map({
        container: el,
        style: SATELLITE_STYLE as never,
        center: [DEFAULT_CENTER[1], DEFAULT_CENTER[0]],
        zoom: DEFAULT_ZOOM,
        maxZoom: 18,
        attributionControl: {},
      });
      map.addControl(new maplibre.NavigationControl(), "top-right");
      map.on("load", () => {
        ensureTrackLayers(map!);
        map!.on("click", "agent-dots", (event) => {
          const code = event.features?.[0]?.properties?.user_code;
          if (code) setSelectedUserRef(String(code));
        });
        map!.on("mouseenter", "agent-dots", () => {
          map!.getCanvas().style.cursor = "pointer";
        });
        map!.on("mouseleave", "agent-dots", () => {
          map!.getCanvas().style.cursor = "";
        });
        setMapReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      if (blinkTimerRef.current) {
        window.clearInterval(blinkTimerRef.current);
        blinkTimerRef.current = null;
      }
      disposed = true;
      map?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(document.fullscreenElement === mapShellRef.current);
      window.setTimeout(() => mapRef.current?.resize(), 80);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !mapReady) return;
    const source = map.getSource("track") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (blinkTimerRef.current) {
      window.clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }

    const points = data?.points ?? [];
    const agentSource = map.getSource("agents") as maplibregl.GeoJSONSource | undefined;
    const ref = String(selectedUserRef || "").toLowerCase();
    const overviewMarkers = (data?.markers ?? []).filter((m) => {
      if (agentFilter === "on_duty") return m.on_duty;
      if (agentFilter === "gps") return true;
      if (agentFilter === "field") return m.in_field;
      return true;
    });
    const selectedMarker = ref
      ? overviewMarkers.find((m) => String(m.user_code).toLowerCase() === ref || String(m.id) === String(selectedUserRef))
      : undefined;
    const showTrackOnly = Boolean(ref && points.length > 0);
    const markers = showTrackOnly
      ? []
      : (ref && selectedMarker ? [selectedMarker] : overviewMarkers);
    if (agentSource) {
      agentSource.setData({
        type: "FeatureCollection",
        features: markers.map((m) => ({
          type: "Feature",
          properties: {
            user_code: m.user_code,
            name: m.name,
            id_last4: m.id_last4 || String(m.user_code).replace(/\D/g, "").slice(-4) || String(m.user_code).slice(-4),
            on_duty: m.on_duty ? 1 : 0,
            in_field: m.in_field ? 1 : 0,
            selected: ref && String(m.user_code).toLowerCase() === ref ? 1 : 0,
          },
          geometry: { type: "Point", coordinates: [m.longitude, m.latitude] },
        })),
      } as never);
    }
    const validPoints = points.filter((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (lat === Math.trunc(lat) && lng === Math.trunc(lng)) return false;
      return true;
    });
    if (validPoints.length === 0) {
      source.setData({ type: "FeatureCollection", features: [] } as never);
      if (markers.length) {
        const bounds = new maplibre.LngLatBounds(
          [markers[0].longitude, markers[0].latitude],
          [markers[0].longitude, markers[0].latitude],
        );
        markers.forEach((m) => bounds.extend([m.longitude, m.latitude]));
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 700 });
      } else {
        map.flyTo({ center: [DEFAULT_CENTER[1], DEFAULT_CENTER[0]], zoom: DEFAULT_ZOOM, duration: 500 });
      }
      return;
    }
    const coords = validPoints.map((p) => [p.longitude, p.latitude] as [number, number]);
    const selectedMeta = (data?.users ?? []).find((u) => String(u.user_code) === String(selectedUserRef));
    const selectedLabel = agentDisplayName(selectedMeta?.name || "", selectedMeta?.id_last4, selectedUserRef);
    const features: any[] = coords.map((coord, idx) => ({
      type: "Feature",
      id: idx + 1,
      properties: {
        is_first: idx === 0 ? 1 : 0,
        is_last: idx === coords.length - 1 ? 1 : 0,
        label: idx === coords.length - 1
          ? selectedLabel
          : idx === 0
            ? `${lang === "so" ? "Bilow" : "Start"} • ${new Date(validPoints[idx].timestamp).toLocaleString()}`
            : `${lang === "so" ? "Goob" : "Place"} ${idx + 1} • ${new Date(validPoints[idx].timestamp).toLocaleString()}`,
      },
      geometry: { type: "Point", coordinates: coord },
    }));
    const segments: [number, number][][] = [];
    let current: [number, number][] = [];
    for (let i = 0; i < coords.length; i += 1) {
      const coord = coords[i];
      if (current.length === 0) {
        current.push(coord);
        continue;
      }
      const prev = current[current.length - 1];
      const jumpKm = haversineKm([prev[1], prev[0]], [coord[1], coord[0]]);
      if (jumpKm > 40) {
        if (current.length >= 2) segments.push(current);
        current = [coord];
      } else {
        current.push(coord);
      }
    }
    if (current.length >= 2) segments.push(current);
    for (const line of segments) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: line },
      });
    }
    source.setData({ type: "FeatureCollection", features } as never);

    const lastId = coords.length;
    let on = false;
    blinkTimerRef.current = window.setInterval(() => {
      on = !on;
      if (!map.getLayer("track-points")) return;
      map.setPaintProperty(
        "track-points",
        "circle-radius",
        ["case",
          ["==", ["id"], lastId], on ? 12 : 8,
          ["==", ["get", "is_first"], 1], 8,
          5.5,
        ],
      );
      map.setPaintProperty(
        "track-points",
        "circle-color",
        ["case",
          ["==", ["id"], lastId], on ? "#22c55e" : "#10b981",
          ["==", ["get", "is_first"], 1], "#3b82f6",
          "#ef4444",
        ],
      );
      map.setPaintProperty(
        "track-points",
        "circle-opacity",
        ["case", ["==", ["id"], lastId], on ? 0.38 : 1, 1],
      );
    }, 550);

    const bounds = new maplibre.LngLatBounds(coords[0], coords[0]);
    coords.forEach((coord) => bounds.extend(coord));
    map.fitBounds(bounds, { padding: 34, maxZoom: 17, duration: 700 });
  }, [data?.points, data?.markers, agentFilter, lang, mapReady, selectedUserRef, styleRevision]);

  const selectedUser = useMemo(
    () => data?.users.find((u) => String(u.user_code) === String(selectedUserRef)),
    [data?.users, selectedUserRef],
  );
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return (data?.users ?? []).filter((u) => {
      if (agentFilter === "on_duty" && !u.on_duty) return false;
      if (agentFilter === "gps" && !u.has_gps && !u.has_track) return false;
      if (agentFilter === "field" && !u.in_field) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q)
        || (u.phone || "").toLowerCase().includes(q)
        || u.id_last4.includes(q)
        || u.user_code.toLowerCase().includes(q)
        || String(u.id).includes(q);
    }).sort((a, b) => {
      const at = a.track_count ?? (a.has_track ? 1 : 0);
      const bt = b.track_count ?? (b.has_track ? 1 : 0);
      if (bt !== at) return bt - at;
      const ag = Number(Boolean(a.has_gps));
      const bg = Number(Boolean(b.has_gps));
      if (bg !== ag) return bg - ag;
      return a.name.localeCompare(b.name);
    });
  }, [data?.users, userSearch, agentFilter]);

  useEffect(() => {
    if (!selectedUserRef || hours === 0) return;
    if ((data?.points?.length ?? 0) > 0) return;
    const u = data?.users.find((row) => String(row.user_code) === String(selectedUserRef));
    if ((u?.track_count ?? 0) > 0 || u?.has_track) {
      setHours(0);
    }
  }, [selectedUserRef, hours, data?.points, data?.users]);

  useEffect(() => {
    if (data?.selected_denied && selectedUserRef) {
      setSelectedUserRef("");
    }
  }, [data?.selected_denied, selectedUserRef]);

  useEffect(() => {
    if (!userSearch.trim()) return;
    if (filteredUsers.some((u) => String(u.user_code) === selectedUserRef)) return;
    if (selectedUserRef) setSelectedUserRef("");
  }, [filteredUsers, selectedUserRef, userSearch]);

  const distanceKm = useMemo(() => trackDistanceKm(data?.points ?? []), [data?.points]);
  const latestPoint = data?.points?.[data.points.length - 1];

  const focusLastPoint = () => {
    const map = mapRef.current;
    if (!map || !latestPoint) return;
    map.flyTo({
      center: [latestPoint.longitude, latestPoint.latitude],
      zoom: Math.min(Math.max(map.getZoom(), 17), 18),
      duration: 800,
    });
  };

  const switchMapStyle = (next: "satellite" | "street") => {
    const map = mapRef.current;
    if (!map || mapStyle === next) return;
    setMapStyle(next);
    map.setStyle((next === "satellite" ? SATELLITE_STYLE : STREET_STYLE) as never);
    map.once("styledata", () => {
      ensureTrackLayers(map);
      setStyleRevision((v) => v + 1);
    });
  };

  const toggleFullscreen = async () => {
    const shell = mapShellRef.current;
    if (!shell) return;
    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
    } else {
      await shell.requestFullscreen();
    }
  };


  return (
    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="lmsbr-toolbar-3" style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: C.panelBg,
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.panelShadow,
        display: "grid",
        gridTemplateColumns: "2fr 1fr auto",
        gap: 10,
        alignItems: "end",
      }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{t.trackUserLabel}</span>
          <AmnigaAgentPicker
            users={filteredUsers}
            value={selectedUserRef}
            onChange={setSelectedUserRef}
            search={userSearch}
            onSearchChange={setUserSearch}
            theme={{
              accent,
              isDark,
              txtPrimary: C.txtPrimary,
              txtMuted: C.txtMuted,
              txtSecondary: C.txtSecondary,
              inputBg: C.inputBg,
              inputBdr: C.inputBdr,
              cardBdr: C.cardBdr,
              panelBg: C.panelBg,
              panelShadow: C.panelShadow,
            }}
            labels={{
              selectAll: t.trackSelectAll,
              selectUser: t.trackUserLabel,
              searchPh: t.trackUserSearchPh,
              inField: lang === "so" ? "Goobta jooga" : "In the field",
              onDuty: t.trackOnDuty,
              offDuty: t.trackOffDuty,
              lastKnown: lang === "so" ? "Goob ugu dambeysay" : "Last known only",
              noGps: lang === "so" ? "GPS ma leh" : "No GPS",
              noResults: data?.search_denied ? t.trackNoPermission : t.trackNoAgentsFound,
              agentsCount: t.trackAgentsCountLabel,
              idLabel: t.trackAgentIdLabel,
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.txtMuted }}>{t.trackHoursLabel}</span>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            style={{
              height: 38,
              borderRadius: 10,
              border: `1px solid ${C.inputBdr}`,
              background: C.inputBg,
              color: C.txtPrimary,
              padding: "0 10px",
              fontFamily: "var(--font-outfit)",
            }}
          >
            <option value={0}>{t.trackHoursAll}</option>
            {[6, 12, 24, 72, 168, 720, 2160].map((h) => (
              <option key={h} value={h}>{h}h</option>
            ))}
          </select>
        </label>

        <div style={{ fontSize: 12, color: isFetching ? accent : C.txtMuted, minWidth: 90, textAlign: "right" }}>
          {isFetching ? (lang === "so" ? "Soo cusboonaysiin..." : "Refreshing...") : "\u00a0"}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {([
          ["all", t.trackFilterAll],
          ["on_duty", t.trackFilterOnDuty],
          ["gps", t.trackFilterWithGps],
          ["field", t.trackFilterInField],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setAgentFilter(key);
              setSelectedUserRef("");
            }}
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 999,
              border: `1px solid ${agentFilter === key ? accent : C.cardBdr}`,
              background: agentFilter === key ? hexA(accent, isDark ? 0.22 : 0.14) : C.inputBg,
              color: agentFilter === key ? accent : C.txtPrimary,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-outfit)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
        {lang === "so"
          ? `"GPS leh" waa ilaalada leh goob sax ah. Horumariyayaasha / superuser-ka lama soo bandhigo.`
          : `"With GPS" is agents with a valid last location. Developer / superuser accounts are hidden from this list.`}
      </div>

      <div className="lmsbr-kpi-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
        {[
          { id: "agents-total", label: t.trackAgentsTotal, value: data?.summary.agents_total ?? data?.users.length ?? 0, color: "#e6b25c" },
          { id: "agents-on-duty", label: t.trackAgentsOnDuty, value: data?.summary.agents_on_duty ?? 0, color: "#22c55e" },
          { id: "agents-with-gps", label: t.trackAgentsWithGps, value: data?.summary.agents_with_gps ?? 0, color: "#2563eb" },
          { id: "agents-in-field", label: t.trackAgentsInField, value: data?.summary.agents_in_field ?? 0, color: "#10b981" },
          { id: "point-count", label: t.trackPointCount, value: data?.summary.point_count ?? 0, color: "#ef4444" },
          { id: "distance-km", label: t.trackDistanceKm, value: Number(distanceKm.toFixed(2)), color: "#7c3aed" },
          { id: "latest", label: t.trackLatest, value: data?.summary.latest_at ? new Date(data.summary.latest_at).toLocaleString() : (selectedUser?.last_seen ? new Date(selectedUser.last_seen).toLocaleString() : "—"), color: "#0ea5e9" },
          { id: "selected-user", label: t.trackPhone, value: selectedUser?.phone || "—", color: selectedUser?.on_duty ? "#22c55e" : "#64748b" },
        ].map((item) => (
          <div key={item.id} style={{
            borderRadius: 12,
            border: `1px solid ${hexA(item.color, 0.28)}`,
            background: hexA(item.color, isDark ? 0.1 : 0.06),
            padding: "12px 12px",
          }}>
            <div style={{ fontSize: 11, color: C.txtMuted, marginBottom: 6 }}>{item.label}</div>
            <div style={{ color: item.color, fontWeight: 700, fontSize: 18, fontFamily: "var(--font-cinzel)" }}>
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${C.cardBdr}`,
        boxShadow: C.panelShadow,
        background: C.panelBg,
        position: "relative",
      }}>
        <div ref={mapShellRef} style={{ width: "100%", height: 520, position: "relative" }}>
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
          <div style={{ position: "absolute", left: 12, top: 12, display: "flex", gap: 8, zIndex: 500 }}>
            <button
              type="button"
              onClick={() => switchMapStyle("street")}
              style={{
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${hexA(accent, 0.35)}`,
                background: mapStyle === "street" ? accent : (isDark ? hexA(accent, 0.16) : "#fff"),
                color: mapStyle === "street" ? "#fff" : accent,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {lang === "so" ? "Jidad" : "Streets"}
            </button>
            <button
              type="button"
              onClick={() => switchMapStyle("satellite")}
              style={{
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${hexA(accent, 0.35)}`,
                background: mapStyle === "satellite" ? accent : (isDark ? hexA(accent, 0.16) : "#fff"),
                color: mapStyle === "satellite" ? "#fff" : accent,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Satellite + Labels
            </button>
            <button
              type="button"
              onClick={focusLastPoint}
              disabled={!latestPoint}
              style={{
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${hexA(accent, 0.35)}`,
                background: isDark ? hexA(accent, 0.16) : "#fff",
                color: accent,
                fontSize: 12,
                fontWeight: 600,
                cursor: latestPoint ? "pointer" : "not-allowed",
                opacity: latestPoint ? 1 : 0.5,
              }}
            >
              {lang === "so" ? "Meesha Ugu Dambeysay" : "Last Location"}
            </button>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              style={{
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                border: `1px solid ${hexA(accent, 0.35)}`,
                background: isDark ? hexA(accent, 0.16) : "#fff",
                color: accent,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isFullscreen ? (lang === "so" ? "Yaree" : "Exit Full") : "Fullsize"}
            </button>
          </div>
          <div style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            zIndex: 500,
            maxWidth: 320,
            borderRadius: 10,
            padding: "10px 12px",
            background: isDark ? "rgba(10,12,16,0.78)" : "rgba(255,255,255,0.9)",
            border: `1px solid ${C.cardBdr}`,
            boxShadow: C.panelShadow,
            fontSize: 11,
            color: C.txtPrimary,
            lineHeight: 1.45,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{lang === "so" ? "Sharaxaad Khariidad" : "Map Legend"}</div>
            <div>{lang === "so" ? "• Cagaar: ilaalo goobta jooga (6 saacadood)" : "• Green: agent in the field (last 6h)"}</div>
            <div>{lang === "so" ? "• Dahab: shaqaynaya (Joogey)" : "• Amber: on duty"}</div>
            <div>{lang === "so" ? "• Cawlan: maqan / fasax" : "• Gray: off duty"}</div>
            <div>{lang === "so" ? "• Khad cas: raadka ilaalada la doortay" : "• Red line: selected agent route"}</div>
            <div>{lang === "so" ? "• Buluug: bilowga raadka" : "• Blue: start of route"}</div>
            <div>{lang === "so" ? "• Dhibco cas: goobaha uu maray" : "• Red dots: places along the route"}</div>
            <div>{lang === "so" ? "• Cagaar biriq-biriq: meesha ugu dambeysay" : "• Blinking green: latest point on route"}</div>
          </div>
        </div>
        {(isLoading || !mapReady) && (
          <div style={{ position: "absolute", inset: 0 }}>
            <ShimmerBlock h={520} />
          </div>
        )}
      </div>
      {selectedUser && !data?.summary.point_count && (
        <div style={{
          marginTop: -4,
          fontSize: 12,
          color: C.txtMuted,
          fontFamily: "var(--font-outfit)",
        }}>
          {(selectedUser.track_count ?? 0) > 0 || selectedUser.has_track
            ? (lang === "so"
              ? `${selectedUser.name} wuxuu leeyahay raad, laakiin ma jiro dhibic ${hours} saacadood. Door soo Dhammaan.`
              : `${selectedUser.name} has movement history outside this window. Switch time range to All time to see the red route.`)
            : selectedUser.has_gps
              ? (lang === "so"
                ? `${selectedUser.name} wuxuu leeyahay goob ugu dambeysay oo keliya — ma jiro dhaqaaq GPS (raad). Dooro ilaalo leh "pts" si aad khadka cas u aragto.`
                : `${selectedUser.name} only has a last-known pin — no movement pings were saved. Pick an agent with “pts” in the list to see the red route.`)
              : (lang === "so"
                ? `${selectedUser.name} GPS ma lahan. Dooro ilaalo GPS leh.`
                : `${selectedUser.name} has no GPS. Pick an agent with GPS to see their route.`)}
        </div>
      )}
      {!selectedUser && !(data?.markers?.length) && !isLoading && (
        <div style={{
          marginTop: -4,
          fontSize: 12,
          color: C.txtMuted,
          fontFamily: "var(--font-outfit)",
        }}>
          {lang === "so"
            ? "Ilaalo GPS leh lama helin. Hubi in user_location la soo dejiyey."
            : "No agents with GPS coordinates found."}
        </div>
      )}
    </div>
  );
}

