import { POST_COOLDOWN_SECONDS } from "../constants";
import { maskIp } from "../utils/ip";
import { logInfo, logWarn } from "../utils/logger";
import { getClientIp } from "../utils/request";

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
    return new Response(
      JSON.stringify({ error: "Too many POST requests. Try again later." }),
      {
        status: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "retry-after": String(POST_COOLDOWN_SECONDS),
        },
      },
    );
  }

  await env.KV.put(key, "1", { expirationTtl: POST_COOLDOWN_SECONDS });
  logInfo(requestId, "cooldown.set", {
    ip: maskIp(ip),
    ttl: POST_COOLDOWN_SECONDS,
  });
  return null;
}
