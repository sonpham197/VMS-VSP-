# Thuật toán Trí tuệ Hàng hải (AI Maritime Algorithms)

Tài liệu này mô tả chi tiết các thuật toán và logic toán học được sử dụng trong Module Trí tuệ Hàng hải AI của hệ thống VMS.

## 1. Ước tính Lượng Hàng hóa (Cargo Estimation)
Thuật toán ước tính lượng hàng hóa (Cargo Throughput) đi qua cảng dựa trên thông số đặc tả của tàu và dữ liệu mớn nước hiện tại thu được từ AIS.

### Công thức:
`Cargo (tấn) = DWT * Utilization_Factor * Berth_Productivity_Factor`

### Tham số:
- **DWT (Deadweight Tonnage)**: Trọng tải toàn phần của tàu.
- **Draft Ratio (Tỷ lệ mớn nước)**: `Current_Draft / Max_Draft`. Nếu Draft Ratio > 0.6, tàu được coi là đang chở hàng (Loaded). Ngược lại là chạy không (Ballast).
- **Utilization Factor (Hệ số sử dụng)**: Trọng số cố định theo loại tàu.
  - Tàu Container: Loaded (0.85) | Ballast (0.35)
  - Tàu Hàng rời (Bulk Carrier): Loaded (0.92) | Ballast (0.30)
  - Tàu Dầu (Tanker): Loaded (0.90) | Ballast (0.32)
- **Berth Productivity Factor (Hệ số thời gian bến)**: Tàu đỗ càng lâu, khả năng bốc dỡ càng cao, bị giới hạn bởi đường cong logarit để tránh tăng quá mức.
  `Berth_Factor = MIN(1.2, 0.6 + ln(1 + Turnaround_Hours) / 10)`

## 2. Tính toán Chỉ số Tắc nghẽn (Congestion Index)
Congestion Index là chỉ số (từ 0.0 đến 1.0) mô tả mức độ quá tải của hệ thống cảng và vùng neo.

### Công thức:
`Congestion_Index = (Berth_Occupancy * 0.6) + (Anchorage_Occupancy * 0.4)`

### Tham số:
- **Berth Occupancy**: Tỷ lệ lấp đầy cầu bến (Số tàu đang cập bến / Tổng số bến khả dụng).
- **Anchorage Occupancy**: Tỷ lệ lấp đầy khu neo đậu (Số tàu đang neo / Sức chứa khu neo đậu).
- Hệ số 0.6 cho bến và 0.4 cho neo đậu thể hiện tầm quan trọng của việc giải phóng tàu tại cầu bến so với việc đợi ngoài vịnh.

## 3. Dự báo Sản lượng & Tắc nghẽn (XGBoost/LSTM Simulation)
Do yêu cầu chạy độc lập (Zero-Dependency) trong môi trường Node.js Serverless mà không cần Python backend, thuật toán Gradient Boosting được mô phỏng qua chuỗi tính toán xu hướng (Trend Analysis) và trung bình trượt (Moving Average).

### Bước 1: Trích xuất đặc trưng (Feature Extraction)
- **Trend (Xu hướng)**: Độ dốc (slope) của sự thay đổi sản lượng trong chuỗi thời gian quá khứ.
- **Last 7d Avg**: Sản lượng trung bình 7 ngày gần nhất.
- **Last 30d Avg**: Sản lượng trung bình 30 ngày gần nhất.
- **Average Congestion**: Chỉ số tắc nghẽn trung bình trong 7 ngày gần nhất.

### Bước 2: Dự báo tương lai (Forecasting)
Tính toán sản lượng cơ sở (Base prediction) kết hợp với tính thời vụ (Seasonality) cho từng ngày trong tương lai (từ D+1 đến D+Horizon):

`Base = (Last7Avg * 0.5) + (Last30Avg * 0.3) + (Trend * Horizon_Day * 0.2)`
`DOW_Factor = 0.8 (cuối tuần) HOẶC 1.05 (ngày thường)`
`Predicted_Tons = MAX(0, Base * DOW_Factor * (1 - Avg_Congestion * 0.1))`

*Lưu ý:* Việc nhân với `(1 - Avg_Congestion * 0.1)` giả định rằng nếu cảng đang tắc nghẽn nặng, hiệu suất bốc dỡ hàng hóa sẽ bị sụt giảm.

## 4. Phát hiện Bất thường Thời gian thực (Live Anomaly Detection)
Hệ thống sử dụng các ngưỡng (Threshold) cứng kết hợp với phân tích hành vi lịch sử để sinh ra các cảnh báo thông minh:

- **Tắc nghẽn vùng neo (Congestion)**: Quét tọa độ AIS trong bán kính khu vực `port_zones` có cờ `anchor_start` nhưng chưa `anchor_end`. Nếu lượng tàu chờ neo > 10 (cảnh báo Warning) hoặc > 20 (cảnh báo Critical).
- **Lưu lượng bất thường (Traffic Surge)**: Đếm tổng số tàu đang trong trạng thái hành trình (Navigational Status = 0) tiến vào khu vực cảng. Vượt ngưỡng trung bình lịch sử sẽ kích hoạt cờ cảnh báo `traffic_surge`.
- **Khử trùng lặp (Deduplication)**: Cơ chế kiểm tra trạng thái bảng `anomalies`. Chỉ trigger cảnh báo mới nếu hệ thống chưa tồn tại một cảnh báo cùng `anomaly_type` đang ở trạng thái `open`.
