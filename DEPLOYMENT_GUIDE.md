# HƯỚNG DẪN TRIỂN KHAI DỰ ÁN (GITHUB & VERCEL)

Tài liệu này hướng dẫn bạn cách đưa mã nguồn dự án Vessel Monitoring System (VMS) lên GitHub và triển khai trực tuyến trên nền tảng Vercel để có thể truy cập từ bất kỳ đâu.

---

## Giai đoạn 1: Đưa mã nguồn lên GitHub

### 1. Tạo Repository trên GitHub
1. Truy cập [github.com](https://github.com/) và đăng nhập.
2. Bấm vào dấu **+** ở góc trên bên phải $\rightarrow$ chọn **New repository**.
3. Đặt tên Repository: `vms-production` (hoặc tên tùy ý).
4. Chọn **Public** hoặc **Private** tùy nhu cầu.
5. **Lưu ý**: Không tích vào "Initialize this repository with a README" (vì chúng ta đã có code sẵn).
6. Bấm **Create repository**.

### 2. Đẩy code từ máy tính lên GitHub
Mở Terminal tại thư mục `VMS` và chạy các lệnh sau:

```bash
# Khởi tạo git (nếu chưa có)
git init

# Thêm tất cả các file vào khu vực chờ (Stage)
git add .

# Ghi nhận phiên bản đầu tiên
git commit -m "Initial commit: VMS system with AI and Route Optimization"

# Đổi tên nhánh chính thành main
git branch -M main

# Kết nối với Repo trên Github (Thay [username] bằng tên của bạn)
git remote add origin https://github.com/[username]/vms-production.git

# Đẩy code lên mây
git push -u origin main
```

> [!WARNING]
> File `.env.local` chứa các khóa bảo mật của Supabase đã được liệt kê trong `.gitignore` nên sẽ **không** bị đẩy lên GitHub. Đây là quy chuẩn bảo mật quan trọng.

---

## Giai đoạn 2: Triển khai dự án lên Vercel

### 1. Kết nối GitHub với Vercel
1. Truy cập [vercel.com](https://vercel.com/) và đăng nhập bằng tài khoản GitHub.
2. Tại Dashboard, bấm **Add New...** $\rightarrow$ chọn **Project**.
3. Danh sách các Repo trên GitHub sẽ hiện ra. Tìm `vms-production` và bấm **Import**.

### 2. Cấu hình dự án (Quan trọng)
Trong phần **Configure Project**, bạn cần chú ý các mục sau:

- **Framework Preset**: Next.js (Hệ thống sẽ tự nhận diện).
- **Environment Variables**: Bạn phải copy các giá trị từ file `.env.local` ở máy tính vào đây:
  - Tên: `NEXT_PUBLIC_SUPABASE_URL` | Giá trị: (Dán URL từ Supabase của bạn)
  - Tên: `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Giá trị: (Dán Anon Key từ Supabase của bạn)

Bấm **Add** cho từng biến môi trường.

### 3. Nhấn Deploy
1. Bấm nút **Deploy**.
2. Vercel sẽ bắt đầu Build dự án (thường mất 1-2 phút).
3. Sau khi hoàn tất, bạn sẽ nhận được một đường dẫn URL (ví dụ: `https://vms-production.vercel.app`).

---

## Giai đoạn 3: Cập nhật và Bảo trì

Khi bạn có thay đổi code ở dưới máy tính và muốn trang web tự động cập nhật:

1. Thực hiện lệnh Git:
   ```bash
   git add .
   git commit -m "Mô tả thay đổi của bạn"
   git push origin main
   ```
2. Vercel sẽ tự động phát hiện thay đổi trên nhánh `main` và bắt đầu quá trình **Redeploy** ngay lập tức. Bạn không cần làm gì thêm trên trang chủ Vercel.

---

## Các lỗi thường gặp (Troubleshooting)

| Lỗi | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| **Error 500** khi gọi API | Thiếu biến môi trường | Kiểm tra lại phần Environment Variables trên Vercel. |
| **Build Failed** (Module not found) | Sai đường dẫn file | Đảm bảo các file JSON (như bản đồ) nằm trong `lib/data` và được import đúng. |
| **Bản đồ không hiện** | Lỗi thư viện Leaflet | Đảm bảo import CSS của Leaflet trong `_app.js` hoặc file Component. |

> [!TIP]
> Nếu bạn gặp lỗi khi Build trên Vercel, hãy mở tab **Deployments** $\rightarrow$ chọn lần Deploy bị lỗi $\rightarrow$ xem **Build Logs** để biết chính xác dòng code nào đang gây ra vấn đề.
