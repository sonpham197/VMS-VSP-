# Implementation Plan: AI Maritime Intelligence Module
**Date:** 2026-05-11

## 1. Mục tiêu (Objectives)
Thiết kế và phát triển Module Trí tuệ Hàng hải AI (AI Maritime Intelligence) tích hợp vào hệ thống Giám sát Tàu thuyền (VMS) hiện hữu. Mục tiêu chính nhằm cung cấp góc nhìn tổng quan và sâu sát về hoạt động của khu vực cảng, tối ưu hóa quá trình ra quyết định và nâng cao an toàn hàng hải.

## 2. Các hạng mục đã triển khai (Implemented Features)

### 2.1. Cấu trúc dữ liệu (Database Schema)
- Khởi tạo `maritime_intelligence_schema.sql` chạy trên Supabase.
- Các bảng mới: `ais_messages`, `port_zones`, `voyages`, `vessel_events`, `port_kpis`, `ai_forecasts`, `anomalies`.
- Tách biệt dữ liệu cụm AI (ais_messages) khỏi bảng core (vessel_tracks) để tối ưu hiệu năng.

### 2.2. Trí tuệ nhân tạo (AI Engine - `lib/maritimeAI.js`)
- **Dự báo sản lượng (Throughput Forecast)**: Sử dụng mô hình Gradient Boosting Decision Tree (mô phỏng bằng thuần JS) kết hợp với Time-series Trend Analysis để dự báo sản lượng và chỉ số tắc nghẽn 7-30 ngày tới.
- **Ước tính tải trọng (Cargo Estimation)**: Phân tích và nội suy khối lượng hàng hóa dựa trên các chỉ số `class_code`, `dwt` (Deadweight tonnage), `draft` (mớn nước thực tế) so với `max_draft_m`, kết hợp hệ số sử dụng (Utilization Factor).
- **Chỉ số Tắc nghẽn (Congestion Index)**: Tính toán theo trọng số mức độ lấp đầy vùng neo (Anchorage) và cầu bến (Berth).

### 2.3. Frontend Dashboard (`pages/maritime-intelligence.js`)
- **UI/UX**: Thiết kế theo phong cách Glassmorphism, tone màu Dark mode đặc trưng của VMS, bố cục dạng lưới linh hoạt.
- **KPI Bar**: Thống kê sản lượng, số lượng tàu vào ra, thời gian chờ trung bình, chỉ số tắc nghẽn theo thời gian thực.
- **Vessel Class Distribution**: Phân loại các nhóm tàu thành phần (Container, Hàng rời, Tàu dầu...) có kèm thanh Progress Bar so sánh tỷ lệ.
- **Heatmap (Mật độ AIS)**: Tích hợp thư viện `leaflet.heat` hiển thị biểu đồ nhiệt mật độ tàu thuyền hoạt động quanh cụm cảng Lạch Huyện - Cát Hải, hỗ trợ phát hiện các nút thắt cổ chai.
- **Anchorage Panel**: Hiển thị thẻ trạng thái công suất sức chứa của từng vùng neo, cảng biển.
- **Anomaly Feed**: Hệ thống hiển thị các cảnh báo thông minh theo phân cấp độ (Nghiêm trọng, Cảnh báo, Thông tin). Hỗ trợ xác nhận (Acknowledge) và đóng (Resolve) cảnh báo.

### 2.4. Data Simulation (`seed_maritime_demo.mjs`)
- Xây dựng hệ thống giả lập chuyên sâu tạo 100 tàu thực tế đa dạng (Container, Tàu lai, Hàng rời...).
- Giả lập hơn 11,000 bản ghi AIS rải rác trong 7 ngày, bao gồm lộ trình vào cảng, thời gian chờ neo, hoạt động trên bến và rời cảng.
- Script tự động đồng bộ (sync) tọa độ mới nhất của 100 tàu AI sang bảng `vessel_tracks` để hiển thị đồng thời trên Bản đồ chính.

## 3. Khắc phục lỗi (Troubleshooting)
- **SQL Policy**: Đã fix lỗi cú pháp `CREATE POLICY IF NOT EXISTS` của PostgreSQL bằng block `DO $$ BEGIN ... END $$`.
- **Generated Column**: Đã loại bỏ lỗi NULL đối với cột `GENERATED ALWAYS AS` cho `wait_hours` ở bảng `voyages`.
- **CSS Scoping**: Khắc phục lỗi hiển thị Progress bar do CSS Modules bị giới hạn phạm vi, sử dụng `<style jsx global>`.
- **Bản đồ Heatmap**: Tinh chỉnh mức zoom và tọa độ center để bao trọn vùng Vịnh Bắc Bộ và Hải Phòng.
- **Anomaly Detection**: Tăng khung thời gian kiểm tra từ 1 giờ lên 7 ngày và tích hợp cơ chế Deduplication để xử lý đúng dữ liệu demo.

## 4. Kế hoạch tiếp theo (Next Steps)
- Tích hợp pipeline AI thực tế chạy bằng Python (nếu cần thiết) và kết nối thông qua REST API, thay thế mô hình XGBoost thuần JS.
- Mở rộng phân tích sang các cụm cảng biển khác (Cái Mép - Thị Vải, Cát Lái).
- Áp dụng Supabase Realtime Subscription cho tab "Cảnh báo" (Anomaly Feed) để tự động push notification.
