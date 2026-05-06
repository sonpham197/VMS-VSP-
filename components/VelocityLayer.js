import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-velocity/dist/leaflet-velocity.css';

export default function VelocityLayer({ data, type = 'wind' }) {
  const map = useMap();

  useEffect(() => {
    let layer = null;
    
    const initVelocity = async () => {
      try {
        if (!L.velocityLayer) {
          require('leaflet-velocity');
        }

        const options = type === 'wind' ? {
          velocityType: 'Gió',
          maxVelocity: 25,
          colorScale: ['#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#fee08b', '#fdae61', '#f46d43', '#d53e4f'],
          particleMultiplier: 1 / 1200,
          lineWidth: 2,
        } : {
          velocityType: 'Hải lưu / Sóng',
          maxVelocity: 2.5, // water moves slower
          colorScale: ['#023858', '#045a8d', '#0570b0', '#3690c0', '#74a9cf', '#a6bddb', '#d0d1e6', '#ece7f2'],
          particleMultiplier: 1 / 800,
          lineWidth: 2,
        };

        // Scale data for water to make it look realistic (10% of wind speed)
        let displayData = data;
        if (type === 'water') {
          displayData = JSON.parse(JSON.stringify(data));
          displayData[0].data = displayData[0].data.map(v => v * 0.1);
          displayData[1].data = displayData[1].data.map(v => v * 0.1);
        }

        layer = L.velocityLayer({
          displayValues: true,
          displayOptions: {
            velocityType: options.velocityType,
            displayPosition: 'bottomleft',
            displayEmptyString: 'Không có dữ liệu'
          },
          data: displayData,
          maxVelocity: options.maxVelocity,
          colorScale: options.colorScale,
          particleMultiplier: options.particleMultiplier,
          lineWidth: options.lineWidth,
          velocityScale: type === 'water' ? 0.05 : 0.005, // scale particle tail
        });

        layer.addTo(map);
      } catch (err) {
        console.error("Velocity layer init error:", err);
      }
    };

    if (data) {
      initVelocity();
    }

    return () => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, data, type]);

  return null;
}
