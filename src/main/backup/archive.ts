import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";
import yauzl from "yauzl";
import { createLogger } from "@main/logger";

const log = createLogger("backup");

/** Tính SHA-256 của tệp theo luồng, trả dạng hex. */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    const s = createReadStream(filePath);
    s.on("data", (c) => h.update(c));
    s.on("end", () => resolve(h.digest("hex")));
    s.on("error", reject);
  });
}

type CreateBackupZipOptions = {
  zipPath: string;
  snapshotPath: string;
  manifest: unknown;
} & ({ kind: "full"; booksDir: string } | { kind: "compact" });

/** Tạo ZIP sao lưu theo luồng gồm DB snapshot, manifest và thư mục books với bản đầy đủ. */
export function createBackupZip(opts: CreateBackupZipOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(opts.zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("warning", (e) => log.warn("archive warning", e));
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(opts.snapshotPath, { name: "marginalia.db" });
    if (opts.kind === "full" && existsSync(opts.booksDir)) {
      archive.directory(opts.booksDir, "books");
    }
    archive.append(JSON.stringify(opts.manifest, null, 2), { name: "manifest.json" });
    void archive.finalize();
  });
}

/** Đọc một mục ZIP thành UTF-8; thiếu mục thì báo lỗi. */
export function readZipEntryText(zipPath: string, entryName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("zip open failed"));
      let found = false;
      zip.on("entry", (entry) => {
        if (entry.fileName !== entryName) return zip.readEntry();
        found = true;
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return reject(e ?? new Error("zip stream failed"));
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("end", () => {
            zip.close();
            resolve(Buffer.concat(chunks).toString("utf8"));
          });
          stream.on("error", (e) => {
            zip.close();
            reject(e);
          });
        });
      });
      zip.on("end", () => {
        if (!found) reject(new Error(`zip entry not found: ${entryName}`));
      });
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

/** Giải nén ZIP vào destDir và chặn đường dẫn zip-slip. */
export function extractZip(zipPath: string, destDir: string): Promise<void> {
  const root = path.resolve(destDir);
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("zip open failed"));
      zip.on("entry", (entry) => {
        const outPath = path.resolve(root, entry.fileName);
        if (outPath !== root && !outPath.startsWith(root + path.sep)) {
          return reject(new Error(`unsafe zip entry path: ${entry.fileName}`));
        }
        if (entry.fileName.endsWith("/")) {
          mkdirSync(outPath, { recursive: true });
          return zip.readEntry();
        }
        mkdirSync(path.dirname(outPath), { recursive: true });
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) return reject(e ?? new Error("zip stream failed"));
          const ws = createWriteStream(outPath);
          stream.on("error", reject);
          ws.on("error", reject);
          ws.on("close", () => zip.readEntry());
          stream.pipe(ws);
        });
      });
      zip.on("end", () => resolve());
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}
