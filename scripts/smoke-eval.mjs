// Công cụ smoke test bằng Playwright (tiện ích eval cục bộ, tương đương node -e: argv[2] là mã).
// Chỉ nhập lệnh trực tiếp trong terminal trên máy này; không truyền đầu vào không đáng tin cậy.
// Yêu cầu: chạy bản dev bằng `pnpm dev -- --remote-debugging-port=9222`.
// Cách dùng: node scripts/smoke-eval.mjs '<mã JavaScript có thể await, biến page là trang ứng dụng>'
// Ví dụ: node scripts/smoke-eval.mjs 'await page.locator("header button").count()'
// Lưu ý: /json/version/ của Electron trả về 400 nếu URL có dấu gạch chéo cuối; connectOverCDP cần URL ws.
import { chromium } from "playwright-core";

const ver = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const browser = await chromium.connectOverCDP(ver.webSocketDebuggerUrl);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => /localhost:\d+/.test(p.url()));
if (!page) {
  console.error("no app page");
  process.exit(1);
}
// oxlint-disable-next-line no-implied-eval -- Đây là công cụ eval (argv chứa mã); chỉ nhận đầu vào từ terminal cục bộ.
const fn = new Function("page", `return (async () => { return ${process.argv[2]}; })()`);
console.log(JSON.stringify(await fn(page), null, 1));
await browser.close();
