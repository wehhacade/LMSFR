import { TipApi } from "./api";
import type { ManagedUserRow } from "./types";

let cachedCoords: { latitude: number; longitude: number } | null = null;

/** Walkie sheet: only show agents within this radius (hides 500km+ ghosts). */
export const NEARBY_MAX_KM = 25;

export type LocationErrorCode = "unsupported" | "insecure" | "denied" | "unavailable" | "timeout";

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.name = "LocationError";
    this.code = code;
  }
}

export type NearbyAgentRow = ManagedUserRow & {
  distanceKm: number | null;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceForUser(
  user: ManagedUserRow,
  latitude: number,
  longitude: number,
): number | null {
  if (user.distanceKm != null && Number.isFinite(user.distanceKm)) return user.distanceKm;
  if (
    user.latitude != null &&
    user.longitude != null &&
    Number.isFinite(user.latitude) &&
    Number.isFinite(user.longitude)
  ) {
    return haversineKm(latitude, longitude, user.latitude, user.longitude);
  }
  return null;
}

function mapGeoError(err: GeolocationPositionError): LocationError {
  if (err.code === err.PERMISSION_DENIED) {
    return new LocationError("denied", "Location permission denied");
  }
  if (err.code === err.TIMEOUT) {
    return new LocationError("timeout", "Location timeout");
  }
  return new LocationError("unavailable", "Location unavailable");
}

function readPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** Request GPS — shows the browser/OS location prompt when possible. */
export async function getCurrentCoords(opts?: {
  forceRefresh?: boolean;
}): Promise<{ latitude: number; longitude: number }> {
  if (!opts?.forceRefresh && cachedCoords) return cachedCoords;

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    throw new LocationError("unsupported", "Geolocation not available");
  }
  if (!window.isSecureContext && window.location.hostname !== "localhost") {
    throw new LocationError("insecure", "Location needs HTTPS (or localhost)");
  }
  if (!navigator.geolocation) {
    throw new LocationError("unsupported", "Geolocation not supported");
  }

  try {
    const status = await navigator.permissions?.query?.({ name: "geolocation" as PermissionName });
    if (status?.state === "denied") {
      throw new LocationError("denied", "Location permission denied");
    }
  } catch (err) {
    if (err instanceof LocationError) throw err;
  }

  let lastError: LocationError | null = null;

  try {
    const pos = await readPosition({
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: opts?.forceRefresh ? 0 : 60_000,
    });
    cachedCoords = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
    return cachedCoords;
  } catch (err) {
    lastError =
      err && typeof err === "object" && "code" in err
        ? mapGeoError(err as GeolocationPositionError)
        : new LocationError("unavailable", "Location unavailable");
    if (lastError.code === "denied") throw lastError;
  }

  try {
    const pos = await readPosition({
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
    cachedCoords = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
    return cachedCoords;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      throw mapGeoError(err as GeolocationPositionError);
    }
    throw lastError ?? new LocationError("unavailable", "Location unavailable");
  }
}

/**
 * List nearby active agents by live GPS radius.
 * Uses global distance sort (not "page 1 of every county") so far agents (500km+) stay out.
 */
export async function listNearbyAgents(selfId: number): Promise<NearbyAgentRow[]> {
  const coords = await getCurrentCoords({ forceRefresh: true });
  const { latitude, longitude } = coords;
  void TipApi.saveUserLocation(selfId, latitude, longitude).catch(() => {});

  const byId = new Map<number, NearbyAgentRow>();
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page++) {
    const { users, totalPages } = await TipApi.fetchUsers({
      countyId: 0,
      page,
      latitude,
      longitude,
      maxDistanceKm: NEARBY_MAX_KM,
    });

    for (const user of users) {
      if (!user.is_active || user.id === selfId) continue;
      const distanceKm = distanceForUser(user, latitude, longitude);
      // Drop anyone without a real distance or outside the radius.
      if (distanceKm == null || distanceKm > NEARBY_MAX_KM) continue;
      const prev = byId.get(user.id);
      if (!prev || (prev.distanceKm != null && distanceKm < prev.distanceKm) || prev.distanceKm == null) {
        byId.set(user.id, {
          ...user,
          distanceKm,
          isClosest: false,
        });
      }
    }

    if (page >= totalPages || users.length === 0) break;
  }

  const rows = [...byId.values()].sort((a, b) => {
    const da = a.distanceKm ?? Infinity;
    const db = b.distanceKm ?? Infinity;
    if (da !== db) return da - db;
    return a.username.localeCompare(b.username);
  });

  return rows.map((row, idx) => ({
    ...row,
    isClosest: idx === 0,
  }));
}

export function formatDistanceLabel(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) {
    const m = Math.max(1, Math.round(km * 1000));
    return `${m} m`;
  }
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
