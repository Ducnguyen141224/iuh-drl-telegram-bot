# Kế hoạch bot Telegram thông báo hoạt động điểm rèn luyện IUH

Ngày lập: 11/10/2026, múi giờ Asia/Saigon.

Cập nhật triển khai cùng ngày: đã kết nối bot Telegram, lưu phiên IUH, xác minh đọc được bảng hoạt động thực tế. Đã có chế độ local quản lý hai tiến trình, tự phục hồi tiến trình con, lưu phiên mới sau các lần thu thập, hàng đợi thông báo và lịch sử ID. Cấu hình khởi động khi đăng nhập Windows bằng tác vụ IUH-DRL-Local. Các mục bên dưới là kế hoạch ban đầu; `/pause` và `/resume` vẫn là phần dự kiến.

Lựa chọn của người dùng: tạo bot Telegram mới dành riêng. Phạm vi bản đầu: một tài khoản IUH, một người nhận Telegram, thông báo hoạt động vừa xuất hiện và hoạt động mở lại đăng ký.

## Kết quả khảo sát và giới hạn đã xác minh

Firecrawl đã cào trực tiếp URL Tra cứu với `maxAge: 0`. Kết quả HTTP 200 có tiêu đề **Đăng nhập**, URL cuối là `https://doantn.iuh.edu.vn/login.html`; HTML có MSSV, mật khẩu và CAPTCHA. Chưa lấy được bản ghi hoạt động qua Firecrawl. Kết quả rút gọn được lưu ở `docs/firecrawl-observation.json`.

Lần khảo sát bằng Computer Use trước đó, trong Chrome đã đăng nhập, xác định bảng `table.tblDoanvien` và ID hoạt động trong `data-target="#myModal_<id>"`. Đây là bằng chứng từ phiên Chrome trước đó, không phải dữ liệu Firecrawl vừa lấy.

Đề xuất triển khai: dùng Firecrawl cho khảo sát; bộ thu thập vận hành dùng Playwright và phiên IUH lưu cục bộ. Plugin Firecrawl trong cuộc chat không tự trở thành dịch vụ chạy bên trong bot. Nếu muốn dùng Firecrawl làm bộ thu thập chính, cần một bước thử nghiệm riêng về phiên đăng nhập phía Firecrawl/API và kiểm chứng trả về bảng hoạt động trước khi chọn kiến trúc đó. Hiện chưa xác minh được hướng này với IUH.

## Luồng vận hành

```text
Phiên IUH đã đăng nhập
        ↓
Đọc bảng hoạt động mỗi 60 giây
        ↓
Kiểm tra trang hợp lệ → Chuẩn hóa dữ liệu → So sánh lịch sử
        ↓
Lưu thông báo vào hàng đợi bền vững
        ↓
Gửi Telegram → Ghi nhận kết quả từng thông báo
```

Chu kỳ 60 giây (1 phút) đã được chọn theo yêu cầu người dùng. Thời gian nhận tin bằng thời gian chờ lần kiểm tra tiếp theo cộng thời gian tải trang và gửi tin; chưa có phép đo để cam kết độ trễ thực tế. Với 60 giây, số lượt kiểm tra lý thuyết là 1.440/ngày. Khi IUH lỗi hoặc giới hạn truy cập, tăng khoảng chờ thay vì kiểm tra liên tục.

## Bước 1 — Tạo bot và kết nối người nhận

