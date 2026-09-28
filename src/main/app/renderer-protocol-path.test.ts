import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRendererAssetPath } from "./renderer-protocol-path";

describe("resolveRendererAssetPath", () => {
  const root = "D:/apps/marginalia/.vite/renderer/main_window";

  it("resolves a requested renderer asset inside the renderer root", () => {
    expect(resolveRendererAssetPath(root, "/index.html")).toBe(path.resolve(root, "index.html"));
    expect(resolveRendererAssetPath(root, "/assets/app.js")).toBe(
      path.resolve(root, "assets/app.js"),
    );
  });

  it("rejects paths that escape the renderer root", () => {
    expect(resolveRendererAssetPath(root, "/../main.js")).toBeNull();
    expect(resolveRendererAssetPath(root, "/%2e%2e/main.js")).toBeNull();
    expect(resolveRendererAssetPath(root, "/%5c..%5cmain.js")).toBeNull();
  });

  it("rejects malformed and empty paths", () => {
    expect(resolveRendererAssetPath(root, "/%zz.js")).toBeNull();
    expect(resolveRendererAssetPath(root, "")).toBeNull();
  });
});
