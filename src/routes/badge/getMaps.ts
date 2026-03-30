import { badge } from "../../utils/response";
import type { RouteContext } from "../../types";

export async function handleGetBadgeMaps({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  const result = await env.DB.prepare(
    `
    SELECT
        COUNT(*) AS maps_count
    FROM maps_latest
    `,
  ).first<{ maps_count: number }>();

  const mapsCount = result?.maps_count.toString() ?? "unknown";

  return badge("maps", mapsCount, "blue");
}
