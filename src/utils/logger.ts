export function logInfo(
  requestId: string,
  event: string,
  data?: Record<string, unknown>,
) {
  console.log(JSON.stringify({ level: "info", requestId, event, ...data }));
}

export function logWarn(
  requestId: string,
  event: string,
  data?: Record<string, unknown>,
) {
  console.warn(JSON.stringify({ level: "warn", requestId, event, ...data }));
}

export function logError(
  requestId: string,
  event: string,
  data?: Record<string, unknown>,
) {
  console.error(JSON.stringify({ level: "error", requestId, event, ...data }));
}