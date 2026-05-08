/**
 * CollisionHistoryPanel.js
 * ──────────────────────────────────────────────────────────────────────────
 * Panel lịch sử sự kiện CPA/TCPA: hiển thị tất cả cảnh báo va chạm
 * (đã xảy ra, đang xảy ra, đã xác nhận) từ bảng alerts Supabase.
 *
 * Props:
 *   isOpen    {boolean}  - Hiển thị panel
 *   onClose   {Function} - Đóng panel
 *   onLocate  {Function} - Callback(vesselId) zoom bản đồ về tàu
 * ──────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  X, ShieldAlert, AlertTriangle, Info,
  CheckCircle2, Clock, Ship, RefreshCw,
  MapPin, Filter, ChevronDown, Navigation,
} from 'lucide-react';

const STATUS_CONFIG = {
  open:         { label: 'Đang xảy ra', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)' },
  acknowledged: { label: 'Đã xác nhận', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)' },
  closed:       { label: 'Đã đóng',     color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)' },
};

const SEVERITY_ICON = {
  danger:  <ShieldAlert size={15} />,
  warning: <AlertTriangle size={15} />,
  info:    <Info size={15} />,
};
const SEVERITY_COLOR = { danger: '#ef4444', warning: '#f59e0b', info: '#38bdf8' };

const PAGE_SIZE = 20;

export default function CollisionHistoryPanel({ isOpen, onClose, onLocate }) {
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');   // all | open | acknowledged | closed
  const [page, setPage]             = useState(0);
  const [hasMore, setHasMore]       = useState(true);
  const [total, setTotal]           = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;

    let query = supabase
      .from('alerts')
      .select(`
        id, status, severity, cpa_nm, tcpa_min,
        description, created_at, updated_at, event_count,
        vessel_id, vessel_id_b,
        vessels!alerts_vessel_id_fkey(Vessel_name)
      `, { count: 'exact' })
      .eq('alert_type', 'collision_risk')
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[CollisionHistory]', error);
    } else {
      setEvents(reset ? (data || []) : prev => [...prev, ...(data || [])]);
      setTotal(count || 0);
      setHasMore((data || []).length === PAGE_SIZE);
      if (!reset) setPage(p => p + 1);
      else setPage(1);
    }

    setLoading(false);
  }, [page, filterStatus]);

  useEffect(() => {
    if (isOpen) {
      fetchEvents(true);
    }
  }, [isOpen, filterStatus]);

  // ── Đóng cảnh báo (status → closed) ────────────────────────────────────
  const closeEvent = async (id) => {
    await supabase.from('alerts').update({ status: 'closed' }).eq('id', id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'closed' } : e));
  };

  if (!isOpen) return null;

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="chp-overlay">
      <div className="chp-panel">

        {/* ── Header ── */}
        <div className="chp-header">
          <div className="chp-header-left">
            <Navigation size={20} className="chp-icon" />
            <div>
              <h2 className="chp-title">Lịch sử CPA</h2>
              <span className="chp-subtitle">
                {total} sự kiện • Collision Point Approach
              </span>
            </div>
          </div>
          <div className="chp-header-right">
            <button
              className="chp-ctrl-btn"
              onClick={() => fetchEvents(true)}
              title="Làm mới"
            >
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            </button>
            <button
              className="chp-ctrl-btn filter-btn"
              onClick={() => setFilterOpen(f => !f)}
              title="Bộ lọc"
            >
              <Filter size={14} />
              {filterStatus !== 'all' && <span className="filter-dot" />}
            </button>
            <button className="chp-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Bộ lọc ── */}
        {filterOpen && (
          <div className="chp-filter-bar">
            {['all', 'open', 'acknowledged', 'closed'].map(s => (
              <button
                key={s}
                className={`filter-chip ${filterStatus === s ? 'active' : ''}`}
                onClick={() => { setFilterStatus(s); setFilterOpen(false); }}
                style={filterStatus === s && s !== 'all' ? {
                  background: STATUS_CONFIG[s]?.bg,
                  borderColor: STATUS_CONFIG[s]?.border,
                  color: STATUS_CONFIG[s]?.color,
                } : {}}
              >
                {s === 'all' ? 'Tất cả' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Stats bar ── */}
        <div className="chp-stats">
          {['open', 'acknowledged', 'closed'].map(s => {
            const count = events.filter(e => e.status === s).length;
            const cfg = STATUS_CONFIG[s];
            return (
              <div key={s} className="chp-stat-item" style={{ color: cfg.color }}>
                <span className="chp-stat-val">{count}</span>
                <span className="chp-stat-lbl">{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {/* ── Danh sách events ── */}
        <div className="chp-list">
          {loading && events.length === 0 && (
            <div className="chp-empty">
              <div className="chp-spinner" />
              Đang tải...
            </div>
          )}

          {!loading && events.length === 0 && (
            <div className="chp-empty">
              <Navigation size={40} style={{ opacity: 0.2 }} />
              <p>Chưa có sự kiện CPA nào được ghi nhận</p>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                Sự kiện được ghi khi risk level = DANGER
              </span>
            </div>
          )}

          {events.map(evt => {
            const statusCfg = STATUS_CONFIG[evt.status] || STATUS_CONFIG.open;
            const vesselNameA = evt.vessels?.Vessel_name || evt.vessel_id;
            const vesselNameB = evt.vessel_id_b || '—';
            const severityColor = SEVERITY_COLOR[evt.severity] || '#94a3b8';

            return (
              <div
                key={evt.id}
                className="chp-card"
                style={{ borderColor: statusCfg.border }}
              >
                {/* Status stripe */}
                <div className="chp-stripe" style={{ background: statusCfg.color }} />

                <div className="chp-card-inner">
                  {/* Row 1: Severity + Status + Thời gian */}
                  <div className="chp-card-header">
                    <span className="chp-severity" style={{ color: severityColor }}>
                      {SEVERITY_ICON[evt.severity]}
                      {evt.severity?.toUpperCase()}
                    </span>
                    <span className="chp-status-badge" style={{
                      background: statusCfg.bg,
                      color: statusCfg.color,
                      border: `1px solid ${statusCfg.border}`,
                    }}>
                      {statusCfg.label}
                    </span>
                    <span className="chp-time">
                      <Clock size={11} />
                      {formatDate(evt.created_at)}
                    </span>
                  </div>

                  {/* Row 2: Cặp tàu */}
                  <div className="chp-vessel-pair">
                    <Ship size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                    <span className="chp-vessel-name">{vesselNameA}</span>
                    <span className="chp-pair-arrow" style={{ color: severityColor }}>↔</span>
                    <span className="chp-vessel-name">{vesselNameB}</span>
                    {evt.event_count > 1 && (
                      <span className="chp-event-count">×{evt.event_count}</span>
                    )}
                  </div>

                  {/* Row 3: CPA / TCPA metrics */}
                  <div className="chp-metrics">
                    <div className="chp-metric">
                      <span className="chp-metric-lbl">CPA</span>
                      <span className="chp-metric-val" style={{ color: severityColor }}>
                        {evt.cpa_nm != null ? `${Number(evt.cpa_nm).toFixed(2)} NM` : '—'}
                      </span>
                    </div>
                    <div className="chp-metric-sep" />
                    <div className="chp-metric">
                      <span className="chp-metric-lbl">TCPA</span>
                      <span className="chp-metric-val" style={{ color: severityColor }}>
                        {evt.tcpa_min != null ? `${Math.round(evt.tcpa_min)} phút` : '—'}
                      </span>
                    </div>
                    <div className="chp-metric-sep" />
                    <div className="chp-metric">
                      <span className="chp-metric-lbl">Sự kiện</span>
                      <span className="chp-metric-val" style={{ color: '#94a3b8' }}>
                        {evt.event_count || 1} lần
                      </span>
                    </div>
                  </div>

                  {/* Row 4: Actions */}
                  <div className="chp-actions">
                    <button
                      className="chp-action-btn locate"
                      onClick={() => onLocate && onLocate(evt.vessel_id)}
                    >
                      <MapPin size={12} /> Định vị
                    </button>
                    {evt.status !== 'closed' && (
                      <button
                        className="chp-action-btn close-evt"
                        onClick={() => closeEvent(evt.id)}
                      >
                        <CheckCircle2 size={12} /> Đóng
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && events.length > 0 && (
            <button
              className="chp-load-more"
              onClick={() => fetchEvents(false)}
              disabled={loading}
            >
              {loading ? 'Đang tải...' : `Tải thêm (trang ${page + 1})`}
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        /* Overlay */
        .chp-overlay {
          position: fixed;
          inset: 0;
          z-index: 9600;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          pointer-events: none;
        }

        /* Panel */
        .chp-panel {
          pointer-events: all;
          width: 420px;
          max-height: calc(100vh - 76px);
          margin: 76px 0 0 16px;
          background: rgba(10, 18, 38, 0.97);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
          animation: chpSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          overflow: hidden;
        }
        @keyframes chpSlideIn {
          from { opacity: 0; transform: translateX(-24px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }

        /* Header */
        .chp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .chp-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chp-icon { color: #38bdf8; }
        .chp-title {
          font-size: 1rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0 0 2px;
        }
        .chp-subtitle {
          font-size: 0.72rem;
          color: #64748b;
        }
        .chp-header-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .chp-ctrl-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
          border-radius: 8px;
          padding: 7px;
          cursor: pointer;
          display: flex;
          align-items: center;
          position: relative;
          transition: all 0.2s;
        }
        .chp-ctrl-btn:hover { background: rgba(255,255,255,0.12); color: #f1f5f9; }
        .filter-btn { gap: 5px; padding: 7px 10px; font-size: 0.75rem; }
        .filter-dot {
          position: absolute;
          top: 4px; right: 4px;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #38bdf8;
        }
        .chp-close-btn {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #f87171;
          border-radius: 8px;
          padding: 7px;
          cursor: pointer;
          display: flex;
          transition: all 0.2s;
        }
        .chp-close-btn:hover { background: rgba(239,68,68,0.2); }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Filter bar */
        .chp-filter-bar {
          display: flex;
          gap: 6px;
          padding: 10px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .filter-chip {
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: #94a3b8;
          transition: all 0.2s;
        }
        .filter-chip:hover { background: rgba(255,255,255,0.1); color: #f1f5f9; }
        .filter-chip.active {
          background: rgba(56,189,248,0.15);
          border-color: rgba(56,189,248,0.4);
          color: #38bdf8;
        }

        /* Stats */
        .chp-stats {
          display: flex;
          padding: 10px 18px;
          gap: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .chp-stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
        }
        .chp-stat-val { font-weight: 800; font-size: 1rem; }
        .chp-stat-lbl { color: #64748b; font-size: 0.7rem; }

        /* List */
        .chp-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .chp-list::-webkit-scrollbar { width: 4px; }
        .chp-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        /* Empty */
        .chp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px 20px;
          color: #475569;
          font-size: 0.85rem;
          text-align: center;
        }
        .chp-spinner {
          width: 28px; height: 28px;
          border: 3px solid rgba(255,255,255,0.08);
          border-left-color: #38bdf8;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Card */
        .chp-card {
          position: relative;
          border: 1px solid;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(255,255,255,0.03);
          transition: background 0.2s;
        }
        .chp-card:hover { background: rgba(255,255,255,0.05); }
        .chp-stripe {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
        }
        .chp-card-inner {
          padding: 11px 14px 11px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .chp-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chp-severity {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.06em;
        }
        .chp-status-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .chp-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.65rem;
          color: #475569;
          margin-left: auto;
        }

        .chp-vessel-pair {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }
        .chp-vessel-name {
          font-size: 0.82rem;
          font-weight: 700;
          color: #e2e8f0;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chp-pair-arrow { font-weight: 800; font-size: 0.9rem; }
        .chp-event-count {
          font-size: 0.65rem;
          background: rgba(255,255,255,0.08);
          padding: 1px 6px;
          border-radius: 999px;
          color: #94a3b8;
          font-weight: 700;
        }

        .chp-metrics {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(0,0,0,0.25);
          border-radius: 8px;
          padding: 7px 12px;
        }
        .chp-metric { display: flex; flex-direction: column; gap: 1px; flex: 1; align-items: center; }
        .chp-metric-lbl { font-size: 0.58rem; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
        .chp-metric-val { font-size: 0.82rem; font-weight: 800; font-variant-numeric: tabular-nums; }
        .chp-metric-sep { width: 1px; height: 24px; background: rgba(255,255,255,0.07); flex-shrink: 0; }

        .chp-actions { display: flex; gap: 7px; }
        .chp-action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px;
          border-radius: 7px;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid;
          transition: all 0.2s;
        }
        .chp-action-btn.locate {
          background: rgba(56,189,248,0.08);
          border-color: rgba(56,189,248,0.25);
          color: #38bdf8;
        }
        .chp-action-btn.locate:hover { background: rgba(56,189,248,0.18); }
        .chp-action-btn.close-evt {
          background: rgba(16,185,129,0.08);
          border-color: rgba(16,185,129,0.25);
          color: #34d399;
        }
        .chp-action-btn.close-evt:hover { background: rgba(16,185,129,0.18); }

        /* Load more */
        .chp-load-more {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #64748b;
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chp-load-more:hover:not(:disabled) {
          background: rgba(56,189,248,0.08);
          color: #38bdf8;
          border-color: rgba(56,189,248,0.25);
        }
        .chp-load-more:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
