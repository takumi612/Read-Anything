# Bản đồ mã nguồn

Trang này có đường dẫn tới từng tệp trong `src`, `packages`, `scripts`, `assets`, `patches` và các cấu hình gốc. Mở từng nhóm phía dưới để tra cứu.

Danh mục tệp bên dưới được ghi lại khi tạo tài liệu. Để đối chiếu với source hiện tại, chạy `rg --files src packages scripts assets patches` rồi so sánh các cấu hình ở thư mục gốc. File `*.test.*` là kiểm thử; `fixture.ts` trong parser và `packages/ui-prototype/src/mock/fixtures.ts` là dữ liệu mẫu; migration ghi lại lịch sử schema. `packages/ui-prototype` không thuộc build ứng dụng chính.

<a id="entry"></a>

## Bắt đầu đọc ở đâu

| Điểm vào | Vai trò |
|----|----|
| [`src/main.ts`](../src/main.ts) | Khởi động Electron, DB, IPC, cửa sổ và renderer server. |
| [`src/preload.ts`](../src/preload.ts) | Mở API an toàn cho renderer qua contextBridge. |
| [`src/preload-api.ts`](../src/preload-api.ts) | Ánh xạ hợp đồng IPC thành window.api có kiểu. |
| [`src/renderer.tsx`](../src/renderer.tsx) | Gắn React, CSS, theme, i18n và React Query. |
| [`src/renderer/App.tsx`](../src/renderer/App.tsx) | Điều hướng ứng dụng và khôi phục tab PDF. |
| [`src/shared/ipc.ts`](../src/shared/ipc.ts) | Tên channel và Zod input. |
| [`src/main/db/schema.ts`](../src/main/db/schema.ts) | Bảng dữ liệu Drizzle. |
| [`forge.config.ts`](../forge.config.ts) | Cấu hình Electron Forge và installer. |
| [`package.json`](../package.json) | Scripts, dependency và phiên bản. |

<a id="areas"></a>

## Các miền code

### [`src/main/ai/`](#dir-src-main-ai)

Tạo prompt, tìm ngữ cảnh và stream trả lời AI. Thư mục search chứa backend tìm kiếm mạng.

### [`src/main/app/`](#dir-src-main-app)

Dịch vụ môi trường, đường dẫn, nền ứng dụng, URL, renderer server và liên kết PDF của Windows.

### [`src/main/backup/`](#dir-src-main-backup)

Snapshot, manifest, ZIP và khôi phục dữ liệu.

### [`src/main/chat/`](#dir-src-main-chat)

Hội thoại, tin nhắn và đặt tên cuộc trò chuyện.

### [`src/main/db/`](#dir-src-main-db)

SQLite, schema Drizzle và đường dẫn migration.

### [`src/main/ipc/`](#dir-src-main-ipc)

Ánh xạ hợp đồng shared vào hàm nghiệp vụ của main.

### [`src/main/library/`](#dir-src-main-library)

Import, metadata, file sách, nội dung, tiến độ, annotation, note và bookmark.

### [`src/main/providers/`](#dir-src-main-providers)

Nhà cung cấp AI, model và endpoint.

### [`src/main/reading-report/`](#dir-src-main-reading-report)

Tạo báo cáo phiên đọc và thu thập bằng chứng.

### [`src/main/stats/`](#dir-src-main-stats)

Thời gian đọc, lượt đọc trang và chuỗi ngày.

### [`src/main/vocabulary/`](#dir-src-main-vocabulary)

Từ điển offline, thuật ngữ kỹ thuật và từ vựng theo sách.

### [`src/renderer/ai/`](#dir-src-renderer-ai)

Panel chat, composer, lịch sử, context chips và IPC stream.

### [`src/renderer/reader/`](#dir-src-renderer-reader)

Reader EPUB/PDF, search, zoom, vùng chọn, annotation, sidebar và TTS.

### [`src/renderer/reading/`](#dir-src-renderer-reading)

Điều hướng theo trạng thái phiên đọc và báo cáo.

### [`src/renderer/settings/`](#dir-src-renderer-settings)

Giao diện cài đặt, provider, giao diện, sao lưu và tìm kiếm web.

### [`src/renderer/store/`](#dir-src-renderer-store)

Zustand store: điều hướng, cài đặt, layout, chat, tab PDF và TTS.

### [`src/renderer/theme/`](#dir-src-renderer-theme)

Theme, nền ứng dụng, màu trang và độ sáng PDF.

### [`src/renderer/stats/`](#dir-src-renderer-stats)

Lịch tháng, biểu đồ, thời gian và streak.

### [`src/shared/`](#dir-src-shared)

Schema Zod, kiểu chung và hợp đồng IPC.

### [`packages/epub-parser/`](#dir-packages-epub-parser)

Package parser EPUB dùng trong app.

### [`packages/pdf-parser/`](#dir-packages-pdf-parser)

Package parser PDF dùng trong main.

### [`packages/virtual-docs/`](#dir-packages-virtual-docs)

Khung section và tài liệu phía renderer.

### [`packages/ui-prototype/`](#dir-packages-ui-prototype)

Prototype UI độc lập, nằm ngoài pnpm workspace chính.

### [`scripts/`](#dir-scripts)

Kịch bản E2E, kiểm thử, tạo icon và tiện ích phát triển.

<a id="inventory"></a>

## Danh mục tệp đầy đủ

Nhấn tên thư mục để mở. Mỗi tên tệp dẫn tới bản source tương ứng. Các file `*.test.*` là test; `migration.sql` và `snapshot.json` là migration; asset nhị phân không phải mã TypeScript.

### Cấu hình ở gốc (20 tệp)

- [`.oxfmtrc.json`](../.oxfmtrc.json)
- [`.oxlintrc.json`](../.oxlintrc.json)
- [`LICENSE`](../LICENSE)
- [`README.md`](../README.md)
- [`README.vi.md`](../README.vi.md)
- [`components.json`](../components.json)
- [`drizzle.config.ts`](../drizzle.config.ts)
- [`forge.config.ts`](../forge.config.ts)
- [`forge.env.d.ts`](../forge.env.d.ts)
- [`i18next.config.ts`](../i18next.config.ts)
- [`index.html`](../index.html)
- [`package.json`](../package.json)
- [`pnpm-lock.yaml`](../pnpm-lock.yaml)
- [`pnpm-workspace.yaml`](../pnpm-workspace.yaml)
- [`tsconfig.json`](../tsconfig.json)
- [`vite.main.config.ts`](../vite.main.config.ts)
- [`vite.preload.config.ts`](../vite.preload.config.ts)
- [`vite.renderer.config.ts`](../vite.renderer.config.ts)
- [`vitest.config.ts`](../vitest.config.ts)
- [`vitest.setup.ts`](../vitest.setup.ts)

### assets/dictionary (3 tệp)

- [`assets/dictionary/ATTRIBUTION.md`](../assets/dictionary/ATTRIBUTION.md) asset/patch
- [`assets/dictionary/README.md`](../assets/dictionary/README.md) asset/patch
- [`assets/dictionary/dictionary_en_vi.db`](../assets/dictionary/dictionary_en_vi.db) asset/patch

### assets (1 tệp)

- [`assets/icon.svg`](../assets/icon.svg) asset/patch

### assets/icons (2 tệp)

- [`assets/icons/icon.icns`](../assets/icons/icon.icns) asset/patch
- [`assets/icons/icon.ico`](../assets/icons/icon.ico) asset/patch

<a id="dir-packages-epub-parser"></a>

### packages/epub-parser (4 tệp)

Package parser EPUB dùng trong app.

- [`packages/epub-parser/package.json`](../packages/epub-parser/package.json)
- [`packages/epub-parser/tsconfig.json`](../packages/epub-parser/tsconfig.json)
- [`packages/epub-parser/tsup.config.ts`](../packages/epub-parser/tsup.config.ts)
- [`packages/epub-parser/vitest.config.ts`](../packages/epub-parser/vitest.config.ts)

### packages/epub-parser/src (9 tệp)

- [`packages/epub-parser/src/content.test.ts`](../packages/epub-parser/src/content.test.ts) test
- [`packages/epub-parser/src/content.ts`](../packages/epub-parser/src/content.ts)
- [`packages/epub-parser/src/dist-browser-safe.test.ts`](../packages/epub-parser/src/dist-browser-safe.test.ts) test
- [`packages/epub-parser/src/fixture.test.ts`](../packages/epub-parser/src/fixture.test.ts) test
- [`packages/epub-parser/src/fixture.ts`](../packages/epub-parser/src/fixture.ts)
- [`packages/epub-parser/src/index.ts`](../packages/epub-parser/src/index.ts)
- [`packages/epub-parser/src/parse.test.ts`](../packages/epub-parser/src/parse.test.ts) test
- [`packages/epub-parser/src/parse.ts`](../packages/epub-parser/src/parse.ts)
- [`packages/epub-parser/src/types.ts`](../packages/epub-parser/src/types.ts)

<a id="dir-packages-pdf-parser"></a>

### packages/pdf-parser (2 tệp)

Package parser PDF dùng trong main.

- [`packages/pdf-parser/package.json`](../packages/pdf-parser/package.json)
- [`packages/pdf-parser/tsconfig.json`](../packages/pdf-parser/tsconfig.json)

### packages/pdf-parser/src (10 tệp)

- [`packages/pdf-parser/src/content.test.ts`](../packages/pdf-parser/src/content.test.ts) test
- [`packages/pdf-parser/src/content.ts`](../packages/pdf-parser/src/content.ts)
- [`packages/pdf-parser/src/fixture.test.ts`](../packages/pdf-parser/src/fixture.test.ts) test
- [`packages/pdf-parser/src/fixture.ts`](../packages/pdf-parser/src/fixture.ts)
- [`packages/pdf-parser/src/index.ts`](../packages/pdf-parser/src/index.ts)
- [`packages/pdf-parser/src/parse.test.ts`](../packages/pdf-parser/src/parse.test.ts) test
- [`packages/pdf-parser/src/parse.ts`](../packages/pdf-parser/src/parse.ts)
- [`packages/pdf-parser/src/render.test.ts`](../packages/pdf-parser/src/render.test.ts) test
- [`packages/pdf-parser/src/render.ts`](../packages/pdf-parser/src/render.ts)
- [`packages/pdf-parser/src/types.ts`](../packages/pdf-parser/src/types.ts)

<a id="dir-packages-ui-prototype"></a>

### packages/ui-prototype (6 tệp)

Prototype UI độc lập, nằm ngoài pnpm workspace chính.

- [`packages/ui-prototype/README.md`](../packages/ui-prototype/README.md) prototype
- [`packages/ui-prototype/components.json`](../packages/ui-prototype/components.json) prototype
- [`packages/ui-prototype/package.json`](../packages/ui-prototype/package.json) prototype
- [`packages/ui-prototype/pnpm-lock.yaml`](../packages/ui-prototype/pnpm-lock.yaml) prototype
- [`packages/ui-prototype/tsconfig.json`](../packages/ui-prototype/tsconfig.json) prototype
- [`packages/ui-prototype/vite.config.ts`](../packages/ui-prototype/vite.config.ts) prototype

### packages/ui-prototype/public (5 tệp)

- [`packages/ui-prototype/public/favicon.ico`](../packages/ui-prototype/public/favicon.ico) prototype
- [`packages/ui-prototype/public/logo192.png`](../packages/ui-prototype/public/logo192.png) prototype
- [`packages/ui-prototype/public/logo512.png`](../packages/ui-prototype/public/logo512.png) prototype
- [`packages/ui-prototype/public/manifest.json`](../packages/ui-prototype/public/manifest.json) prototype
- [`packages/ui-prototype/public/robots.txt`](../packages/ui-prototype/public/robots.txt) prototype

### packages/ui-prototype/src/components (6 tệp)

