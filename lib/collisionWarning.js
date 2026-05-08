/**
 * collisionWarning.js
 * ───────────────────────────────────────────────────────────────────────────
 * Core engine tính toán Cảnh báo Va chạm tàu thuyền (Collision Warning System)
 * Thuật toán: CPA/TCPA theo tiêu chuẩn COLREGS (COLlision REGulations at Sea)
 *
 * Không phụ thuộc thư viện ngoài – thuần JavaScript.
 * ───────────────────────────────────────────────────────────────────────────
 */

// ─── Hằng số ────────────────────────────────────────────────────────────────

/** 1 Hải lý = 1.852 km */
const KM_PER_NM = 1.852;
/** Bán kính Trái Đất (km) */
const EARTH_RADIUS_KM = 6371;

/**
 * Ngưỡng phân loại nguy cơ va chạm.
 * Tham chiếu: COLREGS Rule 8 & ARPA radar standard.
 */
export const RISK_THRESHOLDS = {
  danger: { tcpa_min: 15, cpa_nm: 1.5 },
  warning: { tcpa_min: 30, cpa_nm: 3.0 },
  info:    { tcpa_min: 60, cpa_nm: 5.0 },
};

// ─── Hàm Hình học ────────────────────────────────────────────────────────────

/**
 * Tính khoảng cách Haversine giữa 2 tọa độ (trả về km).
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Khoảng cách (km)
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Tính khoảng cách Haversine (trả về Hải lý).
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Khoảng cách (NM)
 */
export function haversineNM(lat1, lng1, lat2, lng2) {
  return haversineKm(lat1, lng1, lat2, lng2) / KM_PER_NM;
}

/**
 * Chuyển vị trí địa lý → tọa độ phẳng (km) lấy gốc từ điểm tham chiếu.
 * Dùng phép chiếu Equirectangular (chính xác đủ dùng với khoảng cách < 100 NM).
 * @param {number} lat
 * @param {number} lng
 * @param {number} refLat - Vĩ độ gốc chiếu
 * @param {number} refLng - Kinh độ gốc chiếu
 * @returns {{ x: number, y: number }} Tọa độ phẳng (km)
 */
function toFlatKm(lat, lng, refLat, refLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const x = toRad(lng - refLng) * EARTH_RADIUS_KM * Math.cos(toRad(refLat));
  const y = toRad(lat - refLat) * EARTH_RADIUS_KM;
  return { x, y };
}

// ─── Công cụ Vector 2D ───────────────────────────────────────────────────────

