# KẾ HOẠCH THỰC THI: HỆ THỐNG CẢNH BÁO VA CHẠM TÀU THUYỀN (CWS)
## VMS Marine – Collision Warning System
**Phiên bản:** 1.0 | **Ngày:** 2026-05-08 | **Trạng thái:** Đã duyệt – Chờ triển khai

---

## PHẦN 1: NGHIÊN CỨU THUẬT TOÁN

### 1.1 Phân tích bài toán

Va chạm tàu biển là bài toán **dự báo xung đột quỹ đạo 4D** (lat, lng, heading, time). Không giống cảnh báo vùng địa lý (geofencing) đã có, bài toán này yêu cầu:

- Dự báo **vị trí tương lai** của từng tàu trong khoảng thời gian tới.
- Kiểm tra xem các quỹ đạo đó có **giao nhau trong không gian-thời gian** không.
- Tính toán **CPA (Closest Point of Approach)** và **TCPA (Time to CPA)**.
- Phân loại mức độ nguy hiểm và kích hoạt cảnh báo phù hợp.

---

### 1.2 Thuật toán đề xuất: CPA/TCPA + Predictive Cone

Đây là thuật toán chuẩn công nghiệp từ **COLREGS (COLlision REGulations at Sea)** được sử dụng trong AIS/ARPA radar.

#### 1.2.1 Tính CPA và TCPA

Với hai tàu A và B tại thời điểm t₀:

```
Vị trí: Pₐ = (latₐ, lngₐ),   P_b = (lat_b, lng_b)
Vận tốc vector:
  Vₐ = speed_a × [sin(heading_a), cos(heading_a)]  (Vx, Vy)
  V_b = speed_b × [sin(heading_b), cos(heading_b)]

Vị trí tương đối:  ΔP = Pₐ − P_b
Vận tốc tương đối: ΔV = Vₐ − V_b

             −(ΔP · ΔV)
TCPA = ─────────────────────
              |ΔV|²

CPA_distance = |ΔP + TCPA × ΔV|
```

- **TCPA < 0**: Hai tàu đang **rời xa** nhau → Không cảnh báo.
- **TCPA ≥ 0 và CPA_distance < D_safe**: Nguy cơ va chạm.

**Ngưỡng cảnh báo:**

| Mức | TCPA | CPA Distance | Severity |
|-----|------|--------------|----------|
| INFO | 30–60 phút | < 5 NM | `info` |
| WARNING | 15–30 phút | < 3 NM | `warning` |
| DANGER | < 15 phút | < 1.5 NM | `danger` |

#### 1.2.2 Safety Zone (Vùng an toàn động)

Mỗi tàu có vùng an toàn hình elip (phù hợp với hải lý):
- **Trục dọc (forward)**: `L + V_knots × 5` (phụ thuộc vận tốc)
- **Trục ngang**: 0.5 NM cố định

Nếu **vùng an toàn** của A giao với vùng an toàn của B → Kích hoạt cảnh báo.

#### 1.2.3 Predictive Cone Check (Bổ sung, phù hợp visualize)

Dự báo **N điểm tiếp theo** của mỗi tàu theo kinematics tuyến tính:

```javascript
function predictPositions(lat, lng, speed_knots, heading_deg, steps = 10, interval_min = 2) {
  const points = [];
  for (let i = 1; i <= steps; i++) {
    const dist_nm = speed_knots * (interval_min / 60) * i;
    const newLat = lat + (dist_nm / 60) * Math.cos(heading_deg * Math.PI / 180);
    const newLng = lng + (dist_nm / 60) * Math.sin(heading_deg * Math.PI / 180)
                       / Math.cos(lat * Math.PI / 180);
    points.push({ lat: newLat, lng: newLng, timeMin: interval_min * i });
  }
  return points;
}
```

Kiểm tra khoảng cách `points_A[i]` và `points_B[i]` (cùng time step).

