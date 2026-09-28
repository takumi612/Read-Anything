#!/usr/bin/env node
/**
 * Script thử hiệu năng tạm thời: nạp hàng loạt tin nhắn tổng hợp vào một conversation trong cơ sở dữ liệu dev.
 *
 * Cách chạy (phải dùng Electron binary của dự án vì better-sqlite3 được biên dịch theo Electron ABI 145):
 *   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron scripts/seed-long-conversation.mjs --count 200
 *   (Không dùng pnpx electron vì lệnh đó có thể tải phiên bản khác, không khớp ABI.)
 *
 * Mặc định tạo một conversation mới trong thư viện (bookId IS NULL). Để thêm tin nhắn vào conversation có sẵn:
 *   ELECTRON_RUN_AS_NODE=1 pnpx electron scripts/seed-long-conversation.mjs --count 50 --conversation <uuid>
 *
 * Xóa dữ liệu thử: chạy rm ~/Library/Application\ Support/marginalia-dev/marginalia.db* (cơ sở dữ liệu dev có thể xóa tùy ý).
 */
import Database from "better-sqlite3";
import { v7 as uuidv7 } from "uuid";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";

function devDataDir() {
  if (IS_MAC) return path.join(HOME, "Library", "Application Support", "marginalia-dev");
  if (IS_WIN) return path.join(HOME, "AppData", "Roaming", "marginalia-dev");
  // Linux + fallback
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return path.join(xdg, "marginalia-dev");
  return path.join(HOME, ".config", "marginalia-dev");
}

const DB_PATH = path.join(devDataDir(), "marginalia.db");

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : fallback;
}
function hasFlag(name) {
  return args.includes(name);
}

const count = Number(flag("--count", "200"));
const conversationId = flag("--conversation", null);
const complexity = flag("--complexity", "mixed"); // short | long | code | mixed
const clear = hasFlag("--clear"); // Xóa tin nhắn hiện có trong conversation đích trước khi nạp lại.

if (!Number.isFinite(count) || count <= 0) {
  console.error("--count phải là số nguyên dương");
  process.exit(1);
}

console.log(`DB: ${DB_PATH}`);
console.log(
  `Seeding ${count} messages (complexity=${complexity}, conversation=${conversationId ?? "new"})`,
);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function nowMs() {
  return Date.now();
}

const SHORT_USER = [
  "Cuốn sách này nói về điều gì?",
  "Bạn giải thích chi tiết hơn được không?",
  "Tôi chưa hiểu rõ đoạn này.",
  "Tác giả muốn truyền đạt điều gì?",
  "Điều này liên hệ thế nào với chương trước?",
  "Hãy tóm tắt các ý chính giúp tôi.",
  "Có ví dụ trái ngược nào không?",
];

const SHORT_ASSISTANT = [
  "Được, để tôi hệ thống lại.",
  "Điểm mấu chốt của đoạn này là…",
  "Có thể hiểu nội dung này theo ba khía cạnh.",
  "Thực ra tác giả đang phản hồi một lời phê bình.",
  "Để tôi giải thích bằng một ví dụ.",
];

const LONG_PARAGRAPHS = [
  `Danh sách ảo hóa tăng hiệu năng nhờ chỉ hiển thị các phần tử trong vùng nhìn thấy. Khi số nút DOM giảm từ hàng trăm xuống còn vài chục, chi phí cuộn, bố trí lại và vẽ lại của trình duyệt giảm đáng kể. Tuy vậy, ảo hóa không giải quyết mọi vấn đề: các mục có chiều cao thay đổi cần bộ nhớ đệm kết quả đo; các mục chứa cây nội dung phức tạp như tô màu mã nguồn hoặc công thức toán có thể tốn chi phí đo và tái sử dụng nhiều hơn phần hiệu năng tiết kiệm được. Vì vậy, trước khi áp dụng ảo hóa, nên đo chính xác điểm nghẽn của cách triển khai hiện tại.`,
  `Tình trạng khựng khi có hội thoại dài thường có ba biểu hiện: ô nhập phản hồi chậm, cuộn bị rớt khung hình và màn hình trắng hoặc nhấp nháy khi thêm tin nhắn mới. Độ trễ nhập thường liên quan phạm vi React phải kết xuất lại; cuộn giật có thể do nhiều phần tử định vị tuyệt đối hoặc CSS phức tạp; còn dao động khi thêm tin nhắn thường liên quan việc tự cuộn xuống cuối và tải nội dung bất đồng bộ như ảnh hoặc tô màu khối mã. Cần đo riêng từng vấn đề thay vì quy mọi thứ cho số lượng tin nhắn.`,
  `Trong renderer của Electron 41, luồng compositor của Chromium phân lớp nội dung trang rồi gửi tới GPU. Khi tác vụ dài chặn luồng chính, compositor vẫn có thể tiếp tục hiển thị khung hình cũ nhưng không xử lý được sự kiện mới. Vì vậy dù thao tác cuộn trông có vẻ mượt, lần nhấn hoặc bấm phím của người dùng vẫn có thể bị trễ. Mục longtask của PerformanceObserver giúp phát hiện tình trạng này; ngưỡng thường dùng là 50 ms.`,
];

