import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { resolveRendererAssetPath } from "./renderer-protocol-path";

const CONTENT_TYPES: Record<string, string> = {
  ".bcmap": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface RendererServer {
  url: string;
  close: () => Promise<void>;
}

/** Serves only bundled renderer files over loopback, keeping the Chromium renderer sandbox enabled. */
export async function startRendererServer(rendererRoot: string): Promise<RendererServer> {
  const root = path.resolve(rendererRoot);
  const token = randomBytes(32).toString("hex");
  const server = createServer((request, response) => {
    void serveRendererRequest(request, response, root, token);
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Renderer server failed to bind to a TCP loopback address.");
  }

  return {
    url: `http://127.0.0.1:${address.port}/${token}/`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function serveRendererRequest(
  request: IncomingMessage,
  response: ServerResponse,
  rendererRoot: string,
  token: string,
): Promise<void> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname: string;
  try {
    pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    response.writeHead(400).end();
    return;
  }

  const prefix = `/${token}/`;
  if (!pathname.startsWith(prefix)) {
    response.writeHead(404).end();
    return;
  }

  const relativePath = pathname.slice(prefix.length);
  const assetPath = resolveRendererAssetPath(
    rendererRoot,
    relativePath ? `/${relativePath}` : "/index.html",
  );
  if (!assetPath) {
    response.writeHead(404).end();
    return;
  }

  let contents: Buffer;
  try {
    contents = await readFile(assetPath);
  } catch {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    "Cache-Control":
      path.basename(assetPath) === "index.html" ? "no-cache" : "public, max-age=3600",
    "Content-Length": contents.byteLength,
    "Content-Type":
      CONTENT_TYPES[path.extname(assetPath).toLowerCase()] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : contents);
}