- [`packages/ui-prototype/src/components/AppShell.tsx`](../packages/ui-prototype/src/components/AppShell.tsx) prototype
- [`packages/ui-prototype/src/components/LanguageSwitcher.tsx`](../packages/ui-prototype/src/components/LanguageSwitcher.tsx) prototype
- [`packages/ui-prototype/src/components/ScrollArea.tsx`](../packages/ui-prototype/src/components/ScrollArea.tsx) prototype
- [`packages/ui-prototype/src/components/SettingsPopover.tsx`](../packages/ui-prototype/src/components/SettingsPopover.tsx) prototype
- [`packages/ui-prototype/src/components/ThemeToggle.tsx`](../packages/ui-prototype/src/components/ThemeToggle.tsx) prototype
- [`packages/ui-prototype/src/components/use-popover.ts`](../packages/ui-prototype/src/components/use-popover.ts) prototype

### packages/ui-prototype/src/components/ai-panel (4 tệp)

- [`packages/ui-prototype/src/components/ai-panel/AIPanel.tsx`](../packages/ui-prototype/src/components/ai-panel/AIPanel.tsx) prototype
- [`packages/ui-prototype/src/components/ai-panel/ChipBar.tsx`](../packages/ui-prototype/src/components/ai-panel/ChipBar.tsx) prototype
- [`packages/ui-prototype/src/components/ai-panel/Composer.tsx`](../packages/ui-prototype/src/components/ai-panel/Composer.tsx) prototype
- [`packages/ui-prototype/src/components/ai-panel/MessageList.tsx`](../packages/ui-prototype/src/components/ai-panel/MessageList.tsx) prototype

### packages/ui-prototype/src/components/reader (4 tệp)

- [`packages/ui-prototype/src/components/reader/HighlightPopover.tsx`](../packages/ui-prototype/src/components/reader/HighlightPopover.tsx) prototype
- [`packages/ui-prototype/src/components/reader/ReaderPane.tsx`](../packages/ui-prototype/src/components/reader/ReaderPane.tsx) prototype
- [`packages/ui-prototype/src/components/reader/SelectionToolbar.tsx`](../packages/ui-prototype/src/components/reader/SelectionToolbar.tsx) prototype
- [`packages/ui-prototype/src/components/reader/useSelection.ts`](../packages/ui-prototype/src/components/reader/useSelection.ts) prototype

### packages/ui-prototype/src/components/sidebar (1 tệp)

- [`packages/ui-prototype/src/components/sidebar/Sidebar.tsx`](../packages/ui-prototype/src/components/sidebar/Sidebar.tsx) prototype

### packages/ui-prototype/src/components/ui (1 tệp)

- [`packages/ui-prototype/src/components/ui/button.tsx`](../packages/ui-prototype/src/components/ui/button.tsx) prototype

### packages/ui-prototype/src (6 tệp)

- [`packages/ui-prototype/src/highlight.ts`](../packages/ui-prototype/src/highlight.ts) prototype
- [`packages/ui-prototype/src/i18n.ts`](../packages/ui-prototype/src/i18n.ts) prototype
- [`packages/ui-prototype/src/reader-ai-context.tsx`](../packages/ui-prototype/src/reader-ai-context.tsx) prototype
- [`packages/ui-prototype/src/router.tsx`](../packages/ui-prototype/src/router.tsx) prototype
- [`packages/ui-prototype/src/styles.css`](../packages/ui-prototype/src/styles.css) prototype
- [`packages/ui-prototype/src/summary.ts`](../packages/ui-prototype/src/summary.ts) prototype

### packages/ui-prototype/src/lib (1 tệp)

- [`packages/ui-prototype/src/lib/utils.ts`](../packages/ui-prototype/src/lib/utils.ts) prototype

### packages/ui-prototype/src/locales (3 tệp)

- [`packages/ui-prototype/src/locales/de.ts`](../packages/ui-prototype/src/locales/de.ts) prototype
- [`packages/ui-prototype/src/locales/en.ts`](../packages/ui-prototype/src/locales/en.ts) prototype
- [`packages/ui-prototype/src/locales/zh.ts`](../packages/ui-prototype/src/locales/zh.ts) prototype

### packages/ui-prototype/src/mock (3 tệp)

- [`packages/ui-prototype/src/mock/fixtures.ts`](../packages/ui-prototype/src/mock/fixtures.ts) prototype
- [`packages/ui-prototype/src/mock/types.ts`](../packages/ui-prototype/src/mock/types.ts) prototype
- [`packages/ui-prototype/src/mock/useMockChat.ts`](../packages/ui-prototype/src/mock/useMockChat.ts) prototype

### packages/ui-prototype/src/routes (3 tệp)

- [`packages/ui-prototype/src/routes/__root.tsx`](../packages/ui-prototype/src/routes/__root.tsx) prototype
- [`packages/ui-prototype/src/routes/index.tsx`](../packages/ui-prototype/src/routes/index.tsx) prototype
- [`packages/ui-prototype/src/routes/vdocs-lab.tsx`](../packages/ui-prototype/src/routes/vdocs-lab.tsx) prototype

<a id="dir-packages-virtual-docs"></a>

### packages/virtual-docs (3 tệp)

Khung section và tài liệu phía renderer.

- [`packages/virtual-docs/package.json`](../packages/virtual-docs/package.json)
- [`packages/virtual-docs/tsconfig.json`](../packages/virtual-docs/tsconfig.json)
- [`packages/virtual-docs/vitest.config.ts`](../packages/virtual-docs/vitest.config.ts)

### packages/virtual-docs/src (12 tệp)

- [`packages/virtual-docs/src/SectionFrame.tsx`](../packages/virtual-docs/src/SectionFrame.tsx)
- [`packages/virtual-docs/src/VirtualDocs.tsx`](../packages/virtual-docs/src/VirtualDocs.tsx)
- [`packages/virtual-docs/src/geometry.test.ts`](../packages/virtual-docs/src/geometry.test.ts) test
- [`packages/virtual-docs/src/geometry.ts`](../packages/virtual-docs/src/geometry.ts)
- [`packages/virtual-docs/src/index.ts`](../packages/virtual-docs/src/index.ts)
- [`packages/virtual-docs/src/link-target.test.ts`](../packages/virtual-docs/src/link-target.test.ts) test
- [`packages/virtual-docs/src/link-target.ts`](../packages/virtual-docs/src/link-target.ts)
- [`packages/virtual-docs/src/precision.test.ts`](../packages/virtual-docs/src/precision.test.ts) test
- [`packages/virtual-docs/src/precision.ts`](../packages/virtual-docs/src/precision.ts)
- [`packages/virtual-docs/src/use-machine.ts`](../packages/virtual-docs/src/use-machine.ts)
- [`packages/virtual-docs/src/viewport-machine.test.ts`](../packages/virtual-docs/src/viewport-machine.test.ts) test
- [`packages/virtual-docs/src/viewport-machine.ts`](../packages/virtual-docs/src/viewport-machine.ts)

### patches (1 tệp)

- [`patches/pdfjs-dist.patch`](../patches/pdfjs-dist.patch) asset/patch

<a id="dir-scripts"></a>

### scripts (8 tệp)

Kịch bản E2E, kiểm thử, tạo icon và tiện ích phát triển.

- [`scripts/e2e-packaged-pdf.mjs`](../scripts/e2e-packaged-pdf.mjs) script
- [`scripts/make-icons.sh`](../scripts/make-icons.sh) script
- [`scripts/make-windows-icon.mjs`](../scripts/make-windows-icon.mjs) script
- [`scripts/perf-snapshot.mjs`](../scripts/perf-snapshot.mjs) script
- [`scripts/release-notes.mjs`](../scripts/release-notes.mjs) script
- [`scripts/run-vitest-electron.mjs`](../scripts/run-vitest-electron.mjs) script
- [`scripts/seed-long-conversation.mjs`](../scripts/seed-long-conversation.mjs) script
- [`scripts/smoke-eval.mjs`](../scripts/smoke-eval.mjs) script

### src (7 tệp)

- [`src/env.d.ts`](../src/env.d.ts)
- [`src/index.css`](../src/index.css)
- [`src/main.ts`](../src/main.ts)
- [`src/preload-api.test.ts`](../src/preload-api.test.ts) test
- [`src/preload-api.ts`](../src/preload-api.ts)
- [`src/preload.ts`](../src/preload.ts)
- [`src/renderer.tsx`](../src/renderer.tsx)

<a id="dir-src-main-ai"></a>

### src/main/ai (43 tệp)

Tạo prompt, tìm ngữ cảnh và stream trả lời AI. Thư mục search chứa backend tìm kiếm mạng.

- [`src/main/ai/agent-avatar.test.ts`](../src/main/ai/agent-avatar.test.ts) test
- [`src/main/ai/agent-avatar.ts`](../src/main/ai/agent-avatar.ts)
- [`src/main/ai/agent-context.test.ts`](../src/main/ai/agent-context.test.ts) test
- [`src/main/ai/agent-context.ts`](../src/main/ai/agent-context.ts)
- [`src/main/ai/assistant-model.test.ts`](../src/main/ai/assistant-model.test.ts) test
- [`src/main/ai/assistant-model.ts`](../src/main/ai/assistant-model.ts)
- [`src/main/ai/background-limiter.test.ts`](../src/main/ai/background-limiter.test.ts) test
- [`src/main/ai/background-limiter.ts`](../src/main/ai/background-limiter.ts)
- [`src/main/ai/base-prompt.test.ts`](../src/main/ai/base-prompt.test.ts) test
- [`src/main/ai/base-prompt.ts`](../src/main/ai/base-prompt.ts)
- [`src/main/ai/chips.test.ts`](../src/main/ai/chips.test.ts) test
- [`src/main/ai/chips.ts`](../src/main/ai/chips.ts)
- [`src/main/ai/consent.ts`](../src/main/ai/consent.ts)
- [`src/main/ai/context-compaction.test.ts`](../src/main/ai/context-compaction.test.ts) test
- [`src/main/ai/context-compaction.ts`](../src/main/ai/context-compaction.ts)
- [`src/main/ai/context-tools.test.ts`](../src/main/ai/context-tools.test.ts) test
- [`src/main/ai/context-tools.ts`](../src/main/ai/context-tools.ts)
- [`src/main/ai/library-tools.test.ts`](../src/main/ai/library-tools.test.ts) test
- [`src/main/ai/library-tools.ts`](../src/main/ai/library-tools.ts)
- [`src/main/ai/memory-consolidation.test.ts`](../src/main/ai/memory-consolidation.test.ts) test
- [`src/main/ai/memory-consolidation.ts`](../src/main/ai/memory-consolidation.ts)
- [`src/main/ai/memory-tools.test.ts`](../src/main/ai/memory-tools.test.ts) test
- [`src/main/ai/memory-tools.ts`](../src/main/ai/memory-tools.ts)
- [`src/main/ai/model-factory.test.ts`](../src/main/ai/model-factory.test.ts) test
- [`src/main/ai/model-factory.ts`](../src/main/ai/model-factory.ts)
- [`src/main/ai/pdf-retrieval.test.ts`](../src/main/ai/pdf-retrieval.test.ts) test
- [`src/main/ai/pdf-retrieval.ts`](../src/main/ai/pdf-retrieval.ts)
- [`src/main/ai/prompt-caching.test.ts`](../src/main/ai/prompt-caching.test.ts) test
- [`src/main/ai/prompt-caching.ts`](../src/main/ai/prompt-caching.ts)
- [`src/main/ai/prompt.test.ts`](../src/main/ai/prompt.test.ts) test
- [`src/main/ai/prompt.ts`](../src/main/ai/prompt.ts)
- [`src/main/ai/reading-session-tools.test.ts`](../src/main/ai/reading-session-tools.test.ts) test
- [`src/main/ai/reading-session-tools.ts`](../src/main/ai/reading-session-tools.ts)
- [`src/main/ai/send-deps.test.ts`](../src/main/ai/send-deps.test.ts) test
- [`src/main/ai/send-deps.ts`](../src/main/ai/send-deps.ts)
- [`src/main/ai/send.test.ts`](../src/main/ai/send.test.ts) test
- [`src/main/ai/send.ts`](../src/main/ai/send.ts)
- [`src/main/ai/stream-assistant.ts`](../src/main/ai/stream-assistant.ts)
- [`src/main/ai/structured-output.ts`](../src/main/ai/structured-output.ts)
- [`src/main/ai/summary.test.ts`](../src/main/ai/summary.test.ts) test
- [`src/main/ai/summary.ts`](../src/main/ai/summary.ts)
- [`src/main/ai/tools.test.ts`](../src/main/ai/tools.test.ts) test
- [`src/main/ai/tools.ts`](../src/main/ai/tools.ts)

