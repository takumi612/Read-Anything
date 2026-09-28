import { describe, expect, it } from "vitest";
import { resolveApplicationBackground } from "./application-background-state";

describe("resolveApplicationBackground", () => {
  it("uses no custom layer in default mode", () => {
    expect(resolveApplicationBackground("default", "#aabbcc", "wallpaper-id")).toBeNull();
  });

  it("returns the selected solid color without an image", () => {
    expect(resolveApplicationBackground("color", "#aabbcc", "wallpaper-id")).toEqual({
      color: "#aabbcc",
      imageUrl: undefined,
      overlay: "color",
    });
  });

  it("uses a local blob URL for an image background", () => {
    expect(resolveApplicationBackground("image", "#aabbcc", "image id")).toEqual({
      color: "#aabbcc",
      imageUrl: 'url("media://blob/image%20id")',
      overlay: "image",
    });
  });

  it("falls back safely when image mode has no stored image", () => {
    expect(resolveApplicationBackground("image", "#aabbcc", null)).toBeNull();
  });
});
