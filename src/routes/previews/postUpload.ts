import { bad, json } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { readWithLimit } from "../../utils/streamSize";
import { MAX_FILE_SIZE_BYTES } from "../../constants";
import type { RouteContext } from "../../types";

export async function handlePostPreviewUpload({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  const url = new URL(request.url);

  const previewKey = url.searchParams.get("previewKey")?.trim() ?? "";

  logInfo(requestId, "route.previews.upload.hit", { previewKey });

  if (!previewKey) {
    logWarn(requestId, "route.previews.upload.bad_request", {
      reason: "invalid preview key",
    });
    return bad("Invalid preview key");
  }

  const existing = await env.R2.head(previewKey);
  if (existing) {
    return bad("Preview with the same key already exists", 409);
  }

  const contentType =
    request.headers.get("Content-Type") || "application/octet-stream";
  const body = request.body;
  if (!body) {
    logWarn(requestId, "route.previews.upload.bad_request", {
      previewKey,
      reason: "missing body",
    });
    return bad("Missing file body");
  }

  let fileBytes: ArrayBuffer;
  try {
    fileBytes = await readWithLimit(body, MAX_FILE_SIZE_BYTES);
  } catch (err) {
    if (err instanceof Error && err.message === "PAYLOAD_TOO_LARGE") {
      logWarn(requestId, "route.previews.upload.too_large", {
        previewKey,
        max: MAX_FILE_SIZE_BYTES,
      });
    }
    return bad(
      `File too large. Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
      413,
    );
  }

  await env.R2.put(previewKey, fileBytes, { httpMetadata: { contentType } });
  const head = await env.R2.head(previewKey);

  logInfo(requestId, "route.previews.upload.ok", {
    previewKey,
    size: head?.size ?? fileBytes.byteLength,
  });

  return json(
    { ok: true, previewKey, size: head?.size ?? fileBytes.byteLength },
    201,
  );
}
