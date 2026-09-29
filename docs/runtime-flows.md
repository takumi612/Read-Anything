# Ứng dụng chạy như thế nào

Mỗi mục bắt đầu từ thao tác người dùng và đi qua những file thực sự tham gia. Dùng các liên kết để review từng đoạn mã; xem [kiến trúc](architecture.md) khi cần hiểu trách nhiệm của một lớp.

<a id="startup"></a>

## 1. Mở ứng dụng

1.  Electron vào [`src/main.ts`](../src/main.ts), lấy single-instance lock, đăng ký scheme và chờ `app.ready`.
2.  [`initDb`](../src/main/db/instance.ts) mở SQLite, chạy migration từ [`migrations-path.ts`](../src/main/db/migrations-path.ts), chuẩn bị provider tích hợp. Main đăng ký các IPC bindings trong `src/main/ipc/`.
3.  Main cài giao thức cover/media, đồng hồ đọc và sách mẫu nếu là lần đầu. Ở bản đóng gói, [`renderer-server.ts`](../src/main/app/renderer-server.ts) phục vụ renderer qua loopback; khi dev, Forge dùng Vite URL.
4.  Preload lấy snapshot cài đặt ban đầu rồi mở `window.api`. [`renderer.tsx`](../src/renderer.tsx) nạp giao diện, React Query và [`App.tsx`](../src/renderer/App.tsx).

Nếu hệ điều hành mở một PDF bằng Read-Anything, `src/main.ts` nhận đường dẫn, gửi `appOpenFile` tới renderer và `App.tsx` import rồi mở sách.

<a id="import"></a>

## 2. Nhập sách vào thư viện

LibraryView**→**window.api.library.import**→**library-handlers**→**repository + parser + book-files

1.  [`LibraryView.tsx`](../src/renderer/library/LibraryView.tsx) nhận tệp từ hộp thoại hoặc kéo thả. UI chuyển đường dẫn tệp qua preload.
2.  [`library-handlers.ts`](../src/main/ipc/library-handlers.ts) đọc bytes bằng [`import-source.ts`](../src/main/library/import-source.ts). [`repository.ts`](../src/main/library/repository.ts) chọn parser theo định dạng, lưu metadata, TOC/chapter và cover trong SQLite.
3.  [`book-files.ts`](../src/main/library/book-files.ts) giữ bản tệp sách trong thư mục ứng dụng. Danh sách sách trả về UI qua `library.list`; shelf gần đây dùng bảng tiến độ và phiên đọc.

PDF dùng `packages/pdf-parser/`; EPUB dùng `packages/epub-parser/`. PDF lấy ID từ hash bytes. Tệp EPUB cũ có thể được đánh chỉ mục lại khi mở nếu phiên bản parser đã thay đổi.

<a id="read"></a>

## 3. Mở sách, đọc và nhớ vị trí

1.  [`navigation-store.ts`](../src/renderer/store/navigation-store.ts) nhận book ID. [`BookRoute.tsx`](../src/renderer/reading/BookRoute.tsx) chọn màn bắt đầu, reader hoặc báo cáo theo reading state.
2.  [`ReaderView.tsx`](../src/renderer/reader/ReaderView.tsx) chọn [`PdfReader`](../src/renderer/reader/PdfReader.tsx) hay [`EpubReader`](../src/renderer/reader/EpubReader.tsx). Sidebar hiển thị nội dung, PDF có chế độ trang/thumbnail. Công cụ bên phải chứa AI và dữ liệu theo sách.
3.  PDF đọc bytes qua `library.readBookBytes`, [`pdf-book.ts`](../src/renderer/reader/pdf-book.ts) khởi tạo pdfjs worker; `PdfReader` ảo hóa trang, vẽ canvas và text layer. EPUB render bằng epubjs.
4.  [`use-reading-position.ts`](../src/renderer/reader/use-reading-position.ts) và logic reader đổi vị trí thành locator + percent. `progress.save` đi qua [`main/library/progress.ts`](../src/main/library/progress.ts). Lần mở sau đọc locator để khôi phục vị trí.

Ở PDF, [`pdf-zoom.ts`](../src/renderer/reader/pdf-zoom.ts) và [`pdf-scroll.ts`](../src/renderer/reader/pdf-scroll.ts) tính zoom và điểm neo cuộn. `PdfReader.tsx` xử lý wheel/pinch để giữ vùng đọc. Reader chỉ ghi trang đã đọc ở chế độ đọc chủ động.

Header reader tự ẩn khi người dùng cuộn xuống và hiện lại khi cuộn lên hoặc rê chuột vào mép trên. Sự kiện khôi phục vị trí đọc bị bỏ qua để header không tự biến mất khi mở sách. Vùng đọc giữ scrollbar mảnh để người dùng nhận biết vị trí cuộn; thao tác “Complete reading” hiện tạm thời không có nút trong giao diện.

Trong PDF, menu Application theme có hai thanh độ sáng độc lập: độ sáng nội dung trang và độ sáng nền bao quanh trang. Thay đổi nền chỉ áp dụng cho vùng ngoài canvas, nên không làm đổi nội dung của PDF scan; hai giá trị được lưu riêng trong preferences.

<a id="search"></a>

## 4. Tìm kiếm trong PDF

