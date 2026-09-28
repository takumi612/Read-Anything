import { z } from "zod";
import { annotationFillStyle, annotationStyle } from "@shared/annotations";
import { uiLanguage } from "@shared/i18n/language";
import { webSearchConfig } from "@shared/web-search";

/** Kiểu chữ nội dung: default giữ nguyên sách; các lựa chọn khác dùng font đã đóng gói. */
export const readerFontFamily = z.enum(["default", "wenkai", "serif", "sans"]);
export type ReaderFontFamily = z.infer<typeof readerFontFamily>;

/** Tùy chọn dàn trang: cỡ chữ, giãn dòng, chiều rộng cột và font; ReaderPrefs suy ra từ đây. */
export const readerPrefsSchema = z.object({
  fontScale: z.number(),
  lineHeight: z.number(),
  maxWidth: z.number().int(),
  // .default giúp đọc dữ liệu cũ thiếu trường này mà không đặt lại các tùy chọn khác.
  fontFamily: readerFontFamily.default("default"),
});
export type ReaderPrefs = z.infer<typeof readerPrefsSchema>;

/** Ba chế độ màu; ColorMode của renderer suy ra từ đây. */
export const colorMode = z.enum(["light", "dark", "system"]);
export type ColorMode = z.infer<typeof colorMode>;

/** Màu trang đọc độc lập với giao diện ứng dụng; Original giữ nguyên màu của sách. */
export const readerColorMode = z.enum(["light", "dark", "system", "paper", "sepia", "sage"]);
export type ReaderColorMode = z.infer<typeof readerColorMode>;

export const appBackgroundMode = z.enum(["default", "color", "image"]);
export type AppBackgroundMode = z.infer<typeof appBackgroundMode>;
export const appBackgroundColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Bố cục reader lưu trạng thái thanh điều hướng bên trái và bảng AI. */
export const readerLayoutSchema = z.object({
  sidebarOpen: z.boolean(),
  panelOpen: z.boolean(),
});
export type ReaderLayout = z.infer<typeof readerLayoutSchema>;

/** Mức zoom PDF so với chế độ vừa chiều rộng; lưu hệ số để không lệch khi danh sách mức zoom thay đổi. */
export const pdfZoomSchema = z.number().positive();

/** Screen-only brightness applied to PDF page canvases; kept out of EPUB and app appearance. */
export const pdfBrightnessSchema = z.number().int().min(50).max(150);
/** Brightness applied only to the area around PDF pages, independent from page brightness. */
export const pdfSurroundingBrightnessSchema = z.number().int().min(50).max(150);

export const pdfSurroundingColorSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  color: appBackgroundColor,
  showInThemeMenu: z.boolean(),
});

const uniquePdfSurroundingColors = (
  colors: Array<z.infer<typeof pdfSurroundingColorSchema>>,
) => {
  const ids = colors.map((color) => color.id);
  const hexValues = colors.map((color) => color.color.toLowerCase());
  return new Set(ids).size === ids.length && new Set(hexValues).size === hexValues.length;
};

/** User-defined colors apply only to the canvas around PDF pages. */
export const pdfSurroundingBackgroundSchema = z
  .object({
    colors: z.array(pdfSurroundingColorSchema).max(12).refine(uniquePdfSurroundingColors),
    selectedId: z.string().nullable(),
  })
  .refine(
    ({ colors, selectedId }) => selectedId === null || colors.some((color) => color.id === selectedId),
  );
export type PdfSurroundingColor = z.infer<typeof pdfSurroundingColorSchema>;
export type PdfSurroundingBackground = z.infer<typeof pdfSurroundingBackgroundSchema>;

const uniqueAnnotationColors = (colors: string[]) =>
  new Set(colors.map((color) => color.toLowerCase())).size === colors.length;

export const annotationColorsSchema = z
  .array(annotationFillStyle)
  .min(1)
  .refine(uniqueAnnotationColors);
export type AnnotationColors = z.infer<typeof annotationColorsSchema>;

export const annotationPaletteSchema = z
  .array(annotationFillStyle)
  .min(1)
  .refine(uniqueAnnotationColors);
export type AnnotationPalette = z.infer<typeof annotationPaletteSchema>;
/** Five established tones plus one warm orange; all start saved and enabled. */
export const DEFAULT_ANNOTATION_COLORS: AnnotationColors = [
  "yellow",
  "green",
  "blue",
  "pink",
  "purple",
  "#f97316",
];
export const DEFAULT_ANNOTATION_PALETTE: AnnotationPalette = [...DEFAULT_ANNOTATION_COLORS];

