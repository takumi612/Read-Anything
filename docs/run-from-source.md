# Cài và chạy từ đầu

Các lệnh dưới đây chạy tại thư mục gốc chứa `package.json` của Read-Anything. Chúng dùng Corepack để lấy đúng pnpm mà dự án khóa, biên dịch parser EPUB và chạy Electron ở chế độ phát triển.

<a id="prepare"></a>

## 1. Chuẩn bị máy

- Windows 10 hoặc mới hơn, bản 64-bit.
- Node.js 24 và Corepack đi cùng Node. Kiểm tra bằng `node --version` và `corepack --version`.
- Git nếu cần tải repository hoặc xem thay đổi.
- Kết nối mạng cho lần cài dependency đầu tiên. AI là tùy chọn; tra từ địa phương dùng DB đi cùng source.

[`package.json`](../package.json) khai báo `pnpm@11.5.0` và `electron@41.7.1`. [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) yêu cầu `nodeLinker: hoisted`; đừng đổi sang linker khác khi cài dự án này.

<a id="clone"></a>

## 2. Lấy mã và vào đúng thư mục

Nếu đã có thư mục dự án, bỏ qua bước clone và mở PowerShell tại thư mục chứa `package.json`. Từ bản Git công khai:

    git clone https://github.com/takumi612/Read-Anything.git
    cd Read-Anything

    Test-Path package.json

`Test-Path` phải in `True`. Tất cả lệnh tiếp theo chạy từ thư mục đó.

<a id="install"></a>

## 3. Cài thư viện

    node --version
    corepack pnpm --version
    corepack pnpm install --frozen-lockfile

Lệnh pnpm nên báo `11.5.0`. `install` chạy `postinstall` trong [`package.json`](../package.json): build package EPUB và rebuild `better-sqlite3` cho ABI của Electron. Đây là phần cần thiết để ứng dụng và Vitest mở cùng SQLite native module. Lần đầu sẽ tải Electron và nhiều thư viện; đợi lệnh kết thúc không có lỗi.

Dự án có `packages/ui-prototype/` nhưng `pnpm-workspace.yaml` loại nó khỏi workspace. Không cần cài prototype để chạy ứng dụng.

<a id="dev"></a>

## 4. Khởi động ứng dụng phát triển

    corepack pnpm dev

Script chạy `build:packages`, watcher của EPUB parser và `electron-forge start` đồng thời. Cửa sổ Read-Anything mở khi Forge/Vite và main process sẵn sàng. DevTools có thể mở sẵn trong chế độ phát triển. Giữ PowerShell đang chạy; dùng `Ctrl+C` để dừng.

Ở lần mở đầu, main process tạo DB, chạy migration và có thể thêm sách mẫu. Dữ liệu của ứng dụng nằm trong `app.getPath('userData')`; mã nguồn không phải nơi lưu sách đang đọc. Đường dẫn cụ thể được tạo tại [`src/main/app/app-service.ts`](../src/main/app/app-service.ts).

<a id="use"></a>

## 5. Kiểm tra một lượt đọc

1.  Trong Library, nhập một tệp EPUB hoặc PDF từ máy.
2.  Mở sách, sang trang rồi quay lại Library. Mở lại sách để kiểm tra tiến độ.
3.  Chọn một từ tiếng Anh và dùng **Look up**. Từ điển địa phương không cần AI key.
4.  Nếu muốn hỏi AI, mở Settings, thêm provider và API key của chính bạn, chọn model rồi dùng **Ask AI** trên đoạn chọn.

Muốn hiểu từng lời gọi phía sau các thao tác này, xem [luồng nhập](runtime-flows.md#import), [luồng đọc](runtime-flows.md#read) và [luồng AI](runtime-flows.md#ai).

<a id="checks"></a>

## 6. Các lệnh kiểm tra mã

| Lệnh | Việc thực hiện |
|----|----|
| `corepack pnpm typecheck` | Build EPUB parser và chạy TypeScript `tsc --noEmit`. |
| `corepack pnpm lint` | Chạy oxlint, không tự sửa. |
| `corepack pnpm format:check` | Kiểm tra định dạng với oxfmt, không tự sửa. |
| `corepack pnpm test` | Build EPUB parser và chạy Vitest qua Electron runtime để đúng ABI của `better-sqlite3`. |
| `node scripts/e2e-packaged-pdf.mjs --sample="C:\Books\sample.pdf"` | Kiểm thử EXE đã đóng gói bằng PDF hoặc EPUB trên máy; xem [hướng dẫn E2E](build-windows-exe.md#e2e). |

Không dùng `node node_modules/vitest/vitest.mjs` thay cho script dự án: Node thường và Electron có thể dùng ABI khác nhau cho SQLite native module.

<a id="issues"></a>

## Nếu lệnh thất bại

### `pnpm` không được nhận diện

Dùng `corepack pnpm ...` như hướng dẫn. Kiểm tra Node và Corepack đã có trong PATH của PowerShell mới.

### Lỗi tải hoặc dựng Electron/native module khi `install`

Kiểm tra mạng và log của `corepack pnpm install`. Khi chỉ bước rebuild SQLite bị gián đoạn, chạy `corepack pnpm db:rebuild:electron`. Đừng đổi phiên bản Electron chỉ để vượt lỗi ABI.

### Ứng dụng đã chạy nhưng build báo `EPERM` hoặc `Access denied`

Đóng mọi cửa sổ Read-Anything và tiến trình Electron liên quan. Thử lại từ PowerShell có quyền ghi trong repository. Bản đang mở có thể giữ `out/.../resources/app.asar` hoặc `.vite/build`. Xem [cách kiểm tra bản EXE gốc](build-windows-exe.md#locked).

### PDF mở ra trắng hoặc worker lỗi

Kiểm tra lỗi trong DevTools và log của app. Renderer cần worker, CMaps, fonts và WASM của pdfjs từ `vite.renderer.config.ts`. So sánh chế độ dev với bản đóng gói; [luồng đọc PDF](runtime-flows.md#read) chỉ ra điểm parse và render.
