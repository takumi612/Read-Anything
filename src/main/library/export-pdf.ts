import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

export async function writePdfExport(destination: string, bytes: Uint8Array): Promise<void> {
  if (bytes.length < PDF_MAGIC.length || !PDF_MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new Error("Dữ liệu xuất không phải là tệp PDF hợp lệ.");
  }

  const temporaryPath = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    await rename(temporaryPath, destination);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
