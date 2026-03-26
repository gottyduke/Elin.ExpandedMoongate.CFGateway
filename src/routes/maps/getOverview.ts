import { json } from "../../utils/response";
import { logInfo } from "../../utils/logger";

export async function handleGetMapsOverview(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path !== "/maps/overview" || request.method.toUpperCase() !== "GET") {
    return null;
  }

  logInfo(requestId, "route.maps.overview.hit");

  const row = await env.DB.prepare(
    `
    SELECT COUNT(*) AS total
    FROM maps_latest
    `,
  ).first<{ total: number }>();

  logInfo(requestId, "route.maps.overview.total", {
    total: row?.total ?? 0,
  });

  return json({ total: row?.total ?? 0 });
}