#### 1.2.4 Kết luận lựa chọn thuật toán

> **Đề xuất chính**: Dùng **CPA/TCPA** làm engine chính (chạy client-side trong React) vì:
> - Chuẩn COLREGS – tiêu chuẩn hàng hải quốc tế.
> - Không cần backend mới – tính từ dữ liệu có sẵn (lat, lng, speed, heading).
> - Hiệu năng tốt: O(n²) với n < 100 tàu → rất nhanh.
> - Tích hợp tự nhiên với vòng polling realtime 10s đã có.

---

### 1.3 So sánh các phương án

| Phương án | Ưu điểm | Nhược điểm | Phù hợp VMS? |
|-----------|---------|------------|--------------|
| **CPA/TCPA (đề xuất)** | Chuẩn COLREGS, chính xác, nhẹ | Chỉ đúng nếu tàu đi thẳng | ✅ Tốt nhất |
| Predictive Cone | Trực quan, dễ visualize | Kém chính xác hơn | ✅ Bổ sung |
| PostGIS ST_Distance | Chính xác vị trí hiện tại | Không dự báo tương lai | ⚠️ Chỉ hiện tại |
| ML Trajectory Prediction | Rất chính xác | Cần training data lớn, phức tạp | ❌ Quá phức tạp |

---

## PHẦN 2: THIẾT KẾ HỆ THỐNG

### 2.1 Kiến trúc tổng thể

```
Realtime Vessel Positions (latestTracks)
              ↓
    useCwaEngine hook
              ↓
    CPA/TCPA Engine  ←──  lib/collisionWarning.js
              ↓
    collisionRisks[]
     ├──→ CollisionAlert.js     (Toast UI)
     ├──→ soundAlarm.js         (Web Audio API)
     ├──→ Browser Notification  (Notification API)
     ├──→ CollisionOverlay.js   (Map lines/markers)
     └──→ /api/collision-alert  (Ghi Supabase)
```

### 2.2 Data Flow

1. **Polling/Realtime** (đã có) cập nhật `latestTracks` mỗi 10s.
2. **`useCwaEngine` hook** nhận `vessels` array → chạy CPA/TCPA cho mọi cặp tàu.
3. Sinh ra `collisionRisks[]` – danh sách cặp tàu có nguy cơ.
4. Khi có risk mới → Trigger **toast + sound + map overlay**.
5. Risk `danger` → Ghi vào bảng `alerts` Supabase.

---

## PHẦN 3: KẾ HOẠCH THỰC THI CHI TIẾT

### Phase 1 – Core Engine *(Ưu tiên 1, ~4h)*

**File: `lib/collisionWarning.js`** *(MỚI)*

```javascript
// Khoảng cách Haversine (NM)
export function haversineNM(lat1, lng1, lat2, lng2) { ... }

// Heading + speed → velocity vector (km/h)
export function toVelocityVector(speed_kn, heading_deg) { ... }

// Tính CPA distance (NM) và TCPA (phút)
export function computeCPA(vesselA, vesselB) {
  // Returns: { cpa_nm, tcpa_min, risk_level }
}

// Phân loại nguy hiểm
export function classifyRisk(cpa_nm, tcpa_min) {
  // Returns: 'none' | 'info' | 'warning' | 'danger'
}

// Main: kiểm tra toàn bộ cặp tàu
export function detectCollisionRisks(vessels) {
  // Returns: [{ vesselA, vesselB, cpa_nm, tcpa_min, risk_level }, ...]
}
```

**File: `hooks/useCwaEngine.js`** *(MỚI)*

```javascript
export function useCwaEngine(vessels, options = {}) {
  // - Chạy detectCollisionRisks() mỗi khi vessels thay đổi
  // - Debounce 5s tránh spam tính toán
  // - Trả về: { collisionRisks, acknowledgeRisk }
}
```

---

### Phase 2 – UI Notification *(Ưu tiên 1, ~3h)*

