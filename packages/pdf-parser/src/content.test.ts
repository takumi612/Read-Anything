import { describe, expect, it } from "vitest";
import { extractPdfText } from "./content";
import { makeTextPdf } from "./fixture";

describe("extractPdfText", () => {
  it("extracts page range with page-boundary markers", async () => {
    const bytes = await makeTextPdf({ outline: false });
    const slice = await extractPdfText(bytes, { startPage: 1, endPage: 2 });
    expect(slice.text).toContain("[p.1]");
    expect(slice.text).toContain("[p.2]");
    expect(slice.text).not.toContain("[p.3]");
    // Nội dung mẫu được render theo từ; khoảng trắng có thể đổi khi trích xuất nên kiểm tra các cụm theo thứ tự.
    expect(slice.text).toContain("body text of page 1");
    expect(slice.hasMore).toBe(false);
  });

  it("paginates by character offset", async () => {
    const bytes = await makeTextPdf({ outline: false });
    const first = await extractPdfText(bytes, { startPage: 1, endPage: 3, maxChars: 80 });
    expect(first.text.length).toBe(80);
    expect(first.hasMore).toBe(true);
    expect(first.nextOffset).toBe(80);
    const rest = await extractPdfText(bytes, {
      startPage: 1,
      endPage: 3,
      offset: first.nextOffset,
      maxChars: 100_000,
    });
    expect(rest.hasMore).toBe(false);
    // Ghép lại toàn văn phải trùng với kết quả đọc một lần.
    const whole = await extractPdfText(bytes, { startPage: 1, endPage: 3, maxChars: 100_000 });
    expect(first.text + rest.text).toBe(whole.text);
  });

  it("clamps out-of-range offset so nextOffset stays resumable", async () => {
    const bytes = await makeTextPdf({ outline: false });
    const whole = await extractPdfText(bytes, { startPage: 1, endPage: 3, maxChars: 100_000 });
    const past = await extractPdfText(bytes, {
      startPage: 1,
      endPage: 3,
      offset: whole.text.length + 999,
    });
    expect(past.text).toBe("");
    expect(past.hasMore).toBe(false);
    // Offset vượt giới hạn được đưa về cuối văn bản, không trả lại nguyên trạng.
    expect(past.nextOffset).toBe(whole.text.length);
  });
});
