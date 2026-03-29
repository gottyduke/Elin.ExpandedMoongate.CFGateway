export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
}

export async function fileKeyToToken(
  fileKey: string,
  length = 12,
): Promise<string> {
  const data = encodeUTF8(fileKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const base64url = arrayBufferToBase64Url(hashBuffer);
  return base64url.slice(0, length);
}

function encodeUTF8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  let base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
