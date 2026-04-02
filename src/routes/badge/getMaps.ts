import { badge } from "../../utils/response";
import type { RouteContext } from "../../types";
import { BADGE_CACHE_TTL } from "../../constants";

export async function handleGetBadgeMaps({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  const cache = caches.default;
  const cacheKey = new Request(`https://cache/badge/maps`, request);

  if (!bypass) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const result = await env.DB.prepare(
    `
    SELECT COUNT(*) AS maps_count
    FROM maps_latest
    `,
  ).first<{ maps_count: number }>();

  const mapsCount = result?.maps_count.toString() ?? "unknown";

  const response = badge("maps", mapsCount, "blue");
  response.headers.set(
    "cache-control",
    `public, max-age=${BADGE_CACHE_TTL}, immutable`,
  );

  ctx.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}