function dot(v1, v2) { return v1.x * v2.x + v1.y * v2.y; }
function magnitude(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
function addVec(v1, v2) { return { x: v1.x + v2.x, y: v1.y + v2.y }; }
function scaleVec(v, s) { return { x: v.x * s, y: v.y * s }; }
function subVec(v1, v2) { return { x: v1.x - v2.x, y: v1.y - v2.y }; }

// ─── Logic CPA / TCPA ────────────────────────────────────────────────────────

/**
 * Chuyển heading (độ) và speed (knots) → velocity vector (km/phút).
 * Convention: heading 0° = Bắc, 90° = Đông.
 * @param {number} speed_kn - Tốc độ (knots)
 * @param {number} heading_deg - Hướng (độ, 0-359)
 * @returns {{ x: number, y: number }} Vector vận tốc (km/phút)
 */
export function toVelocityVector(speed_kn, heading_deg) {
  // 1 knot = 1.852 km/h = 1.852/60 km/phút
  const speed_km_per_min = (speed_kn * KM_PER_NM) / 60;
  const rad = (heading_deg * Math.PI) / 180;
  return {
    x: speed_km_per_min * Math.sin(rad), // Đông (+) / Tây (-)
    y: speed_km_per_min * Math.cos(rad), // Bắc (+) / Nam (-)
  };
}

/**
 * Tính CPA (Closest Point of Approach) và TCPA (Time to CPA) cho 2 tàu.
 *
 * @param {object} vesselA - { lat, lng, speed, heading }
 * @param {object} vesselB - { lat, lng, speed, heading }
 * @returns {{ cpa_nm: number, tcpa_min: number, risk_level: string }}
 */
export function computeCPA(vesselA, vesselB) {
  // Dùng trung điểm làm gốc chiếu để giảm sai số Equirectangular
  const refLat = (vesselA.lat + vesselB.lat) / 2;
  const refLng = (vesselA.lng + vesselB.lng) / 2;

  // Vị trí trong tọa độ phẳng (km)
  const pA = toFlatKm(vesselA.lat, vesselA.lng, refLat, refLng);
  const pB = toFlatKm(vesselB.lat, vesselB.lng, refLat, refLng);

  // Vector vận tốc (km/phút)
  const vA = toVelocityVector(vesselA.speed || 0, vesselA.heading || 0);
  const vB = toVelocityVector(vesselB.speed || 0, vesselB.heading || 0);

  // Vị trí tương đối: ΔP = pA - pB
  const dP = subVec(pA, pB);
  // Vận tốc tương đối: ΔV = vA - vB
  const dV = subVec(vA, vB);

  const dv2 = dot(dV, dV); // |ΔV|²

  let tcpa_min;
  if (dv2 < 1e-10) {
    // Hai tàu cùng tốc độ và hướng → song song, TCPA = 0 (không tiếp cận)
    tcpa_min = 0;
  } else {
    tcpa_min = -dot(dP, dV) / dv2;
  }

  // TCPA < 0: đã qua điểm gần nhất, hai tàu đang rời xa → không cảnh báo
  const effective_tcpa = Math.max(0, tcpa_min);

  // Vị trí tại thời điểm CPA
  const closestRelPos = addVec(dP, scaleVec(dV, effective_tcpa));
  const cpa_km = magnitude(closestRelPos);
  const cpa_nm = cpa_km / KM_PER_NM;

  const risk_level = classifyRisk(cpa_nm, tcpa_min);

  return { cpa_nm, tcpa_min, risk_level };
}

/**
 * Phân loại mức độ nguy hiểm dựa trên CPA và TCPA.
 * @param {number} cpa_nm - Khoảng cách gần nhất (NM)
 * @param {number} tcpa_min - Thời gian đến điểm gần nhất (phút)
 * @returns {'none'|'info'|'warning'|'danger'}
 */
export function classifyRisk(cpa_nm, tcpa_min) {
  // Nếu hai tàu đang rời xa (TCPA < 0) → an toàn
  if (tcpa_min < 0) return 'none';

  const { danger, warning, info } = RISK_THRESHOLDS;

  if (tcpa_min <= danger.tcpa_min && cpa_nm <= danger.cpa_nm) return 'danger';
  if (tcpa_min <= warning.tcpa_min && cpa_nm <= warning.cpa_nm) return 'warning';
  if (tcpa_min <= info.tcpa_min && cpa_nm <= info.cpa_nm) return 'info';

  return 'none';
}

// ─── Dự báo quỹ đạo tuyến tính ──────────────────────────────────────────────

/**
 * Dự báo N điểm vị trí tiếp theo của tàu theo kinematics tuyến tính.
 * Dùng để vẽ Predictive Cone trên bản đồ.
 * @param {number} lat
 * @param {number} lng
 * @param {number} speed_kn
 * @param {number} heading_deg
 * @param {number} steps - Số bước dự báo (mặc định 10)
 * @param {number} interval_min - Khoảng cách thời gian mỗi bước (phút, mặc định 2)
 * @returns {Array<{ lat: number, lng: number, timeMin: number }>}
 */
export function predictLinearTrack(lat, lng, speed_kn, heading_deg, steps = 10, interval_min = 2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const points = [];

  for (let i = 1; i <= steps; i++) {
    const dist_nm = speed_kn * (interval_min / 60) * i;
    const dist_deg_lat = dist_nm / 60; // 1 NM ≈ 1/60 độ vĩ
    const newLat = lat + dist_deg_lat * Math.cos(toRad(heading_deg));
    const newLng =
      lng +
      (dist_deg_lat * Math.sin(toRad(heading_deg))) /
        Math.cos(toRad(lat));
    points.push({ lat: newLat, lng: newLng, timeMin: interval_min * i });
  }

  return points;
}

/**
 * Tính điểm CPA trên bản đồ (vị trí địa lý tại thời điểm hai tàu gần nhất).
 * Dùng để vẽ marker CPA trên Leaflet.
 * @param {object} vesselA - { lat, lng, speed, heading }
 * @param {number} tcpa_min - Thời gian đến CPA (phút)
 * @returns {{ lat: number, lng: number }}
 */
export function computeCpaPoint(vesselA, tcpa_min) {
  if (tcpa_min <= 0) return { lat: vesselA.lat, lng: vesselA.lng };
  const track = predictLinearTrack(
    vesselA.lat, vesselA.lng,
    vesselA.speed || 0, vesselA.heading || 0,
    1, tcpa_min
  );
  return track[0] || { lat: vesselA.lat, lng: vesselA.lng };
}

// ─── Main Detection Function ──────────────────────────────────────────────────

/**
 * Kiểm tra toàn bộ cặp tàu và trả về danh sách nguy cơ va chạm.
 *
 * @param {Array} vessels - Danh sách tàu, mỗi phần tử cần có:
 *   { Vessel_id, Vessel_name, lat, lng, speed, heading }
 * @returns {Array<CollisionRisk>} Danh sách cặp tàu có nguy cơ (risk_level !== 'none')
 *
 * @typedef {object} CollisionRisk
 * @property {object}  vesselA      - Tàu A
 * @property {object}  vesselB      - Tàu B
 * @property {number}  cpa_nm       - Khoảng cách gần nhất (NM)
 * @property {number}  tcpa_min     - Thời gian đến CPA (phút)
 * @property {string}  risk_level   - 'info' | 'warning' | 'danger'
 * @property {string}  id           - ID duy nhất của cặp (${idA}__${idB})
 * @property {{ lat, lng }} cpaPoint - Điểm CPA trên bản đồ
 */
export function detectCollisionRisks(vessels) {
  const risks = [];

  // Lọc tàu hợp lệ: phải có vị trí và đang di chuyển
  const active = vessels.filter(
    (v) =>
      v.lat != null &&
      v.lng != null &&
      v.speed != null &&
      v.speed > 0.5 // Tàu neo đậu (< 0.5 kn) không tính
  );

  // Spatial pre-filter: chỉ tính CPA cho các cặp cách nhau < 20 NM
  // → Tránh tính toán vô ích cho tàu ở xa nhau
  const MAX_DISTANCE_NM = 20;

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const vA = active[i];
      const vB = active[j];

      // Pre-filter khoảng cách hiện tại
      const currentDist = haversineNM(vA.lat, vA.lng, vB.lat, vB.lng);
      if (currentDist > MAX_DISTANCE_NM) continue;

      const { cpa_nm, tcpa_min, risk_level } = computeCPA(vA, vB);

      if (risk_level === 'none') continue;

      // Tạo ID cố định theo thứ tự alphabet để tránh trùng lặp A-B vs B-A
      const [idA, idB] = [vA.Vessel_id, vB.Vessel_id].sort();
      const id = `${idA}__${idB}`;

      // Điểm CPA trên bản đồ (lấy midpoint giữa 2 vị trí tại tcpa)
      const cpaA = computeCpaPoint(vA, tcpa_min);
      const cpaB = computeCpaPoint(vB, tcpa_min);
      const cpaPoint = {
        lat: (cpaA.lat + cpaB.lat) / 2,
        lng: (cpaA.lng + cpaB.lng) / 2,
      };

      risks.push({
        id,
        vesselA: vA,
        vesselB: vB,
        cpa_nm,
        tcpa_min,
        risk_level,
        current_dist_nm: currentDist,
        cpaPoint,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Sắp xếp theo mức độ nguy hiểm: danger → warning → info
  const severityOrder = { danger: 0, warning: 1, info: 2 };
  risks.sort((a, b) => severityOrder[a.risk_level] - severityOrder[b.risk_level]);

  return risks;
}
