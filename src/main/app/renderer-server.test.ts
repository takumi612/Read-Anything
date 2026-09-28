import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startRendererServer, type RendererServer } from "./renderer-server";

describe("startRendererServer", () => {
  let tempRoot: string | null = null;
  let server: RendererServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  });

  it("serves only renderer assets from a random loopback URL", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "marginalia-renderer-test-"));
    await mkdir(path.join(tempRoot, "assets"));
    await writeFile(path.join(tempRoot, "index.html"), "<!doctype html><title>reader</title>");
    await writeFile(path.join(tempRoot, "assets", "app.js"), "console.log('reader');");
    await writeFile(path.join(tempRoot, "assets", "pdf.worker.mjs"), "export {};\n");
    server = await startRendererServer(tempRoot);

    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{64}\/$/u);

    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("<title>reader</title>");

    const script = await fetch(new URL("assets/app.js", server.url));
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("text/javascript");

    const pdfWorker = await fetch(new URL("assets/pdf.worker.mjs", server.url));
    expect(pdfWorker.status).toBe(200);
    expect(pdfWorker.headers.get("content-type")).toContain("text/javascript");
    expect(await pdfWorker.text()).toContain("export {}");

    const outsideToken = await fetch(new URL("/not-the-token/index.html", server.url));
    expect(outsideToken.status).toBe(404);
  });
});