**File: `components/CollisionAlert.js`** *(MỚI)*

Toast notification nổi (non-blocking), style Glassmorphism:

```
╔══════════════════════════════════════╗
║ 🚨 CẢNH BÁO VA CHẠM               ×  ║
║  ─────────────────────────────────  ║
║  ⚠️  VISHIPEL 01  ↔  SEA PEARL     ║
║  CPA: 0.8 NM  |  TCPA: 8 phút     ║
║  ─────────────────────────────────  ║
║  [🗺 Định vị]    [✓ Đã tiếp nhận]  ║
╚══════════════════════════════════════╝
```

- Tự dismiss sau 30s (warning), không dismiss (danger).
- Stack nhiều alerts, scroll được.
- Badge số lượng trên nút Bell hiện tại.

**File sửa: `pages/index.js`**
- Import và render `<CollisionAlert />`.
- Tích hợp `useCwaEngine(filteredVessels)`.

---

### Phase 3 – Sound Alarm *(Ưu tiên 2, ~2h)*

**File: `lib/soundAlarm.js`** *(MỚI)*

```javascript
export class SoundAlarm {
  constructor() { this.ctx = new AudioContext(); }
  playWarning() { /* Beep 880Hz × 3, lặp mỗi 5s */ }
  playDanger()  { /* Còi 440/880Hz xen kẽ liên tục */ }
  stop()        { /* Dừng toàn bộ */ }
}
```

- Mute button trên UI, lưu preference vào `localStorage`.
- Chỉ phát khi tab đang focus.

**Browser Notification API** *(tích hợp vào `useCwaEngine`)*

```javascript
// Xin quyền khi app load
Notification.requestPermission();

// Gửi khi có risk
new Notification('⚠️ VMS – Nguy cơ va chạm', {
  body: `${vesselA.name} ↔ ${vesselB.name} | CPA: ${cpa} NM | TCPA: ${tcpa} phút`,
  icon: '/favicon.ico',
  tag: `collision-${idA}-${idB}`, // Deduplicate
});
```

---

### Phase 4 – Map Overlay *(Ưu tiên 3, ~3h)*

**File: `components/CollisionOverlay.js`** *(MỚI)*

Hiển thị trên Leaflet:
- **Predictive Track Lines**: Đường nét đứt vàng/đỏ từ tàu → điểm CPA.
- **CPA Point Marker**: Vòng tròn nhấp nháy tại điểm CPA.
- **Connecting Line**: Nối 2 tàu đang có risk, tô màu theo severity.

---

### Phase 5 – Backend Persistence *(Ưu tiên 3, ~2h)*

**SQL Migration: `collision_warning_setup.sql`** *(MỚI)*

```sql
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS alert_type    TEXT    DEFAULT 'zone_violation',
  -- Giá trị: 'zone_violation' | 'collision_risk' | 'speed_limit'
  ADD COLUMN IF NOT EXISTS vessel_id_b   TEXT    REFERENCES vessels("Vessel_id"),
  ADD COLUMN IF NOT EXISTS cpa_nm        NUMERIC,
  ADD COLUMN IF NOT EXISTS tcpa_min      NUMERIC;
```

**File: `pages/api/collision-alert.js`** *(MỚI)*

```javascript
// POST /api/collision-alert
// Body: { vesselIdA, vesselIdB, cpa_nm, tcpa_min, severity }
// Chỉ ghi khi severity === 'danger' để tránh spam DB
```

**File sửa: `components/AlertDrawer.js`**
- Thêm tab **"Va chạm"** bên cạnh tab cảnh báo zone hiện tại.
- Lọc theo `alert_type = 'collision_risk'`.

---

## PHẦN 4: CẤU TRÚC FILE SAU KHI TRIỂN KHAI

