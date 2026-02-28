import { maskIp } from "../utils/ip";
import { logWarn } from "../utils/logger";
import { getClientIp } from "../utils/request";
import { json } from "../utils/response";

export async function enforceIpBan(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  const ip = getClientIp(request);

  if (ip === "unknown") {
    logWarn(requestId, "ip_ban.skip_unknown_ip", {});
    return null;
  }

  const key = `ip-ban:${ip}`;
  const banValue = await env.KV.get(key);

  if (!banValue) return null;

  logWarn(requestId, "ip_ban.blocked", {
    ip: maskIp(ip),
    banValue,
  });

  return json({ error: "IP rate limited" }, 403);
}
