import { makeRequestId } from "./utils/request";
import { safeError } from "./utils/error";
import { withRequestId, json, bad } from "./utils/response";
import { logError, logInfo, logWarn } from "./utils/logger";

import { enforcePostCooldown } from "./middleware/cooldown";
import { enforceIpBan } from "./middleware/ban";

import { handleFilesUpload } from "./routes/filesUpload";
import { handleMapsUpload } from "./routes/mapsUpload";
import { handleMapsDownload } from "./routes/mapsDownload";
import { handleMapsRating } from "./routes/mapsRating";
import { handleMapsRatings } from "./routes/mapsRatings";
import { handleMapsTop } from "./routes/mapsTop";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const requestId = makeRequestId();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    logInfo(requestId, "request.start", { method, path });

    try {
      const debugKey = request.headers.get("x-debugging-key");
      if (debugKey !== null) {
        logInfo(requestId, "passthrough.debug_check", { attempt: debugKey });
        const passthrough = await env.KV.get(debugKey);
        if (passthrough === "passthrough") {
          logInfo(requestId, "passthrough.bypass", { reason: "debug-key" });
        }
      } else {
        const banResp = await enforceIpBan(request, env, requestId);
        if (banResp) {
          logWarn(requestId, "request.end", {
            method,
            path,
            status: banResp.status,
            durationMs: Date.now() - startedAt,
          });
          return withRequestId(banResp, requestId);
        }

        const cooldownResp = await enforcePostCooldown(request, env, requestId);
        if (cooldownResp) {
          logWarn(requestId, "request.end", {
            method,
            path,
            status: cooldownResp.status,
            durationMs: Date.now() - startedAt,
          });
          return withRequestId(cooldownResp, requestId);
        }
      }

      const handlers = [
        handleFilesUpload,
        handleMapsDownload,
        handleMapsRating,
        handleMapsRatings,
        handleMapsTop,
        handleMapsUpload,
      ];

      for (const h of handlers) {
        const resp = await h(request, env, requestId);
        if (resp) {
          logInfo(requestId, "request.end", {
            method,
            path,
            status: resp.status,
            durationMs: Date.now() - startedAt,
          });
          return withRequestId(resp, requestId);
        }
      }

      const notFoundResp = bad("Not Found", 404);
      logWarn(requestId, "route.not_found", { method, path });
      logInfo(requestId, "request.end", {
        method,
        path,
        status: notFoundResp.status,
        durationMs: Date.now() - startedAt,
      });
      return withRequestId(notFoundResp, requestId);
    } catch (e: unknown) {
      logError(requestId, "request.error", {
        method,
        path,
        durationMs: Date.now() - startedAt,
        error: safeError(e),
      });
      const resp = json(
        { error: e instanceof Error ? e.message : "internal error" },
        500,
      );
      return withRequestId(resp, requestId);
    }
  },
} satisfies ExportedHandler<Env>;
