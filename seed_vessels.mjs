import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const vesselsData = [
  { Vessel_id: 'VMS-101', Vessel_name: 'Hải Âu 01', vessel_type: 'Tàu đánh cá', flag: 'VN', length_m: 25, width_m: 6, owner: 'Công ty Thuỷ sản ABC' },
  { Vessel_id: 'VMS-102', Vessel_name: 'Pacific Trader', vessel_type: 'Tàu chở dầu', flag: 'PA', length_m: 220, width_m: 35, owner: 'Pacific Lines' },
  { Vessel_id: 'VMS-103', Vessel_name: 'Vinalines Queen', vessel_type: 'Tàu hàng tổng hợp', flag: 'VN', length_m: 180, width_m: 28, owner: 'Vinalines' },
  { Vessel_id: 'VMS-104', Vessel_name: 'Biển Đông 02', vessel_type: 'Tàu container', flag: 'VN', length_m: 150, width_m: 22, owner: 'Biển Đông MSC' },
  { Vessel_id: 'VMS-105', Vessel_name: 'Tokyo Express', vessel_type: 'Tàu container', flag: 'JP', length_m: 300, width_m: 40, owner: 'Nippon Yusen' },
];

const startPositions = [
  { lat: 10.3, lng: 107.5 }, // Near Vung Tau
  { lat: 11.0, lng: 109.0 }, // Off Binh Thuan
  { lat: 15.5, lng: 109.5 }, // Central VN
  { lat: 20.0, lng: 107.2 }, // Gulf of Tonkin
  { lat: 9.5,  lng: 106.0 }, // Mekong Delta
];

async function seed() {
  console.log('Seeding vessels...');
  for (let i = 0; i < vesselsData.length; i++) {
    const v = vesselsData[i];
    
    // Check if exists
    const { data: existing } = await supabase.from('vessels').select('Vessel_id').eq('Vessel_id', v.Vessel_id);
    if (!existing || existing.length === 0) {
      await supabase.from('vessels').insert(v);
      console.log(`Inserted vessel ${v.Vessel_id}`);
    }

    // Seed track
    const pos = startPositions[i];
    await supabase.from('vessel_tracks').insert({
      Vessel_id: v.Vessel_id,
      lat: pos.lat,
      lng: pos.lng,
      speed: 10 + Math.random() * 5,
      heading: Math.floor(Math.random() * 360),
    });
    console.log(`Inserted track for ${v.Vessel_id}`);
  }
  console.log('Done seeding data.');
}

seed();
