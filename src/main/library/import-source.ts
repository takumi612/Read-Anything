import { readFileSync, readdirSync, statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { zipSync, type Zippable } from "fflate";

/** Liệt kê đường dẫn tương đối dưới root, dùng dấu / và bỏ tệp ẩn. */
function listFilesRel(root: string): string[] {
  const walk = (abs: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const child = path.join(abs, entry.name);
      if (entry.isDirectory()) out.push(...walk(child));
      else out.push(path.relative(root, child).split(path.sep).join("/"));
    }
    return out;
  };
  return walk(root);
}

/** Đóng thư mục EPUB đã giải nén thành ZIP chuẩn; mimetype đứng đầu và không nén. */
export function packEpubDir(
  dirPath: string,
  readEntry: (filePath: string) => Buffer = readFileSync,
): Uint8Array {
  const hasContainer = (() => {
    try {
      return statSync(path.join(dirPath, "META-INF", "container.xml")).isFile();
    } catch {
      return false;
    }
  })();
  if (!hasContainer) {
    throw new Error(`Not a valid EPUB directory (missing META-INF/container.xml): "${dirPath}"`);
  }

  const rels = listFilesRel(dirPath);
  const ordered = rels.includes("mimetype")
    ? ["mimetype", ...rels.filter((r) => r !== "mimetype")]
    : rels;

  const entries: Zippable = {};
  for (const rel of ordered) {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readEntry(path.join(dirPath, rel)));
    } catch {
      throw new Error(
        `Cannot read EPUB directory contents (a file may be a non-materialized iCloud/Apple Books placeholder; download it locally and retry): "${path.join(dirPath, rel)}"`,
      );
    }
    entries[rel] = rel === "mimetype" ? [bytes, { level: 0 }] : bytes;
  }
  return zipSync(entries);
}

/** Đọc bytes từ tệp, hoặc đóng thư mục EPUB thành ZIP; đầu vào khác báo lỗi. */
export async function readBookBytes(filePath: string): Promise<Uint8Array> {
  let st;
  try {
    st = await stat(filePath);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw new Error(`Cannot read book file at "${filePath}": ${e.code ?? e.message}`);
  }
  if (st.isDirectory()) return packEpubDir(filePath);
  if (st.isFile()) {
    const buf = await readFile(filePath).catch((err: NodeJS.ErrnoException) => {
      throw new Error(`Cannot read book file at "${filePath}": ${err.code ?? err.message}`);
    });
    return new Uint8Array(buf);
  }
  throw new Error(`Cannot read book file at "${filePath}": not a regular file or directory`);
}
