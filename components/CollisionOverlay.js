/**
 * CollisionOverlay.js
 * ──────────────────────────────────────────────────────────────────────────
 * Leaflet map overlay hiển thị trực quan nguy cơ va chạm tàu thuyền.
 *
 * Hiển thị với mỗi cặp tàu có risk:
 *   - Đường nối 2 tàu (màu theo severity)
 *   - Predictive track lines (quỹ đạo dự báo nét đứt)
 *   - CPA Point marker (điểm gần nhất)
 *   - Tooltip chi tiết CPA/TCPA
 *
 * Props:
 *   activeRisks {Array} - Từ useCwaEngine().activeRisks
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react';
import { Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { predictLinearTrack } from '@/lib/collisionWarning';

/** Số bước dự báo quỹ đạo hiển thị trên bản đồ */
const PREDICT_STEPS = 8;
/** Khoảng cách mỗi bước (phút) */
const PREDICT_INTERVAL_MIN = 3;

/** Màu sắc theo severity */
const SEVERITY_COLORS = {
  danger:  '#ef4444',
  warning: '#f59e0b',
  info:    '#38bdf8',
};

/** Opacity fill theo severity */
const SEVERITY_FILL_OPACITY = {
  danger:  0.25,
  warning: 0.15,
  info:    0.10,
};

/**
 * Component con — render overlay cho 1 cặp tàu.
 */
function RiskPairOverlay({ risk }) {
  const color = SEVERITY_COLORS[risk.risk_level] || '#94a3b8';
  const fillOpacity = SEVERITY_FILL_OPACITY[risk.risk_level] || 0.1;
  const isDanger = risk.risk_level === 'danger';

  const { vesselA, vesselB, cpaPoint, cpa_nm, tcpa_min } = risk;
  const nameA = vesselA.Vessel_name || vesselA.Vessel_id;
  const nameB = vesselB.Vessel_name || vesselB.Vessel_id;

  // Dự báo quỹ đạo tuyến tính cho 2 tàu
  const trackA = predictLinearTrack(
    vesselA.lat, vesselA.lng,
    vesselA.speed || 0, vesselA.heading || 0,
    PREDICT_STEPS, PREDICT_INTERVAL_MIN
  );
  const trackB = predictLinearTrack(
    vesselB.lat, vesselB.lng,
    vesselB.speed || 0, vesselB.heading || 0,
    PREDICT_STEPS, PREDICT_INTERVAL_MIN
  );

  const posA = [vesselA.lat, vesselA.lng];
  const posB = [vesselB.lat, vesselB.lng];
  const posCpa = cpaPoint ? [cpaPoint.lat, cpaPoint.lng] : null;

  // Polyline path: từ vị trí hiện tại + các điểm dự báo
  const pathA = [posA, ...trackA.map(p => [p.lat, p.lng])];
  const pathB = [posB, ...trackB.map(p => [p.lat, p.lng])];

  const tooltipContent = (
    <div style={{ minWidth: 180, fontFamily: 'inherit' }}>
      <div style={{ fontWeight: 700, color, marginBottom: 4, fontSize: '0.8rem', textTransform: 'uppercase' }}>
        {risk.risk_level === 'danger' ? '🚨' : '⚠️'} Nguy cơ va chạm
      </div>
      <div style={{ fontSize: '0.78rem', color: '#f1f5f9', marginBottom: 6 }}>
        <strong>{nameA}</strong> ↔ <strong>{nameB}</strong>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
        <span>
          <span style={{ color: '#64748b' }}>CPA: </span>
          <strong style={{ color }}>{cpa_nm.toFixed(2)} NM</strong>
        </span>
        <span>
          <span style={{ color: '#64748b' }}>TCPA: </span>
          <strong style={{ color }}>{Math.round(tcpa_min)} phút</strong>
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Đường kết nối 2 tàu hiện tại (solid) ── */}
      <Polyline
        positions={[posA, posB]}
        pathOptions={{
          color,
          weight: isDanger ? 2.5 : 1.5,
          opacity: isDanger ? 0.85 : 0.6,
          dashArray: isDanger ? null : '8, 6',
        }}
      >
        <Tooltip sticky direction="top" opacity={1}>
          {tooltipContent}
        </Tooltip>
      </Polyline>

      {/* ── Predictive track tàu A (nét đứt) ── */}
      <Polyline
        positions={pathA}
        pathOptions={{
          color,
          weight: 1.5,
          opacity: 0.5,
          dashArray: '5, 7',
        }}
      />

      {/* ── Predictive track tàu B (nét đứt) ── */}
      <Polyline
        positions={pathB}
        pathOptions={{
          color,
          weight: 1.5,
          opacity: 0.5,
          dashArray: '5, 7',
        }}
      />

      {/* ── CPA Point Marker ── */}
      {posCpa && (
        <CircleMarker
          center={posCpa}
          radius={isDanger ? 10 : 7}
          pathOptions={{
            color,
            weight: 2,
            fillColor: color,
            fillOpacity,
          }}
        >
          <Tooltip direction="top" opacity={1} permanent={isDanger}>
            {tooltipContent}
          </Tooltip>
        </CircleMarker>
      )}

      {/* ── Vòng tròn cảnh báo tại CPA (chỉ danger) ── */}
      {posCpa && isDanger && (
        <CircleMarker
          center={posCpa}
          radius={22}
          pathOptions={{
            color,
            weight: 1,
            opacity: 0.4,
            fillColor: color,
            fillOpacity: 0.05,
            dashArray: '4, 4',
          }}
        />
      )}
    </>
  );
}

/**
 * Component chính — render tất cả risk overlays.
 * Phải đặt BÊN TRONG <MapContainer>.
 *
 * @param {{ activeRisks: Array }} props
 */
export default function CollisionOverlay({ activeRisks = [] }) {
  if (!activeRisks || activeRisks.length === 0) return null;

  // Chỉ render các tàu có đủ dữ liệu vị trí
  const renderableRisks = activeRisks.filter(
    r =>
      r.vesselA?.lat != null && r.vesselA?.lng != null &&
      r.vesselB?.lat != null && r.vesselB?.lng != null
  );

  return (
    <>
      {renderableRisks.map(risk => (
        <RiskPairOverlay key={risk.id} risk={risk} />
      ))}
    </>
  );
}
