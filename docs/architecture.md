# Kiến trúc ứng dụng

Read-Anything là ứng dụng Electron đọc EPUB và PDF. Mã được chia theo tiến trình Electron, hợp đồng IPC và miền chức năng. Trang này giải thích nơi dữ liệu được xử lý, lưu, và hiển thị.

Đọc cùng [bản đồ mã nguồn](code-map.md) để đi tới từng tệp. [Luồng chạy](runtime-flows.md) nối các lớp dưới đây thành thao tác cụ thể.

<a id="processes"></a>

## Ba môi trường chạy

Renderer: React UI**→**Preload: `window.api`**→**Main: IPC, nghiệp vụ, SQLite và tệp

[`src/main.ts`](../src/main.ts) khởi tạo cửa sổ Electron, cơ sở dữ liệu, giao thức ảnh và media, IPC handlers, dịch vụ đồng hồ đọc và máy chủ nội bộ cho renderer đã đóng gói. [`src/preload.ts`](../src/preload.ts) dùng `contextBridge.exposeInMainWorld`. [`src/preload-api.ts`](../src/preload-api.ts) xây API có kiểu từ hợp đồng; UI gọi `window.api` thay vì đọc Node hoặc SQLite trực tiếp.

[`src/renderer.tsx`](../src/renderer.tsx) gắn React vào `#root`, nạp i18n, CSS, theme và React Query. [`App.tsx`](../src/renderer/App.tsx) chọn màn sách hay khung ứng dụng theo Zustand navigation store. Main giữ quyền truy cập đĩa và API key. Renderer tập trung vào hành vi và trạng thái giao diện.

<a id="contracts"></a>

## Hợp đồng IPC và ranh giới tin cậy

[`src/shared/ipc.ts`](../src/shared/ipc.ts) định nghĩa channel và schema Zod đầu vào. Các kiểu miền nằm trong `src/shared/*.ts`, chẳng hạn [library](../src/shared/library.ts), [chat](../src/shared/chat.ts), [preferences](../src/shared/preferences.ts) và [vocabulary](../src/shared/vocabulary.ts). [`registry.ts`](../src/main/ipc/registry.ts) gắn hợp đồng với hàm xử lý. [`validate.ts`](../src/main/ipc/validate.ts) kiểm tra dữ liệu trước khi chạy nghiệp vụ; registry ghi lỗi nếu handler thất bại.

Preload chuyển lời gọi bằng `ipcRenderer.invoke`; hầu hết handlers dùng `bind(C.channel, fn)`. Dòng AI là ngoại lệ quan trọng: main trả ACK qua invoke, sau đó gửi từng chunk qua sự kiện `ai:chunk`. API đồng bộ chỉ phục vụ ảnh chụp cài đặt ban đầu và lưu tiến độ khi cần.

<a id="data"></a>

## Dữ liệu tại máy

[`app-service.ts`](../src/main/app/app-service.ts) tập trung đường dẫn trong `app.getPath('userData')`. [`db/instance.ts`](../src/main/db/instance.ts) mở một kết nối SQLite và chạy migration. [`db/client.ts`](../src/main/db/client.ts) cấu hình better-sqlite3 và Drizzle. Bảng được định nghĩa ở [`db/schema.ts`](../src/main/db/schema.ts). Migrations là các thư mục chứa `migration.sql` và `snapshot.json` dưới `src/main/db/migrations/`.

Tệp sách được sao chép vào thư mục ứng dụng bằng [`book-files.ts`](../src/main/library/book-files.ts); DB lưu metadata, chỉ mục, tiến độ, annotation, từ vựng, bookmark, hội thoại và số liệu đọc. Sao lưu nằm tại `src/main/backup/`. Dịch vụ ghi log ở `src/main/logger/`; renderer chuyển log bằng IPC. Từ điển đóng gói ở `assets/dictionary/` được sao chép vào vùng dữ liệu người dùng và mở cục bộ.

<a id="books"></a>

## Đọc EPUB và PDF

Import đi từ [`library-handlers.ts`](../src/main/ipc/library-handlers.ts) tới [`library/repository.ts`](../src/main/library/repository.ts). EPUB dùng [`@marginalia/epub-parser`](../packages/epub-parser/src/index.ts) để lấy metadata và cấu trúc; renderer hiển thị qua [`EpubReader.tsx`](../src/renderer/reader/EpubReader.tsx) và epubjs. PDF có parser phía main tại [`@marginalia/pdf-parser`](../packages/pdf-parser/src/index.ts) để lấy thông tin/chỉ mục; renderer dùng pdfjs trong [`pdf-book.ts`](../src/renderer/reader/pdf-book.ts) và [`PdfReader.tsx`](../src/renderer/reader/PdfReader.tsx) để vẽ trang và text layer. Trang PDF dài được ảo hóa bằng react-virtuoso.

