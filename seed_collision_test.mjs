/**
 * seed_collision_test.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * Seed 10 tàu mới trên biển với quỹ đạo được thiết kế để kích hoạt
 * Collision Warning System (CWS) ở các mức độ khác nhau.
 *
 * Thiết kế 5 kịch bản:
 *   [DANGER]  Cặp 1: CWA-D01 ↔ CWA-D02 — đối đầu trực tiếp, TCPA ~8 phút
 *   [DANGER]  Cặp 2: CWA-D03 ↔ CWA-D04 — cắt ngang gần, TCPA ~12 phút
 *   [WARNING] Cặp 3: CWA-W01 ↔ CWA-W02 — tiếp cận chéo, TCPA ~22 phút
 *   [WARNING] Cặp 4: CWA-W03 ↔ CWA-W04 — hội tụ từ xa, TCPA ~28 phút
 *   [INFO]    Cặp 5: CWA-I01 ↔ CWA-I02 — cùng hướng, tốc độ khác nhau
 *
 * Tất cả điểm nằm trong vùng Biển Đông / ngoài khơi Việt Nam.
 * ─────────────────────────────────────────────────────────────────────────
 * Chạy: node seed_collision_test.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ── Load .env.local ─────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) acc[key.trim()] = rest.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Tính vị trí sau khi di chuyển với speed (knots), heading (deg), time (hours) */
function advancePosition(lat, lng, speed_kn, heading_deg, hours) {
  const dist_nm = speed_kn * hours;
  const rad = (heading_deg * Math.PI) / 180;
  const newLat = lat + (dist_nm / 60) * Math.cos(rad);
  const newLng = lng + (dist_nm / 60) * Math.sin(rad) / Math.cos((lat * Math.PI) / 180);
  return { lat: newLat, lng: newLng };
}

/** Sinh chuỗi track 24h trước (24 điểm, mỗi điểm 1 giờ) */
function generateHistoricalTrack(vesselId, vesselName, startLat, startLng, speed, heading) {
  const now = new Date();
  const tracks = [];

  let lat = startLat;
  let lng = startLng;

  // Tính ngược: vị trí hiện tại là điểm cuối → tính lại từ 24h trước
  // Vị trí 24h trước = đi ngược heading với cùng speed
  const reverseHeading = (heading + 180) % 360;
  const startPos = advancePosition(lat, lng, speed, reverseHeading, 24);
  lat = startPos.lat;
  lng = startPos.lng;

  for (let i = 0; i <= 24; i++) {
    const trackTime = new Date(now.getTime() - (24 - i) * 3600 * 1000);
    const pos = advancePosition(lat, lng, speed, heading, i);

    // Nhiễu nhỏ (±0.005 độ) để quỹ đạo trông tự nhiên
    const noiseLat = (Math.random() - 0.5) * 0.005;
    const noiseLng = (Math.random() - 0.5) * 0.005;

    tracks.push({
      Vessel_id: vesselId,
      Vessel_name: vesselName,
      lat: +(pos.lat + noiseLat).toFixed(6),
      lng: +(pos.lng + noiseLng).toFixed(6),
      speed: +(speed + (Math.random() - 0.5) * 0.5).toFixed(2),
      heading: +(heading + (Math.random() - 0.5) * 3).toFixed(1),
      status: 'normal',
      created_at: trackTime.toISOString(),
    });
  }

  return tracks;
}

// ── Định nghĩa 10 tàu & kịch bản ────────────────────────────────────────────
//
// Vị trí lat/lng là vị trí HIỆN TẠI của tàu (điểm cuối track).
// Hai tàu trong cùng cặp phải đang tiến về phía nhau.
//
// Khu vực sử dụng: Biển Đông (107-113°E, 8-17°N) - hoàn toàn trên biển.

