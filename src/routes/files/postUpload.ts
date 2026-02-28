import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MAX_FILE_SIZE_BYTES } from "../../constants";
import { readWithLimit } from "../../utils/streamSize";

export async function handlePostFilesUpload(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const m = path.match(/^\/files\/upload\/([^\/]+)$/);
  if (!m || method !== "POST") return null;

  const id = decodeURIComponent(m[1]);
  logInfo(requestId, "route.files.upload.hit", { id });

  if (!id) {
    logWarn(requestId, "route.files.upload.bad_request", {
      reason: "invalid id",
    });
    return bad("invalid id");
  }

  const mapExists = await env.DB.prepare(`SELECT 1 FROM maps WHERE id = ?`)
    .bind(id)
    .first();
  if (mapExists) {
    logWarn(requestId, "route.files.upload.conflict", {
      id,
      reason: "map-meta-exists",
    });
    return bad("map id already exists in metadata", 409);
  }

  const key = `maps/${id}.z`;
  const existing = await env.R2.head(key);
  if (existing) {
    logWarn(requestId, "route.files.upload.conflict", {
      id,
      reason: "file-exists",
    });
    return bad("file already exists", 409);
  }

  const contentType =
    request.headers.get("content-type") || "application/octet-stream";
  const body = request.body;
  if (!body) {
    logWarn(requestId, "route.files.upload.bad_request", {
      id,
      reason: "missing body",
    });
    return bad("missing file body");
  }

  let fileBytes: ArrayBuffer;
  try {
    fileBytes = await readWithLimit(body, MAX_FILE_SIZE_BYTES);
  } catch (err) {
    if (err instanceof Error && err.message === "PAYLOAD_TOO_LARGE") {
      logWarn(requestId, "route.files.upload.too_large", {
        id,
        max: MAX_FILE_SIZE_BYTES,
      });
      return new Response("file too large (max 25MB)", { status: 413 });
    }
    throw err;
  }

  await env.R2.put(key, fileBytes, { httpMetadata: { contentType } });
  const head = await env.R2.head(key);

  logInfo(requestId, "route.files.upload.ok", {
    id,
    key,
    size: head?.size ?? fileBytes.byteLength,
  });

  return json(
    { ok: true, id, fileKey: key, size: head?.size ?? fileBytes.byteLength },
    201,
  );
}