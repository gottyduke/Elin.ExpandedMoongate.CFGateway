export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function bad(msg: string, status = 400) {
  return json({ error: msg }, status);
}

export function withRequestId(resp: Response, requestId: string) {
  const headers = new Headers(resp.headers);
  headers.set("x-request-id", requestId);
  return new Response(resp.body, { status: resp.status, headers });
}