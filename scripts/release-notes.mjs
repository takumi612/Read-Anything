#!/usr/bin/env node
// Trích mục của phiên bản hiện tại trong package.json từ CHANGELOG.md để làm ghi chú cho bản phát hành GitHub.
// Cách dùng: node scripts/release-notes.mjs [--dry-run]
// Nếu thiếu mục phiên bản, mục rỗng hoặc gh lỗi (không có bản nháp/chưa xác thực), thoát với lỗi thật.
// Không tạo bản phát hành; forge publish là lối duy nhất để tạo.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const changelog = readFileSync("CHANGELOG.md", "utf8");

// Tìm dòng tiêu đề "## <version>", lấy nội dung đến tiêu đề "## " tiếp theo hoặc hết tệp.
// Khớp chính xác (hoặc theo sau bằng dấu cách) để "## 0.2.0" không khớp nhầm "## 0.2.01" hay "## 0.2.0-beta".
const lines = changelog.split("\n");
const start = lines.findIndex((l) => l === `## ${version}` || l.startsWith(`## ${version} `));
if (start === -1) {
  console.error(
    `CHANGELOG.md has no section for version ${version} — run \`pnpm changeset version\` first`,
  );
  process.exit(1);
}
let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith("## ")) {
    end = i;
    break;
  }
}
const notes = lines
  .slice(start + 1, end)
  .join("\n")
  .trim();
if (!notes) {
  console.error(`CHANGELOG.md section for ${version} is empty`);
  process.exit(1);
}

if (dryRun) {
  console.log(`--- notes for v${version} ---\n${notes}`);
  process.exit(0);
}

try {
  execFileSync("gh", ["release", "edit", `v${version}`, "--notes-file", "-"], {
    input: notes,
    stdio: ["pipe", "inherit", "inherit"],
  });
} catch (e) {
  // Lỗi thật từ gh đã được chuyển thẳng qua stderr; bỏ phần stack trace nhiễu của Node nhưng giữ mã thoát khác 0.
  process.exit(e.status ?? 1);
}
console.log(`Notes updated on release v${version}`);