### src/main/ai/search (7 tệp)

- [`src/main/ai/search/mcp-backend.test.ts`](../src/main/ai/search/mcp-backend.test.ts) test
- [`src/main/ai/search/mcp-backend.ts`](../src/main/ai/search/mcp-backend.ts)
- [`src/main/ai/search/search-service.test.ts`](../src/main/ai/search/search-service.test.ts) test
- [`src/main/ai/search/search-service.ts`](../src/main/ai/search/search-service.ts)
- [`src/main/ai/search/types.ts`](../src/main/ai/search/types.ts)
- [`src/main/ai/search/web-search-tool.test.ts`](../src/main/ai/search/web-search-tool.test.ts) test
- [`src/main/ai/search/web-search-tool.ts`](../src/main/ai/search/web-search-tool.ts)

### src/main (5 tệp)

- [`src/main/app-info.test.ts`](../src/main/app-info.test.ts) test
- [`src/main/app-info.ts`](../src/main/app-info.ts)
- [`src/main/i18n.test.ts`](../src/main/i18n.test.ts) test
- [`src/main/i18n.ts`](../src/main/i18n.ts)
- [`src/main/notify.ts`](../src/main/notify.ts)

### src/main/app-meta (2 tệp)

- [`src/main/app-meta/repository.test.ts`](../src/main/app-meta/repository.test.ts) test
- [`src/main/app-meta/repository.ts`](../src/main/app-meta/repository.ts)

<a id="dir-src-main-app"></a>

### src/main/app (16 tệp)

Dịch vụ môi trường, đường dẫn, nền ứng dụng, URL, renderer server và liên kết PDF của Windows.

- [`src/main/app/app-service.test.ts`](../src/main/app/app-service.test.ts) test
- [`src/main/app/app-service.ts`](../src/main/app/app-service.ts)
- [`src/main/app/application-background.test.ts`](../src/main/app/application-background.test.ts) test
- [`src/main/app/application-background.ts`](../src/main/app/application-background.ts)
- [`src/main/app/external-url.test.ts`](../src/main/app/external-url.test.ts) test
- [`src/main/app/external-url.ts`](../src/main/app/external-url.ts)
- [`src/main/app/index.ts`](../src/main/app/index.ts)
- [`src/main/app/protocol-schemes.ts`](../src/main/app/protocol-schemes.ts)
- [`src/main/app/renderer-protocol-path.test.ts`](../src/main/app/renderer-protocol-path.test.ts) test
- [`src/main/app/renderer-protocol-path.ts`](../src/main/app/renderer-protocol-path.ts)
- [`src/main/app/renderer-server.test.ts`](../src/main/app/renderer-server.test.ts) test
- [`src/main/app/renderer-server.ts`](../src/main/app/renderer-server.ts)
- [`src/main/app/update-check.test.ts`](../src/main/app/update-check.test.ts) test
- [`src/main/app/update-check.ts`](../src/main/app/update-check.ts)
- [`src/main/app/windows-pdf-association.test.ts`](../src/main/app/windows-pdf-association.test.ts) test
- [`src/main/app/windows-pdf-association.ts`](../src/main/app/windows-pdf-association.ts)

<a id="dir-src-main-backup"></a>

### src/main/backup (12 tệp)

Snapshot, manifest, ZIP và khôi phục dữ liệu.

- [`src/main/backup/archive.test.ts`](../src/main/backup/archive.test.ts) test
- [`src/main/backup/archive.ts`](../src/main/backup/archive.ts)
- [`src/main/backup/backup-service.test.ts`](../src/main/backup/backup-service.test.ts) test
- [`src/main/backup/backup-service.ts`](../src/main/backup/backup-service.ts)
- [`src/main/backup/compat.test.ts`](../src/main/backup/compat.test.ts) test
- [`src/main/backup/compat.ts`](../src/main/backup/compat.ts)
- [`src/main/backup/filename.test.ts`](../src/main/backup/filename.test.ts) test
- [`src/main/backup/filename.ts`](../src/main/backup/filename.ts)
- [`src/main/backup/manifest.test.ts`](../src/main/backup/manifest.test.ts) test
- [`src/main/backup/manifest.ts`](../src/main/backup/manifest.ts)
- [`src/main/backup/restore.test.ts`](../src/main/backup/restore.test.ts) test
- [`src/main/backup/restore.ts`](../src/main/backup/restore.ts)

<a id="dir-src-main-chat"></a>

### src/main/chat (6 tệp)

Hội thoại, tin nhắn và đặt tên cuộc trò chuyện.

- [`src/main/chat/conversation-title.test.ts`](../src/main/chat/conversation-title.test.ts) test
- [`src/main/chat/conversation-title.ts`](../src/main/chat/conversation-title.ts)
- [`src/main/chat/conversations.test.ts`](../src/main/chat/conversations.test.ts) test
- [`src/main/chat/conversations.ts`](../src/main/chat/conversations.ts)
- [`src/main/chat/messages.test.ts`](../src/main/chat/messages.test.ts) test
- [`src/main/chat/messages.ts`](../src/main/chat/messages.ts)

<a id="dir-src-main-db"></a>

### src/main/db (9 tệp)

SQLite, schema Drizzle và đường dẫn migration.

- [`src/main/db/client.test.ts`](../src/main/db/client.test.ts) test
- [`src/main/db/client.ts`](../src/main/db/client.ts)
- [`src/main/db/conversations-memory-through-seq.test.ts`](../src/main/db/conversations-memory-through-seq.test.ts) test
- [`src/main/db/instance.ts`](../src/main/db/instance.ts)
- [`src/main/db/migrate-assistants-data-carry.test.ts`](../src/main/db/migrate-assistants-data-carry.test.ts) test
- [`src/main/db/migrate-reading-sessions.test.ts`](../src/main/db/migrate-reading-sessions.test.ts) test
- [`src/main/db/migrations-path.test.ts`](../src/main/db/migrations-path.test.ts) test
- [`src/main/db/migrations-path.ts`](../src/main/db/migrations-path.ts)
- [`src/main/db/schema.ts`](../src/main/db/schema.ts)

### src/main/db/migrations (66 tệp)

