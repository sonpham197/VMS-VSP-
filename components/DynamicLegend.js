import React from 'react';

export default function DynamicLegend({ activeLayer }) {
  if (!activeLayer) return null;

  const getLegendData = () => {
    switch (activeLayer) {
      case 'marine':
        return {
          title: 'Ký hiệu Hải đồ (OpenSeaMap)',
          type: 'icons',
          items: [
            { icon: '🏮', label: 'Hải đăng (Lighthouse)' },
            { icon: '🛟', label: 'Phao tiêu (Buoys)' },
            { icon: '⚓', label: 'Khu neo đậu (Anchorage)' },
            { icon: '⚠️', label: 'Chướng ngại vật / Đá ngầm' },
            { icon: '⛴️', label: 'Luồng tàu (Fairway)' },
            { icon: '💥', label: 'Xác tàu đắm (Wreck)' }
          ]
        };
      case 'temp':
        return {
          title: 'Nhiệt độ (°C)',
          type: 'gradient',
          colors: ['#3b82f6', '#2dd4bf', '#fde047', '#f97316', '#ef4444', '#9f1239'],
          labels: ['-10', '0', '10', '20', '30', '40+']
        };
      case 'waves':
        return {
          title: 'Tốc độ Hải lưu & Sóng (m/s)',
          type: 'gradient',
          colors: ['#023858', '#045a8d', '#0570b0', '#3690c0', '#74a9cf', '#a6bddb', '#d0d1e6', '#ece7f2'].reverse(),
          labels: ['0', '0.2', '0.5', '0.8', '1.0', '1.5', '2.0', '2.5+']
        };
      case 'wind':
        return {
          title: 'Tốc độ gió (m/s)',
          type: 'gradient',
          colors: ['#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#fee08b', '#fdae61', '#f46d43', '#d53e4f'],
          labels: ['0', '5', '10', '15', '20', '25', '30', '35+']
        };
      case 'rain':
        return {
          title: 'Lượng mưa (mm/h)',
          type: 'gradient',
          colors: ['#0ff', '#00f', '#0f0', '#ff0', '#f90', '#f00', '#f0f'],
          labels: ['0.1', '1', '2.5', '5', '10', '25', '50+']
        };
      default:
        return null;
    }
  };

  const data = getLegendData();
  if (!data) return null;

  return (
    <div className="dynamic-legend">
      <div className="legend-title">{data.title}</div>
      
      {data.type === 'gradient' && (
        <div className="legend-scale">
          {data.colors.map((color, idx) => (
            <div key={idx} className="legend-item">
              <div className="color-box" style={{ backgroundColor: color }}></div>
              <span className="color-label">{data.labels[idx]}</span>
            </div>
          ))}
        </div>
      )}

      {data.type === 'icons' && (
        <div className="legend-icons">
          {data.items.map((item, idx) => (
            <div key={idx} className="icon-row">
              <span className="icon-symbol">{item.icon}</span>
              <span className="icon-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .dynamic-legend {
          position: absolute;
          bottom: 30px;
          right: 20px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 8px 12px;
          z-index: 1000;
          color: white;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .legend-title {
          font-size: 0.7rem;
          font-weight: 700;
          color: #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        .legend-scale {
          display: flex;
          align-items: center;
        }
        .legend-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 32px;
        }
        .color-box {
          height: 6px;
          width: 100%;
        }
        .legend-item:first-child .color-box {
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
        }
        .legend-item:last-child .color-box {
          border-top-right-radius: 4px;
          border-bottom-right-radius: 4px;
        }
        .color-label {
          font-size: 0.6rem;
          color: #94a3b8;
          margin-top: 4px;
        }
        .legend-icons {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          padding-top: 4px;
        }
        .icon-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .icon-symbol {
          font-size: 0.9rem;
          width: 20px;
          text-align: center;
        }
        .icon-label {
          font-size: 0.75rem;
          color: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
