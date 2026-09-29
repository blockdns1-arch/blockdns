const TEXT_HTML = "text/html; charset=utf-8";

export function sniffMime(bytes: Uint8Array, headerMime: string): string {
  const fromHeader = (headerMime || "").split(";")[0].trim().toLowerCase();
  if (fromHeader && fromHeader !== "application/octet-stream") {
    return headerMime;
  }

  const n = Math.min(bytes.length, 24);
  const head = new Uint8Array(bytes.subarray(0, n));

  if (n >= 4 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return "image/png";
  }
  if (n >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (n >= 4 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
    return head[8] === 0x57 && head[9] === 0x45 ? "image/webp" : "image/x-icon";
  }
  if (n >= 6 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) {
    return "image/gif";
  }
  if (n >= 4 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) {
    return "image/gif";
  }
  if (n >= 4 && head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && head[3] === 0x00) {
    return "image/x-icon";
  }
  if (n === 0) return "text/html; charset=utf-8";

  const text = String.fromCharCode(...head).toLowerCase().trimStart();
  if (text.startsWith("<!doctype") || text.startsWith("<html") || text.startsWith("<head") ||
    text.startsWith("<body") || text.startsWith("<svg") || text.startsWith("<script") ||
    text.startsWith("<style") || (text.startsWith("<") && text.length > 2)) {
    return TEXT_HTML;
  }
  if (text.startsWith("%pdf")) return "application/pdf";
  if (text.startsWith("{")) return "application/json";

  return "application/octet-stream";
}

let textTypes = new Set([
  "text/plain",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/json",
  "application/wasm",
  "image/svg+xml",
]);

export function charsetFor(mime: string): string {
  return textTypes.has(mime.split(";")[0]) ? "; charset=utf-8" : "";
}