# Cài bot IUH trên máy Windows mới

## Chuyển cùng bot Telegram sang máy mới

1. Trên máy cũ, mở **Tắt bot.cmd** để dừng bot và tắt tự khởi động. Chỉ chạy một máy cho cùng token Telegram.
2. Chép file ZIP cài đặt sang máy mới. Giải nén toàn bộ vào thư mục cố định, ví dụ `D:\IUH-Bot`. Không chạy trực tiếp trong ZIP.
3. Nếu muốn giữ token và chat ID hiện tại, chép riêng file `.env` từ máy cũ vào thư mục vừa giải nén bằng cách chuyển tệp riêng tư. Đây là tùy chọn; gói ZIP không chứa token, phiên đăng nhập hay log.
4. Nhấp đúp **Cai-dat-may-moi.bat**. Chạy bằng tài khoản Windows bạn dùng hằng ngày; không cần chủ động chọn Run as administrator. Nếu trình cài Node.js/Chrome yêu cầu quyền Windows, bạn tự xác nhận cửa sổ đó.
5. Nếu chưa có `.env`, dán token BotFather khi được hỏi. Dữ liệu nhập được ẩn. Gửi `/start` vào bot; trình cài tự lấy và lưu chat ID. Nếu bot đã có webhook hoặc nhận lệnh ở nơi khác, cần dùng đúng cấu hình/ứng dụng hiện có trước khi chạy tiếp.
6. Đăng nhập IUH và nhập CAPTCHA trong cửa sổ Chrome được mở. Khi bảng hoạt động xuất hiện, phiên tự lưu.
7. Chờ thông báo hoàn tất. Gửi `/status` hoặc `/events` trên Telegram để kiểm tra.

## File BAT tự làm gì?

- Kiểm tra Node.js và Chrome. Nếu thiếu, dùng WinGet để cài Node.js LTS và Google Chrome.
- Cài đúng các thư viện trong `package-lock.json` bằng `npm ci`.
- Tạo `.env` nếu chưa có, giữ token đã nhập, đặt chu kỳ 60 giây và đường dẫn Chrome trên máy mới.
- Kiểm tra token, lưu chat ID và gửi một tin thử Telegram.
- Mở Chrome để lưu phiên IUH, rồi tạo mốc danh sách hiện tại. Không gửi hàng loạt sự kiện cũ.
- Cài tác vụ `IUH-DRL-Local`, chạy ẩn không mở PowerShell/Terminal và tự chạy khi bạn đăng nhập Windows.

Máy cần có Internet. Nếu máy không có WinGet, cài [Node.js LTS](https://nodejs.org/) và [Google Chrome](https://www.google.com/chrome/) thủ công, rồi mở lại BAT. BAT sẽ báo bước lỗi và có thể chạy lại; không xóa `.env` hay lịch sử khi chạy lại.

## Dùng hằng ngày

- **Bật bot.cmd**: bật chạy nền và tự khởi động Windows.
- **Tắt bot.cmd**: dừng bot và tắt tự khởi động; giữ dữ liệu.
- Telegram `/dangnhap`: mở Chrome trên máy đang chạy bot để đăng nhập lại và nhập CAPTCHA; bot tự nhắn kết quả khi lưu phiên xong.
- **Đăng nhập IUH.cmd**: cách dự phòng nếu bạn không muốn kích hoạt đăng nhập từ Telegram.
- Telegram `/status`: tình trạng phiên, lần kiểm tra gần nhất và chu kỳ 60 giây.
- Telegram `/events`: danh sách lấy gần nhất, kèm thời điểm lấy.

Máy tắt, sleep hoặc mất mạng sẽ tạm dừng việc kiểm tra. Phiên IUH có thể hết hạn theo chính sách của trường; khi cần đăng nhập/CAPTCHA lại, bot sẽ thông báo.

Giữ nguyên vị trí thư mục sau khi cài vì tác vụ Windows dùng đường dẫn tuyệt đối. Muốn đổi vị trí trên cùng máy, tắt bot ở thư mục cũ trước. Nếu task còn trỏ về thư mục cũ, trình cài sẽ dừng để tránh ghi đè một bản cài khác.

## Kiểm tra máy mà không thay đổi cấu hình

```powershell
.\Cai-dat-may-moi.bat -CheckOnly
```

Lệnh này chỉ kiểm tra Node, Chrome, WinGet và sự hiện diện của cấu hình; không cài phần mềm, gửi Telegram hay đổi tác vụ Windows.

Có thể cài phần chạy nền trước và đăng nhập sau bằng `Cai-dat-may-moi.bat -SkipLogin`.

## Gói cài đặt và thông tin riêng tư

ZIP dùng danh sách file cho phép: mã nguồn, scripts, hướng dẫn, file mẫu và lockfile. Nó không đóng gói `.env`, `.auth`, `data`, `node_modules` hoặc các file log. Token chỉ nhập trên máy sử dụng bot. Cần chuyển cả ZIP, không chỉ file BAT vì BAT cần mã nguồn và các script đi kèm.

Nguồn cách cài phần mềm: [Microsoft WinGet install](https://learn.microsoft.com/en-us/windows/package-manager/winget/install). Trình cài dùng ID chính xác và không tắt kiểm tra chữ ký/hash của WinGet.