1. Người dùng mở [BotFather](https://t.me/BotFather), gửi `/newbot`, chọn tên và username theo hướng dẫn.
2. Điền token vào `TELEGRAM_BOT_TOKEN` trong `.env` cục bộ.
3. Mở bot mới, nhấn Start hoặc gửi `/start`.
4. Bổ sung lệnh thiết lập để kiểm tra token bằng `getMe`, xác định `chat_id` từ tin `/start`, rồi lưu `TELEGRAM_CHAT_ID`.
5. Gửi một tin thử có nhãn kiểm tra kết nối và xác nhận điện thoại nhận được.

Với bot mới, dùng `getUpdates` để nhận lệnh; lưu offset đã xử lý. Telegram quy định `getUpdates` và webhook loại trừ nhau. Tham khảo [hướng dẫn tạo bot](https://core.telegram.org/bots/tutorial) và [Bot API](https://core.telegram.org/bots/api#getupdates).

Điều kiện hoàn tất: nhận đúng danh tính bot và một tin thử tại chat riêng đã chọn. Token chỉ nằm trong `.env`; không đưa token vào tài liệu, ảnh hoặc log.

## Bước 2 — Xác minh thu thập dữ liệu thật

- Chạy `npm run login`, người dùng tự đăng nhập IUH và nhập CAPTCHA trong Chrome được mở.
- Lưu phiên vào `.auth/iuh-storage-state.json`; kiểm tra lại phiên bằng một browser context mới.
- Đọc bảng đăng ký và chỉ lấy các trường hoạt động: ID, tên, học kỳ, điểm, hạn, số lượng hiện tại/tối đa, trạng thái và chi tiết cần thiết.
- Nhận diện trang đăng nhập trước khi xử lý dữ liệu. HTTP 200 không đủ để kết luận thu thập thành công.
- Phân biệt bảng rỗng hợp lệ với bảng mất do thay đổi giao diện/lỗi tải.
- Kiểm tra thêm mẫu hoạt động đang còn chỗ; trước đây mới quan sát được một dòng đã đủ số lượng nên logic nhận diện nút đăng ký chưa được xác minh thực tế.

Điều kiện hoàn tất: kết quả đọc khớp bảng trên trình duyệt, không lẫn thông tin hồ sơ sinh viên.

## Bước 3 — Hoàn thiện chống báo trùng và hàng đợi

Mã hiện có là bản nền, cần các thay đổi sau trước khi chạy lâu dài:

| Trường hợp | Hành vi cần đạt |
| --- | --- |
| Khởi chạy lần đầu | Lưu mốc, mặc định không báo các hoạt động hiện có |
| Mốc ban đầu không có hoạt động | Hoạt động đầu tiên xuất hiện sau đó vẫn được báo |
| ID chưa từng gặp | Lưu và tạo một thông báo hoạt động mới |
| Chỉ thay đổi số lượng đăng ký | Cập nhật dữ liệu, không báo hoạt động mới |
| Hết chỗ rồi mở lại | Tạo thông báo mở lại theo một lần chuyển trạng thái đã xác nhận |
| Hoạt động biến mất rồi xuất hiện lại | Giữ lịch sử ID để tránh xem là hoạt động hoàn toàn mới |
| Bot khởi động lại | Khôi phục mốc và hàng đợi từ đĩa |
| Gửi một phần rồi lỗi | Chỉ thử lại các tin chưa ghi nhận gửi thành công |
| Trạng thái không rõ | Đánh dấu chưa xác định; không suy ra mở lại đăng ký |

Bản đầu dùng một file trạng thái JSON ghi thay thế nguyên tử, chứa `seenEvents`, `latestEvents`, `pendingNotifications`, `sentNotifications` và thời điểm kiểm tra thành công. Giữ lịch sử xuyên suốt năm học, không chỉ giữ các dòng đang xuất hiện. Mỗi thông báo có khóa riêng theo hoạt động và lần chuyển trạng thái. Chỉ chạy một tiến trình theo dõi bằng khóa tiến trình.

Khi Telegram mất mạng, giữ hàng đợi và thử lại với khoảng chờ tăng dần. Timeout sau khi Telegram nhận tin có thể dẫn đến gửi lại vì phía gửi chưa biết kết quả; thiết kế này giảm báo trùng, không cam kết tuyệt đối một lần trong mọi sự cố mạng.

Điều kiện hoàn tất: thử tình huống mới, đầy chỗ, mở lại, biến mất, bảng rỗng, restart và gửi lỗi mà vẫn giữ đúng lịch sử.

## Bước 4 — Hoàn thiện trải nghiệm Telegram

Mẫu dưới đây là minh họa định dạng, không phải hoạt động mới được Firecrawl phát hiện:

```text
🎯 Có hoạt động điểm rèn luyện mới

[Tên hoạt động]
Điểm: 2
Học kỳ: 1/2026–2027
Số lượng: 12/100 — còn 88 chỗ
Hạn đăng ký: [ngày]
Trạng thái: Đang mở đăng ký

[Nút: Mở trang đăng ký IUH]
```

Nút mở URL Tra cứu chính thức; phiên đăng nhập trên điện thoại có thể cần đăng nhập riêng. Giới hạn phần chi tiết để giữ tin gọn, không đưa cookie hoặc hồ sơ cá nhân vào tin.

Các lệnh dự kiến cho bản đầu: `/status` xem lần kiểm tra thành công gần nhất và tình trạng phiên; `/events` xem danh sách gần nhất kèm thời điểm lấy; `/pause` và `/resume` tạm dừng/tiếp tục theo dõi. Chỉ chat ID chủ bot được dùng lệnh. Nội dung lấy từ website luôn được xử lý như dữ liệu.

## Bước 5 — Xử lý lỗi và chạy liên tục

- Mạng/website lỗi: tăng khoảng chờ 60 → 120 → 240 → 300 giây; trở về chu kỳ thường khi phục hồi.
- Hết phiên IUH: giữ lịch sử, báo một lần khi Telegram gửi được, chuyển trạng thái cần đăng nhập lại; kiểm tra lại sau khi người dùng cập nhật phiên.
- Mất bảng/thay đổi cấu trúc: báo lỗi thu thập; không ghi đè mốc bằng danh sách rỗng giả.
- Telegram lỗi: đặt timeout, đọc kết quả API, xử lý yêu cầu chờ rồi thử lại, che token trong lỗi.
- Chạy thử trên Windows hiện tại bằng `npm start`; máy phải đang hoạt động và có mạng.
- Sau khi thử ổn định, cấu hình Windows Task Scheduler với đúng thư mục làm việc, khởi chạy lại khi lỗi và ngăn hai bản cùng chạy. Nếu cần máy cá nhân tắt mà bot vẫn hoạt động, chuyển sang máy chủ chạy liên tục và xác minh cách đăng nhập lại IUH tại đó.

Điều kiện hoàn tất: chạy thử ít nhất một ngày, không báo trùng vô cớ, khôi phục sau restart và ghi nhận thời điểm kiểm tra cuối. Nếu chưa có hoạt động mới thật trong thời gian thử, ghi rõ chỉ xác minh luồng bằng dữ liệu giả lập; chưa coi đó là kiểm chứng sự kiện thực tế.

## Phần đã có và phần cần làm

| Thành phần | Hiện tại | Tiếp theo |
| --- | --- | --- |
| Bộ đọc IUH | `src/browser.js`, Playwright | Xác minh phiên thật và mẫu còn chỗ |
| Đăng nhập thủ công | `src/login.js` | Xác minh phiên dùng lại và hết hạn |
| So sánh sự kiện | `src/core.js` | Giữ lịch sử ID, trạng thái chưa rõ |
| Gửi Telegram | `src/notifier.js`, gửi văn bản | Thiết lập bot, nút URL, timeout và retry |
| Vòng theo dõi | `src/index.js`, chu kỳ cấu hình được | Hàng đợi bền vững, khóa tiến trình, backoff |
| Nhận lệnh Telegram | Chưa có | Bộ nhận lệnh và giới hạn chủ bot |
| Vận hành liên tục | Hiện chạy bằng terminal | Task Scheduler sau kiểm thử thực tế |

Thứ tự triển khai: tạo bot/nhận tin thử → kiểm chứng dữ liệu IUH thật → sửa lịch sử và hàng đợi → thêm lệnh Telegram → thử sự cố và chạy liên tục. Chưa tạo bot ngoài Telegram, chưa cấu hình token và chưa gửi tin thử trong lượt lập kế hoạch này.

## Nguồn

- [Trang Tra cứu IUH](https://doantn.iuh.edu.vn/doanvien.html@211@Tra-cuu): Firecrawl chuyển về trang đăng nhập, quan sát ngày 11/10/2026.
- [Firecrawl Scrape](https://docs.firecrawl.dev/features/scrape): tài liệu công cụ khảo sát.
- [Telegram: tạo bot](https://core.telegram.org/bots/tutorial).
- [Telegram Bot API](https://core.telegram.org/bots/api): đối chiếu trực tiếp sau khi Firecrawl báo không hỗ trợ domain tài liệu Telegram qua kết nối này.
