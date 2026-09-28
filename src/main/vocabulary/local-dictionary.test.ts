import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  installBundledDictionary,
  openLocalDictionary,
  resolveBundledDictionaryPath,
} from "@main/vocabulary/local-dictionary";

const tempDirs: string[] = [];

function makeDictionaryFile(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "marginalia-dictionary-"));
  tempDirs.push(dir);
  const file = path.join(dir, "dictionary.db");
  const db = new Database(file);
  db.exec(`
    CREATE TABLE words (id INTEGER PRIMARY KEY, word TEXT NOT NULL, lang_code TEXT NOT NULL);
    CREATE TABLE definitions (
      id INTEGER PRIMARY KEY,
      definition TEXT NOT NULL,
      pos TEXT,
      sub_pos TEXT,
      definition_lang TEXT
    );
    CREATE TABLE word_definitions (
      id INTEGER PRIMARY KEY,
      word_id INTEGER NOT NULL,
      definition_id INTEGER NOT NULL,
      example TEXT
    );
    CREATE TABLE pronunciations (
      id INTEGER PRIMARY KEY,
      word_id INTEGER NOT NULL,
      ipa TEXT NOT NULL,
      region TEXT
    );
    INSERT INTO words (id, word, lang_code) VALUES (1, 'bank', 'en');
    INSERT INTO definitions (id, definition, pos, sub_pos, definition_lang)
      VALUES (1, 'ngân hàng', 'N', 'noun', 'vi'), (2, 'bờ sông', 'N', 'noun', 'vi');
    INSERT INTO word_definitions (id, word_id, definition_id, example)
      VALUES (1, 1, 1, 'She works at a bank.'), (2, 1, 2, 'They sat on the bank.');
    INSERT INTO pronunciations (id, word_id, ipa, region)
      VALUES (1, 1, '/bæŋk/', 'US'), (2, 1, '/baŋk/', 'UK');
  `);
  db.close();
  return file;
}

