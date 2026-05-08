# TÀI LIỆU HƯỚNG DẪN CODING (CODING GUIDELINES)
## Dự án VMS Marine

Tài liệu này cung cấp các quy chuẩn và hướng dẫn lập trình cho dự án VMS Marine, nhằm đảm bảo mã nguồn đồng nhất, dễ bảo trì và mở rộng.

---

## 1. Công nghệ sử dụng (Tech Stack)
- **Framework**: Next.js (App/Pages router), React.
- **Styling**: Tailwind CSS (nếu có) kết hợp với CSS thuần (đặc biệt cho hiệu ứng Glassmorphism).
- **Bản đồ**: `react-leaflet`, `leaflet`, kết hợp `turf.js` cho tính toán không gian (GIS).
- **Database**: Supabase (PostgreSQL), PostGIS.
- **Ngôn ngữ**: JavaScript (ES6+), SQL.

---

## 2. Quy chuẩn Cấu trúc Thư mục

- `components/`: Chứa các React components tái sử dụng (ví dụ: `TopBar`, `WeatherPanel`, `VelocityLayer`).
- `pages/`: Chứa các view chính theo chuẩn Next.js (ví dụ: `index.js`, `vessels.js`).
- `public/`: Chứa assets tĩnh (hình ảnh, geojson như `vietnam-coastline.json`).
- `styles/`: Các file CSS toàn cục (`globals.css`, các file module).
- `lib/` (hoặc `utils/`): Chứa các hàm hỗ trợ độc lập, helper (ví dụ logic tính toán khoảng cách, gọi API).
- Thư mục gốc chứa các file SQL (`vms_detection_logic.sql`, `setup_fleet_tables.sql`) và script seed data (`seed.mjs`, `seed_tracks.mjs`).

---

## 3. Quy tắc Code (Code Conventions)

### 3.1 JavaScript / React
- Sử dụng **Functional Components** với React Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`). Không dùng Class Components.
- Các component bản đồ (Leaflet) phải được bọc trong vòng đời an toàn hoặc import động (dynamic import) với `ssr: false` để tránh lỗi SSR trên Next.js (ví dụ: truy cập `window` object).
- Tên component: **PascalCase** (`WeatherPanel.js`, `VelocityLayer.js`).
- Tên biến/hàm: **camelCase** (`vesselData`, `calculateETA()`).
- Sử dụng `try-catch` trong các thao tác xử lý async/await hoặc gọi API.

### 3.2 SQL / Supabase
- Tên bảng: **snake_case**, chữ thường (`vessels`, `vessel_tracks`, `zones`).
- Các hàm / trigger: `snake_case` với tiền tố rõ ràng (`process_vessel_track_alerts`).
- Khi thêm tính năng mới, hãy tạo file `.sql` riêng biệt và ghi rõ mục đích để dễ theo dõi (ví dụ: `setup_fleet_tables.sql`).

### 3.3 Thiết kế Giao diện (UI/UX)
- Giao diện chú trọng yếu tố **Glassmorphism**: sử dụng background mờ (backdrop-blur), màu sắc hiện đại, và bo góc mềm mại.
- Tránh sử dụng màu cơ bản nhàm chán; sử dụng gradient hoặc màu trong suốt (rgba) với shadow nổi.
- Các panel kiểm soát (như Filter, Weather Layer) nên có hiệu ứng hover mượt mà (`transition-all`).

---

## 4. Quản lý State & Dữ liệu Realtime
- Dữ liệu tĩnh (vessel list): Nên fetch một lần lúc khởi tạo (hoặc dùng `getServerSideProps` nếu phù hợp).
- Dữ liệu động (tracks, alerts): Bắt buộc subscribe thông qua Supabase Realtime để tự động cập nhật bản đồ mà không cần refresh.
- Các logic nặng về tính toán vùng không gian (Geofencing) nên đưa xuống PostGIS / Trigger (xem `vms_detection_logic.sql`). Tuy nhiên, cần dự phòng logic fallback bằng `Turf.js` trên Client để đảm bảo UI không bị lag khi hệ thống quá tải.

---

## 5. Kiểm thử & Seed Dữ liệu
- Khi thay đổi cấu trúc bảng, phải cập nhật lại các file seed (`seed.mjs`, `seed_tracks.mjs`).
- Khuyến nghị chạy thử trên môi trường local thông qua `npm run dev` và gọi trực tiếp các script seed qua NodeJS (`node seed.mjs`) trước khi triển khai lên Production.
