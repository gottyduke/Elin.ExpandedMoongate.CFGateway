import { badge } from "../../utils/response";

export async function handleGetBadgeMaps(
  request: Request,
  env: Env,
  requestId: string,
  bypass = false,
): Promise<Response | null> {
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
