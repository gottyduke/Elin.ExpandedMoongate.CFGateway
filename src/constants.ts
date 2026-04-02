export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export const CORS_HEADERS: HeadersInit = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

export const BADGE_CACHE_TTL = 60 * 30; // 30 minutes

export const MAP_CACHE_TTL = 60 * 60 * 24; // 24 hours
