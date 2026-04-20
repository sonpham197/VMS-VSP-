import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { BarChart2, ShieldAlert, AlertTriangle, CheckCircle2, Users, LogOut, Ship } from 'lucide-react';

export default function TopBar({ vessels = [] }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const session = localStorage.getItem('vms_session');
    if (session) {
      try { setCurrentUser(JSON.parse(session)); } catch { }
    }
  }, []);

  const vList = Array.isArray(vessels) ? vessels : [];
  const normalCount = vList.filter(v => (v?.status?.toLowerCase() || 'normal') === 'normal').length;
  const warningCount = vList.filter(v => v?.status?.toLowerCase() === 'warning').length;
  const dangerCount = vList.filter(v => v?.status?.toLowerCase() === 'danger').length;

  const handleLogout = () => {
    localStorage.removeItem('vms_session');
    router.push('/login');
  };

  return (
    <div className="topbar">
      <div className="brand">
        <BarChart2 className="icon" />
        <h2>VMS Dashboard</h2>
      </div>

      <div className="stats-container">
        <div className="stat-item total">
          <span className="label">Total Vessels</span>
          <span className="value">{vessels.length}</span>
        </div>

        <div className="divider"></div>

        <div className="stat-item status-normal">
          <CheckCircle2 size={18} className="icon" />
          <span className="label">Normal</span>
          <span className="value">{normalCount}</span>
        </div>

        <div className="stat-item status-warning">
          <AlertTriangle size={18} className="icon" />
          <span className="label">Warning</span>
          <span className="value">{warningCount}</span>
        </div>

        <div className="stat-item status-danger">
          <ShieldAlert size={18} className="icon" />
          <span className="label">Danger</span>
          <span className="value">{dangerCount}</span>
        </div>
      </div>

      <div className="nav-area">
        <button className="nav-btn vessels-btn" onClick={() => router.push('/vessels')}>
          <Ship size={16} />
          <span>Tàu</span>
        </button>
        <button className="nav-btn customers-btn" onClick={() => router.push('/customers')}>
          <Users size={16} />
          <span>Khách hàng</span>
        </button>

        {currentUser && (
          <div className="user-info">
            <div className="avatar-mini">
              {currentUser.avatar_url
                ? <img src={currentUser.avatar_url} alt="" />
                : currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="user-name">{currentUser.name}</span>
          </div>
        )}

        <button className="nav-btn logout-btn" onClick={handleLogout} title="Đăng xuất">
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </div>

      <style jsx>{`
        .topbar {
          height: 64px;
          background-color: var(--bg-sidebar);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          padding: 0 24px;
          justify-content: space-between;
          color: var(--text-primary);
          gap: 16px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .brand h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }
        .stats-container {
          display: flex;
          align-items: center;
          gap: 24px;
          background: rgba(0, 0, 0, 0.2);
          padding: 8px 24px;
          border-radius: 9999px;
        }
        .stat-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .label {
          font-size: 0.8rem;
          text-transform: uppercase;
          color: var(--text-secondary);
          letter-spacing: 0.05em;
        }
        .value {
          font-weight: 700;
          font-size: 1.1rem;
        }
        .total .value { color: white; }
        .divider {
          width: 1px;
          height: 24px;
          background: rgba(255, 255, 255, 0.1);
        }
        .status-normal { color: #34d399; }
        .status-warning { color: #fbbf24; }
        .status-danger { color: #f87171; }
        .status-normal .label, .status-warning .label, .status-danger .label {
          color: inherit;
          opacity: 0.8;
        }
        .nav-area {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .nav-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          border-radius: 10px;
          padding: 7px 14px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .customers-btn {
          background: rgba(56,189,248,0.1);
          border-color: rgba(56,189,248,0.25);
          color: #38bdf8;
        }
        .customers-btn:hover {
          background: rgba(56,189,248,0.2);
          color: #7dd3fc;
        }
        .vessels-btn {
          background: rgba(34,197,94,0.08);
          border-color: rgba(34,197,94,0.25);
          color: #4ade80;
        }
        .vessels-btn:hover {
          background: rgba(34,197,94,0.15);
          color: #86efac;
        }
        .logout-btn {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.25);
          color: #f87171;
        }
        .logout-btn:hover {
          background: rgba(239,68,68,0.15);
          color: #fca5a5;
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 5px 12px;
        }
        .avatar-mini {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0891b2, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          overflow: hidden;
          flex-shrink: 0;
        }
        .avatar-mini img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .user-name {
          font-size: 0.85rem;
          color: #cbd5e1;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
