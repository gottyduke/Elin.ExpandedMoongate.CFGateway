import { getClientIp, makeRequestId } from "./utils/request";
import { safeError } from "./utils/error";
import { withRequestId, json, bad, handleOptions } from "./utils/response";
import { logError, logInfo, logWarn } from "./utils/logger";

import { enforcePostCooldown } from "./middleware/cooldown";
import { enforceIpBan } from "./middleware/ban";

import { handlePostFilesUpload } from "./routes/files/postUpload";
import { handlePostMapsUpload } from "./routes/maps/postUpload";
import { handleGetMapsDownload } from "./routes/maps/getDownload";
import { handlePostMapsRating } from "./routes/ratings/postRating";
import { handleGetMapsTop } from "./routes/maps/getTop";
import { handleGetMapsQuery } from "./routes/maps/getQuery";
import { handleGetMapsOverview } from "./routes/maps/getOverview";
import { handleGetRatingsQuery } from "./routes/ratings/getQuery";
import { handleGetMapsHistory } from "./routes/maps/getHistory";
import { handleGetBadgeMaps } from "./routes/badge/getMaps";
import { handleGetMapsSearch } from "./routes/maps/getSearch";
import { RouteContext, RouteHandler } from "./types";

const routes: Record<string, RouteHandler> = {
  "GET /maps/download": ({ request, env, requestId, bypass }) =>
    handleGetMapsDownload(request, env, requestId, bypass),

  "GET /maps/history": ({ request, env, requestId, bypass }) =>
    handleGetMapsHistory(request, env, requestId, bypass),

  "GET /maps/overview": ({ request, env, requestId, bypass }) =>
    handleGetMapsOverview(request, env, requestId, bypass),

  "GET /maps/query": ({ request, env, requestId, bypass }) =>
    handleGetMapsQuery(request, env, requestId, bypass),

  "GET /maps/search": ({ request, env, requestId, bypass }) =>
    handleGetMapsSearch(request, env, requestId, bypass),

  "GET /maps/top": ({ request, env, requestId, bypass }) =>
    handleGetMapsTop(request, env, requestId, bypass),

  "POST /maps/upload": ({ request, env, requestId, bypass }) =>
    handlePostMapsUpload(request, env, requestId, bypass),

  "GET /ratings": ({ request, env, requestId, bypass }) =>
    handleGetRatingsQuery(request, env, requestId, bypass),

  "POST /ratings": ({ request, env, requestId, bypass }) =>
    handlePostMapsRating(request, env, requestId, bypass),

  "POST /files/upload": ({ request, env, requestId, bypass }) =>
    handlePostFilesUpload(request, env, requestId, bypass),

  "GET /badge/maps": ({ request, env, requestId, bypass }) =>
    handleGetBadgeMaps(request, env, requestId, bypass),
};

const directRoutes = new Set<string>(["GET /badge/maps"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const requestId = makeRequestId();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const route = `${method} ${path}`;

    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    let bypass = true;

    if (directRoutes.has(route) && routes[route]) {
      const handler = routes[route];
      return (
        (await handler({ request, env, requestId, bypass })) ??
        bad("No response", 500)
      );
    }

    logInfo(requestId, "request.start", {
      method,
      path,
      ip: getClientIp(request),
    });

    try {
      const debugKey = request.headers.get("x-debugging-key")?.trim();
      if (debugKey) {
        const passthrough = await env.KV.get(debugKey);
        bypass = passthrough === "passthrough";
      }

      let resp: Response | null = null;
      if (!bypass) {
        resp =
          (await enforceIpBan(request, env, requestId)) ??
          (await enforcePostCooldown(request, env, requestId));
      }

      if (resp) {
        logWarn(requestId, "request.blocked", {
          method,
          path,
          status: resp.status,
          durationMs: Date.now() - startedAt,
        });
        return withRequestId(resp, requestId);
      }

      const ctx: RouteContext = { request, env, requestId, bypass };
      const handler = routes[route];

      if (handler) {
        resp = await handler(ctx);
      }

      if (resp) {
        logInfo(requestId, "request.end", {
          method,
          path,
          status: resp.status,
          durationMs: Date.now() - startedAt,
        });
        return withRequestId(resp, requestId);
      }

      resp = json({ error: "Route not found", route }, 404);

      logWarn(requestId, "route.not_found", {
        method,
        path,
      });

      return withRequestId(resp, requestId);
    } catch (e: unknown) {
      logError(requestId, "request.error", {
        method,
        path,
        durationMs: Date.now() - startedAt,
        error: safeError(e),
      });

      const resp = bad(
        `Internal error. Contact mod author if issue persists.\n${
          e instanceof Error ? e.message : String(e)
        }`,
        500,
      );

      return withRequestId(resp, requestId);
    }
  },
} satisfies ExportedHandler<Env>;
