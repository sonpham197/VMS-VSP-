import React, { useState } from 'react';
import { Layers, PenTool, ChevronDown, Wind, CloudRain, Anchor, Waves, Thermometer, ShieldAlert } from 'lucide-react';

export default function DashboardMenu({ activeLayer, setActiveLayer, isDrawing, setIsDrawing, showWarningZones, setShowWarningZones }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleLayer = (layer) => {
    setActiveLayer(activeLayer === layer ? null : layer);
  };

  return (
    <div className="dashboard-menu">
      <button className="menu-trigger" onClick={() => setIsOpen(!isOpen)}>
        <Layers size={18} />
        <span>Công cụ & Lớp Bản đồ</span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="menu-dropdown">
          <div className="menu-section">
            <div className="section-title">VÙNG CẢNH BÁO</div>
            <button className={`tool-btn ${showWarningZones ? 'active' : ''}`} onClick={() => setShowWarningZones(!showWarningZones)}>
              <ShieldAlert size={16} />
              <span>{showWarningZones ? 'Đang hiển thị vùng' : 'Đã ẩn vùng'}</span>
            </button>
            <button className={`tool-btn ${isDrawing ? 'active' : ''}`} onClick={() => setIsDrawing(!isDrawing)}>
              <PenTool size={16} />
              <span>{isDrawing ? 'Đang vẽ (Nhấn để hủy)' : 'Vẽ vùng mới'}</span>
            </button>
          </div>

          <div className="menu-section">
            <div className="section-title">LỚP THỜI TIẾT</div>
            <button className={`layer-btn ${activeLayer === 'temp' ? 'active' : ''}`} onClick={() => toggleLayer('temp')}>
              <Thermometer size={16} /> Nhiệt độ (Heatmap)
            </button>
            <button className={`layer-btn ${activeLayer === 'waves' ? 'active' : ''}`} onClick={() => toggleLayer('waves')}>
              <Waves size={16} /> Sóng & Hải lưu (Particle)
            </button>
            <button className={`layer-btn ${activeLayer === 'wind' ? 'active' : ''}`} onClick={() => toggleLayer('wind')}>
              <Wind size={16} /> Gió (Particle)
            </button>
            <button className={`layer-btn ${activeLayer === 'rain' ? 'active' : ''}`} onClick={() => toggleLayer('rain')}>
              <CloudRain size={16} /> Mưa / Bão (Radar)
            </button>
            <div className="section-title" style={{ marginTop: 10 }}>HÀNG HẢI</div>
            <button className={`layer-btn ${activeLayer === 'marine' ? 'active' : ''}`} onClick={() => toggleLayer('marine')}>
              <Anchor size={16} /> Hải đồ (OpenSeaMap)
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard-menu {
          position: absolute;
          top: 15px;
          right: 15px;
          z-index: 1000;
        }
        .menu-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: white;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          transition: all 0.2s;
        }
        .menu-trigger:hover {
          background: rgba(30, 41, 59, 0.95);
        }
        .chevron {
          transition: transform 0.3s;
        }
        .chevron.open {
          transform: rotate(180deg);
        }
        .menu-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: slideDown 0.2s ease;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .menu-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .section-title {
          font-size: 0.7rem;
          color: #94a3b8;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 2px;
        }
        .tool-btn, .layer-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: 1px solid transparent;
          color: #e2e8f0;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .tool-btn:hover, .layer-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .tool-btn.active {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .layer-btn.active {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.3);
        }
      `}</style>
    </div>
  );
}
