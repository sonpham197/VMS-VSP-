/**
 * components/maritime/DensityMap.js
 * Leaflet map with AIS heatmap + real-time vessel positions
 */
import { useEffect, useState, useRef } from 'react';
import { Layers, RefreshCw, Thermometer } from 'lucide-react';

export default function DensityMap() {
  const mapRef    = useRef(null);
  const leafletRef = useRef(null);
  const heatLayerRef = useRef(null);
  const [statusCount, setStatusCount] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let map, L, heat;
    let isMounted = true;

    async function init() {
      if (typeof window === 'undefined') return;
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      const LH = (await import('leaflet.heat')).default;

      if (!isMounted) return;

      if (mapRef.current && !leafletRef.current) {
        map = L.map(mapRef.current, { center: [20.78, 106.88], zoom: 11 });
        leafletRef.current = map;

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '©OpenStreetMap ©Carto', maxZoom: 18,
        }).addTo(map);

        // Fetch heatmap data
        const res = await fetch('/api/maritime/density?hours=24');
        const d = await res.json();
        
        if (!isMounted) return;

        setStatusCount(d.statusCount || {});

        if (d.heatmapPoints?.length && leafletRef.current) {
          heat = L.heatLayer(d.heatmapPoints, {
            radius: 25, blur: 18, maxZoom: 14,
            gradient: { 0.2:'#1e40af', 0.5:'#0ea5e9', 0.7:'#f59e0b', 1:'#ef4444' },
          }).addTo(map);
          heatLayerRef.current = heat;
        }

        // Port zone overlays
        const ZONES = [
          { coords:[[20.76,106.88],[20.76,106.95],[20.82,106.95],[20.82,106.88]], name:'Neo Cát Hải', color:'#f59e0b' },
          { coords:[[20.73,106.79],[20.73,106.87],[20.78,106.87],[20.78,106.79]], name:'Neo Lạch Huyện', color:'#f59e0b' },
          { coords:[[20.74,106.80],[20.74,106.85],[20.77,106.85],[20.77,106.80]], name:'Cảng Lạch Huyện', color:'#3b82f6' },
          { coords:[[20.85,106.63],[20.85,106.72],[20.90,106.72],[20.90,106.63]], name:'Cảng Hải Phòng', color:'#10b981' },
        ];
        ZONES.forEach(z => {
          L.polygon(z.coords, { color: z.color, fillColor: z.color, fillOpacity: 0.08, weight: 1.5, dashArray:'5,5' })
            .bindTooltip(z.name, { permanent: false, direction:'center' })
            .addTo(map);
        });

        setLoading(false);
      }
    }

    init();
    return () => { 
      isMounted = false;
      if (leafletRef.current) { 
        leafletRef.current.remove(); 
        leafletRef.current = null; 
      } 
    };
  }, []);

  const total = Object.values(statusCount).reduce((s,v)=>s+v,0) || 1;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:12 }}>
      {/* Stats strip */}
      <div style={{ display:'flex', gap:12, flexShrink:0 }}>
        {[
          { label:'Đang hành trình', key:'underway', color:'#38bdf8' },
          { label:'Đang neo', key:'anchored', color:'#f59e0b' },
          { label:'Đang cập bến', key:'moored', color:'#10b981' },
          { label:'Đang đánh bắt', key:'fishing', color:'#06b6d4' },
        ].map(s => (
          <div key={s.key} style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 14px' }}>
            <div style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label}</div>
            <div style={{ fontSize:'1.1rem', fontWeight:800, color:s.color, marginTop:2 }}>{statusCount[s.key] ?? 0}</div>
            <div style={{ fontSize:'0.7rem', color:'#475569' }}>{Math.round((statusCount[s.key]||0)/total*100)}% tổng</div>
          </div>
        ))}
      </div>

      {/* Map legend */}
      <div style={{ display:'flex', alignItems:'center', gap:16, flexShrink:0, padding:'8px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', fontSize:'0.72rem', color:'#64748b' }}>
        <Thermometer size={13}/> <span>Cường độ mật độ AIS:</span>
        {['Thấp','Trung bình','Cao','Rất cao'].map((l,i) => (
          <span key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:12, height:8, borderRadius:2, display:'inline-block', background:['#1e40af','#0ea5e9','#f59e0b','#ef4444'][i] }}/>
            {l}
          </span>
        ))}
      </div>

      {/* Map container */}
      <div style={{ flex:1, borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', position:'relative', minHeight:400 }}>
        {loading && (
          <div style={{ position:'absolute', inset:0, background:'rgba(7,15,31,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, color:'#38bdf8', flexDirection:'column', gap:10 }}>
            <div style={{ width:32, height:32, border:'3px solid rgba(255,255,255,0.1)', borderLeftColor:'#38bdf8', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:'0.85rem' }}>Đang tải heatmap...</span>
          </div>
        )}
        <div ref={mapRef} style={{ width:'100%', height:'100%', minHeight:400 }}/>
      </div>
      <style jsx>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
