export function maskIp(ip: string) {
  if (ip.includes(".")) {
    const p = ip.split(".");
    if (p.length === 4) return `${p[0]}.${p[1]}.x.x`;
  }
  if (ip.includes(":")) return ip.split(":").slice(0, 2).join(":") + "::";
  return "unknown";
}
