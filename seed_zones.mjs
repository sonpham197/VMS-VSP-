import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env.local parsing
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

const zones = [
  {
    name: "Khu vực Hoàng Sa (Paracel Islands)",
    type: "restricted",
    severity: "danger",
    description: "Khu vực hạn chế di chuyển đặc biệt.",
    // Polygon: (lon lat)
    geom: `POLYGON((111.0 15.5, 113.5 15.5, 113.5 17.5, 111.0 17.5, 111.0 15.5))`
  },
  {
    name: "Khu vực Trường Sa (Spratly Islands)",
    type: "restricted",
    severity: "danger",
    description: "Khu vực nhạy cảm hàng hải.",
    geom: `POLYGON((111.5 7.5, 117.0 7.5, 117.0 12.0, 111.5 12.0, 111.5 7.5))`
  },
  {
    name: "Vùng bảo trì cáp quang Vũng Tàu",
    type: "warning",
    severity: "warning",
    description: "Khu vực đang bảo trì cáp quang dưới biển. Hạn chế thả neo.",
    geom: `POLYGON((107.0 10.0, 107.5 10.0, 107.5 10.5, 107.0 10.5, 107.0 10.0))`
  }
];

async function seedZones() {
  console.log("Seeding Zones...");
  
  for (const zone of zones) {
    // We use raw SQL for Gist/Geometry via rpc or just string templates if allowed,
    // but usually with Supabase JS we might need to use a function or raw SQL if PostGIS helper isn't loaded.
    // However, string 'POLYGON(...)' works with PostGIS input.
    
    const { data, error } = await supabase
      .from('zones')
      .insert([
        {
          name: zone.name,
          type: zone.type,
          severity: zone.severity,
          description: zone.description,
          geom: zone.geom // PostGIS handles strings like this
        }
      ]);

    if (error) {
      console.error(`Error seeding ${zone.name}:`, error.message);
    } else {
      console.log(`Successfully seeded ${zone.name}`);
    }
  }
}

seedZones();
