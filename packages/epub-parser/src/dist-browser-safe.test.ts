import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Bản build tsup của epub-parser (dist/index.js) là ESM tự chứa, dùng chung ở main và renderer.
// Vite dev của renderer phục vụ trực tiếp dist nên tệp phải an toàn cho trình duyệt, không chứa
// mã cấp cao nhất chỉ chạy trên Node. Ví dụ trước đây khiến renderer trắng màn hình: nhánh export
// "node" của fflate dùng createRequire và worker_threads; tsup với platform=node sẽ nhúng mã đó vào dist.
// Cấu hình bí danh fflate sang bản browser giải quyết vấn đề; kiểm tra này ngăn hồi quy khi nâng dependency.
const distPath = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const dist = readFileSync(distPath, "utf8");

describe("epub-parser dist is browser-safe", () => {
  it("does not pull the node:module builtin (createRequire shim)", () => {
    expect(dist).not.toMatch(/from\s*["']module["']/);
    expect(dist).not.toContain("createRequire");
  });

  it("does not reference the node-only worker_threads builtin", () => {
    expect(dist).not.toContain("worker_threads");
  });
});
