import { createClient } from '@supabase/supabase-js';
import { detectCollisionRisks } from './lib/collisionWarning.js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) acc[key.trim()] = rest.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data: vData } = await supabase.from('vessels').select('*');
  const { data: tData } = await supabase.from('vessel_current_positions').select('*');
  
  const latest = {};
  tData.forEach(t => {
    if (t.Vessel_id && t.lat !== null) {
      latest[t.Vessel_id] = { ...t, created_at: t.last_seen };
    }
  });

  const vessels = vData.map(v => ({
    ...v,
    ...(latest[v.Vessel_id] || {})
  }));

  const risks = detectCollisionRisks(vessels);
  console.log(`Loaded ${vessels.length} vessels.`);
  console.log(`Vessels with tracks: ${vessels.filter(v => v.lat !== undefined).length}`);
  console.log(`Found ${risks.length} risks.`);
  risks.forEach(r => {
    console.log(`[${r.risk_level.toUpperCase()}] ${r.vesselA.Vessel_name} - ${r.vesselB.Vessel_name} (CPA: ${r.cpa_nm.toFixed(2)}, TCPA: ${r.tcpa_min.toFixed(2)}, Dist: ${r.current_dist_nm.toFixed(2)})`);
  });
}

test();
