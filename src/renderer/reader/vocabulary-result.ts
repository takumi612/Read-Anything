export interface VocabularySenseView {
  domain: string | null;
  partOfSpeech: string | null;
  meaning: string;
  example: string | null;
}

export interface VocabularyResultView {
  baseForm: string | null;
  pronunciation: string | null;
  senses: VocabularySenseView[];
  plainText: string | null;
}

const PARTS_OF_SPEECH = /^(?:n|v|adj|adv|prep|conj|pron|interj|noun|verb|adjective|adverb|preposition|conjunction|danh từ|động từ|tính từ|trạng từ|giới từ|liên từ)$/iu;

/** Parse the bundled dictionary's compact storage format for a readable lookup card. */
export function parseVocabularyResult(value: string): VocabularyResultView {
  const lines = value.split(/\r?\n/u);
  const senses: VocabularySenseView[] = [];
  let baseForm: string | null = null;
  let pronunciation: string | null = null;
  let current: VocabularySenseView | null = null;

  for (const line of lines) {
    const match = line.match(/^\s*\d+\.\s+(.*)$/u);
    if (match) {
      const metadata: string[] = [];
      let meaning = match[1]!.trim();
      while (meaning.startsWith("[")) {
        const label = meaning.match(/^\[([^\]]+)\]\s*/u);
        if (!label) break;
        metadata.push(label[1]!.trim());
        meaning = meaning.slice(label[0].length).trim();
      }
      const partOfSpeech = metadata.find((label) => PARTS_OF_SPEECH.test(label)) ?? null;
      const domain = metadata.find((label) => !PARTS_OF_SPEECH.test(label)) ?? null;
      current = { domain, partOfSpeech, meaning, example: null };
      senses.push(current);
      continue;
    }

    const content = line.trim();
    if (!content) continue;
    if (content.startsWith("@base: ")) {
      baseForm = content.slice("@base: ".length).trim() || null;
      continue;
    }
    if (!current) {
      pronunciation ??= content;
    } else if (/^\s{2,}\S/u.test(line)) {
      current.example = content;
    } else {
      current.meaning = `${current.meaning}\n${content}`;
    }
  }

  return senses.length > 0
    ? { baseForm, pronunciation, senses, plainText: null }
    : { baseForm: null, pronunciation: null, senses: [], plainText: value.trim() || null };
}
