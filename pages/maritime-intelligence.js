/**
 * pages/maritime-intelligence.js
 * AI Maritime Intelligence Dashboard
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Activity, AlertTriangle, Anchor, BarChart2, Clock,
  RefreshCw, Ship, TrendingUp, Zap, ChevronRight,
  Package, Layers, Bell, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { CLASS_ICONS, CLASS_COLORS } from '@/lib/maritimeAI';

const ForecastChart   = dynamic(() => import('@/components/maritime/ForecastChart'),   { ssr: false });
const DensityMap      = dynamic(() => import('@/components/maritime/DensityMap'),      { ssr: false });
const AnomalyFeed     = dynamic(() => import('@/components/maritime/AnomalyFeed'),     { ssr: false });
const AnchoragePanel  = dynamic(() => import('@/components/maritime/AnchoragePanel'),  { ssr: false });

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#38bdf8', change, hint }) {
  const isPos = change > 0;
  return (
    <div className="kpi-card has-tooltip">
      <div className="kpi-icon" style={{ background: `${color}22`, color }}>
        <Icon size={20} />
      </div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
      {change !== undefined && (
        <div className={`kpi-change ${isPos ? 'pos' : 'neg'}`}>
          {isPos ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}
          {Math.abs(change)}%
        </div>
      )}
      {hint && <div className="kpi-tooltip">{hint}</div>}
    </div>
  );
}

// ─── Congestion Gauge ─────────────────────────────────────────────────────────
function CongestionGauge({ value = 0 }) {
  const pct = Math.min(1, value);
  const color = pct > 0.7 ? '#ef4444' : pct > 0.4 ? '#f59e0b' : '#10b981';
  const deg = pct * 180;
  return (
    <div className="gauge-wrap has-tooltip">
      <div className="gauge-arc-container">
        <svg viewBox="0 0 120 65" width="160" height="90">
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round"/>
          <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke={color} strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${pct * 157} 157`}
            style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s' }}/>
          <text x="60" y="55" textAnchor="middle" fill={color} fontSize="18" fontWeight="800">
            {Math.round(pct * 100)}%
          </text>
        </svg>
      </div>
      <div className="gauge-label" style={{ color }}>
        {pct > 0.7 ? '🔴 Tắc nghẽn cao' : pct > 0.4 ? '🟡 Trung bình' : '🟢 Bình thường'}
      </div>
      <div className="kpi-tooltip">
        Trạng thái tắc nghẽn hiện tại của toàn bộ cảng. Nếu trên 70%, các tàu sắp tới nên giảm tốc độ hoặc chuyển hướng để tránh ùn ứ.
      </div>
    </div>
  );
}

// ─── Vessel Class Distribution Bar ───────────────────────────────────────────
function ClassDistribution({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div className="class-dist">
      {data.map(d => (
        <div key={d.class_code} className="class-row">
          <span className="class-icon">{CLASS_ICONS[d.class_code] || '🚢'}</span>
          <span className="class-name">{d.label}</span>
          <div className="class-bar-wrap">
            <div className="class-bar-fill" style={{
              width: `${d.count / total * 100}%`,
              background: CLASS_COLORS[d.class_code] || '#64748b',
            }}/>
          </div>
          <span className="class-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MaritimeIntelligence() {
  const [kpiData,      setKpiData]      = useState(null);
  const [anomalyData,  setAnomalyData]  = useState(null);
  const [activeTab,    setActiveTab]    = useState('overview');
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [forecastHorizon, setForecastHorizon] = useState(7);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, anomalyRes] = await Promise.all([
        fetch('/api/maritime/kpis?days=90'),
        fetch('/api/maritime/anomalies'),
      ]);
      const [kpi, anomaly] = await Promise.all([kpiRes.json(), anomalyRes.json()]);
      setKpiData(kpi);
      setAnomalyData(anomaly);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[maritime-intelligence]', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(fetchAll, 60000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const s = kpiData?.summary || {};
  const forecasts = forecastHorizon === 7 ? kpiData?.forecasts7d : kpiData?.forecasts30d;

  // Vessel class distribution (derived from KPI context)
  const classDist = [
    { class_code: 'container',    label: 'Container',      count: 15 },
    { class_code: 'bulk_carrier', label: 'Hàng rời',       count: 15 },
    { class_code: 'tanker',       label: 'Tàu dầu',        count: 12 },
    { class_code: 'general_cargo',label: 'Hàng tổng hợp',  count: 18 },
    { class_code: 'tugboat',      label: 'Tàu lai',        count: 10 },
    { class_code: 'fishing',      label: 'Tàu cá',         count: 15 },
    { class_code: 'passenger',    label: 'Hành khách',     count: 5  },
    { class_code: 'offshore_support', label: 'Dịch vụ biển', count: 10 },
  ];

  const tabs = [
    { id:'overview',  label:'Tổng quan',    icon: Activity },
    { id:'forecast',  label:'Dự báo AI',    icon: TrendingUp },
    { id:'heatmap',   label:'Mật độ',       icon: Layers },
    { id:'anomalies', label:'Cảnh báo',     icon: Bell },
    { id:'anchorage', label:'Neo đậu',      icon: Anchor },
  ];

  return (
    <>
      <Head>
        <title>Trí tuệ Hàng hải AI — VMS Maritime Intelligence</title>
        <meta name="description" content="Hệ thống giám sát, phân tích và dự báo cảng biển thông minh cho khu vực Hải Phòng"/>
      </Head>

      <div className="mi-shell">
        {/* ── Top bar ── */}
        <header className="mi-topbar">
          <div className="mi-brand">
            <div className="mi-brand-icon">🧠</div>
            <div>
              <div className="mi-brand-title">Trí tuệ Hàng hải AI</div>
              <div className="mi-brand-sub">Cảng Hải Phòng · Vịnh Bắc Bộ</div>
            </div>
          </div>
          <nav className="mi-tabs">
            {tabs.map(t => (
              <button key={t.id} className={`mi-tab ${activeTab===t.id?'active':''}`}
                onClick={() => setActiveTab(t.id)}>
                <t.icon size={15}/> {t.label}
              </button>
            ))}
          </nav>
          <div className="mi-actions">
            {lastRefresh && (
              <span className="mi-refresh-time">
                Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}
              </span>
            )}
            <button className="mi-btn-refresh" onClick={fetchAll} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''}/>
            </button>
            <Link href="/" className="mi-btn-back">
              <ChevronRight size={14}/> Bản đồ chính
            </Link>
          </div>
        </header>

        {/* ── KPI Bar ── */}
        <div className="mi-kpi-bar">
          <KpiCard icon={Package} label="Sản lượng hôm nay" color="#3b82f6"
            value={s.throughput_today ? `${(s.throughput_today/1000).toFixed(1)}k tấn` : '—'}
            change={s.throughput_change_pct}
            sub={`7 ngày: ${s.throughput_7d ? (s.throughput_7d/1000).toFixed(0)+'k tấn' : '—'}`}
            hint="Tổng ước lượng khối lượng hàng hóa thông qua cảng (Dựa trên mớn nước và DWT thực tế) trong 24h qua." />
          <KpiCard icon={Ship} label="Tàu vào hôm nay" color="#10b981"
            value={s.vessel_arrivals_today ?? '—'}
            sub={`30 ngày: ${s.vessel_count_30d ?? '—'} lượt`}
            hint="Số lượng tàu thuyền đi vào khu vực neo đậu hoặc cập bến trong ngày hôm nay." />
          <KpiCard icon={Clock} label="Thời gian chờ TB" color="#f59e0b"
            value={s.avg_wait_hours_today ? `${s.avg_wait_hours_today.toFixed(1)}h` : '—'}
            sub="Trung bình 7 ngày"
            hint="Thời gian trung bình một con tàu phải neo chờ tại vùng neo Cát Hải trước khi được điều động vào cầu bến." />
          <KpiCard icon={Zap} label="Chỉ số tắc nghẽn" color="#ef4444"
            value={s.congestion_index_today ? `${(s.congestion_index_today*100).toFixed(0)}%` : '—'}
            sub={`Bến: ${s.berth_occupancy_today?.toFixed(0) ?? '—'}% chiếm dụng`}
            hint="Chỉ số tổng hợp phản ánh mức độ kẹt cảng. Tính toán từ hệ số chiếm dụng bến và tỷ lệ tàu phải neo chờ." />
          <KpiCard icon={BarChart2} label="Sản lượng 30 ngày" color="#a78bfa"
            value={s.throughput_30d ? `${(s.throughput_30d/1000).toFixed(0)}k tấn` : '—'}
            sub="Dự báo tháng tới ↗"
            hint="Tổng sản lượng hàng hóa luân chuyển qua cụm cảng trong 30 ngày qua (dữ liệu lịch sử)." />
        </div>

        {/* ── Main content ── */}
        <main className="mi-main">
          {activeTab === 'overview' && (
            <div className="mi-grid">
              {/* Congestion gauge */}
              <div className="mi-card span-1">
                <div className="mi-card-title"><Zap size={16}/> Tắc nghẽn thời gian thực</div>
                <CongestionGauge value={s.congestion_index_today || 0}/>
                <div className="mi-card-meta" style={{marginTop:12, color:'#64748b', fontSize:'0.78rem'}}>
                  Chỉ số 0–100% dựa trên mật độ tàu + thời gian chờ bến
                </div>
              </div>

              {/* Vessel class distribution */}
              <div className="mi-card span-2 has-tooltip">
                <div className="mi-card-title"><Ship size={16}/> Phân loại đội tàu (100 tàu demo)</div>
                <ClassDistribution data={classDist}/>
                <div className="kpi-tooltip">
                  Thống kê số lượng phương tiện theo chuẩn phân loại IMO. Giúp đánh giá cơ cấu trọng tải đang lưu thông trong khu vực.
                </div>
              </div>

              {/* AI anomaly summary */}
              <div className="mi-card span-1 has-tooltip">
                <div className="mi-card-title"><AlertTriangle size={16}/> Cảnh báo đang mở</div>
                {anomalyData?.summary ? (
                  <div className="anomaly-summary">
                    <div className="anom-badge critical">{anomalyData.summary.by_severity?.critical || 0} Nghiêm trọng</div>
                    <div className="anom-badge warning">{anomalyData.summary.by_severity?.warning || 0} Cảnh báo</div>
                    <div className="anom-badge info">{anomalyData.summary.by_severity?.info || 0} Thông tin</div>
                    <div className="anom-total">Tổng {anomalyData.summary.total_open || 0} sự kiện đang mở</div>
                  </div>
                ) : <div className="mi-empty">Đang tải...</div>}
                <div className="kpi-tooltip">
                  Các sự kiện bất thường được AI phát hiện (VD: Sai lệch lộ trình, Mất tín hiệu AIS, Thay đổi mớn nước bất thường).
                </div>
              </div>

              {/* 7-day forecast preview */}
              <div className="mi-card span-4">
                <div className="mi-card-title"><TrendingUp size={16}/> Dự báo sản lượng 7 ngày (AI XGBoost)</div>
                {kpiData?.forecasts7d ? (
                  <ForecastChart data={kpiData.forecasts7d} history={kpiData.kpis?.slice(-14)}/>
                ) : <div className="mi-empty">Đang tải dự báo...</div>}
              </div>
            </div>
          )}

          {activeTab === 'forecast' && (
            <div className="mi-grid">
              <div className="mi-card span-4">
                <div className="mi-card-title" style={{justifyContent:'space-between', display:'flex', alignItems:'center'}}>
                  <span><TrendingUp size={16}/> Dự báo AI — {forecastHorizon === 7 ? '7 ngày' : '30 ngày'}</span>
                  <div className="horizon-switch">
                    {[7,30].map(h => (
                      <button key={h} className={`horizon-btn ${forecastHorizon===h?'active':''}`}
                        onClick={() => setForecastHorizon(h)}>{h} ngày</button>
                    ))}
                  </div>
                </div>
                {forecasts
                  ? <ForecastChart data={forecasts} history={kpiData.kpis?.slice(-30)} height={340}/>
                  : <div className="mi-empty">Đang tính toán...</div>}
              </div>
              <div className="mi-card span-4">
                <div className="mi-card-title"><BarChart2 size={16}/> Chi tiết dự báo ngày</div>
                <div className="forecast-table-wrap">
                  <table className="forecast-table">
                    <thead><tr><th>Ngày</th><th>Sản lượng (tấn)</th><th>Tàu vào</th><th>Tắc nghẽn</th><th>Khoảng tin cậy</th></tr></thead>
                    <tbody>
                      {(forecasts || []).map(f => (
                        <tr key={f.day}>
                          <td>{f.date}</td>
                          <td style={{color:'#38bdf8', fontWeight:700}}>{f.throughput_tons?.toLocaleString()}</td>
                          <td>{f.vessel_arrivals || '—'}</td>
                          <td>
                            <span className={`cong-pill ${f.congestion_index>0.7?'high':f.congestion_index>0.4?'mid':'low'}`}>
                              {Math.round(f.congestion_index*100)}%
                            </span>
                          </td>
                          <td style={{color:'#475569', fontSize:'0.75rem'}}>
                            {f.confidence_low?.toLocaleString()} – {f.confidence_high?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'heatmap' && <div className="mi-card mi-fullcard"><DensityMap/></div>}
          {activeTab === 'anomalies' && (
            <div className="mi-card mi-fullcard">
              <AnomalyFeed data={anomalyData} onRefresh={fetchAll}/>
            </div>
          )}
          {activeTab === 'anchorage' && (
            <div className="mi-card mi-fullcard"><AnchoragePanel/></div>
          )}
        </main>
      </div>

      <style jsx global>{`
        /* Shell */
        .mi-shell { display:flex; flex-direction:column; height:100vh; background:#070f1f; color:#e2e8f0; font-family:inherit; overflow:hidden; }

        /* Topbar */
        .mi-topbar { display:flex; align-items:center; gap:20px; padding:0 20px; height:58px; background:rgba(10,18,38,0.98); border-bottom:1px solid rgba(56,189,248,0.15); flex-shrink:0; }
        .mi-brand { display:flex; align-items:center; gap:12px; }
        .mi-brand-icon { font-size:1.6rem; }
        .mi-brand-title { font-size:0.95rem; font-weight:800; color:#f8fafc; letter-spacing:0.02em; }
        .mi-brand-sub { font-size:0.68rem; color:#475569; }
        .mi-tabs { display:flex; gap:4px; flex:1; justify-content:center; }
        .mi-tab { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; border:1px solid transparent; background:transparent; color:#64748b; font-size:0.8rem; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .mi-tab:hover { color:#e2e8f0; background:rgba(255,255,255,0.05); }
        .mi-tab.active { background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3); }
        .mi-actions { display:flex; align-items:center; gap:8px; }
        .mi-refresh-time { font-size:0.7rem; color:#475569; }
        .mi-btn-refresh { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; border-radius:8px; padding:6px; cursor:pointer; display:flex; transition:all 0.2s; }
        .mi-btn-refresh:hover { background:rgba(56,189,248,0.1); color:#38bdf8; }
        .mi-btn-back { display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:transparent; color:#94a3b8; font-size:0.78rem; text-decoration:none; transition:all 0.2s; }
        .mi-btn-back:hover { color:#f1f5f9; background:rgba(255,255,255,0.06); }

        /* KPI bar */
        .mi-kpi-bar { display:flex; gap:10px; padding:12px 20px; background:rgba(10,18,38,0.7); border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; overflow-x:auto; }
        .kpi-card { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:12px 16px; min-width:180px; flex:1; }
        .kpi-icon { border-radius:10px; padding:8px; display:flex; flex-shrink:0; }
        .kpi-body { flex:1; }
        .kpi-label { font-size:0.68rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
        .kpi-value { font-size:1.1rem; font-weight:800; color:#f8fafc; margin:2px 0; }
        .kpi-sub { font-size:0.68rem; color:#475569; }
        .kpi-change { display:flex; align-items:center; gap:2px; font-size:0.72rem; font-weight:700; padding:3px 6px; border-radius:6px; flex-shrink:0; }
        .kpi-change.pos { color:#34d399; background:rgba(52,211,153,0.1); }
        .kpi-change.neg { color:#f87171; background:rgba(248,113,113,0.1); }

        /* Tooltips */
        .has-tooltip { position: relative; cursor: help; }
        .kpi-tooltip {
          position: absolute;
          top: 115%;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
          background: rgba(15,23,42,0.95);
          color: #e2e8f0;
          font-size: 0.75rem;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid rgba(56,189,248,0.3);
          width: max-content;
          max-width: 260px;
          white-space: normal;
          text-align: center;
          line-height: 1.4;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 25px rgba(0,0,0,0.6);
          z-index: 9999;
        }
        .has-tooltip:hover .kpi-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        /* Main */
        .mi-main { flex:1; overflow-y:auto; padding:16px 20px; }
        .mi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .mi-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:16px; }
        .mi-fullcard { min-height:calc(100vh - 200px); }
        .span-1 { grid-column:span 1; }
        .span-2 { grid-column:span 2; }
        .span-4 { grid-column:span 4; }
        .mi-card-title { display:flex; align-items:center; gap:8px; font-size:0.82rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:14px; }
        .mi-empty { color:#475569; font-size:0.85rem; padding:20px; text-align:center; }

        /* Gauge */
        .gauge-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; }
        .gauge-label { font-size:0.8rem; font-weight:700; }

        /* Class distribution */
        .class-dist { display:flex; flex-direction:column; gap:8px; }
        .class-row { display:flex; align-items:center; gap:8px; }
        .class-icon { font-size:1rem; width:22px; text-align:center; flex-shrink:0; }
        .class-name { font-size:0.75rem; color:#94a3b8; width:120px; flex-shrink:0; }
        .class-bar-wrap { flex:1; height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden; }
        .class-bar-fill { height:100%; border-radius:4px; transition:width 0.8s ease; }
        .class-count { font-size:0.75rem; font-weight:700; color:#e2e8f0; width:28px; text-align:right; }

        /* Anomaly summary */
        .anomaly-summary { display:flex; flex-direction:column; gap:8px; }
        .anom-badge { padding:8px 12px; border-radius:8px; font-size:0.78rem; font-weight:700; }
        .anom-badge.critical { background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); }
        .anom-badge.warning  { background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); }
        .anom-badge.info     { background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.25); }
        .anom-total { font-size:0.72rem; color:#475569; padding-top:4px; }

        /* Forecast table */
        .forecast-table-wrap { overflow-x:auto; }
        .forecast-table { width:100%; border-collapse:collapse; font-size:0.8rem; }
        .forecast-table th { padding:8px 12px; text-align:left; color:#64748b; font-size:0.7rem; font-weight:700; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.06); }
        .forecast-table td { padding:9px 12px; border-bottom:1px solid rgba(255,255,255,0.04); }
        .forecast-table tr:hover td { background:rgba(255,255,255,0.02); }
        .cong-pill { padding:2px 8px; border-radius:999px; font-size:0.7rem; font-weight:700; }
        .cong-pill.high { background:rgba(239,68,68,0.15); color:#f87171; }
        .cong-pill.mid  { background:rgba(245,158,11,0.15); color:#fbbf24; }
        .cong-pill.low  { background:rgba(16,185,129,0.15); color:#34d399; }

        /* Horizon switch */
        .horizon-switch { display:flex; gap:4px; }
        .horizon-btn { padding:4px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#64748b; font-size:0.75rem; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .horizon-btn.active { background:rgba(56,189,248,0.15); color:#38bdf8; border-color:rgba(56,189,248,0.3); }

        /* Animations */
        .spin { animation:spinAnim 1s linear infinite; }
        @keyframes spinAnim { to { transform:rotate(360deg); } }

        /* Scrollbar */
        .mi-main::-webkit-scrollbar { width:4px; }
        .mi-main::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
      `}</style>
    </>
  );
}
