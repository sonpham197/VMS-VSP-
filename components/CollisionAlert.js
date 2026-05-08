/**
 * CollisionAlert.js
 * ──────────────────────────────────────────────────────────────────────────
 * Component hiển thị danh sách cảnh báo va chạm dưới dạng Toast Stack.
 * Hiển thị góc trên-TRÁI màn hình (để tránh đè DashboardMenu ở góc phải).
 *
 * Props:
 *   activeRisks       {Array}    - Danh sách risks chưa acknowledge
 *   acknowledgeRisk   {Function} - Callback(riskId) khi người dùng xác nhận
 *   acknowledgeAll    {Function} - Callback() xác nhận tất cả
 *   isMuted           {boolean}  - Trạng thái mute âm thanh
 *   toggleMute        {Function} - Bật/tắt âm thanh
 *   onLocate          {Function} - Callback({ vesselA, vesselB }) zoom bản đồ
 * ──────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, ShieldAlert, Info,
  X, CheckCheck, MapPin, Volume2, VolumeX, ChevronDown, ChevronUp,
} from 'lucide-react';

// Số lượng toast tối đa hiển thị cùng lúc (phần còn lại thu gọn)
const MAX_VISIBLE = 3;

export default function CollisionAlert({
  activeRisks = [],
  acknowledgeRisk,
  acknowledgeAll,
  isMuted,
  toggleMute,
  onLocate,
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Track IDs đã được animate-out để không re-render giật
  const [exitingIds, setExitingIds] = useState(new Set());
  const prevCountRef = useRef(0);

  // Rung header khi có risk MỚI xuất hiện
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (activeRisks.length > prevCountRef.current) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 600);
      prevCountRef.current = activeRisks.length;
      return () => clearTimeout(t);
    }
    prevCountRef.current = activeRisks.length;
  }, [activeRisks.length]);

  if (activeRisks.length === 0) return null;

  const dangerRisks  = activeRisks.filter(r => r.risk_level === 'danger');
  const warningRisks = activeRisks.filter(r => r.risk_level === 'warning');
  const infoRisks    = activeRisks.filter(r => r.risk_level === 'info');

  const visibleRisks  = activeRisks.slice(0, MAX_VISIBLE);
  const hiddenCount   = Math.max(0, activeRisks.length - MAX_VISIBLE);

  const handleAck = (riskId) => {
    setExitingIds(prev => new Set(prev).add(riskId));
    setTimeout(() => {
      acknowledgeRisk(riskId);
      setExitingIds(prev => { const s = new Set(prev); s.delete(riskId); return s; });
    }, 280);
  };

  const getSeverityConfig = (level) => {
    switch (level) {
      case 'danger':
        return {
          icon: <ShieldAlert size={16} />,
          color: '#ef4444',
          bgColor: 'rgba(239,68,68,0.12)',
          borderColor: 'rgba(239,68,68,0.45)',
          glowColor: 'rgba(239,68,68,0.25)',
          label: 'NGUY HIỂM',
          pulse: true,
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={16} />,
          color: '#f59e0b',
          bgColor: 'rgba(245,158,11,0.10)',
          borderColor: 'rgba(245,158,11,0.40)',
          glowColor: 'rgba(245,158,11,0.15)',
          label: 'CẢNH BÁO',
          pulse: false,
        };
      default:
        return {
          icon: <Info size={16} />,
          color: '#38bdf8',
          bgColor: 'rgba(56,189,248,0.08)',
          borderColor: 'rgba(56,189,248,0.30)',
          glowColor: 'rgba(56,189,248,0.10)',
          label: 'THÔNG TIN',
          pulse: false,
        };
    }
  };

  return (
    <div
      className={`cwa-container ${shaking ? 'shake' : ''}`}
    >

      {/* ── Header tổng kết ── */}
      <div className="cwa-header">
        <div className="cwa-header-left">
          <span className="cwa-title-icon">🚢</span>
          <span className="cwa-title">Va chạm tiềm ẩn</span>
          {/* Badges mức độ */}
          <div className="cwa-badges">
            {dangerRisks.length > 0 && (
              <span className="badge badge-danger">{dangerRisks.length} NGUY</span>
            )}
            {warningRisks.length > 0 && (
              <span className="badge badge-warning">{warningRisks.length} CẢNH</span>
            )}
            {infoRisks.length > 0 && (
              <span className="badge badge-info">{infoRisks.length} INFO</span>
            )}
          </div>
        </div>

        <div className="cwa-header-right">
          {/* Mute toggle */}
          <button
            className="ctrl-btn"
            onClick={toggleMute}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Acknowledge all */}
          {activeRisks.length > 1 && (
            <button className="ctrl-btn ctrl-ack-all" onClick={acknowledgeAll} title="Xác nhận tất cả">
              <CheckCheck size={14} />
            </button>
          )}

          {/* Collapse toggle */}
          <button className="ctrl-btn" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* ── Toast stack ── */}
      {!collapsed && (
        <div className="cwa-list">
          {visibleRisks.map((risk) => {
            const cfg = getSeverityConfig(risk.risk_level);
            const nameA = risk.vesselA.Vessel_name || risk.vesselA.Vessel_id;
            const nameB = risk.vesselB.Vessel_name || risk.vesselB.Vessel_id;
            const isExiting = exitingIds.has(risk.id);

            return (
              <div
                key={risk.id}
                className={`cwa-card ${risk.risk_level} ${isExiting ? 'exiting' : 'entering'}`}
                style={{
                  borderColor: cfg.borderColor,
                  background: cfg.bgColor,
                  boxShadow: `0 4px 20px ${cfg.glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}
              >
                {/* Pulsing indicator bar (chỉ danger) */}
                {cfg.pulse && (
                  <div className="pulse-bar" style={{ background: cfg.color }} />
                )}

                {/* Header card */}
                <div className="card-header">
                  <span className="severity-icon" style={{ color: cfg.color }}>
                    {cfg.icon}
                  </span>
                  <span className="severity-label" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="card-time">
                    {new Date(risk.detectedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <button className="card-dismiss" onClick={() => handleAck(risk.id)}>
                    <X size={13} />
                  </button>
                </div>

                {/* Tên 2 tàu */}
                <div className="vessel-pair">
                  <span className="vessel-name-tag">{nameA}</span>
                  <span className="pair-arrow" style={{ color: cfg.color }}>↔</span>
                  <span className="vessel-name-tag">{nameB}</span>
                </div>

                {/* Chỉ số CPA / TCPA */}
                <div className="cpa-metrics">
                  <div className="metric">
                    <span className="metric-label">CPA</span>
                    <span className="metric-value" style={{ color: cfg.color }}>
                      {risk.cpa_nm.toFixed(2)} NM
                    </span>
                  </div>
                  <div className="metric-divider" />
                  <div className="metric">
                    <span className="metric-label">TCPA</span>
                    <span className="metric-value" style={{ color: cfg.color }}>
                      {Math.round(risk.tcpa_min)} phút
                    </span>
                  </div>
                  <div className="metric-divider" />
                  <div className="metric">
                    <span className="metric-label">Hiện tại</span>
                    <span className="metric-value" style={{ color: '#94a3b8' }}>
                      {risk.current_dist_nm?.toFixed(1)} NM
                    </span>
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="card-actions">
                  <button
                    className="action-btn locate-btn"
                    onClick={() => onLocate && onLocate(risk)}
                  >
                    <MapPin size={13} />
                    Định vị
                  </button>
                  <button
                    className="action-btn ack-btn"
                    onClick={() => handleAck(risk.id)}
                  >
                    <CheckCheck size={13} />
                    Đã xử lý
                  </button>
                </div>
              </div>
            );
          })}

          {/* Hiển thị phần thu gọn nếu có nhiều hơn MAX_VISIBLE */}
          {hiddenCount > 0 && (
            <div className="hidden-count-bar">
              +{hiddenCount} cảnh báo khác
              <button className="ctrl-btn" style={{ marginLeft: 8 }} onClick={acknowledgeAll}>
                Xác nhận tất cả
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        /* ── Container ── */
        .cwa-container {
          position: fixed;
          top: 76px;
          left: 16px;
          right: auto;
          width: 340px;
          z-index: 9500;
          display: flex;
          flex-direction: column;
          gap: 0;
          font-family: inherit;
        }
        .cwa-container.shake {
          animation: cwaShake 0.55s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes cwaShake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(3px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }

        /* ── Header ── */
        .cwa-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(239,68,68,0.35);
          border-radius: 14px 14px 0 0;
          padding: 10px 14px;
          box-shadow: 0 0 24px rgba(239,68,68,0.15);
        }
        .cwa-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cwa-title-icon { font-size: 1rem; }
        .cwa-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: #f8fafc;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .cwa-badges { display: flex; gap: 5px; }
        .badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 999px;
          letter-spacing: 0.04em;
        }
        .badge-danger  { background: rgba(239,68,68,0.25);  color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); }
        .badge-warning { background: rgba(245,158,11,0.20); color: #fde68a; border: 1px solid rgba(245,158,11,0.4); }
        .badge-info    { background: rgba(56,189,248,0.15); color: #7dd3fc; border: 1px solid rgba(56,189,248,0.35); }

        .cwa-header-right { display: flex; align-items: center; gap: 4px; }
        .ctrl-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          border-radius: 7px;
          padding: 5px 7px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .ctrl-btn:hover { background: rgba(255,255,255,0.14); color: #f1f5f9; }
        .ctrl-ack-all { color: #34d399; border-color: rgba(52,211,153,0.3); }
        .ctrl-ack-all:hover { background: rgba(52,211,153,0.1); }

        /* ── List ── */
        .cwa-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* ── Card ── */
        .cwa-card {
          position: relative;
          border: 1px solid;
          border-radius: 0;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 9px;
          overflow: hidden;
          transition: opacity 0.28s, transform 0.28s;
          backdrop-filter: blur(12px);
        }
        .cwa-card:last-child {
          border-radius: 0 0 14px 14px;
        }
        .cwa-card.entering {
          animation: slideIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .cwa-card.exiting {
          opacity: 0;
          transform: translateX(-20px);
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-12px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }

        /* Pulse bar (danger only) */
        .pulse-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          animation: pulseWidth 1.8s ease-in-out infinite;
          opacity: 0.9;
          border-radius: 2px 2px 0 0;
        }
        @keyframes pulseWidth {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.3; }
        }

        /* Card sections */
        .card-header {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .severity-icon { flex-shrink: 0; }
        .severity-label {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .card-time {
          font-size: 0.68rem;
          color: #475569;
          margin-left: auto;
        }
        .card-dismiss {
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          display: flex;
          transition: color 0.15s;
          flex-shrink: 0;
        }
        .card-dismiss:hover { color: #f87171; }

        /* Vessel pair */
        .vessel-pair {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .vessel-name-tag {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f1f5f9;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 6px;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pair-arrow {
          font-size: 1rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        /* CPA metrics */
        .cpa-metrics {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .metric { display: flex; flex-direction: column; gap: 1px; flex: 1; align-items: center; }
        .metric-label {
          font-size: 0.6rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
        }
        .metric-value {
          font-size: 0.82rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .metric-divider {
          width: 1px;
          height: 28px;
          background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }

        /* Actions */
        .card-actions { display: flex; gap: 8px; }
        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 7px;
          border-radius: 8px;
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid;
          transition: all 0.2s;
        }
        .locate-btn {
          background: rgba(56,189,248,0.1);
          border-color: rgba(56,189,248,0.3);
          color: #38bdf8;
        }
        .locate-btn:hover { background: rgba(56,189,248,0.2); }
        .ack-btn {
          background: rgba(52,211,153,0.1);
          border-color: rgba(52,211,153,0.3);
          color: #34d399;
        }
        .ack-btn:hover { background: rgba(52,211,153,0.2); }

        /* Hidden count bar */
        .hidden-count-bar {
          background: rgba(15,23,42,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          border-top: none;
          border-radius: 0 0 14px 14px;
          padding: 8px 14px;
          font-size: 0.75rem;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: space-between;
          backdrop-filter: blur(8px);
        }
      `}</style>
    </div>
  );
}
