/** Giới hạn ký tự mỗi utterance vì một số engine cắt hoặc treo với văn bản quá dài. */
export const MAX_UTTERANCE_CHARS = 300;

/**
 * Chia đoạn dài thành các utterance không quá max ký tự, ưu tiên ghép theo câu từ Intl.Segmenter.
 * Nếu một câu còn quá dài, chia tiếp theo dấu câu và giữ dấu ở cuối phần trước để ngắt nghỉ tự nhiên.
 * Nối các phần vẫn ra đúng văn bản gốc; cùng đoạn dùng chung giọng và vùng tô sáng.
 */
export function splitForUtterance(text: string, max = MAX_UTTERANCE_CHARS): string[] {
  if (text.length <= max) return [text];
  const seg = new Intl.Segmenter(undefined, { granularity: "sentence" });
  const sentences = [...seg.segment(text)].map((s) => s.segment);
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(buf);
    buf = "";
  };
  for (const s of sentences) {
    if (s.length > max) {
      flush();
      for (const piece of s.split(/(?<=[,;，；、])/)) {
        if (piece.length > max) {
          // Nếu đoạn quá dài không có dấu câu, buộc cắt theo ký tự để bảo vệ engine.
          flush();
          for (let i = 0; i < piece.length; i += max) out.push(piece.slice(i, i + max));
          continue;
        }
        if (buf.length + piece.length > max) flush();
        buf += piece;
      }
      flush();
      continue;
    }
    if (buf.length + s.length > max) flush();
    buf += s;
  }
  flush();
  return out.length ? out : [text];
}
