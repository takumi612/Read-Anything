import { describe, expect, it } from "vitest";
import rendererConfig from "../../vite.renderer.config";

describe("renderer React runtime resolution", () => {
  it("deduplicates React so compiled hooks share the renderer dispatcher", () => {
    expect(rendererConfig.resolve?.dedupe).toEqual(expect.arrayContaining(["react", "react-dom"]));
  });
});
