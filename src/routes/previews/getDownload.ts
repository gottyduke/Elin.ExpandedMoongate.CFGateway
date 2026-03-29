import { bad, raw } from "../../utils/response";
import { logInfo, logWarn } from "../../utils/logger";
import { sanitizeFileName } from "../../utils/file";

export async function handleGetPreviewDownload(
  request: Request,
  env: Env,
  requestId: string,
  bypass = false,
): Promise<Response | null> {
  const url = new URL(request.url);

  const previewKey = url.searchParams.get("previewKey")?.trim() ?? "";

  logInfo(requestId, "route.previews.download.hit", { previewKey });

  const obj = await env.R2.get(previewKey);
  if (!obj) {
    logWarn(requestId, "route.previews.download.not_found", {
      previewKey,
    });
    return bad("File not found", 404);
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    obj.httpMetadata?.contentType || "application/octet-stream",
  );

  const safe = sanitizeFileName(previewKey);
  const fallback = safe.replace(/[^\x20-\x7E]/g, "_") || "preview.jpg";
  const encoded = encodeURIComponent(safe);

  headers.set(
    "content-disposition",
    `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
  );

  logInfo(requestId, "route.previews.download.ok", {
    previewKey,
  });

  return raw(obj.body, 200, headers);
}
