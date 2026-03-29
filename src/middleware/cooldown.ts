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
  const success = await env.RL.limit({ key });

  if (!success) {
    return bad("Too many POST requests. Try again later", 429);
  }

  return null;
}