- [`src/main/db/migrations/20260531070945_elite_viper/migration.sql`](../src/main/db/migrations/20260531070945_elite_viper/migration.sql) migration
- [`src/main/db/migrations/20260531070945_elite_viper/snapshot.json`](../src/main/db/migrations/20260531070945_elite_viper/snapshot.json) migration
- [`src/main/db/migrations/20260602135810_damp_maestro/migration.sql`](../src/main/db/migrations/20260602135810_damp_maestro/migration.sql) migration
- [`src/main/db/migrations/20260602135810_damp_maestro/snapshot.json`](../src/main/db/migrations/20260602135810_damp_maestro/snapshot.json) migration
- [`src/main/db/migrations/20260602172018_curly_sue_storm/migration.sql`](../src/main/db/migrations/20260602172018_curly_sue_storm/migration.sql) migration
- [`src/main/db/migrations/20260602172018_curly_sue_storm/snapshot.json`](../src/main/db/migrations/20260602172018_curly_sue_storm/snapshot.json) migration
- [`src/main/db/migrations/20260602185035_wakeful_thunderbird/migration.sql`](../src/main/db/migrations/20260602185035_wakeful_thunderbird/migration.sql) migration
- [`src/main/db/migrations/20260602185035_wakeful_thunderbird/snapshot.json`](../src/main/db/migrations/20260602185035_wakeful_thunderbird/snapshot.json) migration
- [`src/main/db/migrations/20260603011333_nebulous_ezekiel/migration.sql`](../src/main/db/migrations/20260603011333_nebulous_ezekiel/migration.sql) migration
- [`src/main/db/migrations/20260603011333_nebulous_ezekiel/snapshot.json`](../src/main/db/migrations/20260603011333_nebulous_ezekiel/snapshot.json) migration
- [`src/main/db/migrations/20260603043311_mature_speed_demon/migration.sql`](../src/main/db/migrations/20260603043311_mature_speed_demon/migration.sql) migration
- [`src/main/db/migrations/20260603043311_mature_speed_demon/snapshot.json`](../src/main/db/migrations/20260603043311_mature_speed_demon/snapshot.json) migration
- [`src/main/db/migrations/20260603061536_sleepy_mentor/migration.sql`](../src/main/db/migrations/20260603061536_sleepy_mentor/migration.sql) migration
- [`src/main/db/migrations/20260603061536_sleepy_mentor/snapshot.json`](../src/main/db/migrations/20260603061536_sleepy_mentor/snapshot.json) migration
- [`src/main/db/migrations/20260603064546_silky_puff_adder/migration.sql`](../src/main/db/migrations/20260603064546_silky_puff_adder/migration.sql) migration
- [`src/main/db/migrations/20260603064546_silky_puff_adder/snapshot.json`](../src/main/db/migrations/20260603064546_silky_puff_adder/snapshot.json) migration
- [`src/main/db/migrations/20260603112655_clever_terrax/migration.sql`](../src/main/db/migrations/20260603112655_clever_terrax/migration.sql) migration
- [`src/main/db/migrations/20260603112655_clever_terrax/snapshot.json`](../src/main/db/migrations/20260603112655_clever_terrax/snapshot.json) migration
- [`src/main/db/migrations/20260603120839_flimsy_black_cat/migration.sql`](../src/main/db/migrations/20260603120839_flimsy_black_cat/migration.sql) migration
- [`src/main/db/migrations/20260603120839_flimsy_black_cat/snapshot.json`](../src/main/db/migrations/20260603120839_flimsy_black_cat/snapshot.json) migration
- [`src/main/db/migrations/20260603123622_mute_the_professor/migration.sql`](../src/main/db/migrations/20260603123622_mute_the_professor/migration.sql) migration
- [`src/main/db/migrations/20260603123622_mute_the_professor/snapshot.json`](../src/main/db/migrations/20260603123622_mute_the_professor/snapshot.json) migration
- [`src/main/db/migrations/20260603124833_thankful_flatman/migration.sql`](../src/main/db/migrations/20260603124833_thankful_flatman/migration.sql) migration
- [`src/main/db/migrations/20260603124833_thankful_flatman/snapshot.json`](../src/main/db/migrations/20260603124833_thankful_flatman/snapshot.json) migration
- [`src/main/db/migrations/20260604000000_plaintext_api_key/migration.sql`](../src/main/db/migrations/20260604000000_plaintext_api_key/migration.sql) migration
- [`src/main/db/migrations/20260604000000_plaintext_api_key/snapshot.json`](../src/main/db/migrations/20260604000000_plaintext_api_key/snapshot.json) migration
- [`src/main/db/migrations/20260605055325_pretty_ultimates/migration.sql`](../src/main/db/migrations/20260605055325_pretty_ultimates/migration.sql) migration
- [`src/main/db/migrations/20260605055325_pretty_ultimates/snapshot.json`](../src/main/db/migrations/20260605055325_pretty_ultimates/snapshot.json) migration
- [`src/main/db/migrations/20260606145055_stiff_spitfire/migration.sql`](../src/main/db/migrations/20260606145055_stiff_spitfire/migration.sql) migration
- [`src/main/db/migrations/20260606145055_stiff_spitfire/snapshot.json`](../src/main/db/migrations/20260606145055_stiff_spitfire/snapshot.json) migration
- [`src/main/db/migrations/20260607123304_mature_blonde_phantom/migration.sql`](../src/main/db/migrations/20260607123304_mature_blonde_phantom/migration.sql) migration
- [`src/main/db/migrations/20260607123304_mature_blonde_phantom/snapshot.json`](../src/main/db/migrations/20260607123304_mature_blonde_phantom/snapshot.json) migration
- [`src/main/db/migrations/20260608070815_wide_surge/migration.sql`](../src/main/db/migrations/20260608070815_wide_surge/migration.sql) migration
- [`src/main/db/migrations/20260608070815_wide_surge/snapshot.json`](../src/main/db/migrations/20260608070815_wide_surge/snapshot.json) migration
- [`src/main/db/migrations/20260608155900_clear_dreadnoughts/migration.sql`](../src/main/db/migrations/20260608155900_clear_dreadnoughts/migration.sql) migration
- [`src/main/db/migrations/20260608155900_clear_dreadnoughts/snapshot.json`](../src/main/db/migrations/20260608155900_clear_dreadnoughts/snapshot.json) migration
- [`src/main/db/migrations/20260608172021_slippery_gorilla_man/migration.sql`](../src/main/db/migrations/20260608172021_slippery_gorilla_man/migration.sql) migration
- [`src/main/db/migrations/20260608172021_slippery_gorilla_man/snapshot.json`](../src/main/db/migrations/20260608172021_slippery_gorilla_man/snapshot.json) migration
- [`src/main/db/migrations/20260609051433_grey_gertrude_yorkes/migration.sql`](../src/main/db/migrations/20260609051433_grey_gertrude_yorkes/migration.sql) migration
- [`src/main/db/migrations/20260609051433_grey_gertrude_yorkes/snapshot.json`](../src/main/db/migrations/20260609051433_grey_gertrude_yorkes/snapshot.json) migration
- [`src/main/db/migrations/20260610023642_empty_blink/migration.sql`](../src/main/db/migrations/20260610023642_empty_blink/migration.sql) migration
- [`src/main/db/migrations/20260610023642_empty_blink/snapshot.json`](../src/main/db/migrations/20260610023642_empty_blink/snapshot.json) migration
- [`src/main/db/migrations/20260610110032_lazy_praxagora/migration.sql`](../src/main/db/migrations/20260610110032_lazy_praxagora/migration.sql) migration
- [`src/main/db/migrations/20260610110032_lazy_praxagora/snapshot.json`](../src/main/db/migrations/20260610110032_lazy_praxagora/snapshot.json) migration
- [`src/main/db/migrations/20260610121829_known_ken_ellis/migration.sql`](../src/main/db/migrations/20260610121829_known_ken_ellis/migration.sql) migration
- [`src/main/db/migrations/20260610121829_known_ken_ellis/snapshot.json`](../src/main/db/migrations/20260610121829_known_ken_ellis/snapshot.json) migration
- [`src/main/db/migrations/20260611151719_steep_mattie_franklin/migration.sql`](../src/main/db/migrations/20260611151719_steep_mattie_franklin/migration.sql) migration
- [`src/main/db/migrations/20260611151719_steep_mattie_franklin/snapshot.json`](../src/main/db/migrations/20260611151719_steep_mattie_franklin/snapshot.json) migration
- [`src/main/db/migrations/20260615041601_dazzling_sabra/migration.sql`](../src/main/db/migrations/20260615041601_dazzling_sabra/migration.sql) migration
- [`src/main/db/migrations/20260615041601_dazzling_sabra/snapshot.json`](../src/main/db/migrations/20260615041601_dazzling_sabra/snapshot.json) migration
- [`src/main/db/migrations/20260615221822_slow_silk_fever/migration.sql`](../src/main/db/migrations/20260615221822_slow_silk_fever/migration.sql) migration
- [`src/main/db/migrations/20260615221822_slow_silk_fever/snapshot.json`](../src/main/db/migrations/20260615221822_slow_silk_fever/snapshot.json) migration
- [`src/main/db/migrations/20260616000326_little_namor/migration.sql`](../src/main/db/migrations/20260616000326_little_namor/migration.sql) migration
- [`src/main/db/migrations/20260616000326_little_namor/snapshot.json`](../src/main/db/migrations/20260616000326_little_namor/snapshot.json) migration
- [`src/main/db/migrations/20260616082526_luxuriant_centennial/migration.sql`](../src/main/db/migrations/20260616082526_luxuriant_centennial/migration.sql) migration
- [`src/main/db/migrations/20260616082526_luxuriant_centennial/snapshot.json`](../src/main/db/migrations/20260616082526_luxuriant_centennial/snapshot.json) migration
- [`src/main/db/migrations/20260714063947_reading_sessions/migration.sql`](../src/main/db/migrations/20260714063947_reading_sessions/migration.sql) migration
- [`src/main/db/migrations/20260714063947_reading_sessions/snapshot.json`](../src/main/db/migrations/20260714063947_reading_sessions/snapshot.json) migration
- [`src/main/db/migrations/20260714072347_derive_reading_state/migration.sql`](../src/main/db/migrations/20260714072347_derive_reading_state/migration.sql) migration
- [`src/main/db/migrations/20260714072347_derive_reading_state/snapshot.json`](../src/main/db/migrations/20260714072347_derive_reading_state/snapshot.json) migration
- [`src/main/db/migrations/20260924084756_robust_joseph/migration.sql`](../src/main/db/migrations/20260924084756_robust_joseph/migration.sql) migration
- [`src/main/db/migrations/20260924084756_robust_joseph/snapshot.json`](../src/main/db/migrations/20260924084756_robust_joseph/snapshot.json) migration
- [`src/main/db/migrations/20260924155237_complex_black_panther/migration.sql`](../src/main/db/migrations/20260924155237_complex_black_panther/migration.sql) migration
- [`src/main/db/migrations/20260924155237_complex_black_panther/snapshot.json`](../src/main/db/migrations/20260924155237_complex_black_panther/snapshot.json) migration
- [`src/main/db/migrations/20260925070227_famous_hammerhead/migration.sql`](../src/main/db/migrations/20260925070227_famous_hammerhead/migration.sql) migration
- [`src/main/db/migrations/20260925070227_famous_hammerhead/snapshot.json`](../src/main/db/migrations/20260925070227_famous_hammerhead/snapshot.json) migration

<a id="dir-src-main-ipc"></a>

### src/main/ipc (21 tệp)

Ánh xạ hợp đồng shared vào hàm nghiệp vụ của main.

- [`src/main/ipc/agent-handlers.ts`](../src/main/ipc/agent-handlers.ts)
- [`src/main/ipc/ai-handlers.test.ts`](../src/main/ipc/ai-handlers.test.ts) test
- [`src/main/ipc/ai-handlers.ts`](../src/main/ipc/ai-handlers.ts)
- [`src/main/ipc/annotations-handlers.ts`](../src/main/ipc/annotations-handlers.ts)
- [`src/main/ipc/app-handlers.ts`](../src/main/ipc/app-handlers.ts)
- [`src/main/ipc/backup-handlers.ts`](../src/main/ipc/backup-handlers.ts)
- [`src/main/ipc/bindings-coverage.test.ts`](../src/main/ipc/bindings-coverage.test.ts) test
- [`src/main/ipc/book-notes-handlers.ts`](../src/main/ipc/book-notes-handlers.ts)
- [`src/main/ipc/chat-handlers.ts`](../src/main/ipc/chat-handlers.ts)
- [`src/main/ipc/library-handlers.ts`](../src/main/ipc/library-handlers.ts)
- [`src/main/ipc/log-handlers.ts`](../src/main/ipc/log-handlers.ts)
- [`src/main/ipc/memory-handlers.ts`](../src/main/ipc/memory-handlers.ts)
- [`src/main/ipc/preferences-handlers.ts`](../src/main/ipc/preferences-handlers.ts)
- [`src/main/ipc/reading-sessions-handlers.test.ts`](../src/main/ipc/reading-sessions-handlers.test.ts) test
- [`src/main/ipc/reading-sessions-handlers.ts`](../src/main/ipc/reading-sessions-handlers.ts)
- [`src/main/ipc/registry.ts`](../src/main/ipc/registry.ts)
- [`src/main/ipc/settings-handlers.ts`](../src/main/ipc/settings-handlers.ts)
- [`src/main/ipc/stats-handlers.ts`](../src/main/ipc/stats-handlers.ts)
- [`src/main/ipc/validate.test.ts`](../src/main/ipc/validate.test.ts) test
- [`src/main/ipc/validate.ts`](../src/main/ipc/validate.ts)
- [`src/main/ipc/vocabulary-handlers.ts`](../src/main/ipc/vocabulary-handlers.ts)

<a id="dir-src-main-library"></a>

### src/main/library (23 tệp)

Import, metadata, file sách, nội dung, tiến độ, annotation, note và bookmark.

- [`src/main/library/annotations.test.ts`](../src/main/library/annotations.test.ts) test
- [`src/main/library/annotations.ts`](../src/main/library/annotations.ts)
- [`src/main/library/book-files.test.ts`](../src/main/library/book-files.test.ts) test
- [`src/main/library/book-files.ts`](../src/main/library/book-files.ts)
- [`src/main/library/book-notes.test.ts`](../src/main/library/book-notes.test.ts) test
- [`src/main/library/book-notes.ts`](../src/main/library/book-notes.ts)
- [`src/main/library/clear-book-category.test.ts`](../src/main/library/clear-book-category.test.ts) test
- [`src/main/library/clear-book-category.ts`](../src/main/library/clear-book-category.ts)
- [`src/main/library/clear-pdf-data.ts`](../src/main/library/clear-pdf-data.ts)
- [`src/main/library/content.test.ts`](../src/main/library/content.test.ts) test
- [`src/main/library/content.ts`](../src/main/library/content.ts)
- [`src/main/library/cover-bytes.test.ts`](../src/main/library/cover-bytes.test.ts) test
- [`src/main/library/cover-bytes.ts`](../src/main/library/cover-bytes.ts)
- [`src/main/library/cover-protocol.ts`](../src/main/library/cover-protocol.ts)
- [`src/main/library/export-pdf.test.ts`](../src/main/library/export-pdf.test.ts) test
- [`src/main/library/export-pdf.ts`](../src/main/library/export-pdf.ts)
- [`src/main/library/import-source.test.ts`](../src/main/library/import-source.test.ts) test
- [`src/main/library/import-source.ts`](../src/main/library/import-source.ts)
- [`src/main/library/pdf-bookmarks.ts`](../src/main/library/pdf-bookmarks.ts)
- [`src/main/library/progress.test.ts`](../src/main/library/progress.test.ts) test
- [`src/main/library/progress.ts`](../src/main/library/progress.ts)
- [`src/main/library/repository.test.ts`](../src/main/library/repository.test.ts) test
- [`src/main/library/repository.ts`](../src/main/library/repository.ts)

### src/main/logger (5 tệp)

- [`src/main/logger/file-sink.test.ts`](../src/main/logger/file-sink.test.ts) test
- [`src/main/logger/file-sink.ts`](../src/main/logger/file-sink.ts)
- [`src/main/logger/index.ts`](../src/main/logger/index.ts)
- [`src/main/logger/logger-service.test.ts`](../src/main/logger/logger-service.test.ts) test
- [`src/main/logger/logger-service.ts`](../src/main/logger/logger-service.ts)

