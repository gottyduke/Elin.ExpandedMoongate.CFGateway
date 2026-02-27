import { bad } from "../utils/response";
import { logInfo, logWarn } from "../utils/logger";

export async function handleMapsDownload(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/maps\/download\/([^\/]+)$/);
  if (!m || method !== "GET") return null;

  const id = decodeURIComponent(m[1]);
  logInfo(requestId, "route.maps.download.hit", { id });

  const map = await env.DB.prepare(`SELECT file_key FROM maps WHERE id = ?`)
    .bind(id)
    .first<{ file_key: string }>();

  if (!map) {
    logWarn(requestId, "route.maps.download.not_found", { id });
    return bad("map not found", 404);
  }

  const obj = await env.R2.get(map.file_key);
  if (!obj) {
    logWarn(requestId, "route.maps.download.not_found", { id, fileKey: map.file_key });
    return bad("file not found", 404);
  }

  await env.DB.prepare(`UPDATE maps SET visit_count = visit_count + 1 WHERE id = ?`)
    .bind(id)
    .run();

  const headers = new Headers();
  headers.set("content-type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("content-disposition", `attachment; filename="${id}.z"`);

  logInfo(requestId, "route.maps.download.ok", { id, fileKey: map.file_key });
  return new Response(obj.body, { status: 200, headers });
}