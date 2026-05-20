import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Bell, ShieldAlert, AlertTriangle, Info, CheckCircle, X, MapPin, Anchor, Navigation } from 'lucide-react';

export default function AlertDrawer({ isOpen, onClose, onLocate, liveCollisionRisks = [] }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('zone'); // 'zone' | 'collision'

  const fetchAlerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('alerts')
      .select('*, vessels!alerts_vessel_id_fkey(Vessel_name)')
      .in('status', ['open', 'acknowledged'])   // chỉ lấy alerts còn hoạt động
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) console.error('Error fetching alerts:', error);
    else setAlerts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    async function init() {
      if (active) {
        await fetchAlerts();
      }
    }
    init();

    // Realtime subscription
    const channel = supabase.channel('public:alerts_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, payload => {
        if (payload.eventType === 'INSERT') {
          // Re-fetch để lấy dữ liệu join với vessels
          fetchAlerts();
        } else if (payload.eventType === 'UPDATE') {
          // Nếu alert bị resolved → xóa khỏi danh sách
          if (payload.new.status === 'resolved' || payload.new.status === 'dismissed') {
            setAlerts(prev => prev.filter(a => a.id !== payload.new.id));
          } else {
            // Cập nhật nhưng giữ nguyên trường join (vessels)
            setAlerts(prev => prev.map(a =>
              a.id === payload.new.id
                ? { ...payload.new, vessels: a.vessels }  // giữ lại vessels join
                : a
            ));
          }
        } else if (payload.eventType === 'DELETE') {
          setAlerts(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAcknowledge = async (id) => {
    const { error } = await supabase
      .from('alerts')
      .update({ status: 'acknowledged' })
      .eq('id', id);
    if (error) console.error(error);
  };

  const statusColors = {
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'danger': return <ShieldAlert size={20} color={statusColors.danger} />;
      case 'warning': return <AlertTriangle size={20} color={statusColors.warning} />;
      default: return <Info size={20} color={statusColors.info} />;
    }
  };

  if (!isOpen) return null;

  const zoneAlerts       = alerts.filter(a => !a.alert_type || a.alert_type === 'zone_violation' || a.alert_type === 'speed_limit');
  const dbCollisionAlerts = alerts.filter(a => a.alert_type === 'collision_risk');

  // Merge: DB records (ground truth) + live risks từ engine chưa có trong DB
  // Composite key giống API: sort([idA, idB]).join('__')
  const dbKeys = new Set(
    dbCollisionAlerts
      .filter(a => a.vessel_id && a.vessel_id_b)
      .map(a => [a.vessel_id, a.vessel_id_b].sort().join('__'))
  );
  const liveOnlyRisks = liveCollisionRisks.filter(r => {
    const key = [r.vesselA.Vessel_id, r.vesselB.Vessel_id].sort().join('__');
    return !dbKeys.has(key);
  }).map(r => ({
    // Đổi sang format tương thích AlertCard
    id:          `live__${r.id}`,
    alert_type:  'collision_risk',
    severity:    r.risk_level,
    status:      'open',
    vessel_id:   r.vesselA.Vessel_id,
    vessel_id_b: r.vesselB.Vessel_id,
    cpa_nm:      r.cpa_nm,
    tcpa_min:    r.tcpa_min,
    description: `Va chạm tiềm ẩn (real-time): CPA ${r.cpa_nm.toFixed(2)} NM, TCPA ${Math.round(r.tcpa_min)} phút`,
    created_at:  r.detectedAt,
    vessels:     { Vessel_name: r.vesselA.Vessel_name || r.vesselA.Vessel_id },
    _live: true,   // đánh dấu là real-time, chưa persist
  }));

  const collisionAlerts  = [...dbCollisionAlerts, ...liveOnlyRisks];
  const displayedAlerts  = activeTab === 'collision' ? collisionAlerts : zoneAlerts;

  return (
    <div className="alert-drawer-overlay">
      <div className="alert-drawer">
        <div className="drawer-header">
          <div className="header-title">
            <Bell size={22} className="bell-icon" />
            <h2>Cảnh báo hệ thống</h2>
            <span className="count-badge">{alerts.filter(a => a.status === 'open').length}</span>
          </div>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>

        {/* Tab switcher */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'zone' ? 'active' : ''}`}
            onClick={() => setActiveTab('zone')}
          >
            <Anchor size={14} />
            Vùng cảnh báo
            {zoneAlerts.length > 0 && <span className="tab-count">{zoneAlerts.length}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'collision' ? 'active-collision' : ''}`}
            onClick={() => setActiveTab('collision')}
          >
            <Navigation size={14} />
            Va chạm
            {collisionAlerts.length > 0 && (
              <span className="tab-count tab-count-danger">{collisionAlerts.length}</span>
            )}
          </button>
        </div>

        <div className="drawer-content">
          {loading ? (
            <div className="empty-state">Đang tải cảnh báo...</div>
          ) : displayedAlerts.length === 0 ? (
            <div className="empty-state">Không có cảnh báo nào</div>
          ) : (
            displayedAlerts.map(alert => (
              <div 
                key={alert.id} 
                className={`alert-card ${alert.status}`}
                style={{ borderLeft: `4px solid ${statusColors[alert.severity] || '#ccc'}` }}
              >
                <div className="alert-card-header">
                  {getAlertIcon(alert.severity)}
                  <span className="vessel-name">
                    {alert.vessels?.Vessel_name || alert.vessel_id}
                    {alert.vessel_id_b && (
                      <span style={{ color: '#64748b', fontWeight: 400 }}> ↔ {alert.vessel_id_b}</span>
                    )}
                  </span>
                  {alert._live && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>LIVE</span>
                  )}
                  <span className="alert-time">{new Date(alert.created_at).toLocaleTimeString()}</span>
                </div>
                
                <div className="alert-body">
                  <p className="alert-description">{alert.description}</p>
                  {alert.event_count > 1 && (
                    <div className="event-badge">Đã diễn ra {alert.event_count} lần</div>
                  )}
                  {alert.cpa_nm != null && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.78rem', color: '#94a3b8' }}>
                      <span>CPA: <b style={{ color: statusColors[alert.severity] }}>{Number(alert.cpa_nm).toFixed(2)} NM</b></span>
                      <span>TCPA: <b style={{ color: statusColors[alert.severity] }}>{Math.round(alert.tcpa_min)} ph</b></span>
                    </div>
                  )}
                </div>

                <div className="alert-actions">
                  <button className="action-btn map" onClick={() => onLocate(alert)}>
                    <MapPin size={16} /> Định vị
                  </button>
                  {!alert._live && alert.status === 'open' && (
                    <button className="action-btn ack" onClick={() => handleAcknowledge(alert.id)}>
                      <CheckCircle size={16} /> Chấp nhận
                    </button>
                  )}
                  {alert.status === 'acknowledged' && (
                    <span className="status-label"><CheckCircle size={14} /> Đã tiếp nhận</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .alert-drawer-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 10000;
          display: flex;
          justify-content: flex-end;
          backdrop-filter: blur(4px);
        }
        .alert-drawer {
          width: 400px;
          background: #0f172a;
          height: 100%;
          box-shadow: -10px 0 30px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .drawer-header {
          padding: 20px 24px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tab-bar {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 0 12px;
          gap: 4px;
        }
        .tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 8px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: -1px;
        }
        .tab-btn:hover { color: #94a3b8; }
        .tab-btn.active {
          color: #38bdf8;
          border-bottom-color: #38bdf8;
        }
        .tab-btn.active-collision {
          color: #ef4444;
          border-bottom-color: #ef4444;
        }
        .tab-count {
          background: rgba(255,255,255,0.1);
          color: #94a3b8;
          font-size: 0.65rem;
          padding: 1px 6px;
          border-radius: 999px;
          font-weight: 700;
        }
        .tab-count-danger {
          background: rgba(239,68,68,0.2);
          color: #fca5a5;
        }
        .header-title { display: flex; align-items: center; gap: 12px; }
        .header-title h2 { font-size: 1.25rem; font-weight: 600; color: #f8fafc; margin: 0; }
        .bell-icon { color: #38bdf8; }
        .count-badge {
          background: #ef4444;
          color: white;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 700;
        }
        .close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; }
        .drawer-content { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .empty-state { text-align: center; color: #64748b; margin-top: 40px; }
        
        .alert-card {
          background: #1e293b;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: transform 0.2s;
        }
        .alert-card.acknowledged { opacity: 0.7; }
        .alert-card-header { display: flex; align-items: center; gap: 8px; }
        .vessel-name { font-weight: 700; color: #f1f5f9; flex: 1; }
        .alert-time { font-size: 0.75rem; color: #64748b; }
        
        .alert-description { font-size: 0.875rem; color: #cbd5e1; margin: 0; line-height: 1.5; }
        .event-badge { 
          display: inline-block; 
          margin-top: 8px; 
          font-size: 0.7rem; 
          background: rgba(255,255,255,0.05); 
          padding: 2px 8px; 
          border-radius: 4px; 
          color: #94a3b8; 
        }
        
        .alert-actions { display: flex; gap: 12px; margin-top: 4px; }
        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .action-btn.map { background: #334155; color: #f1f5f9; }
        .action-btn.map:hover { background: #475569; }
        .action-btn.ack { background: #059669; color: white; }
        .action-btn.ack:hover { background: #10b981; }
        .status-label { font-size: 0.8rem; color: #10b981; display: flex; align-items: center; gap: 4px; }
      `}</style>
    </div>
  );
}
