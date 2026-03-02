import { makeRequestId } from "./utils/request";
import { safeError } from "./utils/error";
import { withRequestId, json, bad } from "./utils/response";
import { logError, logInfo, logWarn } from "./utils/logger";

import { enforcePostCooldown } from "./middleware/cooldown";
import { enforceIpBan } from "./middleware/ban";

import { handlePostFilesUpload } from "./routes/files/postUpload";
import { handlePostMapsUpload } from "./routes/maps/postUpload";
import { handleGetMapsDownload } from "./routes/maps/getDownload";
import { handleGetMapsRating } from "./routes/ratings/getRatings";
import { handlePostMapsRating } from "./routes/ratings/postRating";
import { handleGetMapsTop } from "./routes/maps/getTop";
import { handleGetMapsQuery } from "./routes/maps/getQuery";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const requestId = makeRequestId();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    logInfo(requestId, "request.start", { method, path });

    try {
      const debugKey = request.headers.get("x-debugging-key")?.trim();
      let bypass = false;
      if (debugKey) {
        logInfo(requestId, "passthrough.debug_check", { attempt: debugKey });
        const passthrough = await env.KV.get(debugKey);
        if (passthrough === "passthrough") {
          logInfo(requestId, "passthrough.bypass", { reason: "debug-key" });
          bypass = true;
        } else {
          logInfo(requestId, "passthrough.failed", { reason: "fail-attempt" });
        }
      }

      if (!bypass) {
        const steamId = request.headers.get("x-request-id");
        if (!steamId) {
          logWarn(requestId, "request.end", {
            method,
            path,
            status: 400,
            durationMs: Date.now() - startedAt,
          });
          return withRequestId(bad("Missing Steam ID", 400), requestId);
        }

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
        handleGetMapsDownload,
        handleGetMapsQuery,
        handleGetMapsTop,
        handleGetMapsRating,
        handlePostMapsUpload,
        handlePostMapsRating,
        handlePostFilesUpload,
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
