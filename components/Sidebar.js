import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Ship, Navigation, Activity, Clock, Hash,
  Anchor, Flag, Ruler, Weight, Calendar, User,
  MapPin, BarChart2, Info, ExternalLink, Palette, X
} from 'lucide-react';

const STATUS_CONFIG = {
  normal:  { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'BÌNH THƯỜNG', glow: 'rgba(16,185,129,0.3)' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'CẢNH BÁO',   glow: 'rgba(245,158,11,0.3)'  },
  danger:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'NGUY HIỂM',  glow: 'rgba(239,68,68,0.3)'   },
  unknown: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'KHÔNG CÓ TÍN HIỆU', glow: 'rgba(148,163,184,0.15)' },
};

const FLAGS = {
  VN: '🇻🇳', SG: '🇸🇬', JP: '🇯🇵', KR: '🇰🇷',
  CN: '🇨🇳', PA: '🇵🇦', MH: '🇲🇭', LR: '🇱🇷', BS: '🇧🇸',
};

function InfoRow({ icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="info-row">
      <div className="info-row-icon">{icon}</div>
      <div className="info-row-content">
        <span className="info-label">{label}</span>
        <span className="info-value">{value}</span>
      </div>
      <style jsx>{`
        .info-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);}
        .info-row:last-child{border-bottom:none;}
        .info-row-icon{color:#475569;flex-shrink:0;width:16px;display:flex;align-items:center;justify-content:center;}
        .info-row-content{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;}
        .info-label{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.06em;color:#475569;font-weight:700;}
        .info-value{font-size:0.88rem;color:#e2e8f0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      `}</style>
    </div>
  );
}

