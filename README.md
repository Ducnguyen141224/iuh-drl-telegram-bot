# IUH DRL Telegram Bot

Bot chạy local trên Windows, mở trang **Tra cứu** IUH bằng Chrome và gửi Telegram khi có hoạt động điểm rèn luyện mới hoặc một hoạt động cũ được mở đăng ký lại. Bot chỉ đọc dữ liệu, không tự đăng ký hoạt động.

## Chức năng

- Kiểm tra IUH mỗi 60 giây và chống gửi trùng thông báo.
- Lưu lịch sử sự kiện và hàng đợi thông báo qua các lần khởi động.
- Tự chạy khi người dùng đăng nhập Windows và tự khởi động lại tiến trình gặp lỗi.
- Lưu phiên IUH cục bộ, tự cập nhật cookie sau mỗi lần kiểm tra thành công.
- Khi phiên hết hạn, gửi cảnh báo một lần; sau khi phiên phục hồi, một lần hết hạn mới sẽ được cảnh báo lại.
- Hỗ trợ `/dangnhap` để mở Chrome trên máy chạy bot, nhập CAPTCHA và tự lưu phiên mới.
- Hỗ trợ nhiều người đăng ký nhận tin; quyền đăng nhập IUH và quản lý chỉ dành cho chủ bot.

Máy chạy bot phải đang bật, có mạng và đã đăng nhập Windows. IUH sử dụng CAPTCHA nên bot không thể đăng nhập hoàn toàn tự động hoặc bảo đảm phiên tồn tại vĩnh viễn.

## Cài trên máy Windows mới

1. Tải source ZIP từ GitHub và giải nén vào một thư mục cố định, ví dụ `D:\IUH-Bot`.
2. Nhấp đúp **Cai-dat-may-moi.bat**.
3. Nhập token BotFather khi được hỏi, gửi `/start` cho bot và làm theo hướng dẫn trên màn hình.
4. Đăng nhập IUH và nhập CAPTCHA trong cửa sổ Chrome được mở.

Trình cài đặt kiểm tra hoặc cài Node.js LTS và Chrome bằng WinGet, chạy `npm ci`, kết nối Telegram, lưu phiên IUH rồi cài tác vụ chạy nền. Nếu máy không có WinGet, cài Node.js LTS và Chrome thủ công rồi chạy lại BAT. Xem [HUONG_DAN_CAI_DAT.md](HUONG_DAN_CAI_DAT.md) để biết quy trình chi tiết hoặc chuyển bot từ máy cũ.

## Chạy local tự động trên Windows

Mở **Bật bot.cmd** để cài tác vụ `IUH-DRL-Local` và chạy nền ngay. Bot tự khởi động lại mỗi khi bạn đăng nhập Windows, chạy cùng quyền người dùng hiện tại và không giữ cửa sổ PowerShell/Terminal trên màn hình. Bộ quản lý chạy cả phần trả lời Telegram và phần kiểm tra IUH; tự khởi động lại tiến trình con nếu bị dừng do lỗi. Máy cần hoạt động và có mạng; khi tắt máy hoặc sleep thì không kiểm tra được.

`TELEGRAM_CHAT_ID` là tài khoản **chủ bot**. Khi phiên hết hạn, cảnh báo và quyền `/dangnhap` chỉ gửi/cấp cho tài khoản này. Lệnh mở Chrome trên chính máy đang chạy bot; chủ bot nhập CAPTCHA, bot tự lưu phiên và tiếp tục theo dõi. **Đăng nhập IUH.cmd** là phương án dự phòng.

Người dùng khác mở bot và gửi `/start` để đăng ký. Chat ID của họ được lưu cục bộ trong `data/subscribers.json`; khi có sự kiện mới, bot gửi cho chủ bot và toàn bộ người đăng ký. Người dùng gửi `/stop` để hủy nhận tin. Nếu một tài khoản chặn bot hoặc chat không còn hợp lệ, tài khoản đó được tự loại khỏi danh sách.

Mở **Tắt bot.cmd** để dừng bot và tắt tự khởi động cùng Windows. Dữ liệu phiên và lịch sử được giữ nguyên. Mở Bật bot.cmd để bật lại.

Các lệnh Telegram:

- `/start`: đăng ký nhận thông báo.
- `/status`: trạng thái phiên và lần kiểm tra gần nhất.
- `/events`: tối đa 10 hoạt động trong lần lấy dữ liệu gần nhất.
- `/stop`: hủy nhận thông báo.
- `/help`: hướng dẫn nhanh.
- `/dangnhap`: chỉ chủ bot; mở Chrome để đăng nhập hoặc làm mới phiên IUH.
- `/subscribers`: chỉ chủ bot; xem số người đăng ký.

Nhấn nút **Menu** hoặc nhập dấu `/` trong ô chat để Telegram hiển thị danh sách lệnh trên. Bot tự đăng ký lại menu này mỗi lần khởi động.

Log cục bộ nằm tại `data/local-service.log`, `data/watcher.log` và `data/telegram-bot.log`. Không chạy thêm `npm start` hoặc `npm run bot` riêng khi chế độ local đã bật.

Nếu chỉ muốn chạy chung bằng terminal, dùng `npm run local`. Các hướng dẫn lệnh riêng bên dưới dùng cho kiểm tra hoặc vận hành thủ công.

## 1. Cài đặt

```powershell
npm ci
Copy-Item .env.example .env
```

Mở `.env` và cấu hình ít nhất một kênh:

- Telegram: `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`.
- Discord: `DISCORD_WEBHOOK_URL`.

Nếu để trống cả hai, bot chỉ in thông báo ra terminal.

## 2. Lưu phiên đăng nhập IUH

```powershell
npm run login
```

Chrome sẽ mở. Đăng nhập như bình thường; khi bảng **Đăng ký tham gia** xuất hiện, quay lại terminal và nhấn Enter. Cookie phiên chỉ được lưu cục bộ trong `.auth/` và đã được bỏ khỏi Git. Khi bot local đang chạy, có thể gửi `/dangnhap` thay cho lệnh này.

Khi website báo hết phiên, chạy lại lệnh trên. Không ghi mật khẩu IUH vào `.env` hay mã nguồn.

## 3. Chạy thử một lần

```powershell
npm run check
```

Mặc định lần chạy đầu chỉ ghi nhận danh sách hiện tại vào `data/events-state.json`, không gửi hàng loạt các hoạt động cũ.

## 4. Chạy liên tục

```powershell
npm start
```

Giữ terminal này mở. Bot kiểm tra mỗi 60 giây (1 phút), phát hiện hoạt động theo ID ổn định của website, và không xem thay đổi số lượng `(x/y)` là một hoạt động mới. Bot cũng báo nếu một hoạt động cũ được mở lại đăng ký.

## Cấu hình Telegram thủ công

Sau khi điền `TELEGRAM_BOT_TOKEN` vào `.env`:

1. Gửi `/start` cho bot.
2. Chạy `npm run telegram:setup -- --save-chat-id` để tự phát hiện và lưu Chat ID.
3. Chạy `npm run telegram:test` để gửi tin thử.
4. Chạy `npm run local` để bật cả bộ nhận lệnh Telegram và bộ theo dõi IUH trong cùng một tiến trình quản lý.

Không chia sẻ `.env`, token Telegram, Discord webhook hay thư mục `.auth/`. Danh sách thuê bao trong `data/` cũng là dữ liệu riêng tư. Các đường dẫn này cùng với `node_modules/` và `dist/` đã được bỏ khỏi Git.
