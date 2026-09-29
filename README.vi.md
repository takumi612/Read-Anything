# Read-Anything

[English](README.md)

Read-Anything là ứng dụng đọc PDF và EPUB trên máy tính. Bạn có thể tra từ Anh–Việt bằng từ điển ngoại tuyến, đánh dấu, ghi chú, thêm bookmark và đọc tiếp từ vị trí cũ. AI là tùy chọn: chỉ cần kết nối nhà cung cấp bằng API key của bạn khi muốn hỏi về một đoạn sách.

## Chức năng

- Đọc PDF và EPUB lưu trên máy. Tra từ và chọn chữ trong PDF cần tài liệu có lớp văn bản; PDF scan vẫn xem được như ảnh.
- Tra từ ngoại tuyến, gồm các dạng biến đổi thông dụng, và nghe phát âm bằng giọng có sẵn trên hệ thống.
- Tìm kiếm trong PDF; lưu highlight, ghi chú, bookmark, từ vựng và vị trí đọc trên máy.
- Chọn màu highlight và màu trang. Cài đặt trang EPUB tách riêng với màu trang hoặc vùng bao quanh PDF.
- Theo dõi tiến độ từng ngày và chuỗi lửa sau mười trang khác nhau; trang Thống kê có lịch tháng.
- Hỏi AI về đoạn đã chọn qua OpenAI, Anthropic, Google hoặc endpoint tương thích OpenAI. Nếu nhà cung cấp thu phí API, chi phí thuộc tài khoản của bạn.
- Dùng giao diện tiếng Việt hoặc tiếng Anh. Đọc và tra từ offline không cần tài khoản hay API key.

## Cài và chạy Read-Anything trên Windows

### Yêu cầu

- Windows 10 trở lên, 64 bit.
- [Node.js 24.x cho Windows x64](https://nodejs.org/en/download/archive/v24/). Bộ cài có npm và Corepack. Dự án khóa pnpm ở phiên bản 11.5.0.
- [Git for Windows](https://git-scm.com/download/win) để tải mã nguồn.
- Có kết nối Internet để tải mã nguồn và dependencies trong lần cài đầu.

Sau khi cài, ứng dụng và từ điển đi kèm dùng được ngoại tuyến. Muốn hỏi AI, bạn cần Internet và API key của nhà cung cấp. Đọc sách và tra từ không cần API key.

Mở PowerShell và kiểm tra các công cụ:

```powershell
node --version
git --version
corepack --version
```

`node --version` cần trả về dạng `v24.x.x`. Nếu lệnh `corepack --version` báo không tìm thấy lệnh, chạy `npm install --global corepack`, đóng PowerShell rồi mở lại. Xem [hướng dẫn Corepack](https://github.com/nodejs/corepack#readme) để biết thêm.

### Cài và mở ứng dụng

Chạy các lệnh sau trong PowerShell:

```powershell
git clone https://github.com/takumi612/Read-Anything.git
cd Read-Anything
.\scripts\windows.ps1 setup
.\scripts\windows.ps1 dev
```

Lệnh đầu tải mã nguồn cùng bộ từ điển. `setup` tải phiên bản pnpm và thư viện đã khóa, build bộ đọc EPUB và chuẩn bị SQLite cho Electron. Giữ cửa sổ PowerShell mở khi ứng dụng đang chạy. Nhấn **Ctrl+C** trong cửa sổ đó để dừng chế độ phát triển.

Nếu PowerShell chặn script cài đặt, chạy trực tiếp các lệnh của dự án:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Nếu cài đặt dừng với lỗi biên dịch `node-gyp` hoặc `better-sqlite3`, cài Python 3 và [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), chọn workload **Desktop development with C++**. Sau đó chạy lại `corepack pnpm install --frozen-lockfile`. Một số máy dùng được binary dựng sẵn nên không cần các công cụ biên dịch này.

### Mở sách đầu tiên

1. Trong thư viện, chọn **Import books**, rồi chọn tệp PDF hoặc EPUB.
2. Mở sách, bôi chọn một từ tiếng Anh và chọn **Look up** để xem từ điển offline.
3. Muốn hỏi AI về một đoạn sách, mở **Settings**, thêm nhà cung cấp và API key, rồi chọn đoạn văn và nhấn **Ask AI**. Nhà cung cấp có thể tính phí API.

### Tạo file EXE Windows

Để tạo và chạy bản ứng dụng portable, dùng:

```powershell
.\scripts\windows.ps1 package
.\out\Read-Anything-win32-x64\Read-Anything.exe
```

Để tạo bộ cài Windows, chạy `.\scripts\windows.ps1 installer`. Bộ cài nằm trong `out\make\squirrel.windows\x64\`.

Xem [hướng dẫn chạy từ mã nguồn](docs/run-from-source.md) để biết thêm về chế độ phát triển, hoặc [hướng dẫn đóng gói Windows](docs/build-windows-exe.md) để làm theo các bước tạo EXE và bộ cài.

## Tài liệu trong repository

- [Cài và chạy từ mã nguồn](docs/run-from-source.md)
- [Tạo EXE Windows](docs/build-windows-exe.md)
- [Kiến trúc dự án](docs/architecture.md)
- [Bản đồ mã nguồn](docs/code-map.md)
- [Luồng hoạt động](docs/runtime-flows.md)

## Giấy phép và dữ liệu

Mã nguồn ứng dụng dùng [GPL-3.0-or-later](LICENSE). Dự án phát triển từ [Marginalia của EurFelux](https://github.com/EurFelux/marginalia) và giữ lịch sử, ghi công tác giả gốc. Bộ từ điển đi kèm có [ghi công CC BY-SA 4.0](assets/dictionary/ATTRIBUTION.md) và [thông tin nguồn](assets/dictionary/README.md) riêng. Repository không chứa sách cá nhân hoặc API key.
