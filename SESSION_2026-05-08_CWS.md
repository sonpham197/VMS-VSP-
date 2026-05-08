# SESSION NOTES: Collision Warning System (CWS) — Sprint 1→5 Complete

> **Phiên làm việc**: `89f38790-0849-43a2-80cf-8c0165f1395b`
> **Ngày tạo**: 2026-05-08 | **Giờ**: 14:30 ICT (UTC+7)
> **Người thực hiện**: Antigravity AI + Son Pham (sonpham197)
> **Repository**: `sonpham197/VMS-VSP-` · branch `main`

---

## 1. Mục tiêu phiên

Thiết kế, triển khai và kiểm thử hoàn thiện **Collision Warning System (CWS)** cho VMS Marine — hệ thống cảnh báo nguy cơ va chạm giữa các tàu theo thời gian thực, dựa trên thuật toán **CPA/TCPA** (Closest Point of Approach / Time to CPA) theo tiêu chuẩn COLREGS.

---

## 2. Các file đã tạo mới

| File | Mô tả |
|------|-------|
| `lib/collisionWarning.js` | Core engine CPA/TCPA — Haversine, vector velocity, spatial pre-filter |
| `lib/soundAlarm.js` | Web Audio API alarm (warning beep, danger siren, info ping) |
| `hooks/useCwaEngine.js` | React hook: debounce 5s, risk detection, sound, browser notification |
| `components/CollisionAlert.js` | Toast stack UI — góc trên-**trái** (glassmorphism) |
| `components/CollisionOverlay.js` | Leaflet overlay: predictive tracks + CPA marker |
| `components/CollisionHistoryPanel.js` | Panel lịch sử CPA từ DB — filter, pagination, locate |
| `pages/api/collision-alert.js` | API REST ghi collision risk vào Supabase |
| `collision_warning_setup.sql` | SQL migration thêm cột `alert_type`, `vessel_id_b`, `cpa_nm`, `tcpa_min` |
| `seed_collision_test.mjs` | Script seed 10 tàu test (5 cặp collision scenarios) |
| `COLLISION_WARNING_PLAN.md` | Kế hoạch triển khai chi tiết 5 Sprint |

---

## 3. Các file đã sửa đổi

| File | Thay đổi chính |
|------|---------------|
| `components/DashboardMenu.js` | Thêm section **"CẢNH BÁO VA CHẠM (CPA)"**: toggle lớp + nút lịch sử; nhận `sidebarOpen` để shift khi sidebar mở |
| `components/AlertDrawer.js` | Thêm **2 tab** — "Vùng cảnh báo" và "Va chạm"; fix FK ambiguous query |
| `components/MapView.js` | Import + render `CollisionOverlay`; nhận `showCollisionLayer`, `setShowCollisionLayer`, `sidebarOpen`, `onOpenCpaHistory` |
| `pages/index.js` | Tích hợp `useCwaEngine`, `CollisionAlert`, `CollisionHistoryPanel`; thêm states `showCollisionLayer`, `showCpaHistory` |

---

## 4. Quyết định thiết kế quan trọng

### 4.1 Vị trí Toast UI
- **Quyết định**: `CollisionAlert` → góc **trên-trái** (`left: 16px`)
- **Lý do**: DashboardMenu, Sidebar, AlertDrawer, Bell button đều ở cạnh phải → cạnh trái trống, tránh hoàn toàn mọi overlap
- **Thay thế đã loại**: shift `right` theo sidebar (phức tạp, vẫn overlap với DashboardMenu)

### 4.2 Thuật toán CPA/TCPA
- **Quyết định**: Hệ phẳng (flat-earth) với Haversine pre-conversion, không dùng spherical geometry thuần
- **Lý do**: Độ chính xác đủ cho khoảng cách < 50 NM (phạm vi cảnh báo 20 NM); hiệu năng cao hơn spherical
- **Spatial pre-filter**: Chỉ tính CPA các cặp tàu cách nhau < 20 NM → O(n²) → O(k²), k << n

### 4.3 Ngưỡng cảnh báo
| Level | CPA | TCPA |
|-------|-----|------|
| DANGER | < 1 NM | < 15 phút |
| WARNING | < 3 NM | < 30 phút |
| INFO | < 5 NM | < 60 phút |

### 4.4 Persistence strategy
- **Chỉ persist vào DB khi severity = DANGER** (tránh spam)
- **Upsert logic**: Tìm alert OPEN cùng cặp → cập nhật `event_count`; không có → tạo mới
- **Composite key**: `[sort(idA, idB)]` để cặp A-B = B-A

