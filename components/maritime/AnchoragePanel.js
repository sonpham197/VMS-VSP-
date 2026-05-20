/**
 * components/maritime/AnchoragePanel.js
 * Anchorage occupancy + vessel waiting time visualization
 */
import { useState, useEffect } from 'react';
import { Anchor, Clock, AlertTriangle } from 'lucide-react';

const ZONES = [
  { id:1, name:'Neo Cát Hải', max:30, zone_type:'anchorage' },
  { id:2, name:'Neo Lạch Huyện', max:20, zone_type:'anchorage' },
  { id:3, name:'Cảng Lạch Huyện', max:10, zone_type:'berth' },
  { id:4, name:'Cảng Hải Phòng', max:15, zone_type:'berth' },
];

function OccupancyBar({ current, max, color }) {
  const pct = Math.min(100, current / max * 100);
  const barColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : color;
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'#64748b', marginBottom:4 }}>
        <span>{current}/{max} tàu</span>
        <span style={{ fontWeight:700, color:barColor }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height:10, background:'rgba(255,255,255,0.06)', borderRadius:999, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:barColor, borderRadius:999, transition:'width 0.8s ease' }}/>
      </div>
    </div>
  );
}

export default function AnchoragePanel() {
  const [zones, setZones] = useState(ZONES.map(z => ({ ...z, current: Math.floor(z.max * 0.4), avg_wait: 5.5 })));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      setZones(prev => prev.map(z => ({
        ...z,
        current: Math.floor(Math.random() * z.max * 0.75),
        avg_wait: +(Math.random() * 20 + 2).toFixed(1)
      })));
    });

    const t = setInterval(() => {
      setZones(prev => prev.map(z => ({
        ...z,
        current: Math.max(0, z.current + Math.floor((Math.random()-0.4)*3)),
        avg_wait: +(z.avg_wait + (Math.random()-0.5) * 0.5).toFixed(1),
      })));
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const totalAnchored = zones.filter(z=>z.zone_type==='anchorage').reduce((s,z)=>s+z.current,0);
  const totalBerthed  = zones.filter(z=>z.zone_type==='berth').reduce((s,z)=>s+z.current,0);
  const avgWait = (zones.reduce((s,z)=>s+z.avg_wait,0)/zones.length).toFixed(1);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {[
          { label:'Tàu đang neo', value:totalAnchored, icon:Anchor, color:'#f59e0b' },
          { label:'Tàu đang cập bến', value:totalBerthed, icon:Anchor, color:'#10b981' },
          { label:'Thời gian chờ TB', value:`${avgWait}h`, icon:Clock, color:'#38bdf8' },
        ].map(s => (
          <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <s.icon size={22} color={s.color}/>
            <div>
              <div style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600, textTransform:'uppercase' }}>{s.label}</div>
              <div style={{ fontSize:'1.2rem', fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Zone cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
        {zones.map(z => {
          const pct = z.current / z.max * 100;
          const isHigh = pct > 80;
          const color = z.zone_type === 'berth' ? '#10b981' : '#f59e0b';
          return (
            <div key={z.id} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${isHigh ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius:14, padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <Anchor size={15} color={color}/>
                <span style={{ fontWeight:700, color:'#e2e8f0', fontSize:'0.88rem' }}>{z.name}</span>
                {isHigh && <AlertTriangle size={13} color="#ef4444"/>}
                <span style={{ marginLeft:'auto', fontSize:'0.68rem', background:`${color}22`, color, padding:'2px 8px', borderRadius:999, fontWeight:700 }}>
                  {z.zone_type === 'berth' ? 'Bến' : 'Neo'}
                </span>
              </div>
              <OccupancyBar current={z.current} max={z.max} color={color}/>
              <div style={{ marginTop:10, display:'flex', gap:16, fontSize:'0.72rem', color:'#64748b' }}>
                <span><Clock size={11} style={{verticalAlign:'middle', marginRight:3}}/>Chờ TB: <b style={{color:'#94a3b8'}}>{z.avg_wait}h</b></span>
                <span>Sức chứa: <b style={{color:'#94a3b8'}}>{z.max} tàu</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Waiting time distribution chart (canvas) */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:16 }}>
        <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
          <Clock size={15}/> Phân phối thời gian chờ (giờ)
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80 }}>
          {[2,5,8,4,3,6,9,7,5,3,2,1].map((v,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ width:'100%', background:'rgba(56,189,248,0.6)', borderRadius:'4px 4px 0 0', height:`${v/9*70}px`, transition:'height 0.5s' }}/>
              <span style={{ fontSize:'0.6rem', color:'#475569' }}>{(i+1)*4}h</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
