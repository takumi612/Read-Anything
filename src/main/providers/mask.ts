/**
 * Che API key để hiển thị, ví dụ "sk-…1234".
 * Khóa ngắn tối đa 8 ký tự được che toàn bộ; khóa dài hiện ba ký tự đầu và bốn ký tự cuối.
 */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 8) return "••••";
  return `${plaintext.slice(0, 3)}…${plaintext.slice(-4)}`;
}
