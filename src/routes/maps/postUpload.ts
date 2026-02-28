import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MapDbRecord, MapMetaBody } from "../../types";

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

  const mapId = decodeURIComponent(m[1])?.trim();
  logInfo(requestId, "route.maps.upload.hit", { mapId });

  if (!mapId) {
    logWarn(requestId, "route.maps.upload.bad_request", {
      reason: "invalid map id",
    });
    return bad("invalid map id");
  }

  const mapMeta = (await request.json()) as MapMetaBody;
  if (!mapMeta?.author) {
    logWarn(requestId, "route.maps.upload.bad_request", {
      mapId,
      reason: "author missing",
    });
    return bad("author is required");
  }

  if (mapMeta.version == null) {
    logWarn(requestId, "route.maps.upload.bad_request", {
      mapId,
      reason: "version missing",
    });
    return bad("version is required");
  }

  const fileName = sanitizeFileName(`${mapId}/${mapMeta.created_at}`);
  const fileKey = `files/${sanitizeFileName(mapMeta.author)}/${mapMeta.version}/${fileName}`;
  const mapExist = await env.DB.prepare(
    `
    SELECT 1 
    FROM maps
    WHERE file_key = ?
    `,
  )
    .bind(fileKey)
    .first();

  if (mapExist) {
    logWarn(requestId, "route.maps.upload.conflict", {
      mapId,
      fileKey,
      reason: "file with same key exists",
    });
    return bad("meta with the same id and version already exists", 409);
  }

  const head = await env.R2.head(fileKey);
  if (!head) {
    logWarn(requestId, "route.maps.upload.wait_for_file", {
      mapId,
      reason: "file not uploaded",
    });
    return json({ fileKey }, 424);
  } else {
    logInfo(requestId, "route.maps.upload.file_found", {
      mapId,
    });
  }

  await env.DB.prepare(
    `
    INSERT INTO maps (
        file_key, id, author, title, language, category, created_at, version, tag, 
        visit_count, rating_count, rating_average, file_size, preview_key
    )
    SELECT
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        COALESCE(m.visit_count, 0),
        COALESCE(m.rating_count, 0),
        COALESCE(m.rating_average, 0),
        ?, ?
    FROM (SELECT 1) AS dummy
    LEFT JOIN (
        SELECT visit_count, rating_count, rating_average
        FROM maps
        WHERE id = ?
        ORDER BY created_at DESC
        LIMIT 1
    ) m ON 1=1;
  `,
  )
    .bind(
      fileKey,
      mapId,
      mapMeta.author,
      mapMeta.title,
      mapMeta.language ?? null,
      mapMeta.category ?? null,
      mapMeta.created_at,
      mapMeta.version,
      mapMeta.tag ?? null,
      head.size ?? 0,
      null,
      mapId,
    )
    .run();

  logInfo(requestId, "route.maps.upload.ok", {
    mapId,
    fileName,
    fileKey,
    author: mapMeta.author,
    version: mapMeta.version,
    fileSize: head.size ?? 0,
  });

  return json({ ok: true, mapId }, 201);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
}
