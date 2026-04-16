import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WeatherPanel from './WeatherPanel';

// Fix for default marker icons if needed, but we'll use custom divIcons
// based on the vessel's status.

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'normal': return '#10b981'; // green
    case 'warning': return '#f59e0b'; // orange
    case 'danger': return '#ef4444'; // red
    default: return '#94a3b8'; // slate
  }
};

const createCustomIcon = (status, heading) => {
  const color = getStatusColor(status);
  // Basic ship shape svg pointing upwards. We rotate the wrapper.
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
      <path d="M12 2l-8 10 2 10 6-3 6 3 2-10z" />
    </svg>
  `;

  return L.divIcon({
    className: 'custom-vessel-icon',
    html: `<div style="transform: rotate(${heading || 0}deg); width:24px; height:24px; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">${svgIcon}</div>`,
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

export default function MapView({ vessels, tracks, predictedTracks = [], routeData = null, onSelectVessel, selectedVessel, onTrackRequest, onPredictionRequest, onRouteRequest }) {
  const [contextMenu, setContextMenu] = useState(null);
  const [mapContextMenu, setMapContextMenu] = useState(null);
  const [weatherVessel, setWeatherVessel] = useState(null);
  const [routeCriteria, setRouteCriteria] = useState({ time: true, fuel: false, risk: false, weather: false });
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
        if (selectedVessel) {
          e.originalEvent.preventDefault();
          setMapContextMenu({
            x: e.originalEvent.clientX,
            y: e.originalEvent.clientY,
            lat: e.latlng.lat,
            lng: e.latlng.lng
          });
          setContextMenu(null); // close vessel context menu if open
        }
      }
    });
    return null;
  }

  return (
    <>
    <MapContainer center={defaultCenter} zoom={defaultZoom} zoomControl={false} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      
      <MapUpdater selectedVessel={selectedVessel} />
      <MapEventsHandler />

      {/* Render Polylines for historical tracks */}
      {Object.entries(tracksByVessel).map(([vesselId, vesselTracks]) => {
        // Find current vessel to get status color, fallback to default
        const currentVessel = vessels.find(v => v.Vessel_id === vesselId);
        const color = getStatusColor(currentVessel?.status);
        
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
          key={`marker-${vessel.id}`}
          position={[vessel.lat, vessel.lng]}
          icon={createCustomIcon(vessel.status, vessel.heading)}
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
        .custom-vessel-icon {
          background: transparent;
          border: none;
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
      `}</style>
    </MapContainer>

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
