import { createClient } from '@supabase/supabase-js';
import * as turf from '@turf/turf';
import fs from 'fs';

const supabaseUrl = 'https://pqfzpcuqzfpaernwydao.supabase.co';
const supabaseAnonKey = 'sb_publishable_-QHP-kzHCZI0qgj8Fi-e9w_KEPpxTCk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const coastlineData = JSON.parse(fs.readFileSync('./public/geojson/vietnam-coastline.json', 'utf8'));

const vesselsToUpdate = [
  'PAN-992', 'LIB-451', 'SGP-202', 'MHL-888', 'JPN-100', 
  'VNM-088', 'CHN-999', 'KOR-774', 'MYS-331', 'GRC-005'
];

function isLand(lng, lat) {
  const pt = turf.point([lng, lat]);
  let hit = false;
  try {
    for (const feature of coastlineData.features) {
       if (turf.booleanPointInPolygon(pt, feature)) {
          hit = true;
          break;
       }
    }
  } catch(e) {}
  return hit;
}

function getRandomSeaPoint() {
  const minLat = 9;
  const maxLat = 16;
  const minLng = 106;
  const maxLng = 112;
  
  while(true) {
    const lat = Math.random() * (maxLat - minLat) + minLat;
    const lng = Math.random() * (maxLng - minLng) + minLng;
    if (!isLand(lng, lat)) {
       return { lat, lng };
    }
  }
}

function calculateNextPoint(lat, lng, speed, heading, timeHours) {
  const distance_deg = speed * timeHours / 60.0;
  const next_lat = lat + (distance_deg * Math.cos(heading * Math.PI / 180));
  const next_lng = lng + (distance_deg * Math.sin(heading * Math.PI / 180) / Math.cos(lat * Math.PI / 180));
  return { lat: next_lat, lng: next_lng };
}

async function seedTracks() {
  console.log('Fetching vessel names...');
  const { data: vData } = await supabase.from('vessels').select('Vessel_id, Vessel_name').in('Vessel_id', vesselsToUpdate);
  const vesselNames = {};
  if (vData) {
      vData.forEach(v => vesselNames[v.Vessel_id] = v.Vessel_name);
  }

  console.log('Deleting old tracks for these 10 vessels...');
  await supabase.from('vessel_tracks').delete().in('Vessel_id', vesselsToUpdate);

  console.log('Generating 20 sequential points for each vessel (avoiding land)...');
  
  const allTracks = [];
  
  for (const vId of vesselsToUpdate) {
     const name = vesselNames[vId] || vId;
     // Bắt đầu từ 20 giờ trước
     const baseTime = new Date();
     baseTime.setHours(baseTime.getHours() - 20);
     
     let currentPoint = getRandomSeaPoint();
     let currentHeading = Math.random() * 360;
     const currentSpeed = Math.random() * 8 + 8; // 8 to 16 knots

     for (let i = 0; i < 20; i++) {
        // Cố gắng tính xem point tiếp theo có chui vào đất liền k, đổi heading liên tục nếu bị lỗi
        let nextPt;
        let attempts = 0;
        let tempHeading = currentHeading;
        while(attempts < 10) {
           nextPt = calculateNextPoint(currentPoint.lat, currentPoint.lng, currentSpeed, tempHeading, 1);
           if (!isLand(nextPt.lng, nextPt.lat)) {
              break;
           }
           // Đâm vô bờ, xoay mũi tàu loạn lên
           tempHeading = (tempHeading + 45) % 360;
           attempts++;
        }
        
        currentHeading = tempHeading; // Giữ hướng hợp lệ
        currentPoint = nextPt;
        
        const trackTime = new Date(baseTime.getTime() + (i * 60 * 60 * 1000));
        
        allTracks.push({
           Vessel_id: vId,
           Vessel_name: name,
           lat: currentPoint.lat,
           lng: currentPoint.lng,
           speed: currentSpeed,
           heading: currentHeading,
           status: 'normal',
           created_at: trackTime.toISOString()
        });
     }
  }

  console.log(`Inserting ${allTracks.length} points...`);
  const chunkSize = 50;
  for (let i = 0; i < allTracks.length; i += chunkSize) {
      const chunk = allTracks.slice(i, i + chunkSize);
      const { error } = await supabase.from('vessel_tracks').insert(chunk);
      if (error) {
         console.error('Error inserting block', error);
      }
  }

  console.log('Done!');
}

seedTracks();
