import type { MapUploadBody } from "../../types";
import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";

export async function handlePostMapsUpload(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/maps\/upload\/([^\/]+)$/);
  if (!m || method !== "POST") return null;

  const id = decodeURIComponent(m[1]);
  logInfo(requestId, "route.maps.upload.hit", { id });

  if (!id) {
    logWarn(requestId, "route.maps.upload.bad_request", { reason: "invalid id" });
    return bad("invalid id");
  }

  const exists = await env.DB.prepare(`SELECT 1 FROM maps WHERE id = ?`).bind(id).first();
  if (exists) {
    logWarn(requestId, "route.maps.upload.conflict", { id });
    return bad("map already exists", 409);
  }

  const payload = (await request.json()) as MapUploadBody;
  if (!payload?.Author) {
    logWarn(requestId, "route.maps.upload.bad_request", { id, reason: "author missing" });
    return bad("author is required");
  }

  if (!payload?.Version && payload?.Version !== 0) {
    logWarn(requestId, "route.maps.upload.bad_request", { id, reason: "version missing" });
    return bad("version is required");
  }

  const key = `maps/${id}.z`;
  const head = await env.R2.head(key);
  if (!head) {
    logWarn(requestId, "route.maps.upload.bad_request", { id, reason: "file not uploaded" });
    return bad("file not uploaded yet, upload /files/upload/:id first", 400);
  }

  await env.DB.prepare(`
    INSERT INTO maps
      (id, author, title, lang, cat, created_at, version, tag, is_official,
       visit_count, rating_count, rating_average, file_key, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `)
    .bind(
      id,
      payload.Author,
      payload.Title ?? null,
      payload.Lang ?? null,
      payload.Cat ?? null,
      payload.Date ?? new Date().toISOString().slice(0, 19).replace("T", " "),
      payload.Version,
      payload.Tag ?? null,
      payload.IsOfficial ? 1 : 0,
      key,
      head.size ?? 0,
    )
    .run();

  logInfo(requestId, "route.maps.upload.ok", {
    id,
    author: payload.Author,
    version: payload.Version,
    fileSize: head.size ?? 0,
  });

  return json({ ok: true, id }, 201);
}