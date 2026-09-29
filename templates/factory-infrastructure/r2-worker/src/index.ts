interface Env {
  ASSETS: R2Bucket;
}

const PUBLIC_PREFIX = "public/";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

type NormalizedRange = { offset: number; length: number };

function baseHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": CACHE_CONTROL,
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
  });
}

function responseHeaders(object?: R2Object): Headers {
  const headers = baseHeaders();
  if (object) {
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
  }
  return headers;
}

export function objectKey(request: Request): string | null {
  const pathname = new URL(request.url).pathname.replace(/^\//u, "");
  let key: string;
  try {
    key = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (
    !key.startsWith(PUBLIC_PREFIX) ||
    key.length === PUBLIC_PREFIX.length ||
    key.includes("\\") ||
    key.includes("\0") ||
    /[\u0000-\u001f\u007f]/u.test(key) ||
    key.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }
  return key;
}

export function parseRangeHeader(
  value: string | null,
  size: number,
): NormalizedRange | null | undefined {
  if (value === null) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  if (!match) return null;

  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (startText.length === 0 && endText.length === 0) return null;

  if (startText.length === 0) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0 || size <= 0) return null;
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }

  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return null;
  if (endText.length === 0) return { offset: start, length: size - start };

  const requestedEnd = Number(endText);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null;
  const end = Math.min(requestedEnd, size - 1);
  return { offset: start, length: end - start + 1 };
}

function errorResponse(body: string | null, status: number, extra?: HeadersInit): Response {
  const headers = baseHeaders();
  for (const [name, value] of new Headers(extra)) headers.set(name, value);
  return new Response(body, { status, headers });
}

export const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse("Method not allowed", 405, { Allow: "GET, HEAD" });
    }

    const key = objectKey(request);
    if (!key) return errorResponse("Not found", 404);

    if (request.method === "HEAD") {
      const object = await env.ASSETS.head(key);
      if (!object) return errorResponse(null, 404);
      const headers = responseHeaders(object);
      headers.set("Content-Length", String(object.size));
      return new Response(null, { status: 200, headers });
    }

    const rangeValue = request.headers.get("Range");
    let range: NormalizedRange | undefined;
    if (rangeValue !== null) {
      const metadata = await env.ASSETS.head(key);
      if (!metadata) return errorResponse("Not found", 404);
      const parsed = parseRangeHeader(rangeValue, metadata.size);
      if (!parsed) {
        return errorResponse("Range not satisfiable", 416, {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${metadata.size}`,
        });
      }
      range = parsed;
    }

    const object = await env.ASSETS.get(key, range ? { range } : undefined);
    if (!object) return errorResponse("Not found", 404);
    const headers = responseHeaders(object);
    if (range) {
      headers.set("Content-Length", String(range.length));
      headers.set(
        "Content-Range",
        `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
      );
    } else {
      headers.set("Content-Length", String(object.size));
    }
    return new Response(object.body, {
      status: range ? 206 : 200,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;

export default handler;