### src/main/media (3 tệp)

- [`src/main/media/blob-store.test.ts`](../src/main/media/blob-store.test.ts) test
- [`src/main/media/blob-store.ts`](../src/main/media/blob-store.ts)
- [`src/main/media/media-protocol.ts`](../src/main/media/media-protocol.ts)

### src/main/memory (4 tệp)

- [`src/main/memory/links.test.ts`](../src/main/memory/links.test.ts) test
- [`src/main/memory/links.ts`](../src/main/memory/links.ts)
- [`src/main/memory/repository.test.ts`](../src/main/memory/repository.test.ts) test
- [`src/main/memory/repository.ts`](../src/main/memory/repository.ts)

### src/main/onboarding (4 tệp)

- [`src/main/onboarding/sample-book.test.ts`](../src/main/onboarding/sample-book.test.ts) test
- [`src/main/onboarding/sample-book.ts`](../src/main/onboarding/sample-book.ts)
- [`src/main/onboarding/seed-sample.test.ts`](../src/main/onboarding/seed-sample.test.ts) test
- [`src/main/onboarding/seed-sample.ts`](../src/main/onboarding/seed-sample.ts)

### src/main/preferences (2 tệp)

- [`src/main/preferences/repository.test.ts`](../src/main/preferences/repository.test.ts) test
- [`src/main/preferences/repository.ts`](../src/main/preferences/repository.ts)

<a id="dir-src-main-providers"></a>

### src/main/providers (10 tệp)

Nhà cung cấp AI, model và endpoint.

- [`src/main/providers/default-providers.test.ts`](../src/main/providers/default-providers.test.ts) test
- [`src/main/providers/default-providers.ts`](../src/main/providers/default-providers.ts)
- [`src/main/providers/mask.test.ts`](../src/main/providers/mask.test.ts) test
- [`src/main/providers/mask.ts`](../src/main/providers/mask.ts)
- [`src/main/providers/provider-factory.test.ts`](../src/main/providers/provider-factory.test.ts) test
- [`src/main/providers/provider-factory.ts`](../src/main/providers/provider-factory.ts)
- [`src/main/providers/provider-models.test.ts`](../src/main/providers/provider-models.test.ts) test
- [`src/main/providers/provider-models.ts`](../src/main/providers/provider-models.ts)
- [`src/main/providers/repository.test.ts`](../src/main/providers/repository.test.ts) test
- [`src/main/providers/repository.ts`](../src/main/providers/repository.ts)

<a id="dir-src-main-reading-report"></a>

### src/main/reading-report (18 tệp)

Tạo báo cáo phiên đọc và thu thập bằng chứng.

- [`src/main/reading-report/agent.ts`](../src/main/reading-report/agent.ts)
- [`src/main/reading-report/evidence.test.ts`](../src/main/reading-report/evidence.test.ts) test
- [`src/main/reading-report/evidence.ts`](../src/main/reading-report/evidence.ts)
- [`src/main/reading-report/investigation-runner.ts`](../src/main/reading-report/investigation-runner.ts)
- [`src/main/reading-report/investigator.test.ts`](../src/main/reading-report/investigator.test.ts) test
- [`src/main/reading-report/investigator.ts`](../src/main/reading-report/investigator.ts)
- [`src/main/reading-report/memory-workspace.test.ts`](../src/main/reading-report/memory-workspace.test.ts) test
- [`src/main/reading-report/memory-workspace.ts`](../src/main/reading-report/memory-workspace.ts)
- [`src/main/reading-report/progress.test.ts`](../src/main/reading-report/progress.test.ts) test
- [`src/main/reading-report/progress.ts`](../src/main/reading-report/progress.ts)
- [`src/main/reading-report/prompt.test.ts`](../src/main/reading-report/prompt.test.ts) test
- [`src/main/reading-report/prompt.ts`](../src/main/reading-report/prompt.ts)
- [`src/main/reading-report/runtime.test.ts`](../src/main/reading-report/runtime.test.ts) test
- [`src/main/reading-report/runtime.ts`](../src/main/reading-report/runtime.ts)
- [`src/main/reading-report/service.test.ts`](../src/main/reading-report/service.test.ts) test
- [`src/main/reading-report/service.ts`](../src/main/reading-report/service.ts)
- [`src/main/reading-report/tools.test.ts`](../src/main/reading-report/tools.test.ts) test
- [`src/main/reading-report/tools.ts`](../src/main/reading-report/tools.ts)

### src/main/reading-sessions (2 tệp)

- [`src/main/reading-sessions/repository.test.ts`](../src/main/reading-sessions/repository.test.ts) test
- [`src/main/reading-sessions/repository.ts`](../src/main/reading-sessions/repository.ts)

### src/main/secrets (5 tệp)

- [`src/main/secrets/ai-sdk-tester.test.ts`](../src/main/secrets/ai-sdk-tester.test.ts) test
- [`src/main/secrets/ai-sdk-tester.ts`](../src/main/secrets/ai-sdk-tester.ts)
- [`src/main/secrets/api-key-storage.test.ts`](../src/main/secrets/api-key-storage.test.ts) test
- [`src/main/secrets/api-key-storage.ts`](../src/main/secrets/api-key-storage.ts)
- [`src/main/secrets/tester.ts`](../src/main/secrets/tester.ts)

<a id="dir-src-main-stats"></a>

### src/main/stats (12 tệp)

Thời gian đọc, lượt đọc trang và chuỗi ngày.

- [`src/main/stats/aggregate.test.ts`](../src/main/stats/aggregate.test.ts) test
- [`src/main/stats/aggregate.ts`](../src/main/stats/aggregate.ts)
- [`src/main/stats/clock-wiring.ts`](../src/main/stats/clock-wiring.ts)
- [`src/main/stats/clock.test.ts`](../src/main/stats/clock.test.ts) test
- [`src/main/stats/clock.ts`](../src/main/stats/clock.ts)
- [`src/main/stats/day-key.test.ts`](../src/main/stats/day-key.test.ts) test
- [`src/main/stats/day-key.ts`](../src/main/stats/day-key.ts)
- [`src/main/stats/page-streak-repository.test.ts`](../src/main/stats/page-streak-repository.test.ts) test
- [`src/main/stats/page-streak.test.ts`](../src/main/stats/page-streak.test.ts) test
- [`src/main/stats/page-streak.ts`](../src/main/stats/page-streak.ts)
- [`src/main/stats/reading-daily.test.ts`](../src/main/stats/reading-daily.test.ts) test
- [`src/main/stats/reading-daily.ts`](../src/main/stats/reading-daily.ts)

<a id="dir-src-main-vocabulary"></a>

### src/main/vocabulary (6 tệp)

Từ điển offline, thuật ngữ kỹ thuật và từ vựng theo sách.

- [`src/main/vocabulary/dictionary-store.ts`](../src/main/vocabulary/dictionary-store.ts)
- [`src/main/vocabulary/local-dictionary.test.ts`](../src/main/vocabulary/local-dictionary.test.ts) test
- [`src/main/vocabulary/local-dictionary.ts`](../src/main/vocabulary/local-dictionary.ts)
- [`src/main/vocabulary/repository.test.ts`](../src/main/vocabulary/repository.test.ts) test
- [`src/main/vocabulary/repository.ts`](../src/main/vocabulary/repository.ts)
- [`src/main/vocabulary/technical-glossary.ts`](../src/main/vocabulary/technical-glossary.ts)

### src/renderer (6 tệp)

- [`src/renderer/App.tsx`](../src/renderer/App.tsx)
- [`src/renderer/ErrorBoundary.tsx`](../src/renderer/ErrorBoundary.tsx)
- [`src/renderer/fontsource.d.ts`](../src/renderer/fontsource.d.ts)
- [`src/renderer/global.d.ts`](../src/renderer/global.d.ts)
- [`src/renderer/react-runtime-dedupe.test.ts`](../src/renderer/react-runtime-dedupe.test.ts) test
- [`src/renderer/types.ts`](../src/renderer/types.ts)

<a id="dir-src-renderer-ai"></a>

### src/renderer/ai (47 tệp)

Panel chat, composer, lịch sử, context chips và IPC stream.

- [`src/renderer/ai/AIPanel.tsx`](../src/renderer/ai/AIPanel.tsx)
- [`src/renderer/ai/AssistantAvatar.tsx`](../src/renderer/ai/AssistantAvatar.tsx)
- [`src/renderer/ai/AvatarCropDialog.tsx`](../src/renderer/ai/AvatarCropDialog.tsx)
- [`src/renderer/ai/ChatPerfMonitor.tsx`](../src/renderer/ai/ChatPerfMonitor.tsx)
- [`src/renderer/ai/Composer.tsx`](../src/renderer/ai/Composer.tsx)
- [`src/renderer/ai/ContextPillBar.tsx`](../src/renderer/ai/ContextPillBar.tsx)
- [`src/renderer/ai/ConversationsTab.tsx`](../src/renderer/ai/ConversationsTab.tsx)
- [`src/renderer/ai/CopyButton.tsx`](../src/renderer/ai/CopyButton.tsx)
- [`src/renderer/ai/FloatingAssistant.tsx`](../src/renderer/ai/FloatingAssistant.tsx)
- [`src/renderer/ai/MessageEditor.tsx`](../src/renderer/ai/MessageEditor.tsx)
- [`src/renderer/ai/MessageList.tsx`](../src/renderer/ai/MessageList.tsx)
- [`src/renderer/ai/MessageTimestamp.tsx`](../src/renderer/ai/MessageTimestamp.tsx)
- [`src/renderer/ai/MessageToolbar.tsx`](../src/renderer/ai/MessageToolbar.tsx)
- [`src/renderer/ai/ai-action-draft.test.ts`](../src/renderer/ai/ai-action-draft.test.ts) test
- [`src/renderer/ai/ai-action-draft.ts`](../src/renderer/ai/ai-action-draft.ts)
- [`src/renderer/ai/ai-consent.ts`](../src/renderer/ai/ai-consent.ts)
- [`src/renderer/ai/assistant-activity.test.ts`](../src/renderer/ai/assistant-activity.test.ts) test
- [`src/renderer/ai/assistant-activity.ts`](../src/renderer/ai/assistant-activity.ts)
- [`src/renderer/ai/chat-actions.test.ts`](../src/renderer/ai/chat-actions.test.ts) test
- [`src/renderer/ai/chat-actions.ts`](../src/renderer/ai/chat-actions.ts)
- [`src/renderer/ai/chat-context.test.ts`](../src/renderer/ai/chat-context.test.ts) test
- [`src/renderer/ai/chat-context.ts`](../src/renderer/ai/chat-context.ts)
- [`src/renderer/ai/chip-label.ts`](../src/renderer/ai/chip-label.ts)
- [`src/renderer/ai/composer-focus.test.ts`](../src/renderer/ai/composer-focus.test.ts) test
- [`src/renderer/ai/composer-focus.ts`](../src/renderer/ai/composer-focus.ts)
- [`src/renderer/ai/default-avatar.svg`](../src/renderer/ai/default-avatar.svg)
- [`src/renderer/ai/get-cropped-blob.ts`](../src/renderer/ai/get-cropped-blob.ts)
- [`src/renderer/ai/ipc-chat-transport.test.ts`](../src/renderer/ai/ipc-chat-transport.test.ts) test
- [`src/renderer/ai/ipc-chat-transport.ts`](../src/renderer/ai/ipc-chat-transport.ts)
- [`src/renderer/ai/message-history.test.ts`](../src/renderer/ai/message-history.test.ts) test
- [`src/renderer/ai/message-history.ts`](../src/renderer/ai/message-history.ts)
- [`src/renderer/ai/message-text.test.ts`](../src/renderer/ai/message-text.test.ts) test
- [`src/renderer/ai/message-text.ts`](../src/renderer/ai/message-text.ts)
- [`src/renderer/ai/message-time.test.ts`](../src/renderer/ai/message-time.test.ts) test
- [`src/renderer/ai/message-time.ts`](../src/renderer/ai/message-time.ts)
- [`src/renderer/ai/scroll-follow.test.ts`](../src/renderer/ai/scroll-follow.test.ts) test
- [`src/renderer/ai/scroll-follow.ts`](../src/renderer/ai/scroll-follow.ts)
- [`src/renderer/ai/segments.test.ts`](../src/renderer/ai/segments.test.ts) test
- [`src/renderer/ai/segments.ts`](../src/renderer/ai/segments.ts)
- [`src/renderer/ai/selection-context.test.ts`](../src/renderer/ai/selection-context.test.ts) test
- [`src/renderer/ai/selection-context.ts`](../src/renderer/ai/selection-context.ts)
- [`src/renderer/ai/tool-step-label.test.ts`](../src/renderer/ai/tool-step-label.test.ts) test
- [`src/renderer/ai/tool-step-label.ts`](../src/renderer/ai/tool-step-label.ts)
- [`src/renderer/ai/types.ts`](../src/renderer/ai/types.ts)
- [`src/renderer/ai/use-ai-actions.ts`](../src/renderer/ai/use-ai-actions.ts)
- [`src/renderer/ai/use-restore-conversation.test.ts`](../src/renderer/ai/use-restore-conversation.test.ts) test
- [`src/renderer/ai/use-restore-conversation.ts`](../src/renderer/ai/use-restore-conversation.ts)

