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

const demoTracks = [
  // 1. VI PHẠM VÙNG CẤM: Tàu Hoa Biển 1 đi vào giữa quần đảo Hoàng Sa
  {
    Vessel_id: "BD-001",
    Vessel_name: "Hoa Biển 1",
    lat: 16.82,
    lng: 112.35,
    speed: 12.5,
    heading: 45,
  },
  // 2. QUÁ TỐC ĐỘ: Tàu Ever Glory chạy với tốc độ cực cao
  {
    Vessel_id: "PAN-992",
    Vessel_name: "Ever Glory",
    lat: 10.5,
    lng: 108.5,
    speed: 48.2, // > 25 knots
    heading: 90,
  },
  // 3. NEO ĐẬU BẤT THƯỜNG / LOITERING: Tàu MSC Oscar dừng lại ở vùng cáp quang Vũng Tàu
  {
    Vessel_id: "LIB-451",
    Vessel_name: "MSC Oscar",
    lat: 10.22,
    lng: 107.25,
    speed: 0.1, // Gần như đứng yên
    heading: 10,
  },
  // 4. MẤT TÍN HIỆU (Ghi đè thời gian cũ để mô phỏng)
  {
    Vessel_id: "SGP-202",
    Vessel_name: "BW Pavilion",
    lat: 9.5,
    lng: 106.8,
    speed: 14.0,
    heading: 220,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 tiếng trước
  }
];

async function seedDemoAlerts() {
  console.log("🚀 Bắt đầu nạp dữ liệu Demo cảnh báo...");
  console.log("Lưu ý: Trigger database sẽ tự động phân tích và tạo Alert trong bảng 'alerts'.");

  for (const track of demoTracks) {
    const { data, error } = await supabase
      .from('vessel_tracks')
      .insert([track]);

    if (error) {
      console.error(`❌ Lỗi nạp dữ liệu cho ${track.Vessel_name}:`, error.message);
    } else {
      console.log(`✅ Đã nạp tọa độ cho ${track.Vessel_name}.`);
    }
  }

  console.log("\n✨ Xong! Hãy kiểm tra 'Alert Drawer' trên UI để xem kết quả.");
}

seedDemoAlerts();
