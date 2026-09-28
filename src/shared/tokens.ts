// src/shared/tokens.ts

// Bao phủ các vùng Unicode CJK thường gặp: dấu câu, ký tự mở rộng, chữ Hán,
// ký tự tương thích và dạng toàn chiều rộng/nửa chiều rộng. Mỗi ký tự tính xấp xỉ một token.
const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

/**
 * Ước tính token để hiển thị chip, không phụ thuộc tokenizer.
 * Ký tự CJK tính 1, ký tự khác tính 0,25; cộng rồi làm tròn lên.
 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK.test(ch)) cjk++;
    else other++;
  }
  return Math.ceil(cjk + other / 4);
}

export interface TokenBudgetSlice {
  text: string;
  tokens: number;
  truncated: boolean;
}

/**
 * Cắt văn bản theo cách estimateTokens đếm token, giữ tiền tố dài nhất không vượt budget.
 * Dùng cho phân trang bằng chứng; giới hạn theo ký tự sẽ lệch nhiều giữa CJK và chữ Latin.
 * budget ≤ 0 trả chuỗi rỗng và đánh dấu cắt, trừ khi đầu vào vốn đã rỗng.
 */
export function sliceToTokenBudget(text: string, budget: number): TokenBudgetSlice {
  const total = estimateTokens(text);
  if (total <= budget) return { text, tokens: total, truncated: false };
  let weight = 0;
  let end = 0;
  for (const ch of text) {
    const next = weight + (CJK.test(ch) ? 1 : 0.25);
    if (Math.ceil(next) > budget) break;
    weight = next;
    end += ch.length;
  }
  return { text: text.slice(0, end), tokens: Math.ceil(weight), truncated: true };
}
