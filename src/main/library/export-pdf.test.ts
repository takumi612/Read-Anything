import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writePdfExport } from "./export-pdf";

describe("writePdfExport", () => {
  it("writes the generated PDF bytes to the selected destination", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "marginalia-pdf-export-"));
    const destination = path.join(dir, "annotated.pdf");
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

    try {
      await writePdfExport(destination, bytes);
      expect(Array.from(await readFile(destination))).toEqual(Array.from(bytes));
      expect((await readFile(destination)).subarray(0, 5)).toEqual(Buffer.from("%PDF-"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects non-PDF bytes without changing an existing destination", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "marginalia-pdf-export-"));
    const destination = path.join(dir, "annotated.pdf");
    const original = Buffer.from("existing file");
    await writeFile(destination, original);

    try {
      await expect(writePdfExport(destination, new Uint8Array([1, 2, 3]))).rejects.toThrow(
        "Dữ liệu xuất không phải là tệp PDF hợp lệ.",
      );
      expect(await readFile(destination)).toEqual(original);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