### src/renderer/book-notes (2 tệp)

- [`src/renderer/book-notes/BookNoteEditor.tsx`](../src/renderer/book-notes/BookNoteEditor.tsx)
- [`src/renderer/book-notes/BookNotesPanel.tsx`](../src/renderer/book-notes/BookNotesPanel.tsx)

### src/renderer/components (5 tệp)

- [`src/renderer/components/LocalizedStreamdown.test.ts`](../src/renderer/components/LocalizedStreamdown.test.ts) test
- [`src/renderer/components/LocalizedStreamdown.tsx`](../src/renderer/components/LocalizedStreamdown.tsx)
- [`src/renderer/components/MarkdownEditor.test.ts`](../src/renderer/components/MarkdownEditor.test.ts) test
- [`src/renderer/components/MarkdownEditor.tsx`](../src/renderer/components/MarkdownEditor.tsx)
- [`src/renderer/components/markdown-math.ts`](../src/renderer/components/markdown-math.ts)

### src/renderer/components/ui (20 tệp)

- [`src/renderer/components/ui/alert-dialog.tsx`](../src/renderer/components/ui/alert-dialog.tsx)
- [`src/renderer/components/ui/button.tsx`](../src/renderer/components/ui/button.tsx)
- [`src/renderer/components/ui/card.tsx`](../src/renderer/components/ui/card.tsx)
- [`src/renderer/components/ui/checkbox.tsx`](../src/renderer/components/ui/checkbox.tsx)
- [`src/renderer/components/ui/context-menu.tsx`](../src/renderer/components/ui/context-menu.tsx)
- [`src/renderer/components/ui/dialog.tsx`](../src/renderer/components/ui/dialog.tsx)
- [`src/renderer/components/ui/dropdown-menu.tsx`](../src/renderer/components/ui/dropdown-menu.tsx)
- [`src/renderer/components/ui/hover-card.tsx`](../src/renderer/components/ui/hover-card.tsx)
- [`src/renderer/components/ui/input.tsx`](../src/renderer/components/ui/input.tsx)
- [`src/renderer/components/ui/kbd.tsx`](../src/renderer/components/ui/kbd.tsx)
- [`src/renderer/components/ui/label.tsx`](../src/renderer/components/ui/label.tsx)
- [`src/renderer/components/ui/popover.tsx`](../src/renderer/components/ui/popover.tsx)
- [`src/renderer/components/ui/scroll-area.tsx`](../src/renderer/components/ui/scroll-area.tsx)
- [`src/renderer/components/ui/select.tsx`](../src/renderer/components/ui/select.tsx)
- [`src/renderer/components/ui/sonner.tsx`](../src/renderer/components/ui/sonner.tsx)
- [`src/renderer/components/ui/tabs.tsx`](../src/renderer/components/ui/tabs.tsx)
- [`src/renderer/components/ui/textarea.tsx`](../src/renderer/components/ui/textarea.tsx)
- [`src/renderer/components/ui/toggle-group.tsx`](../src/renderer/components/ui/toggle-group.tsx)
- [`src/renderer/components/ui/toggle.tsx`](../src/renderer/components/ui/toggle.tsx)
- [`src/renderer/components/ui/tooltip.tsx`](../src/renderer/components/ui/tooltip.tsx)

### src/renderer/i18n (2 tệp)

- [`src/renderer/i18n/LanguageSwitcher.tsx`](../src/renderer/i18n/LanguageSwitcher.tsx)
- [`src/renderer/i18n/index.ts`](../src/renderer/i18n/index.ts)

### src/renderer/lib (9 tệp)

- [`src/renderer/lib/keyboard.test.ts`](../src/renderer/lib/keyboard.test.ts) test
- [`src/renderer/lib/keyboard.ts`](../src/renderer/lib/keyboard.ts)
- [`src/renderer/lib/platform.ts`](../src/renderer/lib/platform.ts)
- [`src/renderer/lib/relative-time.test.ts`](../src/renderer/lib/relative-time.test.ts) test
- [`src/renderer/lib/relative-time.ts`](../src/renderer/lib/relative-time.ts)
- [`src/renderer/lib/use-drag-guard.test.ts`](../src/renderer/lib/use-drag-guard.test.ts) test
- [`src/renderer/lib/use-drag-guard.ts`](../src/renderer/lib/use-drag-guard.ts)
- [`src/renderer/lib/utils.test.ts`](../src/renderer/lib/utils.test.ts) test
- [`src/renderer/lib/utils.ts`](../src/renderer/lib/utils.ts)

### src/renderer/library (14 tệp)

- [`src/renderer/library/BookCover.tsx`](../src/renderer/library/BookCover.tsx)
- [`src/renderer/library/CoverImage.tsx`](../src/renderer/library/CoverImage.tsx)
- [`src/renderer/library/DropOverlay.tsx`](../src/renderer/library/DropOverlay.tsx)
- [`src/renderer/library/LibraryView.tsx`](../src/renderer/library/LibraryView.tsx)
- [`src/renderer/library/OnboardingCard.tsx`](../src/renderer/library/OnboardingCard.tsx)
- [`src/renderer/library/RecentlyReadShelf.tsx`](../src/renderer/library/RecentlyReadShelf.tsx)
- [`src/renderer/library/SortableBook.tsx`](../src/renderer/library/SortableBook.tsx)
- [`src/renderer/library/book-drop.test.ts`](../src/renderer/library/book-drop.test.ts) test
- [`src/renderer/library/book-drop.ts`](../src/renderer/library/book-drop.ts)
- [`src/renderer/library/cover-palette.test.ts`](../src/renderer/library/cover-palette.test.ts) test
- [`src/renderer/library/cover-palette.ts`](../src/renderer/library/cover-palette.ts)
- [`src/renderer/library/onboarding-logic.test.ts`](../src/renderer/library/onboarding-logic.test.ts) test
- [`src/renderer/library/onboarding-logic.ts`](../src/renderer/library/onboarding-logic.ts)
- [`src/renderer/library/use-epub-drop.ts`](../src/renderer/library/use-epub-drop.ts)

### src/renderer/logger (2 tệp)

- [`src/renderer/logger/index.ts`](../src/renderer/logger/index.ts)
- [`src/renderer/logger/logger-service.ts`](../src/renderer/logger/logger-service.ts)

### src/renderer/notifications (2 tệp)

- [`src/renderer/notifications/app-notifications.test.ts`](../src/renderer/notifications/app-notifications.test.ts) test
- [`src/renderer/notifications/app-notifications.ts`](../src/renderer/notifications/app-notifications.ts)

### src/renderer/query (7 tệp)

- [`src/renderer/query/book-note-queries.ts`](../src/renderer/query/book-note-queries.ts)
- [`src/renderer/query/client.test.ts`](../src/renderer/query/client.test.ts) test
- [`src/renderer/query/client.ts`](../src/renderer/query/client.ts)
- [`src/renderer/query/conversation-queries.ts`](../src/renderer/query/conversation-queries.ts)
- [`src/renderer/query/keys.test.ts`](../src/renderer/query/keys.test.ts) test
- [`src/renderer/query/keys.ts`](../src/renderer/query/keys.ts)
- [`src/renderer/query/reading-session-queries.ts`](../src/renderer/query/reading-session-queries.ts)

<a id="dir-src-renderer-reader"></a>

### src/renderer/reader (92 tệp)

Reader EPUB/PDF, search, zoom, vùng chọn, annotation, sidebar và TTS.

