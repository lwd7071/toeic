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

## File CSV

- Flashcard: `english,vietnamese`
- Ngữ pháp: `question,A,B,C,D,correct_answer,explanation`
- Nghe chép: `audio_url,transcript`
- Mô tả tranh: `image_url,audio_url,A,B,C,D,correct_answer`

File UTF-8 (có BOM cũng được), tối đa 1 MB và 200 dòng. Câu ngữ pháp cần đúng một dấu `____`. Xem trước và sửa toàn bộ lỗi trước khi xác nhận nhập. Mỗi lần nhập được ghi toàn bộ hoặc không ghi gì.

Listening: admin tải ảnh và MP3 lên Google Drive, bật quyền **Bất kỳ ai có đường liên kết – Người xem** cho từng file, rồi dán link file vào CSV. Tạo bài ở `/admin/listening`, chọn dạng bài trước khi nhập CSV. Trang xem trước cho thử ảnh và MP3; nếu media không phát trong trình duyệt thì không nên nhập bài đó. Nên dùng ảnh tối đa 5 MiB và MP3 tối đa 25 MiB. Vì app chỉ nhận link, app không kiểm tra được dung lượng hoặc bảo đảm Drive sẽ luôn phát trực tiếp. Chỉ kết quả bài đã nộp mới được lưu vào Tiến độ.

## Triển khai Vercel

Đưa các biến trong `.env.local` vào Vercel Project Settings, cộng thêm `FIREBASE_SERVICE_ACCOUNT_JSON` là bí mật máy chủ. Triển khai Firestore Rules từ `firestore.rules` bằng `firebase deploy --only firestore:rules --project <firebase-project-id>` để khóa truy cập trực tiếp từ client. Sau khi có domain Vercel, thêm domain đó vào Firebase Auth Authorized domains. Không triển khai bản thật trước khi đã bật Google Sign-In, tạo Firestore và cấu hình service account.