### 4.5 Sound alarm
- **Embedded trong `useCwaEngine`** thay vì tách riêng (giảm AudioContext leak)
- `lib/soundAlarm.js` tồn tại như standalone module có thể dùng độc lập
- **Lazy init AudioContext**: Chỉ khởi tạo khi có user gesture (tránh browser block)

### 4.6 Layout phân vùng màn hình
```
┌─────────────────────────────────────────────────────────────┐
│  TopBar (64px)                              [DashboardMenu] │ ← Top-right
├────────────────────────────────────────────────────────────┤
│ [CollisionAlert]          MAP               [Sidebar 360px] │ ← Top-left vs Right
│  toast stack                                               │
│                                            [AlertDrawer]   │
│                                                            │
│                                                            │
│                                          [Bell btn] (fixed)│ ← Bottom-right
└────────────────────────────────────────────────────────────┘
```

---

## 5. Kết quả kiểm thử

### Build
- `node next build` → **Compiled successfully** · 0 errors · 0 warnings

### Browser test (với dữ liệu seed 10 tàu)
| Kịch bản | Kết quả |
|---------|---------|
| Toast "VA CHẠM TIỀM ẨN" hiện góc trái | ✅ |
| Card DANGER: Sao Biển 01 ↔ Pacific Arrow · CPA 0.17 NM · TCPA 7 phút | ✅ |
| Map overlay: đường nối đỏ + tooltip trên bản đồ | ✅ |
| Badge vàng trên Bell button | ✅ |
| AlertDrawer 2 tab hoạt động | ✅ |
| Toggle Hiện/Ẩn lớp CPA qua DashboardMenu | ✅ |
| Panel Lịch sử CPA mở từ DashboardMenu | ✅ |
| DashboardMenu không bị toast che khi cả 2 cùng hiện | ✅ |
| DashboardMenu shift sang trái khi Sidebar mở | ✅ |

### SQL Migration
- Đã chạy thành công trên Supabase: cột `alert_type`, `vessel_id_b`, `cpa_nm`, `tcpa_min`, constraint, index đã tạo

---

## 6. Seed data test (10 tàu)

| ID | Tên | Kịch bản | Mức |
|----|-----|----------|-----|
| CWA-D01 | Sao Biển 01 | Đối đầu trực tiếp (heading 90°) | 🚨 DANGER |
| CWA-D02 | Pacific Arrow | Đối đầu trực tiếp (heading 270°) | 🚨 DANGER |
| CWA-D03 | Hùng Vương 08 | Cắt ngang gần (heading 355°) | 🚨 DANGER |
| CWA-D04 | CSCL Neptune | Cắt ngang gần (heading 315°) | 🚨 DANGER |
| CWA-W01 | Viễn Đông 03 | Tiếp cận chéo | ⚠️ WARNING |
| CWA-W02 | MSC Harmony | Tiếp cận chéo | ⚠️ WARNING |
| CWA-W03 | Trường Sa 12 | Hội tụ từ xa | ⚠️ WARNING |
| CWA-W04 | Maersk Batam | Hội tụ từ xa | ⚠️ WARNING |
| CWA-I01 | Đại Dương 07 | Cùng hướng, chênh tốc độ | ℹ️ INFO |
| CWA-I02 | Star Kochi | Cùng hướng, chênh tốc độ | ℹ️ INFO |

---

## 7. Việc còn lại / Technical Debt

- [ ] **`event_count` column**: Cột này chưa có trong migration SQL gốc — cần `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS event_count INT DEFAULT 1;`
- [ ] **Persist API call từ hook**: `useCwaEngine` hiện chưa gọi `/api/collision-alert` khi phát hiện DANGER risk — cần thêm `fetch` call trong `triggerNotifications()`
- [ ] **Lịch sử CPA ẩn tab trong AlertDrawer**: Tab "Va chạm" chỉ hiện alert từ DB, không phản ánh real-time từ engine — nên sync sau khi persist
- [ ] **CollisionHistoryPanel vị trí**: Khi `CollisionAlert` toast stack dài, panel lịch sử có thể bị che — xem xét dùng modal thay vì panel góc trái

---

## 8. Tham chiếu

- **Kế hoạch chi tiết**: `COLLISION_WARNING_PLAN.md`
- **Thuật toán**: `lib/collisionWarning.js` (docstring)
- **COLREGS tham chiếu**: Rule 8 (Action to Avoid Collision), Rule 16 (Action by Give-way Vessel)
- **Database schema**: `DATABASE_DESIGN.md` v2.2
- **System design**: `SYSTEM_DESIGN.md` v2.1
