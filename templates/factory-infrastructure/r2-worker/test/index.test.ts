import assert from "node:assert/strict";
import test from "node:test";

import { handler, objectKey, parseRangeHeader } from "../src/index.js";

function object(
  body: string,
  range?: { offset: number; length: number },
): R2ObjectBody {
  const bytes = new TextEncoder().encode(body);
  return {
    key: "public/v1/en/asset.txt",
    version: "1",
    size: 10,
    etag: "etag",
    httpEtag: '"etag"',
    checksums: {} as R2Checksums,
    uploaded: new Date(0),
    storageClass: "Standard",
    range,
    body: new Blob([bytes]).stream(),
    bodyUsed: false,
    writeHttpMetadata(headers: Headers) {
      headers.set("Content-Type", "text/plain; charset=utf-8");
    },
    async arrayBuffer() {
      return new Uint8Array(bytes).buffer as ArrayBuffer;
    },
    async bytes() {
      return bytes;
    },
    async text() {
      return body;
    },
    async json<T>() {
      return JSON.parse(body) as T;
    },
    async blob() {
      return new Blob([bytes]);
    },
  };
}

function bucket() {
  const calls: Array<{ key: string; range?: R2Range }> = [];
  const value = object("0123456789");
  const binding = {
    async head(key: string) {
      calls.push({ key });
      return value;
    },
    async get(key: string, options?: R2GetOptions) {
      const range = options?.range;
      assert.equal(range instanceof Headers, false);
      calls.push({ key, range: range as R2Range | undefined });
      if (range && "offset" in range && typeof range.offset === "number") {
        const length = range.length ?? value.size - range.offset;
        return object("0123456789".slice(range.offset, range.offset + length), {
          offset: range.offset,
          length,
        });
      }
      return value;
    },
  } as unknown as R2Bucket;
  return { binding, calls };
}

test("allows only normalized public object keys", () => {
  assert.equal(
    objectKey(new Request("https://assets.example/public/v1/en/icon.png")),
    "public/v1/en/icon.png",
  );
  assert.equal(objectKey(new Request("https://assets.example/private/icon.png")), null);
  assert.equal(objectKey(new Request("https://assets.example/public/")), null);
  assert.equal(objectKey(new Request("https://assets.example/public/%00.png")), null);
  assert.equal(
    objectKey(new Request("https://assets.example/public/%2e%2e/private.png")),
    null,
  );
});

test("parses bounded, open, and suffix byte ranges", () => {
  assert.deepEqual(parseRangeHeader("bytes=2-5", 10), { offset: 2, length: 4 });
  assert.deepEqual(parseRangeHeader("bytes=7-", 10), { offset: 7, length: 3 });
  assert.deepEqual(parseRangeHeader("bytes=-4", 10), { offset: 6, length: 4 });
  assert.equal(parseRangeHeader("bytes=10-11", 10), null);
  assert.equal(parseRangeHeader("bytes=0-1,4-5", 10), null);
});

test("serves partial GETs with immutable and security headers", async () => {
  const { binding, calls } = bucket();
  const response = await handler.fetch(
    new Request("https://assets.example/public/v1/en/asset.txt", {
      headers: { Range: "bytes=2-5" },
    }),
    { ASSETS: binding },
  );

  assert.equal(response.status, 206);
  assert.equal(await response.text(), "2345");
  assert.equal(response.headers.get("Content-Range"), "bytes 2-5/10");
  assert.equal(response.headers.get("Content-Length"), "4");
  assert.match(response.headers.get("Cache-Control") ?? "", /immutable/u);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.deepEqual(calls.at(-1)?.range, { offset: 2, length: 4 });
});

test("rejects invalid ranges and write methods without reading an object body", async () => {
  const { binding, calls } = bucket();
  const invalid = await handler.fetch(
    new Request("https://assets.example/public/v1/en/asset.txt", {
      headers: { Range: "bytes=99-" },
    }),
    { ASSETS: binding },
  );
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get("Content-Range"), "bytes */10");
  assert.equal(calls.length, 1);

  const write = await handler.fetch(
    new Request("https://assets.example/public/v1/en/asset.txt", { method: "POST" }),
    { ASSETS: binding },
  );
  assert.equal(write.status, 405);
  assert.equal(write.headers.get("Allow"), "GET, HEAD");
  assert.equal(calls.length, 1);
});

test("HEAD returns metadata only and missing objects stay opaque", async () => {
  const { binding, calls } = bucket();
  const head = await handler.fetch(
    new Request("https://assets.example/public/v1/en/asset.txt", { method: "HEAD" }),
    { ASSETS: binding },
  );
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Content-Length"), "10");
  assert.equal(await head.text(), "");
  assert.equal(calls.length, 1);

  const missing = {
    async head() {
      return null;
    },
    async get() {
      return null;
    },
  } as unknown as R2Bucket;
  const response = await handler.fetch(
    new Request("https://assets.example/public/v1/en/missing.png"),
    { ASSETS: missing },
  );
  assert.equal(response.status, 404);
  const body = await response.text();
  assert.equal(body, "Not found");
  assert.doesNotMatch(body, /bucket|binding|R2/iu);
});
