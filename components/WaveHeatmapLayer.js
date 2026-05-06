import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function WaveHeatmapLayer({ timeOffset = 0 }) {
  const map = useMap();

  useEffect(() => {
    let layer = null;
    
    const initHeat = async () => {
      try {
        if (!L.heatLayer) {
          require('leaflet.heat');
        }

        // We use a generated wave simulation that respects the timeOffset 
        // to create a dynamic forecast animation effect across the visible map.
        // In a real prod system, this would query Open-Meteo grid data.
        const bounds = map.getBounds();
        const points = [];
        const latStep = (bounds.getNorth() - bounds.getSouth()) / 40;
        const lngStep = (bounds.getEast() - bounds.getWest()) / 40;

        // Create wave interference patterns
        for (let lat = bounds.getSouth(); lat < bounds.getNorth(); lat += latStep) {
          for (let lng = bounds.getWest(); lng < bounds.getEast(); lng += lngStep) {
            // Simulated wave height formula moving over time
            const wave1 = Math.sin(lat * 8 + timeOffset * 0.8);
            const wave2 = Math.cos(lng * 8 - timeOffset * 0.8);
            const wave3 = Math.sin((lat + lng) * 4 + timeOffset * 0.4);
            
            let height = (wave1 + wave2 + wave3 + 3) / 1.5; // Range ~0 to 4 meters
            
            if (height > 0.5) {
              points.push([lat, lng, height]);
            }
          }
        }

        layer = L.heatLayer(points, {
          radius: 35,
          blur: 25,
          maxZoom: 10,
          max: 4,
          gradient: {
            0.2: '#0284c7', // Low waves (blue)
            0.4: '#10b981', // Medium (green)
            0.6: '#eab308', // High (yellow)
            0.8: '#f97316', // Very High (orange)
            1.0: '#ef4444'  // Dangerous (red)
          }
        });

        layer.addTo(map);
      } catch (err) {
        console.error("Heatmap init error", err);
      }
    };

    initHeat();
    
    const onMoveEnd = () => {
       if (layer && map.hasLayer(layer)) {
         map.removeLayer(layer);
       }
       initHeat();
    };
    
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('moveend', onMoveEnd);
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, timeOffset]);

  return null;
}
