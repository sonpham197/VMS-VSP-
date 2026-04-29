import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import AlertDrawer from '@/components/AlertDrawer';
import { supabase } from '@/lib/supabaseClient';
import { Bell } from 'lucide-react';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <div className="spinner" />
      Loading Map Data...
    </div>
  )
});

// ── Helpers: WKT parsing & Point-in-Polygon ─────────────────────────────
function parseWKT(wkt) {
  if (!wkt || typeof wkt !== 'string') return [];
  try {
    const coordsPart = wkt.replace('POLYGON((', '').replace('))', '');
    return coordsPart.split(',').map(pair => {
      const [lng, lat] = pair.trim().split(' ').map(Number);
      return [lat, lng];
    });
  } catch { return []; }
}

function pointInPolygon(lat, lng, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0], xi = polygon[i][1];
    const yj = polygon[j][0], xj = polygon[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export default function Home() {
  const [vesselStatics, setVesselStatics] = useState([]);
  const [latestTracks, setLatestTracks] = useState({}); // { vesselId: { trackData } }
  const [openAlerts, setOpenAlerts] = useState([]);     // list of all open alerts
  const [zones, setZones] = useState([]);               // zone polygons for client-side check
  const [activeTrackData, setActiveTrackData] = useState([]);
  const [predictedTracks, setPredictedTracks] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState(null);
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);

  // ── Derived State: Merged Vessels ────────────────────────────────────────
  const vessels = useMemo(() => {
    // Pre-parse zone polygons once
    const parsedZones = zones.map(z => ({
      severity: z.severity,
      polygon: parseWKT(z.geom_wkt),
    })).filter(z => z.polygon.length >= 3);

    return vesselStatics.map(v => {
      const track = latestTracks[v.Vessel_id];
      const vAlerts = openAlerts.filter(a => a.vessel_id === v.Vessel_id);

      // Nếu chưa có track → trạng thái 'unknown' (hiển thị màu xám)
      // Nếu có track → lấy status từ track, mặc định 'normal'
      let status = track ? (track.status || 'normal') : 'unknown';

      // Alert override: nếu có alert mở → đè lên status từ track
      if (vAlerts.length > 0) {
        const hasDanger = vAlerts.some(a =>
          a.severity === 'danger' || a.severity === 'critical' || a.severity === 'high'
        );
        status = hasDanger ? 'danger' : 'warning';
      }

      // Client-side zone violation check (fallback when SQL trigger isn't active)
      if (track && track.lat != null && track.lng != null && status === 'normal') {
        for (const z of parsedZones) {
          if (pointInPolygon(track.lat, track.lng, z.polygon)) {
            if (z.severity === 'danger') { status = 'danger'; break; }
            if (z.severity === 'warning' && status !== 'danger') { status = 'warning'; }
          }
        }
      }

      return {
        ...v,
        ...(track || {}),
        Vessel_id: v.Vessel_id, // Ensure consistent casing for child components
        status // Alert/zone status takes precedence
      };
    });
  }, [vesselStatics, latestTracks, openAlerts, zones]);

  const selectedVessel = useMemo(() => 
    vessels.find(v => v.Vessel_id === selectedVesselId),
  [vessels, selectedVesselId]);

  // ── Initial Data Fetch ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchInitialData = async () => {
      // 1. Fetch static vessel info
      const { data: vData } = await supabase.from('vessels').select('*');
      if (vData) setVesselStatics(vData);

      // 2. Fetch latest track per vessel using the optimized view
      const { data: tData, error: tError } = await supabase
        .from('vessel_current_positions')
        .select('Vessel_id, lat, lng, speed, heading, status, last_seen');
      
      if (!tError && tData) {
        const latest = {};
        tData.forEach(t => {
          if (t.Vessel_id && t.lat !== null) {
            // Map the view format back to track format
            latest[t.Vessel_id] = { ...t, created_at: t.last_seen };
          }
        });
        setLatestTracks(latest);
      }

      // NOTE: vessel_tracks status is updated AFTER INSERT by a trigger.
      // We re-fetch tracks after a short delay to get the trigger-updated status.
      setTimeout(async () => {
        const { data: tData2 } = await supabase
          .from('vessel_current_positions')
          .select('Vessel_id, lat, lng, speed, heading, status, last_seen');
        if (tData2) {
          const latest2 = {};
          tData2.forEach(t => {
            if (t.Vessel_id && t.lat !== null) {
              latest2[t.Vessel_id] = { ...t, created_at: t.last_seen };
            }
          });
          setLatestTracks(latest2);
        }
      }, 3000);

      // 3. Fetch all OPEN alerts
      const { data: aData, error: aError } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'open');
      
      if (!aError && aData) setOpenAlerts(aData);

      // 4. Fetch zone polygons for client-side violation check
      const { data: zData } = await supabase.from('zones_wkt_view').select('*');
      if (zData) setZones(zData);
    };

    fetchInitialData();
  }, []);

  // ── Helper: fetch latest tracks ────────────────────────────────────────────
  const refreshLatestTracks = useCallback(async () => {
    const { data } = await supabase
      .from('vessel_current_positions')
      .select('Vessel_id, lat, lng, speed, heading, status, last_seen');
    if (data) {
      const latest = {};
      data.forEach(t => {
        if (t.Vessel_id && t.lat !== null) {
          latest[t.Vessel_id] = { ...t, created_at: t.last_seen };
        }
      });
      setLatestTracks(latest);
    }
  }, []);

  // ── Realtime + Polling ──────────────────────────────────────────────────
  useEffect(() => {
    // A) Realtime: cập nhật vị trí + status khi có track INSERT hoặc UPDATE
    // Trigger SQL cập nhật status vào vessel_tracks sau INSERT → cần lắng nghe UPDATE
    const tracksSub = supabase.channel('public:vessel_tracks_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vessel_tracks' }, payload => {
        const newTrack = payload.new;
        const vid = newTrack.Vessel_id || newTrack.vessel_id;
        if (vid) {
          setLatestTracks(prev => ({ ...prev, [vid]: newTrack }));
          // Trigger SQL updates status separately after insert → re-fetch after short delay
          setTimeout(() => refreshLatestTracks(), 2000);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vessel_tracks' }, payload => {
        // Triggered when the detection function updates the status field
        const updatedTrack = payload.new;
        const vid = updatedTrack.Vessel_id || updatedTrack.vessel_id;
        if (vid) {
          setLatestTracks(prev => {
            // Only replace if this is the latest track for this vessel
            const existing = prev[vid];
            if (!existing || new Date(updatedTrack.created_at) >= new Date(existing.created_at)) {
              return { ...prev, [vid]: updatedTrack };
            }
            return prev;
          });
        }
      })
      .subscribe();

    // B) Realtime: lắng nghe bảng alerts (hoạt động nếu đã bật Realtime trên Supabase)
    const alertsSub = supabase.channel('public:alerts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        // Khi có bất kỳ thay đổi nào trong alerts → re-fetch toàn bộ open alerts
        supabase.from('alerts').select('*').eq('status', 'open')
          .then(({ data }) => { if (data) setOpenAlerts(data); });
      })
      .subscribe();

    // C) Polling dự phòng: cứ 10 giây cập nhật lại cả open alerts VÀ latest tracks
    // (Đảm bảo hoạt động ngay cả khi Realtime chưa bật)
    const pollInterval = setInterval(async () => {
      // Poll alerts
      const { data: alertData } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'open');
      if (alertData) setOpenAlerts(alertData);

      // Poll tracks để bắt status updates từ trigger SQL
      await refreshLatestTracks();
    }, 10000);

    return () => {
      supabase.removeChannel(tracksSub);
      supabase.removeChannel(alertsSub);
      clearInterval(pollInterval);
    };
  }, [refreshLatestTracks]);

  // ── Track History Request ─────────────────────────────────────────────────
  const handleTrackRequest = async (vesselId, hours) => {
    setPredictedTracks([]);
    setRouteData(null);
    const { data: latestData } = await supabase
      .from('vessel_tracks')
      .select('created_at')
      .eq('Vessel_id', vesselId)
      .order('created_at', { ascending: false })
      .limit(1);

    let baselineTime = new Date();
    if (latestData?.length > 0) baselineTime = new Date(latestData[0].created_at);
    const startTime = new Date(baselineTime);
    startTime.setHours(startTime.getHours() - hours);

    const { data: tData, error: tError } = await supabase
      .from('vessel_tracks')
      .select('*')
      .eq('Vessel_id', vesselId)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: true });

    if (tError) { console.error(tError); setActiveTrackData([]); }
    else setActiveTrackData(tData || []);
  };

  // ── AI Prediction Request ─────────────────────────────────────────────────
  const handlePredictionRequest = async (vesselId, hours) => {
    let visualAnchor = null;
    if (activeTrackData?.length > 0) {
      const vesselTracks = activeTrackData.filter(t => t.Vessel_id === vesselId);
      if (vesselTracks.length > 0) visualAnchor = vesselTracks[vesselTracks.length - 1];
    }
    setIsPredicting(true);
    setPredictedTracks([]);
    setRouteData(null);
    setActiveTrackData([]);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselId, hours, visualAnchor })
      });
      const data = await res.json();
      if (data.success) {
        setPredictedTracks(data.predictedPoints || []);
        if (data.isTerminatedByLand) alert('⚠️ ' + data.stopReason);
      } else {
        alert('Lỗi dự báo: ' + data.error);
      }
    } catch { alert('Lỗi mạng khi gọi API Dự Báo AI'); }
    setIsPredicting(false);
  };

  // ── Route Prediction Request ────────────────────────────────────────────────
  const handleRouteRequest = async (startVessel, destLat, destLng, criteria) => {
    setIsPredicting(true);
    setRouteData(null);
    setPredictedTracks([]);
    setActiveTrackData([]);
    try {
      const res = await fetch('/api/calculate-eta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startLat: startVessel.lat,
          startLng: startVessel.lng,
          destLat, destLng,
          speed: startVessel.speed,
          criteria
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        alert(`Lỗi API (${res.status}): ${errText.substring(0, 50)}...`);
        setIsPredicting(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setRouteData(data);
      } else {
        alert('Lỗi tính toán hải trình: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi khi tính toán hải trình');
    }
    setIsPredicting(false);
  };

  const handleLocateAlert = (alert) => {
    setSelectedVesselId(alert.vessel_id);
    setIsAlertDrawerOpen(false);
  };

  return (
    <>
      <Head>
        <title>Vessel Monitoring System</title>
        <meta name="description" content="Realtime Vessel Monitoring System" />
      </Head>

      <TopBar vessels={vessels} />

      <main className="layout">
        <div className="map-container" id="map-container">
          {isPredicting && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <div className="spinner" />
              <h3 style={{ marginTop: '20px' }}>Hệ thống đang tính toán...</h3>
            </div>
          )}
          <MapView
            vessels={vessels}
            tracks={activeTrackData}
            predictedTracks={predictedTracks}
            routeData={routeData}
            onSelectVessel={(v) => setSelectedVesselId(v.Vessel_id)}
            selectedVessel={selectedVessel}
            onTrackRequest={handleTrackRequest}
            onPredictionRequest={handlePredictionRequest}
            onRouteRequest={handleRouteRequest}
          />
        </div>
        <Sidebar selectedVessel={selectedVessel} vessels={vessels} />
      </main>

      <AlertDrawer
        isOpen={isAlertDrawerOpen}
        onClose={() => setIsAlertDrawerOpen(false)}
        onLocate={handleLocateAlert}
      />

      {/* Floating Alert Trigger Button */}
      <button
        className="alert-trigger-btn"
        onClick={() => setIsAlertDrawerOpen(true)}
      >
        <Bell size={20} />
      </button>

      <style jsx>{`
        .layout { display:flex; height:calc(100vh - 64px); width:100vw; overflow:hidden; background-color:#0f172a; }
        .map-container { flex:3; position:relative; }
        .map-loading { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background-color:#1e293b; color:#94a3b8; font-size:1.125rem; gap:16px; }
        .spinner { width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-left-color:#3b82f6; border-radius:50%; animation:spin 1s linear infinite; }
        .alert-trigger-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background: #ef4444;
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
          cursor: pointer;
          z-index: 99;
          transition: transform 0.2s, background 0.2s;
        }
        .alert-trigger-btn:hover { transform: scale(1.1); background: #f87171; }
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
      `}</style>
    </>
  );
}
