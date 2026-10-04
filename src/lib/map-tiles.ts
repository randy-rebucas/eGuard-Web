import "server-only";

/**
 * The map's tile provider, read on the server only (the URL can hold an API key). MAP_TILE_URL is the upstream
 * template, e.g. "https://tile.openstreetmap.org/{z}/{x}/{y}.png" (the default, fine for development and light use
 * under OSM's tile policy) or a commercial provider's URL with its key.
 */

const DEFAULT_UPSTREAM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const tileUpstream = () => process.env.MAP_TILE_URL || DEFAULT_UPSTREAM;

/**
 * The Referer sent with tile requests. Providers such as MapTiler can restrict a key to allowed websites, checked
 * against this header; tiles fetched by the server carry none unless we send one. MAP_TILE_REFERER when set (the
 * site the key allows, e.g. "https://www.eguard.family/" in development), else this site's own APP_URL.
 */
export const tileReferer = () => process.env.MAP_TILE_REFERER || `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/`;

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** The credit the provider's terms ask for, shown in the map's corner. */
export function tileAttribution() {
  const host = (() => { try { return new URL(tileUpstream()).hostname; } catch { return ""; } })();
  if (host.endsWith("maptiler.com")) return `&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ${OSM}`;
  return OSM;
}
