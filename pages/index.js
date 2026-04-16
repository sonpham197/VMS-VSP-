import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { supabase } from '@/lib/supabaseClient';

const MapView = dynamic(() => import('@/components/MapView'), { 
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <div className="spinner" />
      Loading Map Data...
    </div>
  )
});

export default function Home() {
  const [vessels, setVessels] = useState([]);        // merged: static info + latest track
  const [vesselStatics, setVesselStatics] = useState([]); // raw static vessel info
  const [activeTrackData, setActiveTrackData] = useState([]);
  const [predictedTracks, setPredictedTracks] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState(null);

  // ── Merge static vessel info + latest track position ─────────────────────
  const mergeVesselsWithTracks = useCallback((statics, latestTracks) => {
    return statics.map(v => {
      const latest = latestTracks.find(t => t.Vessel_id === v.Vessel_id) || {};
      return { ...v, ...latest };
    });
  }, []);

  // ── Initial Data Fetch ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchInitialData = async () => {
      // 1. Fetch static vessel info (IMO, MMSI, image, etc.)
      const { data: vData, error: vError } = await supabase
        .from('vessels')
        .select('*');
      if (vError) { console.error('Error fetching vessels:', vError); return; }
      const statics = vData || [];
      setVesselStatics(statics);

      // 2. Fetch latest track per vessel for current position
      // Note: 'status' column added by migration — fall back to 'normal' if missing
      const { data: tData, error: tError } = await supabase
        .from('vessel_tracks')
        .select('Vessel_id, Vessel_name, lat, lng, speed, heading, created_at')
        .order('created_at', { ascending: false });
      if (tError) { console.error('Error fetching latest tracks:', tError); }

      const latestTracks = [];
      const seen = new Set();
      for (const t of (tData || [])) {
        if (!seen.has(t.Vessel_id)) {
          seen.add(t.Vessel_id);
          latestTracks.push({ ...t, status: t.status || 'normal' });
        }
      }

      setVessels(mergeVesselsWithTracks(statics, latestTracks));
    };

    fetchInitialData();
  }, [mergeVesselsWithTracks]);

  // ── Realtime Subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    // Listen to vessel_tracks for position updates
    const tracksSub = supabase.channel('public:vessel_tracks_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vessel_tracks' }, payload => {
        const newTrack = payload.new;
        setVessels(current =>
          current.map(v =>
            v.Vessel_id === newTrack.Vessel_id
              ? { ...v, lat: newTrack.lat, lng: newTrack.lng, speed: newTrack.speed, heading: newTrack.heading, status: newTrack.status, created_at: newTrack.created_at }
              : v
          )
        );
        // Update selectedVessel position too
        setSelectedVessel(sv => sv && sv.Vessel_id === newTrack.Vessel_id
          ? { ...sv, lat: newTrack.lat, lng: newTrack.lng, speed: newTrack.speed, heading: newTrack.heading, status: newTrack.status }
          : sv
        );
      })
      .subscribe();

    // Listen to vessels table for static info changes (IMO, image, etc.)
    const vesselsSub = supabase.channel('public:vessels_static')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vessels' }, payload => {
        setVesselStatics(current => {
          let updated;
          if (payload.eventType === 'INSERT') updated = [...current, payload.new];
          else if (payload.eventType === 'UPDATE') updated = current.map(v => v.Vessel_id === payload.new.Vessel_id ? payload.new : v);
          else if (payload.eventType === 'DELETE') updated = current.filter(v => v.Vessel_id !== payload.old.Vessel_id);
          else updated = current;
          return updated;
        });
        setVessels(prev => {
          if (payload.eventType === 'INSERT') {
            return [...prev, payload.new]; // new vessel, no track yet
          } else if (payload.eventType === 'UPDATE') {
            return prev.map(v => v.Vessel_id === payload.new.Vessel_id
              ? { ...v, ...payload.new }
              : v
            );
          } else if (payload.eventType === 'DELETE') {
            return prev.filter(v => v.Vessel_id !== payload.old.Vessel_id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tracksSub);
      supabase.removeChannel(vesselsSub);
    };
  }, []);

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
      alert('Lỗi mạng khi gọi API Route: ' + err.message); 
    }
    setIsPredicting(false);
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
            <div style={{ position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(15,23,42,0.7)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#38bdf8' }}>
              <div className="spinner" />
              <h3 style={{marginTop:'20px'}}>Hệ thống đang tính toán...</h3>
            </div>
          )}
          <MapView 
            vessels={vessels} 
            tracks={activeTrackData} 
            predictedTracks={predictedTracks}
            routeData={routeData}
            onSelectVessel={setSelectedVessel} 
            selectedVessel={selectedVessel}
            onTrackRequest={handleTrackRequest}
            onPredictionRequest={handlePredictionRequest}
            onRouteRequest={handleRouteRequest}
          />
        </div>
        <Sidebar selectedVessel={selectedVessel} vessels={vessels} />
      </main>

      <style jsx>{`
        .layout { display:flex; height:calc(100vh - 64px); width:100vw; overflow:hidden; background-color:#0f172a; }
        .map-container { flex:3; position:relative; }
        .map-loading { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background-color:#1e293b; color:#94a3b8; font-size:1.125rem; gap:16px; }
        .spinner { width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-left-color:#3b82f6; border-radius:50%; animation:spin 1s linear infinite; }
        @keyframes spin { 0%{transform:rotate(0deg);} 100%{transform:rotate(360deg);} }
      `}</style>
    </>
  );
}
