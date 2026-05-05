import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, Popup, useMap, useMapEvents, Polygon } from 'react-leaflet';
import { supabase } from '@/lib/supabaseClient';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WeatherPanel from './WeatherPanel';

// Fix for default marker icons if needed, but we'll use custom divIcons
// based on the vessel's status.

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'normal':  return '#10b981'; // green
    case 'warning': return '#f59e0b'; // orange
    case 'danger':  return '#ef4444'; // red
    case 'unknown': return '#94a3b8'; // slate gray
    default:        return '#94a3b8'; // slate gray (no track)
  }
};

const createCustomIcon = (status, heading, fleetColor) => {
  const color = fleetColor || getStatusColor(status);
  // Basic ship shape svg pointing upwards. We rotate the wrapper.
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
      <path d="M12 2l-8 10 2 10 6-3 6 3 2-10z" />
    </svg>
  `;

  return L.divIcon({
    className: 'custom-vessel-icon',
    html: `
      <div class="pulsing-container ${status === 'danger' ? 'pulsing-danger' : ''}" style="transform: rotate(${heading || 0}deg); width:24px; height:24px; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
        ${svgIcon}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

function MapUpdater({ selectedVessel }) {
  const map = useMap();
  useEffect(() => {
    if (selectedVessel && selectedVessel.lat && selectedVessel.lng) {
      map.flyTo([selectedVessel.lat, selectedVessel.lng], 12, { animate: true });
    }
  }, [selectedVessel, map]);
  return null;
}

export default function MapView({ vessels, tracks, predictedTracks = [], routeData = null, onSelectVessel, selectedVessel, onTrackRequest, onPredictionRequest, onRouteRequest, onZoneDrawn, onZoneDelete }) {
  const [contextMenu, setContextMenu] = useState(null);
  const [mapContextMenu, setMapContextMenu] = useState(null);
  const [weatherVessel, setWeatherVessel] = useState(null);
  const [showSeamark, setShowSeamark] = useState(false);
  const [zones, setZones] = useState([]);
  const [routeCriteria, setRouteCriteria] = useState({ time: true, fuel: false, risk: false, weather: false });
  
  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState([]); // [{lat, lng}]
  const [mousePos, setMousePos] = useState(null);

  useEffect(() => {
    const fetchZones = async () => {
      const { data, error } = await supabase.from('zones_wkt_view').select('*');
      if (!error && data) {
        // Convert PostGIS geometry WKT or similar to Leaflet latlngs if needed
        // but since we seeded them as POLYGON((...)), they might need parsing
        // or we use a View that returns GeoJSON.
        // For simplicity in seeding, let's assume we can parse basic WKT.
        setZones(data);
      }
    };
    fetchZones();
  }, []);

  // Helper to parse WKT POLYGON((...)) to [[lat, lng], ...]
  const parseWKT = (wkt) => {
    if (!wkt || typeof wkt !== 'string') return [];
    try {
      const coordsPart = wkt.replace('POLYGON((', '').replace('))', '');
      return coordsPart.split(',').map(pair => {
        const [lng, lat] = pair.trim().split(' ').map(Number);
        return [lat, lng];
      });
    } catch (e) {
      console.error("WKT parse error:", e);
      return [];
    }
  };

  // Group tracks by Vessel_id
  const tracksByVessel = useMemo(() => {
    const grouped = {};
    tracks.forEach(t => {
      if (!grouped[t.Vessel_id]) grouped[t.Vessel_id] = [];
      grouped[t.Vessel_id].push(t);
    });
    // Sort each group by created_at ascending
    for (const id in grouped) {
      grouped[id].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return grouped;
  }, [tracks]);

  const defaultCenter = [10.5, 108.0]; // Vietnam
  const defaultZoom = 6;

  function MapEventsHandler() {
    useMapEvents({
      contextmenu: (e) => {
        if (isDrawing) {
          e.originalEvent.preventDefault();
          handleCancelDrawing();
          return;
        }
        if (selectedVessel) {
          e.originalEvent.preventDefault();
          setMapContextMenu({
            x: e.originalEvent.clientX,
            y: e.originalEvent.clientY,
            lat: e.latlng.lat,
            lng: e.latlng.lng
          });
          setContextMenu(null);
        }
      },
      click: (e) => {
        if (isDrawing) {
          setDrawnPoints(prev => [...prev, e.latlng]);
        }
      },
      mousemove: (e) => {
        if (isDrawing) {
          setMousePos(e.latlng);
        }
      },
      dblclick: (e) => {
        if (isDrawing) {
          e.originalEvent.preventDefault();
          handleFinishDrawing();
        }
      }
    });
    return null;
  }

  const handleFinishDrawing = () => {
    // Lọc các điểm trùng lặp liên tiếp
    const distinctPoints = drawnPoints.filter((p, i, arr) => {
      if (i === 0) return true;
      return p.lat !== arr[i-1].lat || p.lng !== arr[i-1].lng;
    });

    if (distinctPoints.length < 3) {
      alert("Cần ít nhất 3 điểm phân biệt để tạo vùng!");
      return;
    }

    // Kiểm tra đa giác bẹt (diện tích xấp xỉ 0 bằng công thức Shoelace đơn giản cho hệ toạ độ phẳng nhỏ)
    let area = 0;
    for (let i = 0; i < distinctPoints.length; i++) {
      let j = (i + 1) % distinctPoints.length;
      area += distinctPoints[i].lng * distinctPoints[j].lat - distinctPoints[j].lng * distinctPoints[i].lat;
    }
    area = Math.abs(area / 2);
    if (area < 1e-10) {
      alert("Vùng vừa vẽ là đa giác bẹt (không có diện tích hợp lệ). Vui lòng vẽ lại!");
      setDrawnPoints([]);
      return;
    }

    if (typeof onZoneDrawn === 'function') {
      onZoneDrawn(distinctPoints);
    }
    setIsDrawing(false);
    setDrawnPoints([]);
    setMousePos(null);
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawnPoints([]);
    setMousePos(null);
  };

  return (
    <>
    <MapContainer center={defaultCenter} zoom={defaultZoom} zoomControl={false} style={{ width: '100%', height: '100%', cursor: isDrawing ? 'crosshair' : 'grab' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {showSeamark && (
        <TileLayer
          attribution='&copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        />
      )}
      
      <MapUpdater selectedVessel={selectedVessel} />
      <MapEventsHandler />

      {/* Render Zones */}
      {zones.map(zone => (
        <Polygon
          key={zone.id}
          positions={parseWKT(zone.geom_wkt)}
          pathOptions={{
            color: zone.severity === 'danger' ? '#ef4444' : '#f59e0b',
            fillColor: zone.severity === 'danger' ? '#ef4444' : '#f59e0b',
            fillOpacity: 0.15,
            dashArray: zone.severity === 'warning' ? '10, 10' : 'none',
            weight: 2
          }}
        >
          <Popup>
            <div style={{ textAlign: 'center', minWidth: '150px' }}>
              <strong style={{color: zone.severity === 'danger' ? '#ef4444' : '#fbbf24'}}>{zone.name.toUpperCase()}</strong><br/>
              {zone.description && <span style={{fontSize: '0.9em'}}>{zone.description}<br/></span>}
              <span style={{fontSize: '0.8em', color: '#64748b'}}>Mức độ: {zone.severity?.toUpperCase()}</span><br/>
              <button 
                onClick={(e) => { e.stopPropagation(); onZoneDelete && onZoneDelete(zone.id); }}
                style={{marginTop: '8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8em'}}
              >🗑️ Xóa vùng này</button>
            </div>
          </Popup>
        </Polygon>
      ))}

      {/* Render Active Drawing */}
      {isDrawing && drawnPoints.length > 0 && (
        <React.Fragment>
          {/* Use Polygon instead of Polyline for drawing closure if there are >= 2 points + mousePos */}
          <Polygon 
            positions={[
              ...drawnPoints.map(p => [p.lat, p.lng]),
              ...(mousePos ? [[mousePos.lat, mousePos.lng]] : [])
            ]} 
            color="#38bdf8" weight={2} dashArray="5,5" fillColor="#38bdf8" fillOpacity={0.1}
          />
          {drawnPoints.map((p, idx) => (
            <CircleMarker key={idx} center={[p.lat, p.lng]} radius={4} color="#38bdf8" fillColor="white" fillOpacity={1} />
          ))}
        </React.Fragment>
      )}

      {/* Render Polylines for historical tracks */}
      {Object.entries(tracksByVessel).map(([vesselId, vesselTracks]) => {
        // Find current vessel to get status color, fallback to default
        const currentVessel = vessels.find(v => v.Vessel_id === vesselId);
        const color = currentVessel?.fleetColor || getStatusColor(currentVessel?.status);
        
        const positions = vesselTracks
          .filter(t => t.lat && t.lng)
          .map(t => [t.lat, t.lng]);

        if (positions.length < 2) return null;

        return (
          <React.Fragment key={`track-group-${vesselId}`}>
            <Polyline 
              positions={positions} 
              color={color} 
              weight={3} 
              opacity={0.8}
            />
            {vesselTracks.filter(t => t.lat && t.lng).map((t, idx) => (
              <CircleMarker
                key={`point-${vesselId}-${idx}`}
                center={[t.lat, t.lng]}
                radius={4}
                color={color}
                fillColor="#242424"
                fillOpacity={1}
                weight={2}
              >
                <Tooltip direction="top" opacity={1}>
                  <div style={{ textAlign: 'center' }}>
                    <strong>{new Date(t.created_at).toLocaleString()}</strong><br/>
                    Lat: {t.lat?.toFixed(5)}, Lng: {t.lng?.toFixed(5)}<br/>
                    Speed: {t.speed?.toFixed(1) || 0} kn<br/>
                    Heading: {t.heading || 0}°
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </React.Fragment>
        );
      })}

      {/* Render Predicted Tracks (AI) */}
      {predictedTracks && predictedTracks.length > 0 && (
        <React.Fragment>
          <Polyline 
            positions={predictedTracks.map(p => [p.lat, p.lng])} 
            color="#22d3ee" 
            weight={3} 
            opacity={0.8}
            dashArray="10, 10"
          />
          {predictedTracks.filter(p => !p.is_anchor).map((p, idx) => (
            <CircleMarker
              key={`pred-${idx}`}
              center={[p.lat, p.lng]}
              radius={5}
              color="#22d3ee"
              fillColor="#0f172a"
              fillOpacity={1}
              weight={2}
            >
              <Tooltip direction="top" opacity={1}>
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <div style={{color: '#f87171', fontWeight: 'bold', marginBottom:'4px'}}>⚠️ CẢNH BÁO: Điểm dự báo AI</div>
                  <strong style={{color: p.is_ai_predicted ? '#22d3ee' : '#cbd5e1'}}>{new Date(p.time).toLocaleString()}</strong><br/>
                  Lat: {p.lat?.toFixed(5)}, Lng: {p.lng?.toFixed(5)}<br/>
                  Speed: {p.speed?.toFixed(1) || 0} kn<br/>
                  Gió môi trường: {p.weather_wind_speed || 0} km/h<br/>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </React.Fragment>
      )}

      {/* Render Target Route Data */}
      {routeData && routeData.path && routeData.path.length > 0 && (
        <React.Fragment>
          <Polyline 
            positions={routeData.path.map(p => [p.lat, p.lng])} 
            color="#10b981" 
            weight={3} 
            opacity={0.8}
            dashArray="8, 8"
          />
          <CircleMarker
            center={[routeData.path[routeData.path.length-1].lat, routeData.path[routeData.path.length-1].lng]}
            radius={6}
            color="#10b981"
            fillColor="#0f172a"
            fillOpacity={1}
            weight={3}
          >
            <Tooltip direction="top" opacity={1}>
               <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <div style={{color: '#10b981', fontWeight: 'bold', marginBottom:'4px'}}>🎯 Điểm đến (Hải trình tối ưu)</div>
                  Độ dài: {routeData.distanceNM?.toFixed(1)} NM ({routeData.distanceKm?.toFixed(1)} km)<br/>
                  ETA: <strong style={{color: '#f8fafc'}}>{new Date(routeData.eta).toLocaleString()}</strong><br/>
                  Thời gian đi: {routeData.timeHours?.toFixed(1)} giờ
                  {routeData.metrics && (
                    <div style={{marginTop: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '0.85em', color: '#cbd5e1', textAlign: 'left'}}>
                      <div style={{fontWeight: 'bold', color: '#38bdf8', marginBottom: '2px'}}>📊 Tối ưu hóa (Cost Score: {routeData.metrics.costScore?.toFixed(2)})</div>
                      ⛽ Nhiên liệu: {routeData.metrics.fuel?.toFixed(1)} tấn<br/>
                      ⛈ Thời tiết (Gió): {routeData.metrics.weatherValue} km/h<br/>
                      ⚠️ Rủi ro: <span style={{color: routeData.metrics.riskStatus === 'Cao' ? '#f87171' : '#10b981'}}>{routeData.metrics.riskStatus}</span>
                    </div>
                  )}
               </div>
            </Tooltip>
          </CircleMarker>

          {/* Interval points every 2 hours */}
          {routeData.intervalPoints && routeData.intervalPoints.map((pt, idx) => (
             <CircleMarker
                 key={`route-interval-${idx}`}
                 center={[pt.lat, pt.lng]}
                 radius={4}
                 color="#10b981"
                 fillColor="#0f172a"
                 fillOpacity={1}
                 weight={2}
               >
                 <Tooltip direction="top" opacity={1}>
                   <div style={{ textAlign: 'center' }}>
                     <strong style={{color: '#10b981'}}>H+{(pt.hour)} giờ</strong><br/>
                     Lat: {pt.lat?.toFixed(5)}, Lng: {pt.lng?.toFixed(5)}<br/>
                     {new Date(pt.time).toLocaleString()}
                   </div>
                 </Tooltip>
             </CircleMarker>
          ))}
        </React.Fragment>
      )}

      {/* Render Markers for current positions */}
      {vessels.filter(v => v.lat && v.lng).map(vessel => (
        <Marker
          key={`marker-${vessel.id || vessel.Vessel_id}`}
          position={[vessel.lat, vessel.lng]}
          icon={createCustomIcon(vessel.status, vessel.heading, vessel.fleetColor)}
          eventHandlers={{
            click: () => onSelectVessel(vessel),
            contextmenu: (e) => {
              e.originalEvent.preventDefault(); // Explicitly prevent browser menu
              setContextMenu({
                x: e.originalEvent.clientX,
                y: e.originalEvent.clientY,
                vessel: vessel
              });
            }
          }}
        >
          <Tooltip direction="top" offset={[0, -12]} opacity={1}>
            <div style={{ textAlign: 'center' }}>
              <strong>{vessel.Vessel_name}</strong><br/>
              {vessel.status?.toUpperCase()}<br/>
              Lat: {vessel.lat?.toFixed(5)}, Lng: {vessel.lng?.toFixed(5)}<br/>
              {vessel.speed?.toFixed(1)} kn
            </div>
          </Tooltip>
        </Marker>
      ))}

      <style jsx global>{`
        .leaflet-container {
          background-color: #242424; /* Prevents white flash before tiles load */
        }
        .map-overlay-controls {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          color: white;
        }
        .control-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .custom-vessel-icon {
          background: transparent;
          border: none;
        }
        .custom-vessel-icon .pulsing-container {
           width: 24px;
           height: 24px;
           position: relative;
        }
        .pulsing-danger::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.6);
          animation: mapPulse 1.5s infinite ease-out;
          z-index: -1;
        }
        @keyframes mapPulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .leaflet-tooltip {
          background: #1e293b;
          color: #f8fafc;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          font-family: inherit;
        }
        .leaflet-tooltip-top:before {
          border-top-color: #1e293b;
        }
        .context-menu {
          position: fixed;
          z-index: 9999;
          background: rgba(15, 23, 42, 0.96);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
          display: flex;
          flex-direction: column;
          padding: 8px;
          min-width: 210px;
          color: white;
          font-family: inherit;
          animation: cmIn 0.15s ease;
        }
        @keyframes cmIn {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .cm-header {
          font-size: 0.85rem;
          color: #f1f5f9;
          font-weight: 700;
          padding: 6px 10px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 4px;
        }
        .cm-section-label {
          font-size: 0.68rem;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
          padding: 6px 10px 2px;
        }
        .cm-divider {
          height: 1px;
          background: rgba(255,255,255,0.07);
          margin: 4px 0;
        }
        .context-menu button {
          background: transparent;
          border: none;
          color: #cbd5e1;
          padding: 7px 10px;
          text-align: left;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.15s;
          font-size: 0.84rem;
          width: 100%;
        }
        .context-menu button:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }
        .context-menu button.cm-weather {
          color: #fbbf24;
          font-weight: 600;
        }
        .context-menu button.cm-weather:hover {
          background: rgba(251,191,36,0.1);
        }
        .context-menu button.cm-cancel {
          color: #64748b;
          font-size: 0.8rem;
        }
        .context-menu button.cm-cancel:hover {
          background: rgba(239,68,68,0.08);
          color: #f87171;
        }
        .draw-btn {
          width: 100%; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
        }
        .draw-btn:hover { background: rgba(56,189,248,0.25); }
        .draw-btn-save {
          width: 100%; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #10b981; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
        }
        .draw-btn-save:hover { background: rgba(16,185,129,0.25); }
        .draw-btn-cancel {
          width: 100%; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
        }
        .draw-btn-cancel:hover { background: rgba(239,68,68,0.25); }
      `}</style>
    </MapContainer>

      {/* Map Controls */}
      <div className="map-overlay-controls">
        <label className="control-label">
          <input type="checkbox" checked={showSeamark} onChange={(e) => setShowSeamark(e.target.checked)} />
          <span>🌊 Lớp Hàng hải & Thời tiết</span>
        </label>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {!isDrawing ? (
            <button className="draw-btn" onClick={() => setIsDrawing(true)}>✏️ Vẽ Vùng Cảnh báo</button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Click trên bản đồ để tạo điểm.</span>
              <button className="draw-btn-save" onClick={handleFinishDrawing}>✅ Hoàn tất ({drawnPoints.length} điểm)</button>
              <button className="draw-btn-cancel" onClick={handleCancelDrawing}>❌ Huỷ</button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Context Menu moved outside MapContainer */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <div className="cm-header">🚢 {contextMenu.vessel.Vessel_name}</div>

          {/* Weather section */}
          <div className="cm-section-label">Thời tiết</div>
          <button className="cm-weather" onClick={() => {
            setWeatherVessel(contextMenu.vessel);
            setContextMenu(null);
          }}>
            🌤 Xem thời tiết tại đây
          </button>

          {/* Track history */}
          <div className="cm-section-label">Lịch sử hành trình</div>
          <button onClick={() => { onTrackRequest(contextMenu.vessel.Vessel_id, 1); setContextMenu(null); }}>⏱ 1 giờ trước</button>
          <button onClick={() => { onTrackRequest(contextMenu.vessel.Vessel_id, 12); setContextMenu(null); }}>⏱ 12 giờ trước</button>
          <button onClick={() => { onTrackRequest(contextMenu.vessel.Vessel_id, 24); setContextMenu(null); }}>⏱ 24 giờ trước</button>
          
          {/* AI prediction */}
          <div className="cm-section-label" style={{color: '#38bdf8'}}>Dự báo AI</div>
          <button style={{color: '#38bdf8'}} onClick={() => { onPredictionRequest(contextMenu.vessel.Vessel_id, 4); setContextMenu(null); }}>🤖 Tương lai (4 giờ)</button>
          <button style={{color: '#38bdf8'}} onClick={() => { onPredictionRequest(contextMenu.vessel.Vessel_id, 6); setContextMenu(null); }}>🤖 Tương lai (6 giờ)</button>
          <button style={{color: '#38bdf8'}} onClick={() => { onPredictionRequest(contextMenu.vessel.Vessel_id, 12); setContextMenu(null); }}>🤖 Tương lai (12 giờ)</button>
          <button style={{color: '#f87171'}} onClick={() => { onPredictionRequest(contextMenu.vessel.Vessel_id, 24); setContextMenu(null); }}>⚠️ Tương lai (24 giờ)</button>

          <div className="cm-divider" />
          <button onClick={() => setContextMenu(null)} className="cm-cancel">✕ Đóng</button>
        </div>
      )}

      {/* Weather Panel */}
      {weatherVessel && (
        <WeatherPanel
          vessel={weatherVessel}
          onClose={() => setWeatherVessel(null)}
        />
      )}

      {/* Floating Map Context Menu for Route Prediction */}
      {mapContextMenu && (
        <div 
          className="context-menu"
          style={{ top: mapContextMenu.y, left: mapContextMenu.x }}
          onMouseLeave={() => setMapContextMenu(null)}
        >
          <div className="cm-header">Lộ trình mục tiêu</div>
          <div className="cm-section-label">Từ: {selectedVessel?.Vessel_name}</div>
          
          <div className="cm-section-label" style={{marginTop: '8px', color: '#94a3b8'}}>Ưu tiên tối ưu:</div>
          <label style={{display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', color: '#cbd5e1'}}>
            <input type="checkbox" checked={routeCriteria.time} onChange={(e) => setRouteCriteria({...routeCriteria, time: e.target.checked})} style={{marginRight: '8px'}} /> ⏱ Thời gian (Time)
          </label>
          <label style={{display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', color: '#cbd5e1'}}>
            <input type="checkbox" checked={routeCriteria.fuel} onChange={(e) => setRouteCriteria({...routeCriteria, fuel: e.target.checked})} style={{marginRight: '8px'}} /> ⛽ Nhiên liệu (Fuel)
          </label>
          <label style={{display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', color: '#cbd5e1'}}>
            <input type="checkbox" checked={routeCriteria.risk} onChange={(e) => setRouteCriteria({...routeCriteria, risk: e.target.checked})} style={{marginRight: '8px'}} /> ⚠️ Rủi ro (Risk)
          </label>
          <label style={{display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', color: '#cbd5e1'}}>
            <input type="checkbox" checked={routeCriteria.weather} onChange={(e) => setRouteCriteria({...routeCriteria, weather: e.target.checked})} style={{marginRight: '8px'}} /> ⛈ Thời tiết (Weather)
          </label>

          <button style={{color: '#10b981', marginTop: '8px'}} onClick={() => { 
            onRouteRequest(selectedVessel, mapContextMenu.lat, mapContextMenu.lng, routeCriteria); 
            setMapContextMenu(null); 
          }}>🎯 Tính toán hải trình đến đây</button>
          
          <div className="cm-divider" />
          <button onClick={() => setMapContextMenu(null)} className="cm-cancel">✕ Đóng</button>
        </div>
      )}
    </>
  );
}
