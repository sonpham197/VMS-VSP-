import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';

// Load Coastline Data for obstacle avoidance
let coastlineData = null;
try {
  const filePath = path.join(process.cwd(), 'public', 'geojson', 'vietnam-coastline.json');
  coastlineData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (e) {
  console.log('Could not load coastline GeoJSON for routing', e);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { startLat, startLng, destLat, destLng, speed } = req.body;

  if (startLat == null || startLng == null || destLat == null || destLng == null) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  const vesselSpeed = Number(speed) || 10; // Default speed to 10 knots if not provided or 0

  try {
    const startPt = turf.point([startLng, startLat]);
    const destPt = turf.point([destLng, destLat]);

    let routeLine;
    
    // Check if we have obstacle data, if so perform shortestPath avoiding obstacles
    if (coastlineData) {
      const options = {
        obstacles: coastlineData, 
        resolution: 50 // lower resolution for faster computation, though less accurate
      };
      
      try {
        const pathData = turf.shortestPath(startPt, destPt, options);
        routeLine = pathData; // Feature<LineString>
      } catch (err) {
        console.error("Pathfinding error (fallback to direct line):", err);
        // Fallback to direct line if shortestPath fails for some reason
        routeLine = turf.lineString([[startLng, startLat], [destLng, destLat]]);
      }
    } else {
      routeLine = turf.lineString([[startLng, startLat], [destLng, destLat]]);
    }

    // Calculate length in nautical miles (1 km = 0.539957 knots/nautical miles)
    // turf.length returns km by default
    const distanceKm = turf.length(routeLine, { units: 'kilometers' });
    const distanceNM = distanceKm * 0.539957;

    const timeHours = distanceNM / vesselSpeed;
    
    // Convert current time + timeHours into a Date representing ETA
    const etaDate = new Date();
    etaDate.setMinutes(etaDate.getMinutes() + (timeHours * 60));

    // Convert route into array of {lat, lng} for Leaflet
    const coords = routeLine.geometry.coordinates;
    const pathCoordinates = coords.map(c => ({
      lng: c[0],
      lat: c[1]
    }));

    return res.status(200).json({
      success: true,
      path: pathCoordinates,
      distanceNM: distanceNM,
      distanceKm: distanceKm,
      timeHours: timeHours,
      eta: etaDate.toISOString()
    });

  } catch (error) {
    console.error('Route API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
