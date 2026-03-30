import { bad, json } from "../../utils/response";
import type { RouteContext } from "../../types";

export async function handleGetModerationUnpreparedList({
  request,
  env,
  requestId,
  bypass,
  ctx,
}: RouteContext): Promise<Response | null> {
  if (!bypass) {
    return bad("Unauthorized", 401);
  }

  const allKeys = await env.DB.prepare(
    `
    SELECT preview_key, view_id FROM maps_latest LIMIT 5
    `,
  ).all<{ preview_key: string; view_id: string }>();

  const unprepared: {}[] = [];
  for (const { preview_key, view_id } of allKeys.results) {
    const existing = await env.R2.head(preview_key);
    if (!existing) {
      unprepared.push({ view_id, preview_key });
    }
  }

  return json(unprepared);
}
