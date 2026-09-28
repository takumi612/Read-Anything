#!/usr/bin/env node
/**
 * Tự động thử hiệu năng tạm thời: kết nối Marginalia ở chế độ dev qua CDP,
 * lần lượt mở các conversation thử có 50/200/500/1000 tin nhắn, chụp ảnh và thu thập log console.
 *
 * Yêu cầu trước:
 *   ./node_modules/.bin/electron-forge start -- --remote-debugging-port=9222
 *
 * Cách chạy:
 *   node scripts/perf-snapshot.mjs --complexity short
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const CDP_HTTP = "http://127.0.0.1:9222";
const OUT_DIR = "/tmp/marginalia-perf-snapshots";

fs.mkdirSync(OUT_DIR, { recursive: true });

const args = process.argv.slice(2);
const complexityFlag = args.includes("--complexity")
  ? args[args.indexOf("--complexity") + 1]
  : "mixed";
const complexity = ["short", "long", "code", "mixed"].includes(complexityFlag)
  ? complexityFlag
  : "mixed";

const targets = [50, 200, 500, 1000].map((n) => ({
  title: `perf-test-${n}-${complexity}`,
  name: `${n}-${complexity}`,
}));

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function snapshot(page, target) {
  const logs = [];
  page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

  // Marginalia mở ở màn hình thư viện.
  // 1. Nhấn nút trợ lý nổi ở góc dưới bên phải.
  await page.click('[aria-label*="Hỏi AI"]', { timeout: 10000 });
  await sleep(500);

  // 2. Mở danh sách conversation.
  await page.click('[aria-label="Danh sách hội thoại"]');
  await sleep(300);

  // 3. Chọn tiêu đề conversation cần thử.
  await page.click(`text=${target.title}`);
  await sleep(6500); // Chờ danh sách tin nhắn và Markdown hiển thị, đồng thời đợi ChatPerf ghi log theo chu kỳ 5 giây.

  // 4. Chụp ảnh trạng thái ban đầu.
  await page.screenshot({
    path: path.join(OUT_DIR, `ai-${target.name}-initial.png`),
    fullPage: false,
  });

  // 5. Cuộn xuống cuối rồi trở lại đầu để đo FPS khi cuộn.
  await page.evaluate(() => {
    const viewport = document.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
  });
  await sleep(1500);

  await page.evaluate(() => {
    const viewport = document.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  await sleep(1500);

  // 6. Chụp ảnh sau khi cuộn.
  await page.screenshot({
    path: path.join(OUT_DIR, `ai-${target.name}-scrolled.png`),
    fullPage: false,
  });

  // 7. Đóng bảng AI để vòng lặp tiếp theo có thể mở lại.
  await page.click('[aria-label="Đóng bảng điều khiển"]');
  await sleep(300);

  fs.writeFileSync(path.join(OUT_DIR, `ai-${target.name}-console.log`), logs.join("\n"));
  console.log(`Done: ${target.title}`);
}

(async () => {
  const versionRes = await fetch(`${CDP_HTTP}/json/version`);
  const version = await versionRes.json();
  const cdpWs = version.webSocketDebuggerUrl;
  console.log("CDP ws:", cdpWs);

  const browser = await chromium.connectOverCDP(cdpWs);
  console.log("Connected to CDP");

  const context = browser.contexts()[0];
  if (!context) {
    console.error("No browser context found");
    process.exit(1);
  }

  // Đóng DevTools tự mở ở chế độ dev để không che cửa sổ chính.
  for (const p of context.pages()) {
    if (p.url().startsWith("devtools://")) await p.close();
  }

  const pages = context.pages().filter((p) => !p.url().startsWith("devtools://"));
  const page = pages[0];
  if (!page) {
    console.error("No existing page found");
    process.exit(1);
  }

  for (const target of targets) {
    await snapshot(page, target).catch((err) => {
      console.error(`Failed ${target.title}:`, err.message);
    });
  }

  await browser.close();
  console.log(`Snapshots saved to ${OUT_DIR}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
