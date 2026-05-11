# Hướng dẫn Sử dụng Module Trí tuệ Hàng hải AI (Maritime Intelligence)

Module Trí tuệ Hàng hải AI là công cụ cung cấp cái nhìn toàn cảnh và chuyên sâu về luồng giao thông hàng hải, giúp tối ưu hóa công tác điều hành tại cụm cảng (VD: Lạch Huyện - Cát Hải - Hải Phòng).

## Cách Truy Cập
1. Mở trang chủ VMS (Bản đồ chính).
2. Nhấn vào nút **"🧠 Trí tuệ AI"** ở góc trên cùng bên phải thanh công cụ (TopBar).
3. Giao diện Dashboard Trí tuệ Hàng hải sẽ xuất hiện với 5 thẻ chức năng (Tabs).

---

## 1. Thẻ "Tổng quan" (Overview)
Nơi cung cấp bức tranh toàn cảnh về hoạt động cảng trong ngày.
- **KPI Bar**: Dải chỉ số nằm trên cùng, hiển thị các thông tin nóng nhất: 
  - *Sản lượng hôm nay*: Tổng số hàng hóa (tính bằng tấn) dự kiến được bốc dỡ, kèm mũi tên so sánh với ngày trước đó.
  - *Thời gian chờ TB*: Thời gian trung bình một tàu phải đợi tại vùng neo trước khi được cấp lệnh cập bến.
  - *Chỉ số tắc nghẽn*: Chỉ số nguy cơ ách tắc. Dưới 40% là Bình thường (Xanh), từ 40% - 70% là Trung bình (Vàng), trên 70% là Tắc nghẽn cao (Đỏ).
- **Phân loại đội tàu**: Thống kê danh sách các tàu đang hoạt động theo từng nhóm (Container, Hàng rời, Tàu lai...) bằng biểu đồ thanh ngang trực quan.
- **Cảnh báo đang mở**: Số lượng các vụ việc cần sự chú ý của người điều hành.
- **Biểu đồ Dự báo 7 Ngày**: Đường dự báo sản lượng bốc dỡ trong tuần tới để Ban giám đốc có cơ sở bố trí nhân sự và xe nâng.

## 2. Thẻ "Dự báo AI" (AI Forecast)
Cung cấp biểu đồ và bảng dữ liệu chuyên sâu do AI tính toán.
- **Chuyển đổi thời gian**: Nhấn nút `7 ngày` hoặc `30 ngày` ở góc phải biểu đồ để xem dự báo ngắn hạn hoặc trung hạn.
- **Khoảng tin cậy (Confidence Interval)**: Bảng dữ liệu phía dưới sẽ hiển thị dải sản lượng cao nhất và thấp nhất có thể xảy ra, giúp tính toán rủi ro biến động.

## 3. Thẻ "Mật độ" (Density/Heatmap)
- **Bản đồ Nhiệt (Heatmap)**: Tự động tổng hợp vị trí hàng ngàn tàu thuyền từ dữ liệu quá khứ. Màu đỏ/cam thể hiện khu vực có mật độ tàu cực cao (thường là luồng lạch hẹp hoặc khu chờ neo). Màu xanh là khu vực thông thoáng.
- **Vùng nhận diện**: Các đường nét đứt trên bản đồ đánh dấu ranh giới các cảng và khu neo đậu (VD: Neo Cát Hải, Cảng Lạch Huyện).

## 4. Thẻ "Cảnh báo" (Anomalies / Alerts)
Theo dõi các rủi ro hoạt động do AI tự động phát hiện.
- Hệ thống có 3 cấp độ: 🔴 **Nghiêm trọng** (Critical), 🟡 **Cảnh báo** (Warning), và 🔵 **Thông tin** (Info).
- Nếu khu vực neo đậu có số lượng tàu vượt ngưỡng, hệ thống tự động sinh ra cảnh báo Tắc nghẽn.
- **Hành động xử lý**: Với mỗi thẻ cảnh báo, bạn có thể nhấn **"Ghi nhận"** (Acknowledge - đang xử lý) hoặc **"Đóng"** (Resolve - đã giải quyết xong) để quản lý tiến độ xử lý rủi ro.

## 5. Thẻ "Neo đậu" (Anchorage)
Giám sát công suất của các khu vực bến bãi.
- **Trạng thái từng vùng**: Hiển thị thanh tiến trình (Progress bar) cho biết khu vực đó đã lấp đầy bao nhiêu phần trăm sức chứa.
- **Thời gian chờ (Waiting Time)**: Biểu đồ cột bên dưới cho thấy sự phân bổ thời gian neo đậu của các tàu (bao nhiêu tàu phải chờ dưới 12h, bao nhiêu tàu phải chờ quá 48h).

---

## Mẹo sử dụng (Tips)
- Dashboard tự động cập nhật dữ liệu mới mỗi 60 giây.
- Bạn có thể nhấn nút `[Refresh]` (biểu tượng vòng xoay cạnh đồng hồ trên TopBar) để tải lại dữ liệu thủ công nếu cần.
- Nếu muốn quay lại bản đồ theo dõi tàu trực tiếp, nhấn **"Bản đồ chính"** ở góc phải trên cùng.
