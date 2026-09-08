/**
 * Pure, deterministic location helpers for Step 7 worker matching.
 *
 * No external map/geocoding API is used. Coordinates are optional and may be
 * supplied as free-text location strings such as "18.5204,73.8567". When
 * coordinates are absent or invalid, callers must fall back to city/locality
 * text matching.
 */
const EARTH_RADIUS_KM = 6371;

/** Accepts "lat,lng", "lat, lng", "lat;lng", or "lat lng". */
const COORDINATE_PATTERN = /^(-?\d+(?:\.\d+)?)\s*[,;\t ]\s*(-?\d+(?:\.\d+)?)$/;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function parseCoordinates(location: string | null | undefined): Coordinates | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;
  const match = trimmed.match(COORDINATE_PATTERN);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/**
 * Haversine great-circle distance in kilometres.
 *
 * Returns NaN (not a throw) for invalid input so callers can treat the result
 * as "distance unavailable" and fall back safely.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  for (const [lat, lon] of [
    [lat1, lon1],
    [lat2, lon2],
  ]) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NaN;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return NaN;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Distance threshold (km) under which a worker is considered nearby. */
export const PROXIMITY_THRESHOLD_KM = 50;