function makeMorphologyDictionaryFile(): string {
  const file = makeDictionaryFile();
  const db = new Database(file);
  const entries = [
    ["centralized", "Quá khứ của centralize."],
    ["centralize", "tập trung vào một trung tâm"],
    ["centralization", "quá trình tập trung hóa"],
    ["deploying", "đang triển khai"],
    ["deploy", "triển khai phần mềm"],
    ["application", "ứng dụng"],
    ["apply", "áp dụng"],
    ["decision", "quyết định"],
    ["decide", "đưa ra quyết định"],
  ];
  const insertWord = db.prepare("INSERT INTO words (id, word, lang_code) VALUES (?, ?, 'en')");
  const insertDefinition = db.prepare(
    "INSERT INTO definitions (id, definition, pos, sub_pos, definition_lang) VALUES (?, ?, 'N', 'noun', 'vi')",
  );
  const insertMapping = db.prepare(
    "INSERT INTO word_definitions (id, word_id, definition_id, example) VALUES (?, ?, ?, NULL)",
  );
  entries.forEach(([term, meaning], index) => {
    const id = index + 2;
    insertWord.run(id, term);
    insertDefinition.run(id + 1, meaning);
    insertMapping.run(id + 1, id, id + 1);
  });
  db.close();
  return file;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("local English-Vietnamese dictionary", () => {
  it("returns all offline senses, examples, and pronunciations without changing the source", () => {
    const file = makeDictionaryFile();
    const dictionary = openLocalDictionary(file);

    try {
      expect(dictionary.lookup(" BANK ")).toEqual({
        term: "bank",
        baseTerm: null,
        senses: [
          {
            meaning: "ngân hàng",
            partOfSpeech: "N",
            subPartOfSpeech: "noun",
            example: "She works at a bank.",
          },
          {
            meaning: "bờ sông",
            partOfSpeech: "N",
            subPartOfSpeech: "noun",
            example: "They sat on the bank.",
          },
        ],
        pronunciations: [
          { ipa: "/bæŋk/", region: "US" },
          { ipa: "/baŋk/", region: "UK" },
        ],
      });
      expect(() => dictionary.database.prepare("DELETE FROM words").run()).toThrow();
    } finally {
      dictionary.close();
    }
  });

  it("returns null when a headword is not in the offline dictionary", () => {
    const dictionary = openLocalDictionary(makeDictionaryFile());
    try {
      expect(dictionary.lookup("not-a-word")).toBeNull();
    } finally {
      dictionary.close();
    }
  });

  it("keeps the selected surface form and adds verified roots for past, -ing, -ization, -ation, and -sion forms", () => {
    const dictionary = openLocalDictionary(makeMorphologyDictionaryFile());
    try {
      const cases = [
        { surface: "centralized", root: "centralize", rootMeaning: "tập trung vào một trung tâm" },
        { surface: "centralization", root: "centralize", rootMeaning: "tập trung vào một trung tâm" },
        { surface: "deploying", root: "deploy", rootMeaning: "triển khai phần mềm" },
        { surface: "application", root: "apply", rootMeaning: "áp dụng" },
        { surface: "decision", root: "decide", rootMeaning: "đưa ra quyết định" },
      ];

      for (const item of cases) {
        const entry = dictionary.lookup(item.surface);
        expect(entry?.term).toBe(item.surface);
        expect(entry?.baseTerm).toBe(item.root);
        expect(entry?.senses.map((sense) => sense.meaning)).toContain(item.rootMeaning);
      }
      expect(dictionary.lookup("centralize")?.baseTerm).toBeNull();
    } finally {
      dictionary.close();
    }
  });

  it("resolves development and packaged resource locations", () => {
    expect(resolveBundledDictionaryPath(false, "C:/app", "C:/resources")).toBe(
      path.join("C:/app", "assets", "dictionary", "dictionary_en_vi.db"),
    );
    expect(resolveBundledDictionaryPath(true, "C:/app", "C:/resources")).toBe(
      path.join("C:/resources", "dictionary", "dictionary_en_vi.db"),
    );
  });

  it("installs and queries the bundled English-Vietnamese dataset", () => {
    const source = path.resolve(__dirname, "../../../assets/dictionary/dictionary_en_vi.db");
    const dir = mkdtempSync(path.join(os.tmpdir(), "marginalia-bundled-dictionary-"));
    tempDirs.push(dir);
    const target = path.join(dir, "dictionaries", "english-vietnamese.db");
    expect(installBundledDictionary(source, target)).toBe(target);
    expect(installBundledDictionary(source, target)).toBe(target);
    const dictionary = openLocalDictionary(target);

    try {
      const entry = dictionary.lookup("SEAMLESS");
      expect(entry?.term).toBe("seamless");
      expect(entry?.senses.some((sense) => sense.meaning.includes("Không có đường nối"))).toBe(
        true,
      );
      expect(entry?.pronunciations.length).toBeGreaterThan(0);
      expect(dictionary.lookup("a-headword-not-in-this-dictionary")).toBeNull();
    } finally {
      dictionary.close();
    }
  });

  it("prioritizes curated computing senses and resolves technical phrases offline", () => {
    const source = path.resolve(__dirname, "../../../assets/dictionary/dictionary_en_vi.db");
    const dir = mkdtempSync(path.join(os.tmpdir(), "marginalia-computing-dictionary-"));
    tempDirs.push(dir);
    const installed = installBundledDictionary(source, path.join(dir, "english-vietnamese.db"));
    const dictionary = openLocalDictionary(installed);

    try {
      const scalable = dictionary.lookup("scalable");
      expect(scalable?.senses[0]).toMatchObject({
        meaning:
          "có khả năng mở rộng để xử lý lượng tải tăng lên mà không phải thiết kế lại toàn bộ hệ thống",
        domain: "Kỹ thuật phần mềm",
      });
      expect(scalable?.senses.some((sense) => sense.meaning === "Có thể leo bằng thang")).toBe(
        false,
      );

      const microservices = dictionary.lookup("microservices");
      expect(microservices?.senses.length).toBeGreaterThanOrEqual(2);
      expect(microservices?.senses.every((sense) => sense.domain === "Kiến trúc phần mềm")).toBe(
        true,
      );

      const machineLearning = dictionary.lookup("machine learning");
      expect(machineLearning?.term).toBe("machine learning");
      expect(machineLearning?.senses[0]?.domain).toBe("Khoa học máy tính · AI/ML");

      // Look up the selected surface form while resolving a dictionary-backed base form offline.
      const released = dictionary.lookup("released", "NestJS 6.0 is released.");
      expect(released?.term).toBe("released");
      expect(released?.baseTerm).toBe("release");
      expect(released?.senses[0]).toMatchObject({
        domain: "Kỹ thuật phần mềm",
        meaning: "phiên bản phần mềm được công bố để người khác cài đặt hoặc sử dụng",
      });
    } finally {
      dictionary.close();
    }
  });

  it("ranks the software-performance sense first in a system-load passage", () => {
    const source = path.resolve(__dirname, "../../../assets/dictionary/dictionary_en_vi.db");
    const dir = mkdtempSync(path.join(os.tmpdir(), "marginalia-performance-dictionary-"));
    tempDirs.push(dir);
    const installed = installBundledDictionary(source, path.join(dir, "english-vietnamese.db"));
    const dictionary = openLocalDictionary(installed);

    try {
      const performance = dictionary.lookup(
        "performance",
        "Application performance degrades under heavy load; latency increases and throughput drops.",
      );
      expect(performance?.senses[0]).toMatchObject({
        domain: "Hiệu năng hệ thống",
        meaning: "tốc độ xử lý và khả năng phản hồi của hệ thống khi hoạt động dưới tải",
      });
      expect(performance?.senses.length).toBeGreaterThan(1);
    } finally {
      dictionary.close();
    }
  });

  it("uses reviewed computing definitions instead of malformed corpus examples", () => {
    const source = path.resolve(__dirname, "../../../assets/dictionary/dictionary_en_vi.db");
    const dir = mkdtempSync(path.join(os.tmpdir(), "marginalia-computing-quality-"));
    tempDirs.push(dir);
    const installed = installBundledDictionary(source, path.join(dir, "english-vietnamese.db"));
    const dictionary = openLocalDictionary(installed);

    try {
      const programming = dictionary.lookup("programming");
      expect(programming?.senses[0]).toMatchObject({
        meaning: "hoạt động thiết kế, viết, kiểm thử và duy trì chương trình máy tính",
        domain: "Khoa học máy tính",
        example: "Programming requires careful testing.",
      });
      expect(programming?.senses.some((sense) => sense.example?.includes("ape"))).toBe(false);

      expect(dictionary.lookup("pointer")?.senses[0]).toMatchObject({
        domain: "Khoa học máy tính",
      });
      expect(dictionary.lookup("kernel")?.senses[0]).toMatchObject({
        domain: "Hệ điều hành",
      });
    } finally {
      dictionary.close();
    }
  });

  it("includes security and language-processing senses and ranks them by passage context", () => {
    const source = path.resolve(__dirname, "../../../assets/dictionary/dictionary_en_vi.db");
    const dir = mkdtempSync(path.join(os.tmpdir(), "marginalia-contextual-dictionary-"));
    tempDirs.push(dir);
    const installed = installBundledDictionary(source, path.join(dir, "english-vietnamese.db"));
    const dictionary = openLocalDictionary(installed);

    try {
      expect(dictionary.lookup("data masking")?.senses[0]).toMatchObject({
        domain: "Bảo mật dữ liệu",
      });

      const security = dictionary.lookup(
        "tokenization",
        "For sensitive data displayed in your application, consider data masking or tokenization.",
      );
      expect(security?.senses).toHaveLength(2);
      expect(security?.senses[0]?.domain).toBe("Bảo mật dữ liệu");

      const languageProcessing = dictionary.lookup(
        "tokenization",
        "The tokenizer splits text into tokens before the language model processes it.",
      );
      expect(languageProcessing?.senses[0]?.domain).toBe("AI/ML");
    } finally {
      dictionary.close();
    }
  });

  it("puts the computing sense from a technical book passage first for ambiguous terms", () => {
    const source = path.resolve(__dirname, "../../../assets/dictionary/dictionary_en_vi.db");
    const dir = mkdtempSync(path.join(os.tmpdir(), "marginalia-book-dictionary-context-"));
    tempDirs.push(dir);
    const installed = installBundledDictionary(source, path.join(dir, "english-vietnamese.db"));
    const dictionary = openLocalDictionary(installed);

    const cases = [
      {
        term: "model",
        context: "The read model and the write model want different shapes",
        sense: "biểu diễn đơn giản hóa",
        domain: "Kỹ thuật phần mềm",
      },
      {
        term: "token",
        context: "Token Bucket: 100 tokens per key; each request takes a token",
        sense: "bucket của bộ giới hạn tốc độ",
        domain: "Mạng máy tính",
      },
      {
        term: "pipeline",
        context: "multi-tenant analytics pipeline on DynamoDB",
        sense: "thu thập, biến đổi và chuyển dữ liệu",
        domain: "Khoa học dữ liệu",
      },
      {
        term: "orchestration",
        context: "Orchestration Saga; a central orchestrator dispatches compensations",
        sense: "điều phối thứ tự các bước",
        domain: "Hệ thống phân tán",
      },
      {
        term: "feature",
        context: "Feature Flag; deploy code behind a flag defaulting to OFF",
        sense: "công tắc cấu hình dùng để bật hoặc tắt",
        domain: "Kỹ thuật phần mềm",
      },
      {
        term: "precision",
        context: "Quantize the model to INT8; reduce weight precision from 32-bit to 8-bit",
        sense: "độ chính xác số học",
        domain: "AI/ML · Tính toán số",
      },
      {
        term: "serialization",
        context: "PostgreSQL SSI serialization failures; transactions abort and retry",
        sense: "các giao dịch đồng thời có thể được sắp xếp",
        domain: "Cơ sở dữ liệu",
      },
      {
        term: "pointer",
        context: "flip the read pointer to the new users_v2 table",
        sense: "tham chiếu chỉ tới vị trí",
        domain: "Kỹ thuật phần mềm",
      },
      {
        term: "recall",
        context: "catastrophic forgetting can degrade recall of old content",
        sense: "khả năng truy xuất hoặc nhớ lại",
        domain: "AI/ML",
      },
      {
        term: "kernel",
        context: "GPU kernel launch overhead; GPUs want 256 inputs to process together",
        sense: "hàm hoặc chương trình nhỏ được GPU",
        domain: "GPU & Hệ thống",
      },
      {
        term: "provider",
        context: "The webhook timed out; Stripe retries; this duplicates provider behavior",
        sense: "dịch vụ bên ngoài cung cấp API",
        domain: "Tích hợp hệ thống",
      },
      {
        term: "query",
        context: "N+1 Query Problem; the query log shows 51 queries per request",
        sense: "yêu cầu đọc, thêm, sửa hoặc xóa dữ liệu",
        domain: "Cơ sở dữ liệu",
      },
      {
        term: "partition",
        context: "Kafka with a taken partition key; events must stay ordered",
        sense: "được chia từ một bảng, chủ đề",
        domain: "Cơ sở dữ liệu",
      },
      {
        term: "consistency",
        context: "eventual consistency between the read store and the primary database",
        sense: "mức bảo đảm các lần đọc",
        domain: "Cơ sở dữ liệu",
      },
      {
        term: "index",
        context: "B-tree lookup; Elasticsearch index; Postgres index scan",
        sense: "cấu trúc phụ trợ cho phép cơ sở dữ liệu",
        domain: "Cơ sở dữ liệu",
      },
      {
        term: "memory",
        context: "O(1) memory per key; GPU memory footprint",
        sense: "bộ nhớ của máy tính",
        domain: "Hệ thống máy tính",
      },
      {
        term: "traffic",
        context: "A load balancer distributes traffic; request traffic spikes",
        sense: "lượng yêu cầu hoặc dữ liệu đi qua mạng",
        domain: "Mạng máy tính",
      },
    ];

    try {
      for (const { term, context, sense, domain } of cases) {
        const first = dictionary.lookup(term, context)?.senses[0];
        expect
          .soft(first?.meaning, `${term} should show its passage meaning first`)
          .toContain(sense);
        expect
          .soft(first?.domain, `${term} should be classified in the matching domain`)
          .toBe(domain);
      }
    } finally {
      dictionary.close();
    }
  });
});
