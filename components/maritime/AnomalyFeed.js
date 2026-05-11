/**
 * components/maritime/AnomalyFeed.js
 * Live scrolling anomaly + alert feed with acknowledge/resolve actions
 */
import { useState } from 'react';
import { AlertTriangle, ShieldAlert, Info, CheckCircle2, X, RefreshCw } from 'lucide-react';

const TYPE_LABELS = {
  congestion:         'Tắc nghẽn',
  eta_deviation:      'Lệch ETA',
  abnormal_anchorage: 'Neo bất thường',
  suspicious_movement:'Di chuyển khả nghi',
  traffic_surge:      'Gia tăng lưu lượng',
  speed_anomaly:      'Tốc độ bất thường',
  zone_intrusion:     'Xâm phạm vùng cấm',
};

const SEVERITY_CFG = {
  critical: { color:'#ef4444', bg:'rgba(239,68,68,0.12)', border:'rgba(239,68,68,0.3)', icon: ShieldAlert, label:'Nghiêm trọng' },
  warning:  { color:'#f59e0b', bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.3)', icon: AlertTriangle, label:'Cảnh báo' },
  info:     { color:'#38bdf8', bg:'rgba(56,189,248,0.08)', border:'rgba(56,189,248,0.25)', icon: Info, label:'Thông tin' },
};

function AnomalyCard({ a, onAction }) {
  const cfg = SEVERITY_CFG[a.severity] || SEVERITY_CFG.info;
  const Icon = cfg.icon;
  const typeLabel = TYPE_LABELS[a.anomaly_type] || a.anomaly_type;
  const time = new Date(a.detected_at).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

  return (
    <div className="anom-card" style={{ borderColor: cfg.border, background: cfg.bg }}>
      <div className="anom-stripe" style={{ background: cfg.color }}/>
      <div className="anom-inner">
        <div className="anom-header">
          <Icon size={14} color={cfg.color}/>
          <span className="anom-severity" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="anom-type-tag">{typeLabel}</span>
          <span className="anom-time">{time}</span>
          <span className={`anom-status-badge status-${a.status}`}>{a.status === 'open' ? 'Đang mở' : a.status === 'acknowledged' ? 'Đã ghi nhận' : 'Đã đóng'}</span>
        </div>
        <div className="anom-title">{a.title}</div>
        <div className="anom-desc">{a.description}</div>
        {a.metadata && (
          <div className="anom-meta">
            {Object.entries(a.metadata).map(([k,v]) => (
              <span key={k} className="meta-chip">{k}: <b>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</b></span>
            ))}
          </div>
        )}
        {a.status !== 'resolved' && (
          <div className="anom-actions">
            {a.status === 'open' && (
              <button className="anom-btn ack" onClick={() => onAction(a.id, 'acknowledge')}>
                <CheckCircle2 size={12}/> Ghi nhận
              </button>
            )}
            <button className="anom-btn resolve" onClick={() => onAction(a.id, 'resolve')}>
              <X size={12}/> Đóng
            </button>
          </div>
        )}
      </div>
      <style jsx>{`
        .anom-card { position:relative; border:1px solid; border-radius:12px; overflow:hidden; margin-bottom:8px; }
        .anom-stripe { position:absolute; left:0; top:0; bottom:0; width:3px; }
        .anom-inner { padding:12px 14px 12px 18px; display:flex; flex-direction:column; gap:6px; }
        .anom-header { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
        .anom-severity { font-size:0.7rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; }
        .anom-type-tag { font-size:0.68rem; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; padding:1px 7px; border-radius:999px; }
        .anom-time { font-size:0.65rem; color:#475569; margin-left:auto; }
        .anom-status-badge { font-size:0.65rem; font-weight:700; padding:2px 8px; border-radius:999px; }
        .status-open { background:rgba(239,68,68,0.15); color:#f87171; }
        .status-acknowledged { background:rgba(245,158,11,0.15); color:#fbbf24; }
        .status-resolved { background:rgba(16,185,129,0.15); color:#34d399; }
        .anom-title { font-size:0.85rem; font-weight:700; color:#f1f5f9; }
        .anom-desc { font-size:0.78rem; color:#94a3b8; line-height:1.5; }
        .anom-meta { display:flex; gap:6px; flex-wrap:wrap; }
        .meta-chip { font-size:0.68rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:#64748b; padding:2px 8px; border-radius:6px; }
        .meta-chip b { color:#94a3b8; }
        .anom-actions { display:flex; gap:6px; }
        .anom-btn { display:flex; align-items:center; gap:5px; padding:5px 10px; border-radius:7px; font-size:0.72rem; font-weight:600; cursor:pointer; border:1px solid; transition:all 0.2s; }
        .anom-btn.ack { background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.3); color:#fbbf24; }
        .anom-btn.ack:hover { background:rgba(245,158,11,0.2); }
        .anom-btn.resolve { background:rgba(16,185,129,0.1); border-color:rgba(16,185,129,0.3); color:#34d399; }
        .anom-btn.resolve:hover { background:rgba(16,185,129,0.2); }
      `}</style>
    </div>
  );
}

export default function AnomalyFeed({ data, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const open    = data?.open    || [];
  const history = data?.history || [];
  const summary = data?.summary || {};

  const filtered = filter === 'all' ? open
    : filter === 'history' ? history
    : open.filter(a => a.severity === filter);

  async function handleAction(id, action) {
    await fetch('/api/maritime/anomalies', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, action }),
    });
    onRefresh?.();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:12 }}>
      {/* Summary strip */}
      <div style={{ display:'flex', gap:10, flexShrink:0 }}>
        {[
          { label:'Nghiêm trọng', count:summary.by_severity?.critical||0, color:'#ef4444' },
          { label:'Cảnh báo', count:summary.by_severity?.warning||0, color:'#f59e0b' },
          { label:'Thông tin', count:summary.by_severity?.info||0, color:'#38bdf8' },
          { label:'Tổng đang mở', count:summary.total_open||0, color:'#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 14px' }}>
            <div style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600 }}>{s.label}</div>
            <div style={{ fontSize:'1.2rem', fontWeight:800, color:s.color }}>{s.count}</div>
          </div>
        ))}
        <button onClick={onRefresh} style={{ padding:'0 14px', background:'rgba(56,189,248,0.1)', border:'1px solid rgba(56,189,248,0.25)', color:'#38bdf8', borderRadius:10, cursor:'pointer' }}>
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
        {['all','critical','warning','info','history'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'5px 12px', borderRadius:999, fontSize:'0.75rem', fontWeight:600, cursor:'pointer', border:'1px solid', transition:'all 0.2s',
              background: filter===f ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
              color: filter===f ? '#38bdf8' : '#64748b',
              borderColor: filter===f ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.1)',
            }}>
            {{ all:'Tất cả', critical:'Nghiêm trọng', warning:'Cảnh báo', info:'Thông tin', history:'Lịch sử' }[f]}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ flex:1, overflowY:'auto', paddingRight:4 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', color:'#475569', padding:'40px 20px', fontSize:'0.85rem' }}>
            Không có cảnh báo nào trong bộ lọc này
          </div>
        )}
        {filtered.map(a => <AnomalyCard key={a.id} a={a} onAction={handleAction}/>)}
      </div>
    </div>
  );
}
