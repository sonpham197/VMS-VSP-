import { supabase } from '@/lib/supabaseClient';
import * as turf from '@turf/turf';
import fs from 'fs';
import path from 'path';

// Changed from brain.js (requires C++ build tools on Windows) to synaptic (pure JS)
const synaptic = require('synaptic');

// Load Coastline Data
let coastlinePolygon = null;
try {
  const filePath = path.join(process.cwd(), 'public', 'geojson', 'vietnam-coastline.json');
  coastlinePolygon = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (e) {
  console.log('Could not load coastline GeoJSON', e);
}

// Fallback dead reckoning logic if ML fails or doesn't have enough data
function calculateNextPoint(lat, lng, speed, heading, timeHours) {
  const distance_deg = speed * timeHours / 60.0;
  const next_lat = lat + (distance_deg * Math.cos(heading * Math.PI / 180));
  const next_lng = lng + (distance_deg * Math.sin(heading * Math.PI / 180) / Math.cos(lat * Math.PI / 180));
  return { lat: next_lat, lng: next_lng };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { vesselId, hours, visualAnchor } = req.body;
  
  if (!vesselId || !hours) return res.status(400).json({ error: 'Missing parameters' });

  try {
    // 1. Fetch History from Supabase (Get the most recent 50 tracks)
    const { data: rawTracks, error } = await supabase
      .from('vessel_tracks')
      .select('lat, lng, speed, heading, created_at')
      .eq('Vessel_id', vesselId)
      .order('created_at', { ascending: false }) // Get newest first
      .limit(50);

    if (error || !rawTracks || rawTracks.length === 0) {
      return res.status(404).json({ error: 'No history found for this vessel' });
    }

    // Khởi tạo mảng ngược tường minh bypass hàm sort/reverse phức tạp
    const tracks = [];
    for (let i = rawTracks.length - 1; i >= 0; i--) {
      tracks.push(rawTracks[i]);
    }

    // Ưu tiên Điểm cuối cùng trên giao diện UI (visualAnchor) làm gốc để giữ nguyên mảng đứt nét
    const latestDb = tracks[tracks.length - 1];
    const latest = visualAnchor || latestDb;

    // 2. Fetch Weather Data (Open-Meteo) for the latest point
    let weatherInput = { wind_speed: 0, wind_direction: 0 };
    try {
      const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latest.lat}&longitude=${latest.lng}&current_weather=true`);
      const wData = await wRes.json();
      if (wData.current_weather) {
        weatherInput.wind_speed = wData.current_weather.windspeed;
        weatherInput.wind_direction = wData.current_weather.winddirection;
      }
    } catch (err) {
      console.log('Weather API failed', err);
    }

    // 3. Prepare AI Prediction (LSTM)
    let predictedPoints = [];
    let currentLat = latest.lat;
    let currentLng = latest.lng;
    let currentSpeed = latest.speed || 10;
    let currentHeading = latest.heading || 0;
    
    // Nối điểm cuối của track vào vị trí đầu tiên của đường dự báo
    predictedPoints.push({
      lat: currentLat,
      lng: currentLng,
      speed: currentSpeed,
      heading: currentHeading,
      time: latest.created_at,
      weather_wind_speed: 0,
      is_ai_predicted: false,
      is_anchor: true // Báo hiệu cho MapView không vẽ Marker cho điểm dính này
    });
    
    // We scale data roughly to 0-1 for brain.js (LSTMTimeStep needs normalized data)
    // Speed: max 50 kn = /50
    // Heading: /360
    // Lat: ~ /90, Lng: ~ /180
    const scale = {
      lat: (val) => val / 90,
      lng: (val) => val / 180,
      speed: (val) => val / 50,
      heading: (val) => val / 360
    };
    const unscale = {
      lat: (val) => val * 90,
      lng: (val) => val * 180,
      speed: (val) => val * 50,
      heading: (val) => val * 360
    };

    let aiReady = false;
    let net = new synaptic.Architect.LSTM(2, 6, 2); // 2 inputs (speed, heading), 6 hidden, 2 outputs
    
    if (tracks.length > 5) {
      // Training data: map absolute kinematics to DELTA kinematics
      const trainingData = [];
      for (let i = 0; i < tracks.length - 1; i++) {
        let deltaSpeed = tracks[i+1].speed - tracks[i].speed;
        let deltaHeading = tracks[i+1].heading - tracks[i].heading;
        
        // Cân bằng Delta Heading về cung [-180, 180]
        while (deltaHeading <= -180) deltaHeading += 360;
        while (deltaHeading > 180) deltaHeading -= 360;

        // Chuẩn hóa Delta về khoảng [0, 1] cho Sigmoid của ML
        // Giả sử tốc độ thay đổi tối đa là [-15, +15] knot mỗi giờ
        let sSpeed = Math.max(0, Math.min(1, (deltaSpeed + 15) / 30));
        let sHeading = Math.max(0, Math.min(1, (deltaHeading + 180) / 360));

        trainingData.push({
          input: [scale.speed(tracks[i].speed), scale.heading(tracks[i].heading)],
          output: [sSpeed, sHeading]
        });
      }
      
      const trainer = new synaptic.Trainer(net);
      trainer.train(trainingData, { iterations: 100, rate: 0.1, error: 0.01, log: false });
      aiReady = true;
    }

    let isTerminatedByLand = false;
    let stopReason = "";

    // 4. Generate points step by step (1 hour interval)
    let sequence = tracks.map(t => [scale.speed(t.speed), scale.heading(t.heading)]);
    
    let simulatedTime = new Date(latest.created_at || Date.now());

    for (let i = 1; i <= hours; i++) {
      let nextLat, nextLng, nextSpeed, nextHeading;
      
      if (aiReady) {
        try {
          const lastPoint = sequence[sequence.length - 1];
          const prediction = net.activate(lastPoint); 
          
          // Giải mã Delta ngược lại từ khoảng [0, 1]
          let deltaSpeed = (prediction[0] * 30) - 15;
          let deltaHeading = (prediction[1] * 360) - 180;
          
          nextSpeed = currentSpeed + deltaSpeed + (weatherInput.wind_speed * 0.01); 
          nextHeading = currentHeading + deltaHeading;
          
          // Giới hạn giá trị vật lý
          if (isNaN(nextSpeed) || isNaN(nextHeading)) throw new Error('NaN output');
          nextSpeed = Math.max(0, Math.min(nextSpeed, 35));
          
          while (nextHeading < 0) nextHeading += 360;
          while (nextHeading >= 360) nextHeading -= 360;

          const ext = calculateNextPoint(currentLat, currentLng, nextSpeed, nextHeading, 1);
          nextLat = ext.lat;
          nextLng = ext.lng;
          
          sequence.push([scale.speed(nextSpeed), scale.heading(nextHeading)]);

        } catch (e) {
           // fallback to math if ML explodes
           const ext = calculateNextPoint(currentLat, currentLng, currentSpeed, currentHeading, 1);
           nextLat = ext.lat;
           nextLng = ext.lng;
           nextSpeed = currentSpeed;
           nextHeading = currentHeading;
        }
      } else {
        // Linear fallback
        const ext = calculateNextPoint(currentLat, currentLng, currentSpeed, currentHeading, 1);
        nextLat = ext.lat;
        nextLng = ext.lng;
        nextSpeed = currentSpeed;
        nextHeading = currentHeading;
      }

      // 5. Land Avoidance Check
      let hitLand = false;
      if (coastlinePolygon) {
        const pt = turf.point([nextLng, nextLat]);
        try {
          hitLand = turf.booleanPointInPolygon(pt, coastlinePolygon.features[0]);
        } catch(e) {}
      }
      
      if (hitLand) {
        isTerminatedByLand = true;
        stopReason = `Cảnh báo đất liền tại múi giờ thứ ${i}. Vị trí kết thúc an toàn.`;
        break; // Stop predicting
      }
      
      simulatedTime = new Date(simulatedTime.getTime() + 60 * 60 * 1000); // +1 hour

      predictedPoints.push({
        lat: nextLat,
        lng: nextLng,
        speed: nextSpeed,
        heading: nextHeading,
        time: simulatedTime.toISOString(),
        weather_wind_speed: weatherInput.wind_speed,
        is_ai_predicted: aiReady
      });

      // update current for next iteration
      currentLat = nextLat; currentLng = nextLng;
    }

    return res.status(200).json({ 
      success: true, 
      predictedPoints, 
      isTerminatedByLand, 
      stopReason 
    });

  } catch (error) {
    console.error('Prediction API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
