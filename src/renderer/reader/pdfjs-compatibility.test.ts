import { expect, it } from "vitest";
import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

it("loads the production PDF.js build with Math.sumPrecise compatibility", async () => {
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { baseURI: "http://localhost/" },
  });

  await import("./pdf-book");

  expect(Reflect.get(Math, "sumPrecise")).toBeTypeOf("function");
});
