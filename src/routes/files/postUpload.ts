import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { MAX_FILE_SIZE_BYTES } from "../../constants";
import { readWithLimit } from "../../utils/streamSize";

export async function handlePostFilesUpload(
  request: Request,
  env: Env,
  requestId: string,
  bypass = false,
): Promise<Response | null> {
  const url = new URL(request.url);

  const fileKeyId = url.searchParams.get("fileKeyId")?.trim() ?? "";

  logInfo(requestId, "route.files.upload.hit", { fileKeyId });

  if (!fileKeyId) {
    logWarn(requestId, "route.files.upload.bad_request", {
      reason: "invalid file key id",
    });
    return bad("Invalid fileKeyId");
  }

  const fileKey = await env.KV.get(`pending-upload:${fileKeyId}`);
  if (!fileKey) {
    logWarn(requestId, "route.files.upload.not_permitted", {
      fileKeyId,
    });
    return bad(
      "File upload not permitted. Regenerate fileKeyId via /maps/upload",
      403,
    );
  }

  const existing = await env.R2.head(fileKey);
  if (existing) {
    logWarn(requestId, "route.files.upload.conflict", {
      fileKey,
      reason: "file conflict",
    });
    return bad("File already exists", 409);
  }

  const contentType =
    request.headers.get("Content-Type") || "application/octet-stream";
  const body = request.body;
  if (!body) {
    logWarn(requestId, "route.files.upload.bad_request", {
      fileKey,
      reason: "missing body",
    });
    return bad("Missing file body");
  }

  let fileBytes: ArrayBuffer;
  try {
    fileBytes = await readWithLimit(body, MAX_FILE_SIZE_BYTES);
  } catch (err) {
    if (err instanceof Error && err.message === "PAYLOAD_TOO_LARGE") {
      logWarn(requestId, "route.files.upload.too_large", {
        fileKey,
        max: MAX_FILE_SIZE_BYTES,
      });
      return bad(
        `File too large. Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
        413,
      );
    }
    throw err;
  }

  await env.R2.put(fileKey, fileBytes, { httpMetadata: { contentType } });
  const head = await env.R2.head(fileKey);

  logInfo(requestId, "route.files.upload.ok", {
    fileKey,
    size: head?.size ?? fileBytes.byteLength,
  });

  await env.KV.delete(`pending-upload:${fileKeyId}`);

  return json(
    { ok: true, fileKey, size: head?.size ?? fileBytes.byteLength },
    201,
  );
}