- [`src/renderer/reader/AnnotationsList.tsx`](../src/renderer/reader/AnnotationsList.tsx)
- [`src/renderer/reader/BookFileMissingPanel.tsx`](../src/renderer/reader/BookFileMissingPanel.tsx)
- [`src/renderer/reader/ChapterList.tsx`](../src/renderer/reader/ChapterList.tsx)
- [`src/renderer/reader/ClearBookCategoryButton.tsx`](../src/renderer/reader/ClearBookCategoryButton.tsx)
- [`src/renderer/reader/CollapsiblePane.tsx`](../src/renderer/reader/CollapsiblePane.tsx)
- [`src/renderer/reader/EpubReader.tsx`](../src/renderer/reader/EpubReader.tsx)
- [`src/renderer/reader/HighlightStyleBar.tsx`](../src/renderer/reader/HighlightStyleBar.tsx)
- [`src/renderer/reader/header-visibility.test.ts`](../src/renderer/reader/header-visibility.test.ts) test
- [`src/renderer/reader/header-visibility.ts`](../src/renderer/reader/header-visibility.ts)
- [`src/renderer/reader/NoteHoverCard.tsx`](../src/renderer/reader/NoteHoverCard.tsx)
- [`src/renderer/reader/NoteModal.tsx`](../src/renderer/reader/NoteModal.tsx)
- [`src/renderer/reader/PdfBookmarksList.tsx`](../src/renderer/reader/PdfBookmarksList.tsx)
- [`src/renderer/reader/PdfPrefs.tsx`](../src/renderer/reader/PdfPrefs.tsx)
- [`src/renderer/reader/PdfReader.tsx`](../src/renderer/reader/PdfReader.tsx)
- [`src/renderer/reader/PdfSearchPanel.test.tsx`](../src/renderer/reader/PdfSearchPanel.test.tsx) test
- [`src/renderer/reader/PdfSearchPanel.tsx`](../src/renderer/reader/PdfSearchPanel.tsx)
- [`src/renderer/reader/PdfTabsBar.tsx`](../src/renderer/reader/PdfTabsBar.tsx)
- [`src/renderer/reader/PdfThumbnailsPanel.tsx`](../src/renderer/reader/PdfThumbnailsPanel.tsx)
- [`src/renderer/reader/ReaderPanel.tsx`](../src/renderer/reader/ReaderPanel.tsx)
- [`src/renderer/reader/ReaderPrefs.tsx`](../src/renderer/reader/ReaderPrefs.tsx)
- [`src/renderer/reader/ReaderView.tsx`](../src/renderer/reader/ReaderView.tsx)
- [`src/renderer/reader/SelectionToolbar.test.tsx`](../src/renderer/reader/SelectionToolbar.test.tsx) test
- [`src/renderer/reader/SelectionToolbar.tsx`](../src/renderer/reader/SelectionToolbar.tsx)
- [`src/renderer/reader/Sidebar.test.tsx`](../src/renderer/reader/Sidebar.test.tsx) test
- [`src/renderer/reader/Sidebar.tsx`](../src/renderer/reader/Sidebar.tsx)
- [`src/renderer/reader/TtsControlBar.tsx`](../src/renderer/reader/TtsControlBar.tsx)
- [`src/renderer/reader/VocabularyList.test.tsx`](../src/renderer/reader/VocabularyList.test.tsx) test
- [`src/renderer/reader/VocabularyList.tsx`](../src/renderer/reader/VocabularyList.tsx)
- [`src/renderer/reader/annotation-colors.test.ts`](../src/renderer/reader/annotation-colors.test.ts) test
- [`src/renderer/reader/annotation-colors.ts`](../src/renderer/reader/annotation-colors.ts)
- [`src/renderer/reader/apply-annotations.ts`](../src/renderer/reader/apply-annotations.ts)
- [`src/renderer/reader/chapter-id-at-cfi.test.ts`](../src/renderer/reader/chapter-id-at-cfi.test.ts) test
- [`src/renderer/reader/chapter-id-at-cfi.ts`](../src/renderer/reader/chapter-id-at-cfi.ts)
- [`src/renderer/reader/chapter-id-by-href.test.ts`](../src/renderer/reader/chapter-id-by-href.test.ts) test
- [`src/renderer/reader/chapter-id-by-href.ts`](../src/renderer/reader/chapter-id-by-href.ts)
- [`src/renderer/reader/current-anchor-chapter.test.ts`](../src/renderer/reader/current-anchor-chapter.test.ts) test
- [`src/renderer/reader/current-anchor-chapter.ts`](../src/renderer/reader/current-anchor-chapter.ts)
- [`src/renderer/reader/epub-book.test.ts`](../src/renderer/reader/epub-book.test.ts) test
- [`src/renderer/reader/epub-book.ts`](../src/renderer/reader/epub-book.ts)
- [`src/renderer/reader/epub-selection.ts`](../src/renderer/reader/epub-selection.ts)
- [`src/renderer/reader/epub-session.tsx`](../src/renderer/reader/epub-session.tsx)
- [`src/renderer/reader/epub-text-position.test.ts`](../src/renderer/reader/epub-text-position.test.ts) test
- [`src/renderer/reader/epub-text-position.ts`](../src/renderer/reader/epub-text-position.ts)
- [`src/renderer/reader/font-stacks.ts`](../src/renderer/reader/font-stacks.ts)
- [`src/renderer/reader/highlight.test.ts`](../src/renderer/reader/highlight.test.ts) test
- [`src/renderer/reader/highlight.ts`](../src/renderer/reader/highlight.ts)
- [`src/renderer/reader/note-hover-machine.test.ts`](../src/renderer/reader/note-hover-machine.test.ts) test
- [`src/renderer/reader/note-hover-machine.ts`](../src/renderer/reader/note-hover-machine.ts)
- [`src/renderer/reader/pdf-annotation-export.test.ts`](../src/renderer/reader/pdf-annotation-export.test.ts) test
- [`src/renderer/reader/pdf-annotation-export.ts`](../src/renderer/reader/pdf-annotation-export.ts)
- [`src/renderer/reader/pdf-annotations.test.ts`](../src/renderer/reader/pdf-annotations.test.ts) test
- [`src/renderer/reader/pdf-annotations.ts`](../src/renderer/reader/pdf-annotations.ts)
- [`src/renderer/reader/pdf-autolink.test.ts`](../src/renderer/reader/pdf-autolink.test.ts) test
- [`src/renderer/reader/pdf-autolink.ts`](../src/renderer/reader/pdf-autolink.ts)
- [`src/renderer/reader/pdf-book.ts`](../src/renderer/reader/pdf-book.ts)
- [`src/renderer/reader/pdf-chapter-at-page.test.ts`](../src/renderer/reader/pdf-chapter-at-page.test.ts) test
- [`src/renderer/reader/pdf-chapter-at-page.ts`](../src/renderer/reader/pdf-chapter-at-page.ts)
- [`src/renderer/reader/pdf-locator.test.ts`](../src/renderer/reader/pdf-locator.test.ts) test
- [`src/renderer/reader/pdf-locator.ts`](../src/renderer/reader/pdf-locator.ts)
- [`src/renderer/reader/pdf-page-appearance.test.ts`](../src/renderer/reader/pdf-page-appearance.test.ts) test
- [`src/renderer/reader/pdf-page-appearance.ts`](../src/renderer/reader/pdf-page-appearance.ts)
- [`src/renderer/reader/pdf-scroll.test.ts`](../src/renderer/reader/pdf-scroll.test.ts) test
- [`src/renderer/reader/pdf-scroll.ts`](../src/renderer/reader/pdf-scroll.ts)
- [`src/renderer/reader/pdf-search.test.ts`](../src/renderer/reader/pdf-search.test.ts) test
- [`src/renderer/reader/pdf-search.ts`](../src/renderer/reader/pdf-search.ts)
- [`src/renderer/reader/pdf-selection.test.ts`](../src/renderer/reader/pdf-selection.test.ts) test
- [`src/renderer/reader/pdf-selection.ts`](../src/renderer/reader/pdf-selection.ts)
- [`src/renderer/reader/pdf-zoom.test.ts`](../src/renderer/reader/pdf-zoom.test.ts) test
- [`src/renderer/reader/pdf-zoom.ts`](../src/renderer/reader/pdf-zoom.ts)
- [`src/renderer/reader/pdfjs-compatibility.test.ts`](../src/renderer/reader/pdfjs-compatibility.test.ts) test
- [`src/renderer/reader/pdfjs-runtime.test.ts`](../src/renderer/reader/pdfjs-runtime.test.ts) test
- [`src/renderer/reader/percent.test.ts`](../src/renderer/reader/percent.test.ts) test
- [`src/renderer/reader/percent.ts`](../src/renderer/reader/percent.ts)
- [`src/renderer/reader/prefs-to-css.test.ts`](../src/renderer/reader/prefs-to-css.test.ts) test
- [`src/renderer/reader/prefs-to-css.ts`](../src/renderer/reader/prefs-to-css.ts)
- [`src/renderer/reader/reader-fonts.ts`](../src/renderer/reader/reader-fonts.ts)
- [`src/renderer/reader/reader-panel-accessibility.test.ts`](../src/renderer/reader/reader-panel-accessibility.test.ts) test
- [`src/renderer/reader/reader-panel-accessibility.ts`](../src/renderer/reader/reader-panel-accessibility.ts)
- [`src/renderer/reader/reader-theme-css.test.ts`](../src/renderer/reader/reader-theme-css.test.ts) test
- [`src/renderer/reader/reader-theme-css.ts`](../src/renderer/reader/reader-theme-css.ts)
- [`src/renderer/reader/reading-position-machine.test.ts`](../src/renderer/reader/reading-position-machine.test.ts) test
- [`src/renderer/reader/reading-position-machine.ts`](../src/renderer/reader/reading-position-machine.ts)
- [`src/renderer/reader/use-pdf-highlights.ts`](../src/renderer/reader/use-pdf-highlights.ts)
- [`src/renderer/reader/use-pdf-search-marks.ts`](../src/renderer/reader/use-pdf-search-marks.ts)
- [`src/renderer/reader/use-pdf-vocabulary.test.ts`](../src/renderer/reader/use-pdf-vocabulary.test.ts) test
- [`src/renderer/reader/use-pdf-vocabulary.ts`](../src/renderer/reader/use-pdf-vocabulary.ts)
- [`src/renderer/reader/use-reading-clock.test.ts`](../src/renderer/reader/use-reading-clock.test.ts) test
- [`src/renderer/reader/use-reading-clock.ts`](../src/renderer/reader/use-reading-clock.ts)
- [`src/renderer/reader/use-reading-position.ts`](../src/renderer/reader/use-reading-position.ts)
- [`src/renderer/reader/use-record-reading-page.ts`](../src/renderer/reader/use-record-reading-page.ts)
- [`src/renderer/reader/vocabulary-result.test.ts`](../src/renderer/reader/vocabulary-result.test.ts) test
- [`src/renderer/reader/vocabulary-result.ts`](../src/renderer/reader/vocabulary-result.ts)

### src/renderer/reader/tts (15 tệp)

- [`src/renderer/reader/tts/PronunciationButton.tsx`](../src/renderer/reader/tts/PronunciationButton.tsx)
- [`src/renderer/reader/tts/detect-lang.test.ts`](../src/renderer/reader/tts/detect-lang.test.ts) test
- [`src/renderer/reader/tts/detect-lang.ts`](../src/renderer/reader/tts/detect-lang.ts)
- [`src/renderer/reader/tts/pick-voice.test.ts`](../src/renderer/reader/tts/pick-voice.test.ts) test
- [`src/renderer/reader/tts/pick-voice.ts`](../src/renderer/reader/tts/pick-voice.ts)
- [`src/renderer/reader/tts/segment-paragraphs.test.ts`](../src/renderer/reader/tts/segment-paragraphs.test.ts) test
- [`src/renderer/reader/tts/segment-paragraphs.ts`](../src/renderer/reader/tts/segment-paragraphs.ts)
- [`src/renderer/reader/tts/split-for-utterance.test.ts`](../src/renderer/reader/tts/split-for-utterance.test.ts) test
- [`src/renderer/reader/tts/split-for-utterance.ts`](../src/renderer/reader/tts/split-for-utterance.ts)
- [`src/renderer/reader/tts/tts-controller.ts`](../src/renderer/reader/tts/tts-controller.ts)
- [`src/renderer/reader/tts/tts-css.ts`](../src/renderer/reader/tts/tts-css.ts)
- [`src/renderer/reader/tts/tts-engine.test.ts`](../src/renderer/reader/tts/tts-engine.test.ts) test
- [`src/renderer/reader/tts/tts-engine.ts`](../src/renderer/reader/tts/tts-engine.ts)
- [`src/renderer/reader/tts/voices.test.ts`](../src/renderer/reader/tts/voices.test.ts) test
- [`src/renderer/reader/tts/voices.ts`](../src/renderer/reader/tts/voices.ts)

<a id="dir-src-renderer-reading"></a>

### src/renderer/reading (15 tệp)

Điều hướng theo trạng thái phiên đọc và báo cáo.

- [`src/renderer/reading/BookRoute.test.ts`](../src/renderer/reading/BookRoute.test.ts) test
- [`src/renderer/reading/BookRoute.tsx`](../src/renderer/reading/BookRoute.tsx)
- [`src/renderer/reading/CompleteReadingDialog.tsx`](../src/renderer/reading/CompleteReadingDialog.tsx)
- [`src/renderer/reading/PageStreakPill.tsx`](../src/renderer/reading/PageStreakPill.tsx)
- [`src/renderer/reading/ReadingReportView.test.ts`](../src/renderer/reading/ReadingReportView.test.ts) test
- [`src/renderer/reading/ReadingReportView.tsx`](../src/renderer/reading/ReadingReportView.tsx)
- [`src/renderer/reading/ReadingStartView.tsx`](../src/renderer/reading/ReadingStartView.tsx)
- [`src/renderer/reading/ReportEditor.test.ts`](../src/renderer/reading/ReportEditor.test.ts) test
- [`src/renderer/reading/ReportEditor.tsx`](../src/renderer/reading/ReportEditor.tsx)
- [`src/renderer/reading/ReportProgressTimeline.tsx`](../src/renderer/reading/ReportProgressTimeline.tsx)
- [`src/renderer/reading/reading-session-actions.test.ts`](../src/renderer/reading/reading-session-actions.test.ts) test
- [`src/renderer/reading/report-view-model.test.ts`](../src/renderer/reading/report-view-model.test.ts) test
- [`src/renderer/reading/report-view-model.ts`](../src/renderer/reading/report-view-model.ts)
- [`src/renderer/reading/route-state.test.ts`](../src/renderer/reading/route-state.test.ts) test
- [`src/renderer/reading/route-state.ts`](../src/renderer/reading/route-state.ts)