1.  [`PdfSearchPanel.tsx`](../src/renderer/reader/PdfSearchPanel.tsx) nhận từ khóa, tùy chọn phân biệt hoa thường và trọn từ. [`pdf-search.ts`](../src/renderer/reader/pdf-search.ts) tìm trong nội dung trang.
2.  [`use-pdf-search-marks.ts`](../src/renderer/reader/use-pdf-search-marks.ts) đánh dấu kết quả trên text layer. Click một kết quả điều hướng đến trang và vị trí.
3.  Ẩn panel giữ từ khóa hiện có để mở lại. `Ctrl+F` được bắt ở reader; vùng chọn vẫn có thể trở thành từ khóa theo logic trong `PdfReader.tsx`.

PDF scan không có text layer thì parser không cung cấp chữ để tìm. Đánh dấu kết quả phụ thuộc tọa độ text layer của pdfjs, nên kiểm tra với PDF cụ thể nếu thấy vị trí sai.

<a id="selection"></a>

## 5. Chọn chữ, tra từ, chú thích và ghi chú

1.  Reader ghi nội dung, locator và đoạn lân cận vào [`annotation-store.ts`](../src/renderer/store/annotation-store.ts). [`SelectionToolbar.tsx`](../src/renderer/reader/SelectionToolbar.tsx) hiện thao tác tra từ, đánh dấu, thêm ghi chú và hỏi AI.
2.  Tra từ gọi `window.api.vocabulary.lookup`. [`vocabulary-handlers.ts`](../src/main/ipc/vocabulary-handlers.ts) dùng [`dictionary-store.ts`](../src/main/vocabulary/dictionary-store.ts) mở DB từ điển và [`local-dictionary.ts`](../src/main/vocabulary/local-dictionary.ts) tìm nghĩa, dạng biến cách và thuật ngữ kỹ thuật. Popup có thể phát âm qua `src/renderer/reader/tts/`.
3.  Lưu từ vào [`vocabulary/repository.ts`](../src/main/vocabulary/repository.ts). PDF có thể hiện từ đã lưu ở những chỗ khác trong cùng sách qua [`use-pdf-vocabulary.ts`](../src/renderer/reader/use-pdf-vocabulary.ts). Annotation đi qua `main/library/annotations.ts`, note qua `main/library/book-notes.ts`.
4.  Bookmark PDF yêu cầu nội dung do người dùng nhập; UI ở `PdfReader.tsx` và danh sách ở [`PdfBookmarksList.tsx`](../src/renderer/reader/PdfBookmarksList.tsx). Main lưu qua `main/library/pdf-bookmarks.ts`.

Mỗi danh mục có nút xóa riêng sau hộp thoại xác nhận. [`clear-book-category.ts`](../src/main/library/clear-book-category.ts) xóa dữ liệu theo book ID và category trong transaction, không xóa tiến độ đọc.

<a id="ai"></a>

## 6. Hỏi AI theo ngữ cảnh sách

1.  [`use-ai-actions.ts`](../src/renderer/ai/use-ai-actions.ts) chuyển đoạn đã chọn và đoạn lân cận thành context chips, đặt câu nháp, mở panel. [`Composer.tsx`](../src/renderer/ai/Composer.tsx) gửi câu hỏi qua [`ipc-chat-transport.ts`](../src/renderer/ai/ipc-chat-transport.ts).
2.  Main kiểm tra nhà cung cấp và sự đồng ý gửi dữ liệu AI tại `src/main/ai/consent.ts`. [`send.ts`](../src/main/ai/send.ts) xác minh hội thoại, lấy lịch sử từ DB, có thể lấy trích đoạn PDF liên quan và dựng prompt với `prompt.ts`.
3.  [`stream-assistant.ts`](../src/main/ai/stream-assistant.ts) dùng AI SDK và công cụ sách/memory/search. [`ai-handlers.ts`](../src/main/ipc/ai-handlers.ts) gửi ACK trước, rồi chuyển chunk về renderer. [`AIPanel.tsx`](../src/renderer/ai/AIPanel.tsx) hiển thị stream, lịch sử được lưu bởi `src/main/chat/`.

Đường `ai.translateSelection` riêng dùng model đã cấu hình. Nó khác tra từ điển ngoại tuyến. Nội dung gửi ra ngoài gồm câu hỏi và ngữ cảnh mà lượt hỏi bật.

<a id="streak"></a>

## 7. Ghi thời gian và chuỗi đọc

[`use-reading-clock.ts`](../src/renderer/reader/use-reading-clock.ts) theo dõi thời gian đọc. [`use-record-reading-page.ts`](../src/renderer/reader/use-record-reading-page.ts) báo trang tới main. [`page-streak.ts`](../src/main/stats/page-streak.ts) đếm mỗi trang một lần mỗi ngày, cộng nhiều sách, giới hạn hiển thị tiến độ ở 10/10 và tính chuỗi ngày liên tiếp đủ 10 trang. `src/renderer/stats/` hiển thị lịch tháng và thống kê.

<a id="backup"></a>

## 8. Sao lưu và khôi phục

[`backup-service.ts`](../src/main/backup/backup-service.ts) tạo snapshot SQLite, bỏ thông tin khóa API khỏi bản sao, dựng manifest và đóng ZIP. Khi khôi phục, `compat.ts` kiểm tra tương thích, `restore.ts` kiểm tra dữ liệu rồi thay DB trước khi ứng dụng khởi động lại. UI ở `src/renderer/settings/BackupExportButton.tsx` và `AdvancedSettings.tsx`. Cần nhập lại API key sau khi khôi phục.
