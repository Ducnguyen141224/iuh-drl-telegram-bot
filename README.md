# Bot thông báo hoạt động điểm rèn luyện IUH

Bot mở trang **Tra cứu** bằng Chrome, đọc bảng **Đăng ký tham gia** và gửi thông báo ngay khi xuất hiện một hoạt động mới. Bot chỉ đọc dữ liệu; không tự bấm nút đăng ký.

## Cài trên máy Windows mới

Giải nén gói cài đặt vào thư mục cố định rồi mở **Cai-dat-may-moi.bat**. File này kiểm tra/cài Node.js LTS và Chrome nếu thiếu, cài thư viện, hướng dẫn kết nối Telegram và đăng nhập IUH, rồi bật chạy nền tự động. Xem [HUONG_DAN_CAI_DAT.md](HUONG_DAN_CAI_DAT.md) để chuyển bot từ máy cũ. Cần chép cả gói, không chỉ riêng file BAT.

## Chạy local tự động trên Windows

Mở **Bật bot.cmd** để cài tác vụ `IUH-DRL-Local` và chạy nền ngay. Bot tự khởi động lại mỗi khi bạn đăng nhập Windows, chạy cùng quyền người dùng hiện tại. Bộ quản lý chạy cả phần trả lời Telegram và phần kiểm tra IUH; tự khởi động lại tiến trình con nếu bị dừng do lỗi. Máy cần hoạt động và có mạng; khi tắt máy hoặc sleep thì không kiểm tra được.

Mở **Đăng nhập IUH.cmd** khi cần đăng nhập. Phiên được lưu trên máy, tự lưu cookie mới sau mỗi lần kiểm tra thành công và được tải lại tự động khi bạn đăng nhập lại. Website vẫn có thể hết hạn hoặc thu hồi phiên; bot sẽ báo qua Telegram và chờ bạn đăng nhập/CAPTCHA lại. Không có cam kết đăng nhập vĩnh viễn.

Mở **Tắt bot.cmd** để dừng bot và tắt tự khởi động cùng Windows. Dữ liệu phiên và lịch sử được giữ nguyên. Mở Bật bot.cmd để bật lại.

Xem trạng thái bằng `/status` và danh sách bằng `/events` trong Telegram. Log cục bộ ở `data/local-service.log`, `data/watcher.log`, `data/telegram-bot.log`. Lịch sử ID và hàng đợi thông báo được lưu trên đĩa qua các lần khởi động; không chạy thêm `npm start` hoặc `npm run bot` riêng khi chế độ local đã bật.

Nếu chỉ muốn chạy chung bằng terminal, dùng `npm run local`. Các hướng dẫn lệnh riêng bên dưới dùng cho kiểm tra hoặc vận hành thủ công.

## 1. Cài đặt

```powershell
npm install
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

Chrome sẽ mở. Đăng nhập như bình thường; khi bảng **Đăng ký tham gia** xuất hiện, quay lại terminal và nhấn Enter. Cookie phiên chỉ được lưu cục bộ trong `.auth/` và đã được bỏ khỏi Git.

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

## Telegram nhanh

Sau khi cấu hình token và chat ID, chạy `npm run bot` để trả lời `/start`, `/status`, `/events` và `/help`. Phần nhận lệnh hoạt động độc lập với bộ theo dõi IUH (`npm start`). Muốn nhận thông báo hoạt động mới, cần chạy bộ theo dõi sau khi đăng nhập IUH. Cả hai tiến trình cần tiếp tục chạy trên máy tính.

1. Nhắn `@BotFather`, tạo bot và lấy token.
2. Nhắn một tin bất kỳ cho bot vừa tạo.
3. Mở `https://api.telegram.org/bot<TOKEN>/getUpdates` để xem `chat.id`.
4. Điền token và chat ID vào `.env`.

Không chia sẻ `.env`, token Telegram, Discord webhook hay thư mục `.auth/`.
