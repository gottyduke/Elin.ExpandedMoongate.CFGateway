import { logWarn } from "../utils/logger";
import { getClientIp } from "../utils/request";
import { bad, json } from "../utils/response";

export async function enforceIpBan(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const ip = getClientIp(request);

  if (ip === "unknown") return null;

  const key = `ip-ban:${ip}`;
  const banValue = await env.KV.get(key);

  if (!banValue) return null;

  return bad("IP rate limited", 403);
}
