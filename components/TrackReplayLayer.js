import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { Polyline, CircleMarker, Tooltip, Marker } from 'react-leaflet';
import { Play, Pause, FastForward, Rewind, SkipBack, X } from 'lucide-react';
import L from 'leaflet';

// Create a custom vessel icon for the replay
const createVesselIcon = (color, heading = 0) => {
  return L.divIcon({
    className: 'replay-vessel-icon',
    html: `<div style="
      width: 24px; height: 24px;
      background: ${color};
      clip-path: polygon(50% 0%, 100% 25%, 100% 100%, 0% 100%, 0% 25%);
      transform: rotate(${heading}deg);
      border: 1px solid white;
      box-shadow: 0 0 10px ${color};
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

export default function TrackReplayLayer({ tracks, color, onClose, title = "▶ REPLAY HÀNH TRÌNH", timeKey = "created_at" }) {
  const map = useMap();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [speed, setSpeed] = useState(1); // 1x, 2x, 5x, 10x
  
  const points = tracks.filter(t => t.lat && t.lng);
  const totalPoints = points.length;
  
  const currentIndex = Math.min(
    Math.floor((progress / 100) * (totalPoints - 1)),
    totalPoints - 1
  );

  const currentPoint = points[currentIndex];
  
  // Animation loop
  useEffect(() => {
    let animationFrame;
    let lastTime = performance.now();

    const animate = (time) => {
      if (isPlaying && totalPoints > 1) {
        const deltaMs = time - lastTime;
        lastTime = time;

        // Calculate how much progress to add based on speed
        // Let's say 1x speed completes the replay in 10 seconds.
        const totalDurationMs = 10000 / speed; 
        const progressDelta = (deltaMs / totalDurationMs) * 100;
        
        setProgress(prev => {
          const next = prev + progressDelta;
          if (next >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return next;
        });
      } else {
        lastTime = time;
      }
      animationFrame = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, speed, totalPoints]);

  // Auto-fit bounds when tracks are loaded
  useEffect(() => {
    if (points.length > 1) {
      const positions = points.map(p => [p.lat, p.lng]);
      const bounds = L.polyline(positions).getBounds();
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [tracks, map]);

  // Split path into traveled and remaining
  const positions = points.map(p => [p.lat, p.lng]);
  const traveledPath = positions.slice(0, currentIndex + 1);
  const remainingPath = positions.slice(currentIndex);

  const togglePlay = () => {
    if (!isPlaying && progress >= 99) {
      setProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };
  
  const changeSpeed = () => {
    const speeds = [1, 2, 5, 10];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    setSpeed(speeds[nextIdx]);
  };

  const handleSeek = (e) => {
    setProgress(Number(e.target.value));
  };

  return (
    <>
      {/* Remaining Path (Dimmed) */}
      <Polyline positions={remainingPath} color={color} weight={2} opacity={0.3} dashArray="5, 5" />
      
      {/* Traveled Path (Solid) */}
      <Polyline positions={traveledPath} color={color} weight={4} opacity={0.9} />
      
      {/* Vessel Marker at current point */}
      {currentPoint && (
        <Marker 
          position={[currentPoint.lat, currentPoint.lng]} 
          icon={createVesselIcon(color, currentPoint.heading || 0)}
          zIndexOffset={1000}
        >
          <Tooltip direction="top" opacity={1} permanent={false}>
             <div style={{ textAlign: 'center' }}>
                <strong>{new Date(currentPoint[timeKey]).toLocaleString()}</strong><br/>
                Lat: {currentPoint.lat.toFixed(5)}<br/>
                Lng: {currentPoint.lng.toFixed(5)}<br/>
                Speed: {currentPoint.speed?.toFixed(1) || 0} kn
             </div>
          </Tooltip>
        </Marker>
      )}

      {/* History Points (Dots) */}
      {points.map((t, idx) => (
        <CircleMarker
          key={`rp-${idx}`}
          center={[t.lat, t.lng]}
          radius={idx <= currentIndex ? 3 : 2}
          color={color}
          fillColor="#242424"
          fillOpacity={1}
          weight={idx <= currentIndex ? 2 : 1}
          opacity={idx <= currentIndex ? 1 : 0.4}
        />
      ))}

      {/* Replay UI Control Panel */}
      <div className="replay-controls">
        <div className="replay-header">
          <span className="replay-title" style={{ color }}>{title}</span>
          <button className="close-btn" onClick={onClose}><X size={14}/></button>
        </div>
        
        <div className="replay-body">
          <button className="play-btn" style={{ background: color }} onClick={togglePlay}>
            {isPlaying ? <Pause size={18} color="#0f172a" /> : <Play size={18} color="#0f172a" style={{marginLeft: '2px'}} />}
          </button>
          
          <div className="scrubber-container">
            <input 
              type="range" 
              className="scrubber" 
              min="0" 
              max="100" 
              step="0.1"
              value={progress} 
              onChange={handleSeek}
              style={{ accentColor: color }}
            />
            <div className="time-info">
              <span>{new Date(points[0][timeKey]).toLocaleTimeString()}</span>
              <span className="current-time" style={{ color }}>{currentPoint && new Date(currentPoint[timeKey]).toLocaleString()}</span>
              <span>{new Date(points[totalPoints-1][timeKey]).toLocaleTimeString()}</span>
            </div>
          </div>

          <button className="speed-btn" onClick={changeSpeed}>
            {speed}x
          </button>
        </div>
      </div>

      <style jsx>{`
        .replay-controls {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 12px 16px;
          z-index: 1000;
          color: white;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          width: 450px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          animation: slideUp 0.3s ease;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .replay-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 6px;
        }
        .replay-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #38bdf8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
        }
        .close-btn:hover { color: #f87171; }
        
        .replay-body {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .play-btn {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: #38bdf8;
          color: #0f172a;
          border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .play-btn:hover { background: #7dd3fc; transform: scale(1.05); }
        
        .scrubber-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .scrubber {
          width: 100%;
          accent-color: #38bdf8;
          cursor: pointer;
        }
        .time-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.65rem;
          color: #94a3b8;
        }
        .current-time {
          color: #f1f5f9;
          font-weight: 600;
        }
        .speed-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: #e2e8f0;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          min-width: 40px;
        }
        .speed-btn:hover { background: rgba(255,255,255,0.2); }
      `}</style>
      <style jsx global>{`
        .replay-vessel-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </>
  );
}