```
VMS/
├── lib/
│   ├── collisionWarning.js       [MỚI] Engine CPA/TCPA thuần JS
│   ├── soundAlarm.js             [MỚI] Web Audio API alarm
│   └── supabaseClient.js         [GIỮ NGUYÊN]
├── hooks/
│   └── useCwaEngine.js           [MỚI] React hook tích hợp engine
├── components/
│   ├── CollisionAlert.js         [MỚI] Toast notification UI
│   ├── CollisionOverlay.js       [MỚI] Leaflet map overlay
│   ├── AlertDrawer.js            [SỬA] Thêm tab "Va chạm"
│   └── ...                       [GIỮ NGUYÊN]
├── pages/
│   ├── index.js                  [SỬA] Tích hợp hook + components
│   └── api/
│       ├── collision-alert.js    [MỚI] API ghi Supabase
│       ├── calculate-eta.js      [GIỮ NGUYÊN]
│       └── predict.js            [GIỮ NGUYÊN]
└── collision_warning_setup.sql   [MỚI] Migration SQL
```

---

## PHẦN 5: SPRINT PLAN

| Sprint | Nội dung | File | Ước lượng |
|--------|----------|------|-----------|
| **1** | Core CPA/TCPA Engine | - [x] `lib/collisionWarning.js` – Engine CPA/TCPA ✅<br>- [x] `hooks/useCwaEngine.js` – React hook ✅<br>- [x] Test thực tế ✅ | ✅ **DONE** |
| **2** | UI Toast Notification | `components/CollisionAlert.js`, `pages/index.js` | 3h |
| **3** | Sound + Browser Push | `lib/soundAlarm.js` | 2h |
| **4** | Map Overlay | `components/CollisionOverlay.js` | 3h |
| **5** | Backend Persistence | SQL, `api/collision-alert.js`, `AlertDrawer.js` | 2h |
| **Tổng** | | | **~14h** |

---

## PHẦN 6: LƯU Ý KỸ THUẬT

> **⚠️ Tọa độ cầu vs phẳng**: Công thức CPA thuần dùng hệ phẳng. Luôn chuyển
> (lat, lng) → (x_km, y_km) bằng Haversine trước khi tính vector vận tốc.
> Sai lệch đáng kể khi khoảng cách > 50 NM.

> **🔇 Tránh spam**: Dùng composite key `${idA}-${idB}` để deduplicate risks.
> Chỉ ghi Supabase khi risk **chuyển trạng thái** từ `none → danger`
> (transition-based, không phải mỗi vòng poll).

> **⚡ Performance**: n=50 tàu → 1,225 phép tính CPA/10s – rất nhẹ.
> Nếu n > 200, áp dụng spatial pre-filter: chỉ tính CPA các cặp cách nhau < 20 NM.

> **🔔 Browser Notification**: Yêu cầu HTTPS hoặc localhost.
> Vercel deployment đã có HTTPS. Cần xin quyền user lần đầu.

---

## PHẦN 7: ACCEPTANCE CRITERIA

Tính năng **hoàn thành** khi đáp ứng tất cả:

- [ ] Phát hiện 2 tàu tiến về phía nhau với TCPA < 15 phút.
- [ ] Toast notification hiển thị thông tin CPA/TCPA chính xác.
- [ ] Âm thanh cảnh báo phát theo mức severity (có thể mute).
- [ ] Browser Notification gửi được khi tab không focus.
- [ ] Đường kết nối 2 tàu nguy hiểm hiển thị trên bản đồ.
- [ ] Alert `danger` được ghi vào Supabase và hiện trong AlertDrawer.
- [ ] Người dùng có thể "Chấp nhận" (acknowledge) cảnh báo.
- [ ] Không có alert trùng lặp cho cùng một cặp tàu.

---

*Tài liệu này là tham chiếu kỹ thuật dài hạn cho tính năng CWS của VMS Marine.*
*Cập nhật khi có thay đổi thiết kế hoặc hoàn thành sprint.*