<a id="dir-src-renderer-settings"></a>

### src/renderer/settings (21 tệp)

Giao diện cài đặt, provider, giao diện, sao lưu và tìm kiếm web.

- [`src/renderer/settings/AdvancedSettings.tsx`](../src/renderer/settings/AdvancedSettings.tsx)
- [`src/renderer/settings/AgentSettings.tsx`](../src/renderer/settings/AgentSettings.tsx)
- [`src/renderer/settings/AnnotationPaletteSettings.tsx`](../src/renderer/settings/AnnotationPaletteSettings.tsx)
- [`src/renderer/settings/AppearanceSettings.tsx`](../src/renderer/settings/AppearanceSettings.tsx)
- [`src/renderer/settings/AssistantModelPicker.tsx`](../src/renderer/settings/AssistantModelPicker.tsx)
- [`src/renderer/settings/BackupExportButton.test.ts`](../src/renderer/settings/BackupExportButton.test.ts) test
- [`src/renderer/settings/BackupExportButton.tsx`](../src/renderer/settings/BackupExportButton.tsx)
- [`src/renderer/settings/MemorySettings.tsx`](../src/renderer/settings/MemorySettings.tsx)
- [`src/renderer/settings/ModelEditor.tsx`](../src/renderer/settings/ModelEditor.tsx)
- [`src/renderer/settings/ModelPickerSection.tsx`](../src/renderer/settings/ModelPickerSection.tsx)
- [`src/renderer/settings/ModelsSettings.tsx`](../src/renderer/settings/ModelsSettings.tsx)
- [`src/renderer/settings/ProviderCard.tsx`](../src/renderer/settings/ProviderCard.tsx)
- [`src/renderer/settings/ProviderForm.tsx`](../src/renderer/settings/ProviderForm.tsx)
- [`src/renderer/settings/ReadingSettings.tsx`](../src/renderer/settings/ReadingSettings.tsx)
- [`src/renderer/settings/SettingsShell.tsx`](../src/renderer/settings/SettingsShell.tsx)
- [`src/renderer/settings/SummaryModelPicker.tsx`](../src/renderer/settings/SummaryModelPicker.tsx)
- [`src/renderer/settings/WebSearchSettings.tsx`](../src/renderer/settings/WebSearchSettings.tsx)
- [`src/renderer/settings/restore-confirmation.test.ts`](../src/renderer/settings/restore-confirmation.test.ts) test
- [`src/renderer/settings/restore-confirmation.ts`](../src/renderer/settings/restore-confirmation.ts)
- [`src/renderer/settings/settings-logic.test.ts`](../src/renderer/settings/settings-logic.test.ts) test
- [`src/renderer/settings/settings-logic.ts`](../src/renderer/settings/settings-logic.ts)

### src/renderer/shell (3 tệp)

- [`src/renderer/shell/AppShell.tsx`](../src/renderer/shell/AppShell.tsx)
- [`src/renderer/shell/SettingsMenuButton.tsx`](../src/renderer/shell/SettingsMenuButton.tsx)
- [`src/renderer/shell/ShellHeader.tsx`](../src/renderer/shell/ShellHeader.tsx)

<a id="dir-src-renderer-stats"></a>

### src/renderer/stats (9 tệp)

Lịch tháng, biểu đồ, thời gian và streak.

- [`src/renderer/stats/BookRanking.tsx`](../src/renderer/stats/BookRanking.tsx)
- [`src/renderer/stats/DailyBarChart.tsx`](../src/renderer/stats/DailyBarChart.tsx)
- [`src/renderer/stats/StatOverview.tsx`](../src/renderer/stats/StatOverview.tsx)
- [`src/renderer/stats/StatsView.tsx`](../src/renderer/stats/StatsView.tsx)
- [`src/renderer/stats/StreakCard.tsx`](../src/renderer/stats/StreakCard.tsx)
- [`src/renderer/stats/format-duration.test.ts`](../src/renderer/stats/format-duration.test.ts) test
- [`src/renderer/stats/format-duration.ts`](../src/renderer/stats/format-duration.ts)
- [`src/renderer/stats/month-calendar.test.ts`](../src/renderer/stats/month-calendar.test.ts) test
- [`src/renderer/stats/month-calendar.ts`](../src/renderer/stats/month-calendar.ts)

<a id="dir-src-renderer-store"></a>

### src/renderer/store (19 tệp)

Zustand store: điều hướng, cài đặt, layout, chat, tab PDF và TTS.

- [`src/renderer/store/annotation-store.test.ts`](../src/renderer/store/annotation-store.test.ts) test
- [`src/renderer/store/annotation-store.ts`](../src/renderer/store/annotation-store.ts)
- [`src/renderer/store/chat-store.test.ts`](../src/renderer/store/chat-store.test.ts) test
- [`src/renderer/store/chat-store.ts`](../src/renderer/store/chat-store.ts)
- [`src/renderer/store/hydrate-preferences.ts`](../src/renderer/store/hydrate-preferences.ts)
- [`src/renderer/store/lazy-storage.ts`](../src/renderer/store/lazy-storage.ts)
- [`src/renderer/store/navigation-store.test.ts`](../src/renderer/store/navigation-store.test.ts) test
- [`src/renderer/store/navigation-store.ts`](../src/renderer/store/navigation-store.ts)
- [`src/renderer/store/note-hover-store.ts`](../src/renderer/store/note-hover-store.ts)
- [`src/renderer/store/pane-size-store.test.ts`](../src/renderer/store/pane-size-store.test.ts) test
- [`src/renderer/store/pane-size-store.ts`](../src/renderer/store/pane-size-store.ts)
- [`src/renderer/store/pdf-tabs-store.ts`](../src/renderer/store/pdf-tabs-store.ts)
- [`src/renderer/store/persist-preference.ts`](../src/renderer/store/persist-preference.ts)
- [`src/renderer/store/prefs-store.test.ts`](../src/renderer/store/prefs-store.test.ts) test
- [`src/renderer/store/prefs-store.ts`](../src/renderer/store/prefs-store.ts)
- [`src/renderer/store/settings-store.ts`](../src/renderer/store/settings-store.ts)
- [`src/renderer/store/theme-store.test.ts`](../src/renderer/store/theme-store.test.ts) test
- [`src/renderer/store/theme-store.ts`](../src/renderer/store/theme-store.ts)
- [`src/renderer/store/tts-store.ts`](../src/renderer/store/tts-store.ts)

<a id="dir-src-renderer-theme"></a>

### src/renderer/theme (7 tệp)

Theme, nền ứng dụng, màu trang và độ sáng PDF.

- [`src/renderer/theme/ApplicationBackground.tsx`](../src/renderer/theme/ApplicationBackground.tsx)
- [`src/renderer/theme/ApplicationBackgroundControls.tsx`](../src/renderer/theme/ApplicationBackgroundControls.tsx)
- [`src/renderer/theme/PageColorModeControl.tsx`](../src/renderer/theme/PageColorModeControl.tsx)
- [`src/renderer/theme/PdfBrightnessControl.tsx`](../src/renderer/theme/PdfBrightnessControl.tsx)
- [`src/renderer/theme/ThemeController.tsx`](../src/renderer/theme/ThemeController.tsx)
- [`src/renderer/theme/application-background-state.test.ts`](../src/renderer/theme/application-background-state.test.ts) test
- [`src/renderer/theme/application-background-state.ts`](../src/renderer/theme/application-background-state.ts)

### src/renderer/update (1 tệp)

- [`src/renderer/update/useStartupUpdateCheck.ts`](../src/renderer/update/useStartupUpdateCheck.ts)

<a id="dir-src-shared"></a>

### src/shared (31 tệp)

Schema Zod, kiểu chung và hợp đồng IPC.

- [`src/shared/agent.ts`](../src/shared/agent.ts)
- [`src/shared/annotations.ts`](../src/shared/annotations.ts)
- [`src/shared/app-background.ts`](../src/shared/app-background.ts)
- [`src/shared/backup.test.ts`](../src/shared/backup.test.ts) test
- [`src/shared/backup.ts`](../src/shared/backup.ts)
- [`src/shared/book-notes.test.ts`](../src/shared/book-notes.test.ts) test
- [`src/shared/book-notes.ts`](../src/shared/book-notes.ts)
- [`src/shared/chat.test.ts`](../src/shared/chat.test.ts) test
- [`src/shared/chat.ts`](../src/shared/chat.ts)
- [`src/shared/ipc.test.ts`](../src/shared/ipc.test.ts) test
- [`src/shared/ipc.ts`](../src/shared/ipc.ts)
- [`src/shared/library.test.ts`](../src/shared/library.test.ts) test
- [`src/shared/library.ts`](../src/shared/library.ts)
- [`src/shared/memory.ts`](../src/shared/memory.ts)
- [`src/shared/pdf-bookmarks.test.ts`](../src/shared/pdf-bookmarks.test.ts) test
- [`src/shared/pdf-bookmarks.ts`](../src/shared/pdf-bookmarks.ts)
- [`src/shared/preferences.test.ts`](../src/shared/preferences.test.ts) test
- [`src/shared/preferences.ts`](../src/shared/preferences.ts)
- [`src/shared/providers.test.ts`](../src/shared/providers.test.ts) test
- [`src/shared/providers.ts`](../src/shared/providers.ts)
- [`src/shared/reading-sessions.ts`](../src/shared/reading-sessions.ts)
- [`src/shared/stats.ts`](../src/shared/stats.ts)
- [`src/shared/theme.test.ts`](../src/shared/theme.test.ts) test
- [`src/shared/theme.ts`](../src/shared/theme.ts)
- [`src/shared/tokens.test.ts`](../src/shared/tokens.test.ts) test
- [`src/shared/tokens.ts`](../src/shared/tokens.ts)
- [`src/shared/types.ts`](../src/shared/types.ts)
- [`src/shared/vocabulary.test.ts`](../src/shared/vocabulary.test.ts) test
- [`src/shared/vocabulary.ts`](../src/shared/vocabulary.ts)
- [`src/shared/web-search.test.ts`](../src/shared/web-search.test.ts) test
- [`src/shared/web-search.ts`](../src/shared/web-search.ts)

### src/shared/i18n (6 tệp)

- [`src/shared/i18n/i18next.d.ts`](../src/shared/i18n/i18next.d.ts)
- [`src/shared/i18n/index.ts`](../src/shared/i18n/index.ts)
- [`src/shared/i18n/language.test.ts`](../src/shared/i18n/language.test.ts) test
- [`src/shared/i18n/language.ts`](../src/shared/i18n/language.ts)
- [`src/shared/i18n/locales.test.ts`](../src/shared/i18n/locales.test.ts) test
- [`src/shared/i18n/resources.ts`](../src/shared/i18n/resources.ts)

### src/shared/i18n/locales (2 tệp)

- [`src/shared/i18n/locales/en.ts`](../src/shared/i18n/locales/en.ts)
- [`src/shared/i18n/locales/vi.ts`](../src/shared/i18n/locales/vi.ts)

<a id="reading-order"></a>

## Lộ trình review

1.  Đọc entry point và [kiến trúc](architecture.md).
2.  Chọn một thao tác tại [luồng chạy](runtime-flows.md) rồi đi theo các file liên kết.
3.  Mở test đặt cạnh file nghiệp vụ để xem trường hợp biên.
4.  Dùng [hướng dẫn chạy](run-from-source.md) và [hướng dẫn EXE](build-windows-exe.md) để kiểm chứng trên ứng dụng.
