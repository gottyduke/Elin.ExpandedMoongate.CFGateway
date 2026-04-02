import { bad, raw } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { sanitizeFileName } from "../../utils/file";
import type { RouteContext } from "../../types";
import { MAP_CACHE_TTL } from "../../constants";

export async function handleGetMapsDownload({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  const url = new URL(request.url);

  const mapId = url.searchParams.get("mapId")?.trim() ?? "";
  const viewId = url.searchParams.get("viewId")?.trim() ?? "";

  logInfo(requestId, "route.maps.download.hit", { mapId, viewId });

  if (!mapId && !viewId) {
    logWarn(requestId, "route.maps.download.bad_request", {
      reason: "invalid map id or view id",
    });
    return bad("Invalid map id or view id");
  }

  const cache = caches.default;
  const cacheViewKey = new Request(`https://cache/view/${viewId}`);
  let map: { file_key: string } | null = null;

  if (viewId.length == 12) {
    const cached = await cache.match(cacheViewKey);
    if (cached) {
      return cached;
    }

    map = await env.DB.prepare(
      `
      SELECT file_key
      FROM maps
      WHERE view_id = ?
      `,
    )
      .bind(viewId)
      .first<{ file_key: string }>();
  } else {
    map = await env.DB.prepare(
      `
      SELECT file_key
      FROM maps_latest
      WHERE id = ?
      `,
    )
      .bind(mapId)
      .first<{ file_key: string }>();
  }

  if (!map) {
    logWarn(requestId, "route.maps.download.not_found", { mapId, viewId });
    return bad("Map not found", 404);
  }

  const cacheFileKey = new Request(`https://cache/file/${map.file_key}`);
  const cached = await cache.match(cacheFileKey);
  if (cached) {
    return cached;
  }

  const obj = await env.R2.get(map.file_key);
  if (!obj) {
    logWarn(requestId, "route.maps.download.not_found", {
      mapId,
      fileKey: map.file_key,
    });
    return bad("File not found", 404);
  }

  const safe = sanitizeFileName(mapId);
  const fallback = safe.replace(/[^\x20-\x7E]/g, "_") || "download.z";
  const encoded = encodeURIComponent(safe);

  const headers = new Headers();
  headers.set(
    "content-type",
    obj.httpMetadata?.contentType || "application/octet-stream",
  );
  headers.set(
    "content-disposition",
    `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
  );
  headers.set("cache-control", `public, max-age=${MAP_CACHE_TTL}, immutable`);

  logInfo(requestId, "route.maps.download.ok", {
    mapId,
    viewId,
    fileKey: map.file_key,
  });

  const response = raw(obj.body, 200, headers);

  ctx.waitUntil(cache.put(cacheViewKey, response.clone()));
  ctx.waitUntil(cache.put(cacheFileKey, response.clone()));

  return response;
}