[`BookRoute.tsx`](../src/renderer/reading/BookRoute.tsx) phân nhánh theo trạng thái phiên đọc: bắt đầu, đang đọc, xem lại, báo cáo. [`ReaderView.tsx`](../src/renderer/reader/ReaderView.tsx) gắn đầu đọc, sidebar, công cụ theo sách và AI. Các locator trong `src/renderer/reader/` là cầu nối giữa vị trí trên trang và DB. Search PDF xử lý text trong [`pdf-search.ts`](../src/renderer/reader/pdf-search.ts), hiển thị kết quả trong [`PdfSearchPanel.tsx`](../src/renderer/reader/PdfSearchPanel.tsx), và tô trên text layer bằng hook [`use-pdf-search-marks.ts`](../src/renderer/reader/use-pdf-search-marks.ts).

<a id="assistant"></a>

## Từ điển và trợ lý AI

Tra từ mặc định dùng [`local-dictionary.ts`](../src/main/vocabulary/local-dictionary.ts) và [`technical-glossary.ts`](../src/main/vocabulary/technical-glossary.ts). [`SelectionToolbar.tsx`](../src/renderer/reader/SelectionToolbar.tsx) hiển thị kết quả. Tính năng phát âm dùng Web Speech qua `src/renderer/reader/tts/`. Tra từ ngoại tuyến không cần provider AI.

AI được cấu hình ở `src/main/providers/`, `src/main/secrets/` và giao diện `src/renderer/settings/`. [`ai/send.ts`](../src/main/ai/send.ts) lấy câu hỏi, nội dung chọn, lịch sử và bằng chứng PDF. [`prompt.ts`](../src/main/ai/prompt.ts) dựng thông điệp. [`stream-assistant.ts`](../src/main/ai/stream-assistant.ts) gọi AI SDK và công cụ ngữ cảnh, sau đó stream kết quả về panel React. Tìm kiếm mạng chỉ tham gia khi đã cấu hình và bật cho lượt hỏi. Các công cụ đọc sách, memory và phiên đọc nằm cùng miền `src/main/ai/`.

<a id="state"></a>

## Trạng thái UI và cài đặt

[`navigation-store.ts`](../src/renderer/store/navigation-store.ts) giữ màn hiện tại; [`pdf-tabs-store.ts`](../src/renderer/store/pdf-tabs-store.ts) giữ các tab PDF; [`prefs-store.ts`](../src/renderer/store/prefs-store.ts) và [`theme-store.ts`](../src/renderer/store/theme-store.ts) giữ lựa chọn hiển thị. [`query/client.ts`](../src/renderer/query/client.ts) tạo React Query cache cho dữ liệu đọc từ main; mutation phải làm mới query liên quan. Thay đổi cấu hình được lưu qua `window.api.preferences.set`.

Theme ứng dụng, nền thư viện, tông trang EPUB, nền quanh PDF và độ sáng PDF là các lựa chọn khác nhau. UI điều khiển nằm trong `src/renderer/theme/`, `src/renderer/settings/AppearanceSettings.tsx` và `src/renderer/shell/SettingsMenuButton.tsx`. Bộ lọc độ sáng PDF tác động trang PDF đang hiển thị; nó không sửa bytes của sách gốc.

<a id="build"></a>

## Cấu trúc build

[`forge.config.ts`](../forge.config.ts) ghép ba entry: main, preload và renderer. Các config Vite riêng là [`vite.main.config.ts`](../vite.main.config.ts), [`vite.preload.config.ts`](../vite.preload.config.ts) và [`vite.renderer.config.ts`](../vite.renderer.config.ts). Main để native `better-sqlite3`, `pdfjs-dist` và `@napi-rs/canvas` ở ngoài bundle. Forge giữ chúng trong package, giải nén tệp `.node`, và kèm migrations/từ điển trong `resources`. Renderer copy CMaps, font chuẩn và WASM của pdfjs.

Bản đóng gói phục vụ tài nguyên renderer qua HTTP trên `127.0.0.1` với đường dẫn ngẫu nhiên do [`renderer-server.ts`](../src/main/app/renderer-server.ts) tạo. Đây là máy chủ cục bộ trong ứng dụng; phát triển dùng Vite dev server. Xem [cách tạo EXE](build-windows-exe.md) để phân biệt `package` và `make:win`.

<a id="limits"></a>

## Ranh giới cần nhớ khi review

- Tài liệu phản ánh mã trong working tree tại thời điểm viết. `CLAUDE.md` có một số câu về lệnh phát hành và phiên bản cũ; kiểm tra `package.json` và config hiện tại trước khi dùng.
- PDF scan không có text layer thì tìm kiếm/chọn từ theo văn bản có thể không khả dụng; phần vẽ trang vẫn dùng ảnh PDF.
- API key và dữ liệu sách ở máy người dùng. Hỏi AI gửi nội dung câu hỏi/ngữ cảnh tới provider do người dùng cấu hình; các luồng ngoại tuyến không cần mạng.