export default function Sidebar({ selectedVessel, vessels = [], onClose }) {
  const router = useRouter();
  const [bgColor, setBgColor] = useState('#0f172a'); // default dark sidebar bg

  useEffect(() => {
    const saved = localStorage.getItem('sidebarBgColor');
    if (saved) {
      Promise.resolve().then(() => {
        setBgColor(saved);
      });
    }
  }, []);

  const handleBgColorChange = (e) => {
    const hex = e.target.value;
    setBgColor(hex);
    localStorage.setItem('sidebarBgColor', hex);
  };

  const statusCfg = STATUS_CONFIG[selectedVessel?.status?.toLowerCase()] || STATUS_CONFIG.unknown;

  // Vessel counts for sidebar stats panel
  const vList = Array.isArray(vessels) ? vessels : [];
  const counts = {
    total:   vList.length,
    normal:  vList.filter(v => v?.status?.toLowerCase() === 'normal').length,
    warning: vList.filter(v => v?.status?.toLowerCase() === 'warning').length,
    danger:  vList.filter(v => v?.status?.toLowerCase() === 'danger').length,
    unknown: vList.filter(v => !v?.status || v?.status?.toLowerCase() === 'unknown').length,
  };

  return (
    <div className="sidebar" style={{ background: bgColor }}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <BarChart2 size={16} className="sh-icon" />
          <h2>Chi tiết Tàu</h2>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} title="Đổi màu nền thẻ">
          <input 
            type="color" 
            value={bgColor} 
            onChange={handleBgColorChange} 
            style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 2 }} 
          />
          <Palette size={16} className="sh-icon" style={{ zIndex: 1 }} />
        </div>
      </div>

      {selectedVessel ? (
        <div className="vessel-info">
          {/* Close button */}
          {onClose && (
            <button className="close-btn" onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', zIndex: 11 }}>
              <X size={20} />
            </button>
          )}
          {/* Vessel Image */}
          {selectedVessel.image_url && (
            <div className="vessel-img-wrap">
              <img src={selectedVessel.image_url} alt={selectedVessel.Vessel_name} className="vessel-img" />
              <div className="vessel-img-overlay" />
            </div>
          )}

          {/* Status + Name */}
          <div className="vessel-hero">
            <div className="status-badge" style={{ 
              color: statusCfg.color, 
              background: statusCfg.bg,
              border: `1px solid ${statusCfg.color}33`,
              boxShadow: `0 0 15px ${statusCfg.glow}`
            }}>
              <span className="status-dot" style={{ background: statusCfg.color }} />
              {statusCfg.label}
            </div>
            <h3 className="vessel-name">{selectedVessel.Vessel_name}</h3>
            {selectedVessel.vessel_type && (
              <span className="vessel-type-tag">{selectedVessel.vessel_type}</span>
            )}
          </div>

          {/* Dynamic (realtime) data */}
          <div className="section-label">📡 Vị trí & Hành trình</div>
          <div className="info-card">
            <InfoRow icon={<Activity size={14}/>} label="Tốc độ" value={selectedVessel.speed != null ? `${Number(selectedVessel.speed).toFixed(1)} knots` : null} />
            <InfoRow icon={<Navigation size={14}/>} label="Hướng" value={selectedVessel.heading != null ? `${selectedVessel.heading}°` : null} />
            <InfoRow icon={<MapPin size={14}/>} label="Vĩ độ (Lat)" value={selectedVessel.lat != null ? selectedVessel.lat.toFixed(5) : null} />
            <InfoRow icon={<MapPin size={14}/>} label="Kinh độ (Lng)" value={selectedVessel.lng != null ? selectedVessel.lng.toFixed(5) : null} />
            <InfoRow icon={<Clock size={14}/>} label="Cập nhật" value={selectedVessel.created_at ? new Date(selectedVessel.created_at).toLocaleString('vi-VN') : null} />
          </div>

          {/* Static vessel info */}
          <div className="section-label">🚢 Thông tin tàu</div>
          <div className="info-card">
            <InfoRow icon={<Hash size={14}/>} label="Vessel ID" value={selectedVessel.Vessel_id} />
            <InfoRow icon={<Anchor size={14}/>} label="Số IMO" value={selectedVessel.IMO} />
            <InfoRow icon={<Hash size={14}/>} label="Số MMSI" value={selectedVessel.MMSI} />
            <InfoRow icon={<Flag size={14}/>} label="Cờ hiệu" value={
              selectedVessel.flag
                ? `${FLAGS[selectedVessel.flag] || ''} ${selectedVessel.flag}`
                : null
            } />
            <InfoRow icon={<User size={14}/>} label="Chủ tàu" value={selectedVessel.owner} />
            <InfoRow icon={<Calendar size={14}/>} label="Năm đóng" value={selectedVessel.year_built} />
          </div>

          {/* Technical specs */}
          {(selectedVessel.length_m || selectedVessel.width_m || selectedVessel.gross_tonnage) && (
            <>
              <div className="section-label">📐 Thông số kỹ thuật</div>
              <div className="specs-grid">
                {selectedVessel.length_m && (
                  <div className="spec-box">
                    <Ruler size={14} className="spec-icon"/>
                    <div className="spec-val">{selectedVessel.length_m} m</div>
                    <div className="spec-label">Chiều dài</div>
                  </div>
                )}
                {selectedVessel.width_m && (
                  <div className="spec-box">
                    <Ruler size={14} className="spec-icon" style={{transform:'rotate(90deg)'}}/>
                    <div className="spec-val">{selectedVessel.width_m} m</div>
                    <div className="spec-label">Chiều rộng</div>
                  </div>
                )}
                {selectedVessel.gross_tonnage && (
                  <div className="spec-box">
                    <Weight size={14} className="spec-icon"/>
                    <div className="spec-val">{Number(selectedVessel.gross_tonnage).toLocaleString()}</div>
                    <div className="spec-label">DWT</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Description */}
          {selectedVessel.description && (
            <div className="vessel-desc">
              <Info size={13} />
              <p>{selectedVessel.description}</p>
            </div>
          )}

          {/* Quick link to vessel detail */}
          <button className="view-detail-btn" onClick={() => router.push('/vessels')}>
            <ExternalLink size={14} /> Quản lý đội tàu
          </button>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-ship-wrapper">
            <Ship size={48} className="empty-icon" />
          </div>
          <p className="empty-title">Chưa chọn tàu</p>
          <p className="empty-sub">Nhấp chuột phải vào tàu trên bản đồ để xem thông tin và hành trình.</p>

          {/* Status counts panel */}
          {counts.total > 0 && (
            <div className="sidebar-counts">
              <div className="counts-title">Tổng quan đội tàu</div>
              <div className="counts-grid">
                <div className="count-cell total">
                  <span className="count-num">{counts.total}</span>
                  <span className="count-lbl">Tổng</span>
                </div>
                <div className="count-cell normal">
                  <span className="count-num">{counts.normal}</span>
                  <span className="count-lbl">Bình thường</span>
                </div>
                <div className="count-cell warning">
                  <span className="count-num">{counts.warning}</span>
                  <span className="count-lbl">Cảnh báo</span>
                </div>
                <div className="count-cell danger">
                  <span className="count-num">{counts.danger}</span>
                  <span className="count-lbl">Nguy hiểm</span>
                </div>
                {counts.unknown > 0 && (
                  <div className="count-cell unknown">
                    <span className="count-num">{counts.unknown}</span>
                    <span className="count-lbl">Mất tín hiệu</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .sidebar {
          display: flex; flex-direction: column;
          flex: 1; min-width: 300px; max-width: 340px;
          color: var(--text-primary);
          height: 100%; overflow-y: auto;
          box-shadow: -4px 0 20px rgba(0,0,0,0.3);
          scrollbar-width: thin;
          scrollbar-color: rgba(56,189,248,0.2) transparent;
          transition: background-color 0.3s ease;
        }
        .sidebar-header {
          display: flex; align-items: center; gap: 10px;
          padding: 18px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(0,0,0,0.15);
          position: sticky; top: 0; z-index: 10;
        }
        .sh-icon { color: #38bdf8; }
        .sidebar-header h2 { font-weight: 700; font-size: 1rem; margin: 0; }
        .vessel-info { display: flex; flex-direction: column; }
        .vessel-img-wrap { position: relative; height: 160px; overflow: hidden; }
        .vessel-img { width: 100%; height: 100%; object-fit: cover; }
        .vessel-img-overlay { position: absolute; bottom: 0; left: 0; right: 0; height: 50%; background: linear-gradient(to top, var(--bg-sidebar), transparent); }
        .vessel-hero { padding: 16px 20px 12px; }
        .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 12px; backdrop-filter: blur(4px); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; animation: statusPulse 1.5s infinite; }
        @keyframes statusPulse { 0%{transform:scale(1); opacity:1; box-shadow: 0 0 0 0 currentColor;} 70%{transform:scale(1.1); opacity:0.7; box-shadow: 0 0 0 6px rgba(0,0,0,0);} 100%{transform:scale(1); opacity:1; box-shadow: 0 0 0 0 rgba(0,0,0,0);} }
        .vessel-name { font-size: 1.25rem; font-weight: 800; margin: 0 0 6px; color: #f1f5f9; line-height: 1.2; }
        .vessel-type-tag { display: inline-block; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); color: #38bdf8; border-radius: 6px; padding: 2px 10px; font-size: 0.72rem; font-weight: 600; }
        .section-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; padding: 12px 20px 4px; }
        .info-card { margin: 0 12px 4px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 4px 12px; }
        .specs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 12px 4px; }
        .spec-box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 10px 8px; text-align: center; }
        .spec-icon { color: #38bdf8; margin: 0 auto 4px; display: block; }
        .spec-val { font-size: 0.88rem; font-weight: 700; color: #f1f5f9; }
        .spec-label { font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        .vessel-desc { display: flex; gap: 8px; margin: 4px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 10px 12px; color: #94a3b8; font-size: 0.8rem; line-height: 1.5; }
        .vessel-desc p { margin: 0; }
        .view-detail-btn { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 12px 12px 20px; background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2); color: #38bdf8; border-radius: 10px; padding: 9px 0; cursor: pointer; font-size: 0.84rem; font-weight: 600; transition: all 0.2s; width: calc(100% - 24px); }
        .view-detail-btn:hover { background: rgba(56,189,248,0.15); }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; gap: 12px; }
        .empty-ship-wrapper { width: 80px; height: 80px; border-radius: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: center; }
        .empty-icon { color: #334155; }
        .empty-title { font-size: 1rem; font-weight: 600; color: #64748b; margin: 0; }
        .empty-sub { font-size: 0.8rem; color: #475569; line-height: 1.6; margin: 0; }
        .sidebar-counts { width: 100%; margin-top: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 12px; }
        .counts-title { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 10px; }
        .counts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .count-cell { display: flex; flex-direction: column; align-items: center; padding: 10px 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); }
        .count-num { font-size: 1.4rem; font-weight: 800; line-height: 1; }
        .count-lbl { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; opacity: 0.8; }
        .count-cell.total { background: rgba(248,250,252,0.05); color: #f8fafc; }
        .count-cell.normal { background: rgba(16,185,129,0.08); color: #10b981; }
        .count-cell.warning { background: rgba(245,158,11,0.08); color: #f59e0b; }
        .count-cell.danger { background: rgba(239,68,68,0.08); color: #ef4444; }
        .count-cell.unknown { background: rgba(148,163,184,0.06); color: #94a3b8; }
      `}</style>
    </div>
  );
}
