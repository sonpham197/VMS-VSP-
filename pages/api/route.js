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

  const { startLat, startLng, destLat, destLng, speed, criteria } = req.body;

  if (startLat == null || startLng == null || destLat == null || destLng == null) {
    return res.status(400).json({ error: 'Missing coordinates' });
  }

  const vesselSpeedSettings = Number(speed) || 12; // Default speed 12 knots
  const opts = criteria || { time: true, fuel: false, risk: false, weather: false };

  try {
    const startPt = turf.point([startLng, startLat]);
    const destPt = turf.point([destLng, destLat]);

    // 1. Fetch real Weather data at Midpoint
    const midLng = (startLng + destLng) / 2;
    const midLat = (startLat + destLat) / 2;
    let windSpeed = 0;
    try {
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${midLat}&longitude=${midLng}&current_weather=true`);
      if (wRes.ok) {
         const wData = await wRes.json();
         if (wData.current_weather) {
           windSpeed = wData.current_weather.windspeed;
         }
      }
    } catch (err) {
      console.log('Weather API failed', err);
      windSpeed = 25; // fallback to simulate a storm
    }

    // 2. Route Path Generation
    let routeLine;
    let isPerturbed = (opts.weather || opts.risk) && windSpeed > 10;
    let calcPoints = [[startLng, startLat]];

    if (isPerturbed) {
      // Perturb the route to avoid the "storm" in the middle
      // Move midpoint by approx 40km perpendicular
      const bearing = turf.bearing(startPt, destPt);
      const midPoint = turf.midpoint(startPt, destPt);
      const offsetBearing = bearing + 90;
      const offsetPt = turf.destination(midPoint, 40, offsetBearing, { units: 'kilometers' });
      calcPoints.push(offsetPt.geometry.coordinates);
    }
    calcPoints.push([destLng, destLat]);

    let pathCoordinates = [];
    if (coastlineData && !isPerturbed) {
        try {
            const tempLine = turf.shortestPath(startPt, destPt, { obstacles: coastlineData, resolution: 50 });
            pathCoordinates = tempLine.geometry.coordinates;
        } catch {
            pathCoordinates = calcPoints;
        }
    } else {
        pathCoordinates = calcPoints;
    }

    routeLine = turf.lineString(pathCoordinates);

    // 3. Distance
    const distanceKm = turf.length(routeLine, { units: 'kilometers' });
    const distanceNM = distanceKm * 0.539957;

    // 4. Cost/Speed calculations
    let actualSpeed = vesselSpeedSettings;
    let riskStatus = 'Thấp';
    
    // Penalty logic
    if (opts.fuel) {
        actualSpeed = Math.max(8, actualSpeed * 0.70); // Eco speed -> slower but saves fuel
    }

    if (!isPerturbed && windSpeed > 12) {
        // Going straight into bad weather/risk -> speed drops heavily, risk is high
        actualSpeed = Math.max(4, actualSpeed * 0.5); // Speed reduced heavily by storm
        riskStatus = 'Cao';
    } else if (isPerturbed) {
        // Optimized route, bypassed storm
        riskStatus = 'Thấp (đã chuyển làn an toàn)';
    }

    const timeHours = distanceNM / actualSpeed;
    const fuelConsumption = distanceNM * 0.1 * (actualSpeed / 10) * (actualSpeed / 10); // Non-linear fuel consumption based on speed

    // Simple Scoring: a*time + b*fuel + c*risk + d*weather
    const a = opts.time ? 10 : 2;
    const b = opts.fuel ? 50 : 5;
    const c = opts.risk ? 30 : 2;
    const d = opts.weather ? 20 : 2;

    const riskVal = riskStatus === 'Cao' ? 10 : 1;
    const weatherImpact = isPerturbed ? 1 : windSpeed; // if perturbed, no weather impact on the new route

    const costScore = (a * timeHours) + (b * fuelConsumption) + (c * riskVal) + (d * weatherImpact);

    const etaDate = new Date();
    etaDate.setMinutes(etaDate.getMinutes() + (timeHours * 60));

    // Convert route into Leaflet {lat, lng} array
    const mappedCoordinates = routeLine.geometry.coordinates.map(coord => ({
      lng: coord[0],
      lat: coord[1]
    }));

    // Interval points every 2 hours
    const intervalPoints = [];
    for (let h = 2; h < timeHours; h += 2) {
      const distKm = (h * actualSpeed) / 0.539957;
      let pt;
      try {
        pt = turf.along(routeLine, distKm, { units: 'kilometers' });
      } catch(e) {
        pt = turf.point(mappedCoordinates[mappedCoordinates.length - 1]);
      }
      const ptEta = new Date();
      ptEta.setMinutes(ptEta.getMinutes() + (h * 60));
      intervalPoints.push({
        lat: pt.geometry.coordinates[1],
        lng: pt.geometry.coordinates[0],
        time: ptEta.toISOString(),
        hour: h
      });
    }

    return res.status(200).json({
      success: true,
      path: mappedCoordinates,
      intervalPoints: intervalPoints,
      distanceNM: distanceNM,
      distanceKm: distanceKm,
      timeHours: timeHours,
      eta: etaDate.toISOString(),
      metrics: {
         costScore: costScore,
         fuel: fuelConsumption,
         weatherValue: windSpeed,
         riskStatus: riskStatus
      }
    });

  } catch (error) {
    console.error('Route API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
