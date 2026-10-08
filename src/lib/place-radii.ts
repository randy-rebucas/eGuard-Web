/** Saved places (shared with the browser): how many a family can name, and the radius a parent can choose (metres). */
export const MAX_PLACES = 30;
export const PLACE_RADII = [100, 150, 250, 500, 1000] as const;
export const DEFAULT_RADIUS_M = 150;

/**
 * "14.6507, 121.0494" (as maps apps copy them; a space instead of the comma works too) as a point, or null when it
 * isn't one or is out of range.
 */
export function parseLatLng(s: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
