import { json } from "../../utils/response";
import { logInfo } from "../../utils/logger";

export async function handleGetMapsQuery(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/maps\/query\/([^\/]+)$/);
  if (!m || method !== "GET") return null;

  const id = decodeURIComponent(m[1]);
  logInfo(requestId, "route.maps.query.hit", { id });

  const map = await env.DB.prepare(`SELECT file_key FROM maps WHERE id = ?`)
    .bind(id)
    .first<{ file_key: string }>();

  if (!map) {
    logInfo(requestId, "route.maps.query.not_found", { id });
    return json({ found: false });
  }

  const obj = await env.R2.head(map.file_key);
  if (!obj) {
    logInfo(requestId, "route.maps.query.not_found", {
      id,
      fileKey: map.file_key,
    });
    return json({ found: false }, 404);
  }

  logInfo(requestId, "route.maps.query.found", { id, fileKey: map.file_key });
  return json({ found: true, fileKey: map.file_key }, 200);
}