/**
 * Mức reasoning ánh xạ vào tham số `reasoning` của AI SDK v7;
 * SDK chuyển sang cấu hình riêng của từng provider.
 * Chat và summary có tùy chọn độc lập. Nếu chưa đặt, không gửi tham số và dùng mặc định provider.
 * `none` tắt reasoning khi provider hỗ trợ; model luôn bật reasoning có thể trả lỗi.
 */
export const reasoningEffort = z.enum(["none", "low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof reasoningEffort>;

/** Model tóm tắt và đặt tên hội thoại: cặp provider/model tường minh; thiếu nghĩa là chưa cấu hình. */
export const summaryModelSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: reasoningEffort.optional(), // Thiếu trường thì không gửi tham số; dữ liệu cũ vẫn hợp lệ.
});
export type SummaryModel = z.infer<typeof summaryModelSchema>;

/** Giới hạn số bước AI: 0 là không giới hạn; từ 1 trở lên là số bước tối đa. */
export const stepLimitSchema = z.number().int().min(0);

/** stepLimit mặc định, dùng chung cho main process và renderer. */
export const DEFAULT_STEP_LIMIT = 10;

/** Số tác vụ AI nền tối đa chạy đồng thời; phải dương để không vô tình tắt toàn bộ tác vụ. */
export const backgroundConcurrencySchema = z.number().int().positive();

/** backgroundConcurrency mặc định, dùng chung cho main process và renderer. */
export const DEFAULT_BACKGROUND_CONCURRENCY = 3;

/** Model trò chuyện (spec 2026-06-10 §2.2): cặp provider/model tường minh, thiếu là chưa cấu hình. */
export const chatModelSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: reasoningEffort.optional(), // Thiếu trường thì không gửi tham số; dữ liệu cũ vẫn hợp lệ.
});
export type ChatModel = z.infer<typeof chatModelSchema>;

/** Cấu hình nhân cách AI (SOUL): tên hiển thị riêng và mô tả persona bằng Markdown. */
export const soulSchema = z.object({
  name: z.string().min(1),
  persona: z.string(),
});
export type Soul = z.infer<typeof soulSchema>;

/** Giá trị SOUL ban đầu: tên Lia; persona ngắn để người dùng tiếp tục tùy chỉnh. */
export const DEFAULT_SOUL: Soul = {
  name: "Lia",
  persona:
    "You are a warm, curious, and thoughtful reading companion. You genuinely care about how your reader thinks and grows. Keep your voice gentle and concise; let personality come through naturally rather than performing it.",
};

/** Tùy chọn đọc to: tốc độ và voice.name theo ngôn ngữ; thiếu giọng thì dùng chuỗi dự phòng. */
export const ttsPrefsSchema = z.object({
  rate: z.number().min(0.5).max(2),
  voiceByLang: z.record(z.string(), z.string()),
});
export type TtsPrefs = z.infer<typeof ttsPrefsSchema>;

/** Tùy chọn đọc to mặc định, dùng chung khi khởi tạo và đặt lại. */
export const DEFAULT_TTS_PREFS: TtsPrefs = { rate: 1, voiceByLang: {} };

/**
 * Nguồn duy nhất của tùy chọn người dùng có lưu trữ: key → Zod schema.
 * Thêm tùy chọn bằng cách đăng ký key và schema; DB, service, IPC và kiểu dữ liệu suy ra từ đây.
 */
export const PREFERENCE_SCHEMAS = {
  readerPrefs: readerPrefsSchema,
  lastHighlightStyle: annotationStyle,
  annotationColors: annotationColorsSchema,
  annotationPalette: annotationPaletteSchema,
  autoSummarize: z.boolean(),
  onboardingDismissed: z.boolean(),
  colorMode,
  /** EPUB page styling is independent from the application chrome and PDF pages. */
  epubColorMode: readerColorMode,
  /** PDF page rendering is independent from the application chrome; light preserves source colors. */
  pdfColorMode: readerColorMode,
  pdfSurroundingBackground: pdfSurroundingBackgroundSchema,
  appBackgroundMode,
  appBackgroundColor,
  appBackgroundBlobId: z.string().nullable(),
  language: uiLanguage,
  readerLayout: readerLayoutSchema,
  summaryModel: summaryModelSchema,
  pdfZoom: pdfZoomSchema,
  pdfBrightness: pdfBrightnessSchema,
  pdfSurroundingBrightness: pdfSurroundingBrightnessSchema,
  restorePdfTabs: z.boolean(),
  stepLimit: stepLimitSchema,
  backgroundConcurrency: backgroundConcurrencySchema,
  chatModel: chatModelSchema,
  aiDataConsent: z.boolean(),
  memoryEnabled: z.boolean(),
  memoryAutoConsolidate: z.boolean(),
  soul: soulSchema,
  instructions: z.string(),
  ttsPrefs: ttsPrefsSchema,
  showAgentAvatar: z.boolean(),
  avatarBlobId: z.string().nullable(),
  webSearch: webSearchConfig,
  webSearchEnabled: z.boolean(),
} as const;

