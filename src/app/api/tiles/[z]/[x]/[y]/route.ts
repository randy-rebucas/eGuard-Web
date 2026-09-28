import { getUser } from "@/lib/auth";

/**
 * Map tiles for the family map, fetched by the server. Tiles at street zoom reveal roughly where a child is;
 * requested straight from the browser they'd go to the tile provider with the parent's IP address. Through
 * here the provider only sees this server, and a provider API key (in MAP_TILE_URL) never reaches the browser.
 *
 * MAP_TILE_URL is the upstream template, e.g. "https://tile.openstreetmap.org/{z}/{x}/{y}.png" (the default,
 * fine for development and light use under OSM's tile policy) or a commercial provider's URL with its key.
 */

export const dynamic = "force-dynamic";

const DEFAULT_UPSTREAM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAX_ZOOM = 18;
const TTL_MS = 24 * 3600_000;
const MAX_CACHED = 1500;

/** Small in-process cache (Map keeps insertion order, so the first key is the oldest). OSM asks proxies to cache. */
const cache = new Map<string, { body: ArrayBuffer; type: string; until: number }>();

function remember(key: string, body: ArrayBuffer, type: string) {
  cache.delete(key);
  cache.set(key, { body, type, until: Date.now() + TTL_MS });
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}

const tile = (body: ArrayBuffer, type: string) =>
  new Response(body, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });

export async function GET(_req: Request, ctx: RouteContext<"/api/tiles/[z]/[x]/[y]">) {
  // Parents only: this must not become an open proxy
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const p = await ctx.params;
  const [z, x, y] = [p.z, p.x, p.y.replace(/\.png$/, "")].map((v) => (/^\d{1,7}$/.test(v) ? Number(v) : NaN));
  const n = 2 ** z;
  if (!(z >= 0 && z <= MAX_ZOOM && x >= 0 && x < n && y >= 0 && y < n)) return new Response("Not found", { status: 404 });

  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return tile(hit.body, hit.type);

  const url = (process.env.MAP_TILE_URL || DEFAULT_UPSTREAM).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
  const site = process.env.APP_URL || "http://localhost:3000";
  try {
    // OSM's tile policy asks for a User-Agent that identifies the app
    const res = await fetch(url, { headers: { "User-Agent": `eGuard/1.0 (+${site})` }, signal: AbortSignal.timeout(10_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response("Tile unavailable", { status: 502 });
    const body = await res.arrayBuffer();
    remember(key, body, type);
    return tile(body, type);
  } catch {
    return new Response("Tile unavailable", { status: 502 });
  }
}
