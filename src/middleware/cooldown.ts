import { POST_COOLDOWN_SECONDS } from "../constants";
import { maskIp } from "../utils/ip";
import { logInfo, logWarn } from "../utils/logger";
import { getClientIp } from "../utils/request";
import { bad, json } from "../utils/response";

export async function enforcePostCooldown(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  if (request.method.toUpperCase() !== "POST") return null;

  const ip = getClientIp(request);

  const key = `post-cooldown:${ip}`;
  const existing = await env.KV.get(key);
  if (existing) {
    logWarn(requestId, "cooldown.blocked", {
      ip: maskIp(ip),
      ttl: POST_COOLDOWN_SECONDS,
    });
    return bad("Too many POST requests. Try again later.", 429);
  }

  await env.KV.put(key, new Date().toISOString(), {
    expirationTtl: POST_COOLDOWN_SECONDS,
  });
  logInfo(requestId, "cooldown.set", {
    ip: maskIp(ip),
    ttl: POST_COOLDOWN_SECONDS,
  });
  return null;
}
