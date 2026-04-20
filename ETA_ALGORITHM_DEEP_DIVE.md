# PHÂN TÍCH CHUYÊN SÂU GIẢI THUẬT TỐI ƯU HÓA HẢI TRÌNH (ETA)

Tài liệu này đi sâu vào chi tiết toán học và logic nghiệp vụ của module `calculate-eta.js`, giải thích cách hệ thống cân bằng giữa các yếu tố xung đột để đưa ra lộ trình tối ưu nhất.

---

## 1. Hàm chi phí đa mục tiêu (Multi-objective Cost Function)

Trái tim của giải thuật là hàm chi phí tổng quát, dùng để định lượng "độ tốt" của một lộ trình:

$$Cost = (W_t \cdot T) + (W_f \cdot F) + (W_r \cdot R) + (W_w \cdot W)$$

Trong đó:
- **$T$ (Time)**: Tổng thời gian di chuyển (giờ).
- **$F$ (Fuel)**: Tổng nhiên liệu tiêu thụ ước tính (tấn).
- **$R$ (Risk)**: Chỉ số rủi ro (định lượng từ 1 đến 10).
- **$W$ (Weather)**: Tác động của thời tiết (tốc độ gió km/h).
- **$W_x$**: Các trọng số ưu tiên do người dùng điều khiển qua UI.

### Cơ chế trọng số động:
Hệ thống thay đổi các hệ số $W$ dựa trên checkbox người dùng chọn:
- Nếu chọn **Time**: Trọng số thời gian tăng vọt ($a=10$), các yếu tố khác giảm.
- Nếu chọn **Fuel**: Trọng số nhiên liệu trở thành ưu tiên cao nhất ($b=50$).
- Nếu chọn **Risk/Weather**: Hệ thống kích hoạt thuật toán **Bẻ lái lộ trình (Perturbation)**.

---

## 2. Mô hình tiêu thụ nhiên liệu phi tuyến (Non-linear Fuel Model)

Nhiên liệu không tỉ lệ thuận đơn giản với quãng đường. Theo vật lý hàng hải, sức cản của nước tỉ lệ với bình phương vận tốc. Công thức áp dụng:

$$F = D \cdot k \cdot \left(\frac{V}{V_{ref}}\right)^2$$

- **$D$**: Khoảng cách (Hải lý).
- **$k = 0.1$**: Hệ số tiêu thụ cơ bản trên mỗi hải lý.
- **$V/V_{ref}$**: Tỉ lệ vận tốc thực tế so với vận tốc tham chiếu (10 knots).

**Ý nghĩa**: Khi tàu tăng tốc gấp đôi, lượng nhiên liệu không tăng gấp đôi mà tăng gấp **bốn lần**. Điều này giải thích tại sao khi chọn ưu tiên "Fuel", hệ thống chủ động giảm vận tốc về mức **Economic Speed** (70% vận tốc máy) để giảm chi phí cực đại.

---

## 3. Logic né tránh thời tiết xấu (Weather Avoidance Logic)

Khi phát hiện gió tại điểm giữa lộ trình (Midpoint) vượt ngưỡng **10 km/h** và người dùng chọn tối ưu Weather/Risk, hệ thống thực hiện các bước hình học sau:

1. **Tính toán Bearing**: Xác định góc hướng từ điểm A đến điểm B.
2. **Xác định Perpendicular Bearing**: Cộng thêm 90 độ vào hướng gốc để tìm hướng vuông góc với lộ trình.
3. **Tạo Waypoint phụ**: Sử dụng hàm `turf.destination` để tạo một điểm nốt mới nằm cách lộ trình cũ **40km** về phía hướng vuông góc.
4. **Tái kiến trúc lộ trình**: Thay vì đường thẳng $A \rightarrow B$, tàu sẽ đi theo đường gãy khúc (hoặc đường cong) $A \rightarrow Waypoint \rightarrow B$.

**Kết quả**: Quãng đường thực tế tăng lên một chút, nhưng tàu thoát khỏi vùng lõi bão, duy trì được vận tốc cao, giúp tổng chi phí $Cost$ thấp hơn việc đi thẳng qua bão với vận tốc rùa bò.

---

## 4. Cơ chế Phạt chỉ số (Penalty Mechanism)

Nếu tàu **không** chọn tối ưu mà đi thẳng vào vùng thời tiết xấu (Gió > 12 km/h), hệ thống áp dụng các hình phạt vật lý:
- **Vận tốc thực tế**: Giảm xuống còn **50%** vận tốc thiết kế (`actualSpeed * 0.5`).
- **Trạng thái Rủi ro**: Thiết lập mức **"Cao"**, cộng thêm điểm phạt trực tiếp vào $Cost$.

Điều này giúp người dùng so sánh trực quan trên Tooltip: Lộ trình uốn cong né bão luôn có điểm **Cost Score** thấp hơn và an toàn hơn lộ trình đi thẳng.

---

## 5. Lưu đồ thực thi API (`calculate-eta.js`)

1. **Input**: Toạ độ Start/End + Vận tốc máy + Tiêu chí.
2. **Weather Fetch**: Gọi Open-Meteo tại tọa độ Midpoint.
3. **Logic rẽ nhánh**:
   - Nếu né bão: Tạo đường cong/lệch tâm $\rightarrow$ Tính Distance $\rightarrow$ Tính Vận tốc duy trì.
   - Nếu đi thẳng: Check vật cản đất liền (Turf) $\rightarrow$ Tính Distance $\rightarrow$ Áp dụng Penalty thời tiết.
4. **Scoring**: Tính toán 4 thành phần của hàm Cost.
5. **Output**: Trả về Array tọa độ hiển thị + Báo cáo các chỉ số (Metrics).
