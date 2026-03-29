import { CORS_HEADERS } from "../constants";

export function json(data: unknown, status = 200) {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
  );
}

export function bad(msg: string, status = 400) {
  return withCors(
    new Response(msg, {
      status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    }),
  );
}

export function raw(
  body: BodyInit | null,
  status = 200,
  headers?: HeadersInit,
) {
  return withCors(
    new Response(body, {
      status,
      headers,
    }),
  );
}

export function badge(label: string, message: string, color = "blue") {
  return json({
    schemaVersion: 1,
    label,
    message,
    color,
  });
}

export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export function withRequestId(resp: Response, requestId: string) {
  const headers = new Headers(resp.headers);
  headers.set("x-request-id", requestId);
  return new Response(resp.body, { status: resp.status, headers });
}

export function withCors(resp: Response): Response {
  const headers = new Headers(resp.headers);

  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }

  return new Response(resp.body, {
    status: resp.status,
    headers,
  });
}