const CODE_BLOCKS = [
  `\`\`\`ts\nfunction measure<T>(fn: () => T): { result: T; ms: number } {\n  const start = performance.now();\n  const result = fn();\n  return { result, ms: performance.now() - start };\n}\n\`\`\``,
  `\`\`\`python\ndef chunked(items, size):\n    for i in range(0, len(items), size):\n        yield items[i:i + size]\n\nfor batch in chunked(range(1000), 100):\n    process(batch)\n\`\`\``,
  `\`\`\`css\n.message-list {\n  display: flex;\n  flex-direction: column;\n  gap: 1rem;\n  overflow-y: auto;\n  contain: layout style paint;\n}\n\`\`\``,
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildAssistantText() {
  switch (complexity) {
    case "short":
      return pick(SHORT_ASSISTANT);
    case "long":
      return pick(LONG_PARAGRAPHS) + "\n\n" + pick(LONG_PARAGRAPHS);
    case "code":
      return "Đây là ví dụ:\n\n" + pick(CODE_BLOCKS) + "\n\n" + pick(SHORT_ASSISTANT);
    case "mixed":
    default: {
      const roll = Math.random();
      if (roll < 0.4) return pick(SHORT_ASSISTANT);
      if (roll < 0.7) return pick(LONG_PARAGRAPHS);
      return "Cách triển khai tham khảo:\n\n" + pick(CODE_BLOCKS) + "\n\n" + pick(SHORT_ASSISTANT);
    }
  }
}

function buildParts(text) {
  return [{ type: "text", text }];
}

let targetConversationId = conversationId;

if (!targetConversationId) {
  const createdAt = nowMs();
  targetConversationId = uuidv7();
  db.prepare(
    `INSERT INTO conversations (id, book_id, title, context_summary, summarized_through_seq, memory_through_seq, created_at, updated_at)
     VALUES (?, NULL, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(targetConversationId, `perf-test-${count}-${complexity}`, createdAt, createdAt);
  console.log(`Created conversation ${targetConversationId}`);
} else {
  const row = db.prepare("SELECT id FROM conversations WHERE id = ?").get(targetConversationId);
  if (!row) {
    console.error(`Conversation ${targetConversationId} not found`);
    process.exit(1);
  }
  console.log(`Using existing conversation ${targetConversationId}`);
}

if (clear) {
  const result = db
    .prepare("DELETE FROM messages WHERE conversation_id = ?")
    .run(targetConversationId);
  console.log(`Cleared ${result.changes} existing messages`);
}

const insert = db.prepare(
  `INSERT INTO messages (id, conversation_id, role, parts, metadata, status, seq, created_at)
   VALUES (?, ?, ?, ?, NULL, 'complete', ?, ?)`,
);

const startSeq =
  (db
    .prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM messages WHERE conversation_id = ?")
    .get(targetConversationId)?.seq ?? 0) + 1;

const insertMany = db.transaction((items) => {
  for (const item of items) insert.run(item);
});

const batch = [];
const baseTime = nowMs();
for (let i = 0; i < count; i++) {
  const seq = startSeq + i;
  const isUser = i % 2 === 0;
  const role = isUser ? "user" : "assistant";
  const text = isUser ? pick(SHORT_USER) : buildAssistantText();
  const id = uuidv7();
  // Tăng dấu thời gian mỗi giây để thứ tự tin nhắn trông tự nhiên.
  const createdAt = baseTime + i * 1000;
  batch.push([id, targetConversationId, role, JSON.stringify(buildParts(text)), seq, createdAt]);
}

insertMany(batch);
console.log(`Inserted ${batch.length} messages into conversation ${targetConversationId}`);

db.close();
