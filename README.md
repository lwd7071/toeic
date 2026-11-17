# Miu TOEIC

Web học từ vựng, ngữ pháp và listening TOEIC với Next.js, Firebase và Vercel.

## Chạy tại máy

1. Điền các biến Firebase Web SDK và `ADMIN_GOOGLE_EMAIL` vào `.env.local`.
2. Cài thư viện bằng `npm install`, rồi chạy `npm run dev`.
3. Để dùng Firebase thật, cấu hình `FIREBASE_SERVICE_ACCOUNT_JSON` bằng toàn bộ JSON service account trong biến môi trường máy chủ. Không đặt khóa này vào biến `NEXT_PUBLIC_*` hoặc commit vào Git.
4. Bật Google Sign-In và tạo Firestore trong Firebase Console. Thêm domain triển khai vào danh sách domain được phép của Firebase Auth.

Không có service account, trang giới thiệu vẫn dựng được nhưng đăng nhập/session và dữ liệu sẽ chưa hoạt động.

## Firebase Emulator

Chạy `npm run emulators`. Emulator dùng project giả `demo-miu-toeic`, không đọc hay ghi Firestore thật. Mở PowerShell thứ hai trong thư mục dự án:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-miu-toeic'
$env:ADMIN_GOOGLE_EMAIL = 'admin@example.com'
npm run dev
```

Đăng nhập Google giả bằng `admin@example.com` trong Auth Emulator để thử quyền quản trị; dùng email khác để thử quyền học viên. Firebase Emulator UI ở `http://127.0.0.1:4000`. Khi vừa khởi động Emulator với dữ liệu trống, có thể chạy kiểm tra giao diện và API:

```powershell
npm test
.\node_modules\.bin\playwright-cli.cmd open http://localhost:3000
.\node_modules\.bin\playwright-cli.cmd run-code --filename scripts\smoke-emulator.js
```

Để thử truy vấn trên 3.000 thẻ và kiểm tra công cụ đối chiếu, đặt `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` và `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-miu-toeic`, rồi chạy `node scripts/smoke-reads-emulator.mjs`, `node scripts/reconcile-counts.mjs check`, `node scripts/reconcile-counts.mjs repair`, và `check` lại. Lệnh `check` đầu tiên trả mã 1 khi thấy bộ đếm thử nghiệm cố tình để lệch.

## Tài khoản Bot quản lý bài học

1. Trong Firebase Console > Authentication, bật phương thức **Email/Password** và tạo một tài khoản chỉ dành cho Bot. Tên đăng nhập là email của tài khoản này; không dùng Gmail cá nhân hay tài khoản Google của admin.
2. Sao chép **UID** của tài khoản vừa tạo vào `BOT_FIREBASE_UID` trong `.env.local` và cấu hình cùng biến này trên Vercel. Chỉ UID đó với phương thức đăng nhập bằng mật khẩu mới có role Bot.
3. Mở `/bot/login` để đăng nhập. Bot được tạo, sửa và nhập nội dung tại `/admin`, `/admin/listening`; Bot không được xem lịch học viên, dùng API học viên, hoặc ẩn/khôi phục nội dung. Trang đăng nhập này không có liên kết từ trang công khai; quyền vẫn được kiểm tra trên máy chủ.
4. Khi cần ngắt quyền, xóa `BOT_FIREBASE_UID` khỏi cấu hình triển khai và thu hồi phiên của UID đó trong Firebase Authentication. Đổi mật khẩu đơn lẻ không thay thế việc thu hồi phiên.

Chỉ nhập mật khẩu vào trang đăng nhập hoặc hộp thông tin bảo mật chính thức của Muse; không gửi trong chat. Role Bot dùng giao diện quản trị hiện có, chưa thiết lập lịch chạy hằng ngày trong Muse.

## File CSV

- Flashcard: `english,vietnamese`
- Ngữ pháp: `question,A,B,C,D,correct_answer,explanation`
- Nghe chép: `audio_url,transcript`
- Mô tả tranh: `image_url,audio_url,A,B,C,D,correct_answer`

File UTF-8 (có BOM cũng được), tối đa 1 MB và 200 dòng. Câu ngữ pháp cần đúng một dấu `____`. Xem trước và sửa toàn bộ lỗi trước khi xác nhận nhập. Mỗi lần nhập được ghi toàn bộ hoặc không ghi gì.

Listening: admin tải ảnh và MP3 lên Google Drive, bật quyền **Bất kỳ ai có đường liên kết – Người xem** cho từng file, rồi dán link **từng file** dạng `https://drive.google.com/file/d/FILE_ID/view` vào CSV (không dùng link thư mục). Tạo bài ở `/admin/listening`, chọn dạng bài trước khi nhập CSV. App dùng trình xem nhúng của Drive để hiển thị ảnh và phát MP3; hãy thử từng câu trong trang xem trước trước khi nhập. Nên dùng ảnh tối đa 5 MiB và MP3 tối đa 25 MiB. Vì app chỉ nhận link, app không kiểm tra được dung lượng hoặc bảo đảm Drive sẽ luôn phát trực tiếp. Chỉ kết quả bài đã nộp mới được lưu vào Tiến độ.

