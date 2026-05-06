import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function TempHeatmapLayer({ timeOffset = 0 }) {
  const map = useMap();
  const [heatmapLayer, setHeatmapLayer] = useState(null);

  useEffect(() => {
    let currentLayer = null;
    let abortController = new AbortController();

    const fetchHeatmapData = async () => {
      try {
        if (!L.heatLayer) {
          require('leaflet.heat');
        }

        const bounds = map.getBounds();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();

        // Generate an 8x8 grid = 64 points (safe for Open-Meteo limits)
        const lats = [];
        const lons = [];
        const steps = 8;
        const latStep = (north - south) / steps;
        const lonStep = (east - west) / steps;

        // Collect coordinates
        const coords = [];
        for (let i = 0; i <= steps; i++) {
          for (let j = 0; j <= steps; j++) {
            const lat = south + i * latStep;
            let lon = west + j * lonStep;
            
            // Normalize longitude for Open-Meteo
            if (lon > 180) lon -= 360;
            if (lon < -180) lon += 360;

            lats.push(lat.toFixed(4));
            lons.push(lon.toFixed(4));
            coords.push({ lat, lon });
          }
        }

        const latsStr = lats.join(',');
        const lonsStr = lons.join(',');
        
        // Fetch real-time data
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latsStr}&longitude=${lonsStr}&current=temperature_2m`,
          { signal: abortController.signal }
        );
        
        if (!res.ok) {
          const errData = await res.text();
          console.error("Open-Meteo API Error:", errData);
          return; // Do not throw to avoid crashing Next.js overlay
        }
        
        const data = await res.json();
        const results = Array.isArray(data) ? data : [data]; // Open-Meteo returns array if multiple coords
        
        const heatPoints = [];
        results.forEach((item, index) => {
          if (item && item.current && item.current.temperature_2m !== null) {
            const temp = item.current.temperature_2m;
            // Normalize temp for heatmap intensity: -10 to 40 C range -> 0.0 to 1.0
            let intensity = (temp + 10) / 50;
            intensity = Math.max(0, Math.min(1, intensity));
            
            heatPoints.push([
              coords[index].lat, 
              coords[index].lon, 
              intensity
            ]);
          }
        });

        if (heatPoints.length > 0) {
          if (currentLayer) map.removeLayer(currentLayer);
          
          currentLayer = L.heatLayer(heatPoints, {
            radius: 80,
            blur: 60,
            maxZoom: 10,
            max: 1.0,
            gradient: {
              0.1: '#3b82f6', // Cold (Blue)
              0.3: '#2dd4bf', // Cool (Teal)
              0.5: '#fde047', // Mild (Yellow)
              0.7: '#f97316', // Warm (Orange)
              0.9: '#ef4444', // Hot (Red)
              1.0: '#9f1239'  // Very Hot (Dark Red)
            }
          });
          
          currentLayer.addTo(map);
          setHeatmapLayer(currentLayer);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("TempHeatmap init error", err);
        }
      }
    };

    let fetchTimeout;

    // Initial fetch
    fetchTimeout = setTimeout(() => {
      fetchHeatmapData();
    }, 100);

    const onMoveEnd = () => {
       clearTimeout(fetchTimeout);
       fetchTimeout = setTimeout(() => {
         fetchHeatmapData();
       }, 800); // 800ms debounce
    };

    map.on('moveend', onMoveEnd);

    return () => {
      clearTimeout(fetchTimeout);
      abortController.abort();
      map.off('moveend', onMoveEnd);
      if (currentLayer && map.hasLayer(currentLayer)) {
        map.removeLayer(currentLayer);
      }
    };
  }, [map, timeOffset]);

  return null;
}
