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

## Cài và chạy từ mã nguồn trên Windows

Cần **Windows 10 trở lên (64 bit)**, **Node.js 24 có Corepack** và **Git** để tải mã nguồn. Lần cài đầu tải thư viện npm, Electron và phiên bản pnpm đã khóa; các lần chạy sau dùng lại thư viện trên máy. Bộ từ điển ngoại tuyến đã có trong repository.

```powershell
git clone https://github.com/takumi612/Read-Anything.git
cd Read-Anything
.\scripts\windows.ps1 setup
.\scripts\windows.ps1 dev
```

Nếu PowerShell không cho chạy script, dùng lệnh tương đương:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

`install` tự build các package nội bộ và biên dịch `better-sqlite3` cho Electron qua `postinstall`. Giữ cửa sổ terminal mở khi chạy chế độ phát triển. Nếu máy thiếu trình biên dịch native, cài Microsoft C++ Build Tools rồi chạy lại lệnh `install`.

## Tạo và chạy EXE trên Windows

Đóng EXE đang chạy trước khi build lại. Lệnh `package` tạo một thư mục ứng dụng; khi sao chép phải giữ nguyên cả thư mục:

```powershell
.\scripts\windows.ps1 package
.\out\Read-Anything-win32-x64\Read-Anything.exe
```

Để tạo bộ cài Windows, chạy `.\scripts\windows.ps1 installer`. Electron Forge ghi bộ cài Squirrel trong `out\make\squirrel.windows\x64\`. Bản tự build chưa ký mã. Lệnh này không đăng bản phát hành lên GitHub.

Có thể dùng trực tiếp `corepack pnpm package` và `corepack pnpm make:win`. Trên macOS hoặc Linux, cài cùng phiên bản Node.js, rồi chạy `corepack pnpm install --frozen-lockfile`, `corepack pnpm dev`, `corepack pnpm package`. Muốn đóng gói cho hệ điều hành nào thì chạy lệnh trên hệ điều hành đó; repository này chưa có luồng phát hành đã ký và công chứng.

## Bắt đầu đọc

1. Nhập một tệp PDF hoặc EPUB trong thư viện.
2. Chọn từ tiếng Anh và nhấn **Look up** để tra offline. Chọn đoạn văn và nhấn **Ask AI** khi đã cấu hình nhà cung cấp.
3. Nếu dùng AI, mở **Settings**, chọn nhà cung cấp và nhập API key của bạn. Bản sao lưu không chứa API key.
4. Muốn mở PDF bằng Read-Anything trên Windows, bật đăng ký ứng dụng trong phần cài đặt nâng cao. Sau đó chọn Read-Anything cho `.pdf` trong **Ứng dụng mặc định** của Windows.

## Tài liệu trong repository

- [Cài và chạy từ mã nguồn](docs/run-from-source.html)
- [Tạo EXE Windows](docs/build-windows-exe.html)
- [Kiến trúc dự án](docs/architecture.html)
- [Bản đồ mã nguồn](docs/code-map.html)
- [Luồng hoạt động](docs/runtime-flows.html)

## Giấy phép và dữ liệu

Mã nguồn ứng dụng dùng [GPL-3.0-or-later](LICENSE). Dự án phát triển từ [Marginalia của EurFelux](https://github.com/EurFelux/marginalia) và giữ lịch sử, ghi công tác giả gốc. Bộ từ điển đi kèm có [ghi công CC BY-SA 4.0](assets/dictionary/ATTRIBUTION.md) và [thông tin nguồn](assets/dictionary/README.md) riêng. Repository không chứa sách cá nhân hoặc API key.
