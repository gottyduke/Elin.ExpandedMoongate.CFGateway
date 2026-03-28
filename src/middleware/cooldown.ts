import { POST_COOLDOWN_SECONDS } from "../constants";
import { logInfo, logWarn } from "../utils/logger";
import { getClientIp } from "../utils/request";
import { bad } from "../utils/response";

export async function enforcePostCooldown(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response | null> {
  if (request.method.toUpperCase() !== "POST") return null;

  const ip = getClientIp(request);
  const key = `post-cooldown:${ip}`;

  const now = Date.now();
  const cooldownMs = POST_COOLDOWN_SECONDS * 1000;

  const existing = await env.KV.get(key);

  if (existing) {
    const lastTime = Number(existing);
    const diff = now - lastTime;

    if (diff < cooldownMs) {
      logWarn(requestId, "cooldown.blocked", {
        ip,
        remainingMs: cooldownMs - diff,
      });

      return bad("Too many POST requests. Try again later.", 429);
    }
  }

  await env.KV.put(key, now.toString(), {
    expirationTtl: 60,
  });

  logInfo(requestId, "cooldown.set", {
    ip,
    ttl: POST_COOLDOWN_SECONDS,
  });

  return null;
}