## Triển khai Vercel

### Chuyển sang bộ đếm và truy vấn có giới hạn

Phiên bản này cần index và bộ đếm trước khi đưa API mới lên production. Sau khi quota Firestore đặt lại, tạm dừng nhập/sửa/ẩn nội dung trong lúc chuyển dữ liệu. Nếu dữ liệu cũ chưa có bài tập ngữ pháp, chạy `node scripts/migrate-grammar-exercises.mjs` trước bước đối chiếu bộ đếm:

1. Triển khai index bằng `firebase deploy --only firestore:indexes --project <firebase-project-id>` và đợi tất cả index ở trạng thái **Enabled**.
2. Trong môi trường có `NEXT_PUBLIC_FIREBASE_PROJECT_ID` và một trong hai biến `FIREBASE_SERVICE_ACCOUNT_JSON` hoặc `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file ADC, chạy `node scripts/reconcile-counts.mjs check` để xem chênh lệch. Lệnh này thoát với mã 1 nếu có chênh lệch và không ghi dữ liệu.
3. Chạy `node scripts/reconcile-counts.mjs repair`, rồi chạy `check` lần nữa đến khi không còn chênh lệch. Chỉ sau đó mới triển khai ứng dụng và cho phép nhập/sửa trở lại.

Giữ script để chạy `check` định kỳ hoặc sau khi sửa dữ liệu trực tiếp trong Firestore Console. `repair` đọc toàn bộ nội dung một lần nên cũng tiêu tốn Reads; chạy khi còn đủ quota. Nếu sửa dữ liệu trực tiếp sau triển khai, cache nội dung chung có thể còn cũ qua request đầu sau mốc 15 phút trong lúc làm mới ở nền; quản trị không dùng cache. Thao tác qua app vô hiệu hóa cache ngay sau khi ghi thành công.

### Chuyển bộ flashcard sang một tài liệu mỗi chủ đề

Phiên bản gộp thẻ cần chuyển dữ liệu **trước khi triển khai ứng dụng mới**. Tạm ngừng ghi từ cả admin lẫn học viên trong suốt quá trình; chỉ mở lại sau khi triển khai xong. Dùng đúng `NEXT_PUBLIC_FIREBASE_PROJECT_ID` của production và service account hoặc ADC như phần đối chiếu bộ đếm ở trên:

1. Chạy `node scripts/reconcile-counts.mjs check`; nếu lệch, sửa bằng `repair` rồi `check` lại.
2. Chạy `node scripts/migrate-vocab-decks.mjs check`. Mã thoát 1 nghĩa là còn tài liệu cần chuyển hoặc có lỗi cần xử lý. Chủ đề gần 1 MiB phải chia nhỏ trước khi tiếp tục.
3. Chạy `node scripts/migrate-vocab-decks.mjs migrate`. Script ghi bản sao JSON của các collection liên quan vào `.migration-backups/` **trước khi ghi Firebase**; giữ bản sao này ở nơi an toàn vì chứa tiến độ người học.
4. Chạy `node scripts/migrate-vocab-decks.mjs check` đến khi báo 0 lỗi và 0 tài liệu cần cập nhật, rồi triển khai ứng dụng mới. Không xóa `vocabCards` hoặc `cardProgress`.

Mỗi file CSV vẫn tối đa 200 dòng; có thể nhập thêm file vào cùng chủ đề khi tài liệu bộ thẻ còn dưới ngưỡng kích thước. API học viên đọc bộ thẻ và một tài liệu tiến độ; lần mở khi cache nội dung trống cần hai lượt đọc Firestore.

Trước khi triển khai phiên bản có nhiều bài tập ngữ pháp trên dữ liệu cũ, chạy một lần `node scripts/migrate-grammar-exercises.mjs` với `NEXT_PUBLIC_FIREBASE_PROJECT_ID` và một trong hai cách xác thực trên. Script tạo “Bài tập 1” cho mỗi bài ngữ pháp cũ và gắn các câu hỏi cũ vào đó; chạy lại không tạo trùng. Lượt làm bài và câu trả lời cũ được giữ nguyên.

Đưa các biến trong `.env.local` vào Vercel Project Settings, cộng thêm `FIREBASE_SERVICE_ACCOUNT_JSON` là bí mật máy chủ. Đặt `STUDY_TRACKING_START_DATE` thành ngày tính năng lịch học bắt đầu hoạt động theo giờ Việt Nam (`YYYY-MM-DD`); các ngày trước đó hiển thị là chưa theo dõi. Triển khai Firestore Rules từ `firestore.rules` bằng `firebase deploy --only firestore:rules --project <firebase-project-id>` để khóa truy cập trực tiếp từ client. Sau khi có domain Vercel, thêm domain đó vào Firebase Auth Authorized domains. Không triển khai bản thật trước khi đã bật Google Sign-In, tạo Firestore và cấu hình service account.