const VESSELS = [
  // ── CẶPNGUY HIỂM 1: Đối đầu thẳng (DANGER ~8 phút) ──────────────────────
  // Khoảng cách hiện tại: ~3 NM, tổng vận tốc hội tụ 22 kn → TCPA ≈ 8 phút
  {
    Vessel_id:   'CWA-D01',
    Vessel_name: 'Sao Biển 01',
    vessel_type: 'Tàu container',
    flag: 'VN', length_m: 185, width_m: 28,
    // Nằm ở phía TÂY của điểm gặp, đi về phía ĐÔNG (heading 90°)
    lat: 13.500, lng: 109.820, speed: 12.0, heading: 90,
  },
  {
    Vessel_id:   'CWA-D02',
    Vessel_name: 'Pacific Arrow',
    vessel_type: 'Tàu chở hàng',
    flag: 'PA', length_m: 210, width_m: 32,
    // Nằm ở phía ĐÔNG của điểm gặp, đi về phía TÂY (heading 270°)
    lat: 13.502, lng: 109.870, speed: 10.0, heading: 270,
  },

  // ── CẶP NGUY HIỂM 2: Cắt ngang gần (DANGER ~12 phút) ────────────────────
  // Tàu D03 đi Bắc, D04 đi Đông-Bắc → giao nhau sắp tới
  {
    Vessel_id:   'CWA-D03',
    Vessel_name: 'Hùng Vương 08',
    vessel_type: 'Tàu dầu',
    flag: 'VN', length_m: 240, width_m: 38,
    lat: 11.180, lng: 110.500, speed: 11.0, heading: 355,
  },
  {
    Vessel_id:   'CWA-D04',
    Vessel_name: 'CSCL Neptune',
    vessel_type: 'Tàu container',
    flag: 'CN', length_m: 300, width_m: 46,
    // Xuất phát từ phía Đông-Nam, đang đi về Tây-Bắc
    lat: 11.080, lng: 110.620, speed: 14.0, heading: 315,
  },

  // ── CẶP CẢNH BÁO 1: Tiếp cận chéo (WARNING ~22 phút) ────────────────────
  {
    Vessel_id:   'CWA-W01',
    Vessel_name: 'Viễn Đông 03',
    vessel_type: 'Tàu hàng tổng hợp',
    flag: 'VN', length_m: 140, width_m: 22,
    lat: 15.200, lng: 111.800, speed: 9.0, heading: 270,
  },
  {
    Vessel_id:   'CWA-W02',
    Vessel_name: 'MSC Harmony',
    vessel_type: 'Tàu container',
    flag: 'LR', length_m: 260, width_m: 40,
    lat: 15.350, lng: 111.620, speed: 13.0, heading: 210,
  },

  // ── CẶP CẢNH BÁO 2: Hội tụ từ xa (WARNING ~27 phút) ─────────────────────
  {
    Vessel_id:   'CWA-W03',
    Vessel_name: 'Trường Sa 12',
    vessel_type: 'Tàu nghiên cứu',
    flag: 'VN', length_m: 85, width_m: 14,
    lat: 9.500, lng: 113.200, speed: 10.0, heading: 300,
  },
  {
    Vessel_id:   'CWA-W04',
    Vessel_name: 'Maersk Batam',
    vessel_type: 'Tàu container',
    flag: 'SG', length_m: 295, width_m: 45,
    lat: 9.800, lng: 113.000, speed: 15.0, heading: 150,
  },

  // ── CẶP THÔNG TIN: Cùng hành lang, chênh lệch tốc độ (INFO ~50 phút) ────
  {
    Vessel_id:   'CWA-I01',
    Vessel_name: 'Đại Dương 07',
    vessel_type: 'Tàu hàng tổng hợp',
    flag: 'VN', length_m: 120, width_m: 18,
    lat: 16.500, lng: 112.000, speed: 8.0, heading: 45,
  },
  {
    Vessel_id:   'CWA-I02',
    Vessel_name: 'Star Kochi',
    vessel_type: 'Tàu chở dầu',
    flag: 'IN', length_m: 175, width_m: 26,
    // Đang từ phía Tây-Nam, cùng hướng nhưng nhanh hơn → đang đuổi kịp
    lat: 16.280, lng: 111.820, speed: 15.0, heading: 48,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' Collision Warning Test Data Seeder');
  console.log('═══════════════════════════════════════════════════════');

  // 1. Xóa dữ liệu cũ của các tàu này (nếu có) để chạy lại clean
  const vesselIds = VESSELS.map(v => v.Vessel_id);
  console.log('\n[1/3] Xóa dữ liệu cũ...');
  await supabase.from('vessel_tracks').delete().in('Vessel_id', vesselIds);
  await supabase.from('alerts').delete().eq('alert_type', 'collision_risk');
  // Xóa từng vessel (tránh lỗi constraint)
  for (const id of vesselIds) {
    await supabase.from('vessels').delete().eq('Vessel_id', id);
  }
  console.log('   Đã xóa.');

  // 2. Insert vessels
  console.log('\n[2/3] Tạo 10 tàu mới...');
  const vesselRows = VESSELS.map(v => ({
    Vessel_id:   v.Vessel_id,
    Vessel_name: v.Vessel_name,
    vessel_type: v.vessel_type,
    flag:        v.flag,
    length_m:    v.length_m,
    // Thêm IMO và MMSI ngẫu nhiên hợp lệ
    IMO:  'IMO' + (9000000 + Math.floor(Math.random() * 999999)),
    MMSI: String(500000000 + Math.floor(Math.random() * 99999999)),
  }));

  const { error: vesselErr } = await supabase.from('vessels').insert(vesselRows);
  if (vesselErr) {
    console.error('   ❌ Lỗi insert vessels:', vesselErr.message);
    process.exit(1);
  }
  console.log(`   ✅ Đã tạo ${vesselRows.length} tàu.`);

  // 3. Insert tracks (lịch sử 24h + vị trí hiện tại)
  console.log('\n[3/3] Tạo lịch sử hành trình (24 điểm × 10 tàu)...');

  const allTracks = [];
  for (const v of VESSELS) {
    const tracks = generateHistoricalTrack(
      v.Vessel_id, v.Vessel_name,
      v.lat, v.lng,
      v.speed, v.heading
    );
    allTracks.push(...tracks);
  }

  // Chèn theo từng batch 50 bản ghi
  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < allTracks.length; i += CHUNK) {
    const chunk = allTracks.slice(i, i + CHUNK);
    const { error } = await supabase.from('vessel_tracks').insert(chunk);
    if (error) {
      console.error(`   ❌ Lỗi insert tracks [${i}–${i + CHUNK}]:`, error.message);
    } else {
      inserted += chunk.length;
      process.stdout.write(`   Đã insert ${inserted}/${allTracks.length} tracks...\r`);
    }
  }

  console.log(`\n   ✅ Đã tạo ${inserted} điểm track.`);

  // Tóm tắt kịch bản
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' Tóm tắt kịch bản Collision Warning:');
  console.log('───────────────────────────────────────────────────────');
  console.log(' 🚨 DANGER  | Sao Biển 01  ↔ Pacific Arrow   | TCPA ~8 phút  | CPA <1 NM');
  console.log(' 🚨 DANGER  | Hùng Vương 08 ↔ CSCL Neptune   | TCPA ~12 phút | CPA <1.5 NM');
  console.log(' ⚠️  WARNING | Viễn Đông 03 ↔ MSC Harmony     | TCPA ~22 phút | CPA <2.5 NM');
  console.log(' ⚠️  WARNING | Trường Sa 12 ↔ Maersk Batam    | TCPA ~27 phút | CPA <3 NM');
  console.log(' ℹ️  INFO    | Đại Dương 07 ↔ Star Kochi       | TCPA ~50 phút | CPA <5 NM');
  console.log('═══════════════════════════════════════════════════════');
  console.log(' Reload trang VMS để xem kết quả!');
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
