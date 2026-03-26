import { bad, raw } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";

export async function handleGetMapsDownload(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/maps\/download\/([^\/]+)$/);
  if (!m || method !== "GET") return null;

  const mapId = decodeURIComponent(m[1])?.trim();
  logInfo(requestId, "route.maps.download.hit", { mapId });

  if (!mapId) {
    logWarn(requestId, "route.maps.download.bad_request", {
      reason: "invalid map id",
    });
    return bad("invalid map id");
  }

  const map = await env.DB.prepare(
    `
    SELECT file_key 
    FROM maps 
    WHERE id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(mapId)
    .first<{ file_key: string }>();

  if (!map) {
    logWarn(requestId, "route.maps.download.not_found", { mapId });
    return bad("map not found", 404);
  }

  const obj = await env.R2.get(map.file_key);
  if (!obj) {
    logWarn(requestId, "route.maps.download.not_found", {
      mapId,
      fileKey: map.file_key,
    });
    return bad("file not found", 404);
  }

  await env.DB.prepare(
    `
    UPDATE maps 
    SET visit_count = visit_count + 1 
    WHERE id = ? 
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(mapId)
    .run();

  const headers = new Headers();
  headers.set(
    "content-type",
    obj.httpMetadata?.contentType || "application/octet-stream",
  );
  headers.set("content-disposition", `attachment; filename="${mapId}.z"`);

  logInfo(requestId, "route.maps.download.ok", {
    mapId,
    fileKey: map.file_key,
  });
  return raw(obj.body, 200, headers);
}
