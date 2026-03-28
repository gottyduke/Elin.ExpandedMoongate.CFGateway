import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MapMetaBody } from "../../types";
import { makeRequestId } from "../../utils/request";

export async function handlePostMapsUpload(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path !== "/maps/upload" || method !== "POST") return null;

  const mapId = url.searchParams.get("mapId")?.trim() ?? "";

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

  const fileName = sanitizeFileName(`${mapMeta.title}/${mapMeta.created_at}.z`);
  const fileKey = `files/${sanitizeFileName(mapMeta.author)}/${mapMeta.version}/${fileName}`;

  const head = await env.R2.head(fileKey);
  if (!head) {
    const fileKeyId = makeRequestId();
    logWarn(requestId, "route.maps.upload.wait_for_file", {
      mapId,
      fileKeyId,
      reason: "file not uploaded",
    });
    await env.KV.put(`pending-upload:${fileKeyId}`, fileKey, {
      expirationTtl: 120,
    });
    return json({ fileKeyId }, 424);
  } else {
    logInfo(requestId, "route.maps.upload.file_found", {
      mapId,
    });
  }

  const mapExist = await env.DB.prepare(
    `
    SELECT 1 
    FROM maps
    WHERE file_key = ?
    `,
  )
    .bind(fileKey)
    .first();
  if (mapExist && head) {
    logWarn(requestId, "route.maps.upload.conflict", {
      mapId,
      fileKey,
      reason: "file with same key exists",
    });
    return bad("meta with the same id and version already exists", 409);
  }

  await env.DB.prepare(
    `
    INSERT INTO maps (
        file_key, id, author, title, language, category, created_at, version, tag, 
        visit_count, rating_count, file_size, preview_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?);
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