export type PreferenceKey = keyof typeof PREFERENCE_SCHEMAS;
export type PreferenceValue<K extends PreferenceKey> = z.infer<(typeof PREFERENCE_SCHEMAS)[K]>;

/** Kiểm tra key hợp lệ tại ranh giới IPC. */
export const preferenceKey = z.enum(
  Object.keys(PREFERENCE_SCHEMAS) as [PreferenceKey, ...PreferenceKey[]],
);

/** Snapshot tùy chọn để renderer khởi tạo, chỉ gồm key đã lưu và hợp lệ. */
export type PreferencesSnapshot = Partial<{ [K in PreferenceKey]: PreferenceValue<K> }>;

/**
 * Đầu vào IPC `preferences:set`: kiểm tra value theo key ngay tại ranh giới.
 * Khi thêm key mới, thêm nhánh tương ứng tại đây; preferences.test.ts kiểm tra sự đồng bộ.
 */
export const setPreferenceInput = z.discriminatedUnion("key", [
  z.object({ key: z.literal("readerPrefs"), value: readerPrefsSchema }),
  z.object({ key: z.literal("lastHighlightStyle"), value: annotationStyle }),
  z.object({ key: z.literal("annotationColors"), value: annotationColorsSchema }),
  z.object({ key: z.literal("annotationPalette"), value: annotationPaletteSchema }),
  z.object({ key: z.literal("autoSummarize"), value: z.boolean() }),
  z.object({ key: z.literal("onboardingDismissed"), value: z.boolean() }),
  z.object({ key: z.literal("colorMode"), value: colorMode }),
  z.object({ key: z.literal("epubColorMode"), value: readerColorMode }),
  z.object({ key: z.literal("pdfColorMode"), value: readerColorMode }),
  z.object({ key: z.literal("pdfSurroundingBackground"), value: pdfSurroundingBackgroundSchema }),
  z.object({ key: z.literal("appBackgroundMode"), value: appBackgroundMode }),
  z.object({ key: z.literal("appBackgroundColor"), value: appBackgroundColor }),
  z.object({ key: z.literal("appBackgroundBlobId"), value: z.string().nullable() }),
  z.object({ key: z.literal("language"), value: uiLanguage }),
  z.object({ key: z.literal("readerLayout"), value: readerLayoutSchema }),
  z.object({ key: z.literal("summaryModel"), value: summaryModelSchema }),
  z.object({ key: z.literal("pdfZoom"), value: pdfZoomSchema }),
  z.object({ key: z.literal("pdfBrightness"), value: pdfBrightnessSchema }),
  z.object({ key: z.literal("pdfSurroundingBrightness"), value: pdfSurroundingBrightnessSchema }),
  z.object({ key: z.literal("restorePdfTabs"), value: z.boolean() }),
  z.object({ key: z.literal("stepLimit"), value: stepLimitSchema }),
  z.object({ key: z.literal("backgroundConcurrency"), value: backgroundConcurrencySchema }),
  z.object({ key: z.literal("chatModel"), value: chatModelSchema }),
  z.object({ key: z.literal("aiDataConsent"), value: z.boolean() }),
  z.object({ key: z.literal("memoryEnabled"), value: z.boolean() }),
  z.object({ key: z.literal("memoryAutoConsolidate"), value: z.boolean() }),
  z.object({ key: z.literal("soul"), value: soulSchema }),
  z.object({ key: z.literal("instructions"), value: z.string() }),
  z.object({ key: z.literal("ttsPrefs"), value: ttsPrefsSchema }),
  z.object({ key: z.literal("showAgentAvatar"), value: z.boolean() }),
  z.object({ key: z.literal("avatarBlobId"), value: z.string().nullable() }),
  z.object({ key: z.literal("webSearch"), value: webSearchConfig }),
  z.object({ key: z.literal("webSearchEnabled"), value: z.boolean() }),
]);
export type SetPreferenceInput = z.infer<typeof setPreferenceInput>;
