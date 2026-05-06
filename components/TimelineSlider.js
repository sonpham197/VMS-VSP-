import React from 'react';

export default function TimelineSlider({ value, onChange }) {
  const getLabel = (val) => {
    if (val === 0) return 'Hiện tại';
    if (val < 0) return `${Math.abs(val)}h trước`;
    return `Dự báo +${val}h`;
  };

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <span>🕒 Thời gian (Quá khứ / Dự báo)</span>
        <span className="timeline-current">{getLabel(value)}</span>
      </div>
      <input 
        type="range" 
        min="-12" 
        max="12" 
        step="1" 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="timeline-input"
      />
      <div className="timeline-marks">
        <span>-12h</span>
        <span>Hiện tại</span>
        <span>+12h</span>
      </div>
      <style jsx>{`
        .timeline-container {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          width: 400px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 12px 20px;
          z-index: 1000;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          color: white;
          animation: slideUp 0.3s ease;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .timeline-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          margin-bottom: 12px;
          color: #94a3b8;
          font-weight: 600;
        }
        .timeline-current {
          color: #38bdf8;
          font-weight: 700;
          background: rgba(56,189,248,0.1);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .timeline-input {
          width: 100%;
          cursor: pointer;
          accent-color: #38bdf8;
        }
        .timeline-marks {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 6px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
