import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-velocity/dist/leaflet-velocity.css';

export default function WindVelocityLayer({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!data) return;

    let velocityLayer;
    
    // Import leaflet-velocity dynamically on client side
    const initVelocity = async () => {
      try {
        if (!L.velocityLayer) {
          require('leaflet-velocity');
        }
        
        velocityLayer = L.velocityLayer({
          displayValues: true,
          displayOptions: {
            velocityType: 'Gió',
            position: 'bottomright',
            emptyString: 'Không có dữ liệu',
            angleConvention: 'bearingCW',
            displayPosition: 'bottomright',
            displayEmptyString: 'Không có dữ liệu',
            speedUnit: 'm/s'
          },
          data: data,
          maxVelocity: 15,
          velocityScale: 0.005,
          colorScale: [
            "#0000ff", "#0033ff", "#0066ff", "#0099ff", "#00ccff", "#00ffff", "#33ffcc",
            "#66ff99", "#99ff66", "#ccff33", "#ffff00", "#ffcc00", "#ff9900", "#ff6600",
            "#ff3300", "#ff0000"
          ]
        });

        velocityLayer.addTo(map);
      } catch (err) {
        console.error("leaflet-velocity load error:", err);
      }
    };

    initVelocity();

    return () => {
      if (velocityLayer && map.hasLayer(velocityLayer)) {
        map.removeLayer(velocityLayer);
      }
    };
  }, [map, data]);

  return null;
}
