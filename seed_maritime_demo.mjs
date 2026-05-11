/**
 * seed_maritime_demo.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Synthetic AIS data generator for AI Maritime Intelligence demo
 * Generates 100 vessels × 120+ AIS records = ~12,000 position records
 * Geographic area: Hai Phong Port / Gulf of Tonkin / Northern Vietnam
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage: node seed_maritime_demo.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local manually (no dotenv dependency)
const __dir = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dir, '.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
const SUPABASE_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']?.trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


// ─── Geographic constants (Hai Phong area) ───────────────────────────────────
const GEO = {
  lachHuyen:   { lat: 20.750, lng: 106.820 },
  haiPhongPort:{ lat: 20.870, lng: 106.670 },
  catHaiAnch:  { lat: 20.790, lng: 106.920 },
  pilotStation:{ lat: 20.720, lng: 106.880 },
  gulfEntry:   { lat: 20.500, lng: 107.100 },
  gulfDeep:    { lat: 20.200, lng: 107.500 },
  offshore1:   { lat: 20.300, lng: 107.800 },
  fishingGround:{ lat: 20.100, lng: 107.300 },
};

// ─── AIS nav_status codes ─────────────────────────────────────────────────────
const NAV = {
  UNDERWAY: 0, ANCHOR: 1, NOT_COMMAND: 2, RESTRICTED: 3,
  DRAUGHT: 4, MOORED: 5, AGROUND: 6, FISHING: 7, SAILING: 8,
};

// ─── Vessel class definitions ─────────────────────────────────────────────────
const VESSEL_CLASSES = [
  {
    class_code: 'container', vessel_type: 'Container Ship',
    count: 15, flag: 'VN',
    dwt: [15000,80000], loa: [150,300], draft: [8,14],
    speed: [12,18], behavior: 'liner',
  },
  {
    class_code: 'bulk_carrier', vessel_type: 'Bulk Carrier',
    count: 15, flag: 'VN',
    dwt: [20000,100000], loa: [160,280], draft: [10,16],
    speed: [10,15], behavior: 'bulk',
  },
  {
    class_code: 'tanker', vessel_type: 'Tanker',
    count: 12, flag: 'SG',
    dwt: [10000,60000], loa: [120,250], draft: [8,15],
    speed: [10,14], behavior: 'tanker',
  },
  {
    class_code: 'general_cargo', vessel_type: 'General Cargo',
    count: 18, flag: 'VN',
    dwt: [2000,15000], loa: [80,150], draft: [4,9],
    speed: [8,12], behavior: 'coastal',
  },
  {
    class_code: 'tugboat', vessel_type: 'Tugboat',
    count: 10, flag: 'VN',
    dwt: [500,2000], loa: [25,45], draft: [3,5],
    speed: [6,12], behavior: 'tug',
  },
  {
    class_code: 'fishing', vessel_type: 'Fishing Vessel',
    count: 15, flag: 'VN',
    dwt: [50,500], loa: [15,40], draft: [2,4],
    speed: [2,8], behavior: 'fishing',
  },
  {
    class_code: 'passenger', vessel_type: 'Passenger Vessel',
    count: 5, flag: 'VN',
    dwt: [1000,5000], loa: [50,120], draft: [3,6],
    speed: [12,20], behavior: 'ferry',
  },
  {
    class_code: 'offshore_support', vessel_type: 'Offshore Support Vessel',
    count: 10, flag: 'SG',
    dwt: [2000,8000], loa: [60,100], draft: [4,7],
    speed: [10,16], behavior: 'offshore',
  },
];

// ─── Helper functions ─────────────────────────────────────────────────────────
const rnd = (min, max) => min + Math.random() * (max - min);
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const rndChoice = (arr) => arr[rndInt(0, arr.length - 1)];
const noise = (val, pct = 0.05) => val + (Math.random() - 0.5) * 2 * val * pct;

function lerp(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function bearing(from, to) {
  const dLng = to.lng - from.lng;
  const dLat = to.lat - from.lat;
  let angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
}

// Interpolate waypoints into N AIS records with realistic noise
function interpolateRoute(waypoints, totalRecords, baseSpeed, startTime, options = {}) {
  const records = [];
  const segCount = waypoints.length - 1;
  const recPerSeg = Math.max(1, Math.floor(totalRecords / segCount));

  let currentTime = new Date(startTime);

  for (let s = 0; s < segCount; s++) {
    const from = waypoints[s];
    const to   = waypoints[s + 1];
    const hdg  = bearing(from, to);
    const segRecords = (s === segCount - 1)
      ? totalRecords - records.length
      : recPerSeg;

    const segSpeed = options.speedOverride?.[s] ?? noise(baseSpeed, 0.1);
    const navStatus = options.navStatus?.[s] ?? NAV.UNDERWAY;

    for (let i = 0; i < segRecords; i++) {
      const t = segRecords > 1 ? i / (segRecords - 1) : 0;
      const pos = lerp(from, to, t);

      // Add realistic position noise
      const posNoise = navStatus === NAV.MOORED ? 0.0001 : 0.002;
      records.push({
        lat:          +(pos.lat + (Math.random()-0.5) * posNoise).toFixed(6),
        lng:          +(pos.lng + (Math.random()-0.5) * posNoise).toFixed(6),
        speed:        navStatus === NAV.MOORED ? 0 :
                      navStatus === NAV.ANCHOR ? +(rnd(0,0.5)).toFixed(1) :
                      +(noise(segSpeed, 0.08)).toFixed(1),
        heading:      +((hdg + (Math.random()-0.5)*10) % 360).toFixed(0),
        cog:          +((hdg + (Math.random()-0.5)*5) % 360).toFixed(0),
        nav_status:   navStatus,
        nav_status_text: navStatusText(navStatus),
        timestamp:    new Date(currentTime).toISOString(),
      });
      // Advance time: distance/speed approximation — ~3-15 min per record
      currentTime = new Date(currentTime.getTime() + rnd(3, 15) * 60000);
    }
  }
  return records;
}

function navStatusText(code) {
  const map = {0:'Under Way', 1:'At Anchor', 2:'Not Under Command',
    3:'Restricted Manoeuvrability', 5:'Moored', 7:'Engaged in Fishing', 8:'Under Way Sailing'};
  return map[code] || 'Unknown';
}

// ─── Behavior Simulators ──────────────────────────────────────────────────────

function simulateLiner(vessel, startTime) {
  // Container: Gulf → Pilot → Lach Huyen berth → stay → outbound
  const scenario = rndChoice(['inbound', 'outbound', 'at_berth']);
  if (scenario === 'inbound') {
    return interpolateRoute([
      GEO.gulfEntry, GEO.catHaiAnch, GEO.pilotStation, GEO.lachHuyen,
      { lat: GEO.lachHuyen.lat+0.01, lng: GEO.lachHuyen.lng-0.01 },
    ], 130, vessel.speedKn, startTime, {
      navStatus: [NAV.UNDERWAY, NAV.ANCHOR, NAV.RESTRICTED, NAV.MOORED, NAV.MOORED],
    });
  } else if (scenario === 'outbound') {
    return interpolateRoute([
      { lat: GEO.lachHuyen.lat+0.01, lng: GEO.lachHuyen.lng-0.01 },
      GEO.lachHuyen, GEO.pilotStation, GEO.catHaiAnch, GEO.gulfEntry, GEO.gulfDeep,
    ], 130, vessel.speedKn, startTime, {
      navStatus: [NAV.MOORED, NAV.RESTRICTED, NAV.UNDERWAY, NAV.UNDERWAY, NAV.UNDERWAY, NAV.UNDERWAY],
    });
  } else {
    // at berth — stationary
    return interpolateRoute([
      GEO.lachHuyen, { lat: GEO.lachHuyen.lat+0.005, lng: GEO.lachHuyen.lng+0.005 },
    ], 120, 0, startTime, { navStatus: [NAV.MOORED, NAV.MOORED] });
  }
}

function simulateBulk(vessel, startTime) {
  // Bulk: arrive Gulf → anchor wait → inbound → berth
  const weatherSlow = Math.random() < 0.3; // 30% chance of weather slowdown
  const speed = weatherSlow ? vessel.speedKn * 0.55 : vessel.speedKn;
  return interpolateRoute([
    GEO.gulfDeep, GEO.gulfEntry,
    GEO.catHaiAnch,   // anchor wait
    GEO.catHaiAnch,   // still anchoring
    GEO.pilotStation, GEO.lachHuyen,
    { lat: GEO.lachHuyen.lat-0.02, lng: GEO.lachHuyen.lng+0.01 }, // berth
  ], 140, speed, startTime, {
    navStatus: [NAV.UNDERWAY, NAV.UNDERWAY, NAV.ANCHOR, NAV.ANCHOR,
                NAV.RESTRICTED, NAV.RESTRICTED, NAV.MOORED],
    speedOverride: [speed, speed, 0.3, 0.2, speed*0.3, speed*0.2, 0],
  });
}

function simulateTanker(vessel, startTime) {
  const loaded = Math.random() < 0.5;
  const draft = loaded ? vessel.maxDraft : vessel.maxDraft * 0.55;
  return interpolateRoute([
    GEO.gulfDeep, GEO.gulfEntry, GEO.catHaiAnch, GEO.catHaiAnch,
    GEO.pilotStation, GEO.haiPhongPort,
  ], 120, vessel.speedKn, startTime, {
    navStatus: [NAV.UNDERWAY, NAV.UNDERWAY, NAV.ANCHOR, NAV.ANCHOR,
                NAV.RESTRICTED, NAV.MOORED],
  });
}

function simulateCoastal(vessel, startTime) {
  // General cargo: short coastal hops
  const ports = [GEO.haiPhongPort, GEO.lachHuyen,
                 { lat: 20.95, lng: 106.55 }, { lat: 21.05, lng: 106.45 }];
  const from = rndChoice(ports);
  const to   = rndChoice(ports.filter(p => p !== from));
  return interpolateRoute([from, GEO.pilotStation, to], 110, vessel.speedKn, startTime, {
    navStatus: [NAV.UNDERWAY, NAV.UNDERWAY, NAV.MOORED],
  });
}

function simulateTug(vessel, startTime) {
  // Short patrol loops around port
  const base = GEO.lachHuyen;
  return interpolateRoute([
    base,
    { lat: base.lat+0.05, lng: base.lng+0.02 },
    { lat: base.lat+0.03, lng: base.lng-0.03 },
    { lat: base.lat-0.02, lng: base.lng+0.04 },
    base,
  ], 100, vessel.speedKn, startTime, { navStatus: [0,0,0,0,5] });
}

function simulateFishing(vessel, startTime) {
  // Erratic fishing movement in Gulf
  const base = GEO.fishingGround;
  const waypoints = [base];
  for (let i = 0; i < 8; i++) {
    waypoints.push({
      lat: base.lat + rnd(-0.5, 0.5),
      lng: base.lng + rnd(-0.5, 0.5),
    });
  }
  waypoints.push(base);
  return interpolateRoute(waypoints, 120, vessel.speedKn, startTime,
    { navStatus: waypoints.map(() => NAV.FISHING) });
}

function simulateFerry(vessel, startTime) {
  // Cat Hai ferry: back and forth
  const catBi = { lat: 20.82, lng: 106.72 };
  const catHai = { lat: 20.78, lng: 106.95 };
  const loops = [catBi, catHai, catBi, catHai, catBi];
  return interpolateRoute(loops, 110, vessel.speedKn, startTime,
    { navStatus: [0, 5, 0, 5, 5] });
}

function simulateOffshore(vessel, startTime) {
  return interpolateRoute([
    GEO.haiPhongPort, GEO.gulfEntry, GEO.offshore1,
    { lat: GEO.offshore1.lat+0.2, lng: GEO.offshore1.lng+0.1 },
    GEO.offshore1, GEO.gulfEntry, GEO.haiPhongPort,
  ], 120, vessel.speedKn, startTime,
    { navStatus: [0,0,0,5,0,0,5] });
}

const BEHAVIOR_MAP = {
  liner:   simulateLiner,
  bulk:    simulateBulk,
  tanker:  simulateTanker,
  coastal: simulateCoastal,
  tug:     simulateTug,
  fishing: simulateFishing,
  ferry:   simulateFerry,
  offshore: simulateOffshore,
};

// ─── Vessel name generators ───────────────────────────────────────────────────
const PREFIXES = {
  container: ['Hải Phòng', 'Lạch Huyện', 'Pacific', 'Vietnam Star', 'Đại Dương', 'MSC'],
  bulk_carrier: ['Hùng Vương', 'Vạn Tường', 'Hoàng Sa', 'Trường Sa', 'Đại Việt', 'Phú Quý'],
  tanker: ['PetroVN', 'BSR', 'Đình Vũ', 'Nam Định', 'Thanh Hóa', 'Nghi Sơn'],
  general_cargo: ['Sao Biển', 'Viễn Đông', 'Đông Bắc', 'Tây Bắc', 'Bình Minh', 'Hưng Phú'],
  tugboat: ['TS', 'HP-TK', 'LH-TG', 'VITOSG', 'Cường Thịnh', 'Hải Âu'],
  fishing: ['QB-', 'HP-', 'TH-', 'NA-', 'HT-', 'BĐ-'],
  passenger: ['Cat Hai', 'Đồ Sơn', 'Cát Bà', 'Vịnh Bắc Bộ', 'Hoa Sen'],
  offshore_support: ['Vietsovpetro', 'PTSC', 'Cửu Long', 'Rồng Đôi', 'Nam Côn Sơn'],
};

function vesselName(cls, idx) {
  const pfx = rndChoice(PREFIXES[cls] || ['VMS']);
  const num = rndInt(1, 99).toString().padStart(2,'0');
  if (cls === 'fishing') return `${pfx}${rndInt(1000,9999)}-${idx}`;
  if (cls === 'tugboat') return `${pfx}-${num}-${idx}`;
  return `${pfx} ${num}-${idx}`;
}

// ─── Main seed function ───────────────────────────────────────────────────────
async function main() {
  console.log('🚢 AI Maritime Intelligence — AIS Simulation Seed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const allVessels = [];
  let vesselIndex = 1;

  for (const cls of VESSEL_CLASSES) {
    for (let i = 0; i < cls.count; i++) {
      const dwt     = Math.round(rnd(...cls.dwt));
      const loa     = Math.round(rnd(...cls.loa));
      const maxDraft = +rnd(...cls.draft).toFixed(1);
      const mmsi    = `574${rndInt(100000, 999999)}`;
      const imo     = `IMO${rndInt(1000000, 9999999)}`;
      const id      = `DEMO-${cls.class_code.toUpperCase().slice(0,3)}-${String(vesselIndex).padStart(3,'0')}`;
      vesselIndex++;

      allVessels.push({
        Vessel_id:   id,
        Vessel_name: vesselName(cls.class_code, i),
        vessel_type: cls.vessel_type,
        class_code:  cls.class_code,
        flag:        cls.flag,
        MMSI:        mmsi,
        IMO:         imo,
        dwt,
        loa_m:       loa,
        beam_m:      Math.round(loa * rnd(0.12, 0.16)),
        max_draft_m: maxDraft,
        gross_tonnage: Math.round(dwt * rnd(0.55, 0.75)),
        year_built:  rndInt(1998, 2024),
        owner:       `Công ty TNHH Vận tải Biển ${rndInt(1,50)}`,
        call_sign:   `XV${rndInt(1000,9999)}`,
        speedKn:     rnd(...cls.speed),   // working field, not in DB
        maxDraft,                          // working field
        behavior:    cls.behavior,
      });
    }
  }

  // ── Upsert vessels (only columns that exist in current schema) ──
  console.log(`\n📋 Upserting ${allVessels.length} vessels...`);
  const dbVessels = allVessels.map(v => ({
    Vessel_id:     v.Vessel_id,
    Vessel_name:   v.Vessel_name,
    vessel_type:   v.vessel_type,
    flag:          v.flag,
    MMSI:          v.MMSI,
    IMO:           v.IMO,
    gross_tonnage: v.gross_tonnage,
    year_built:    v.year_built,
    owner:         v.owner,
    // Store extra maritime fields in description until schema migration is run
    description:   JSON.stringify({ class_code: v.class_code, dwt: v.dwt, loa_m: v.loa_m, max_draft_m: v.max_draft_m }),
  }));
  const { error: vErr } = await supabase.from('vessels').upsert(dbVessels, { onConflict: 'Vessel_id' });
  if (vErr) { console.error('Vessel upsert error:', vErr.message); process.exit(1); }
  console.log(`   ✅ ${allVessels.length} vessels seeded`);

  // ── Generate AIS records ──
  console.log('\n📡 Generating AIS position records...');
  let totalAis = 0;
  const now = new Date();
  const CHUNK = 500;
  let chunkBuf = [];

  for (let vi = 0; vi < allVessels.length; vi++) {
    const v = allVessels[vi];
    const simulator = BEHAVIOR_MAP[v.behavior] || simulateCoastal;

    // Stagger start times: vessels started between 7 days ago and now
    const startOffset = rnd(0, 7 * 24 * 60 * 60 * 1000);
    const startTime   = new Date(now.getTime() - startOffset);

    const aisRecs = simulator(v, startTime.toISOString());

    // Determine draft per record (simple: inbound = near max, outbound = half)
    const baseDraft = v.maxDraft * rnd(0.6, 1.0);
    const destinations = ['Hai Phong', 'Lach Huyen', 'CNSG', 'HAIPHONG', 'HP PORT', 'Gulf of Tonkin'];
    const eta = new Date(startTime.getTime() + rnd(2,24) * 3600000).toISOString();

    for (const rec of aisRecs) {
      chunkBuf.push({
        vessel_id:       v.Vessel_id,
        mmsi:            v.MMSI,
        imo:             v.IMO,
        timestamp:       rec.timestamp,
        lat:             rec.lat,
        lng:             rec.lng,
        speed:           rec.speed,
        heading:         rec.heading,
        cog:             rec.cog,
        nav_status:      rec.nav_status,
        nav_status_text: rec.nav_status_text,
        draft:           +(baseDraft * (rec.nav_status === NAV.ANCHOR ? 1.0 : rnd(0.8,1.0))).toFixed(1),
        destination:     rndChoice(destinations),
        eta,
        source:          'simulation',
      });

      if (chunkBuf.length >= CHUNK) {
        const { error } = await supabase.from('ais_messages').insert(chunkBuf);
        if (error) console.warn(`  ⚠ chunk insert warn: ${error.message}`);
        totalAis += chunkBuf.length;
        process.stdout.write(`\r   📍 ${totalAis} records inserted...`);
        chunkBuf = [];
      }
    }

    console.log(`\n   [${vi+1}/${allVessels.length}] ${v.Vessel_name} (${v.class_code}) — ${aisRecs.length} records`);
  }

  // Flush remaining
  if (chunkBuf.length > 0) {
    await supabase.from('ais_messages').insert(chunkBuf);
    totalAis += chunkBuf.length;
  }

  console.log(`\n✅ Total AIS records: ${totalAis}`);

  // ── Generate Port KPIs (90 days history) ──
  console.log('\n📊 Generating Port KPI history (90 days)...');
  const kpis = [];
  for (let d = 89; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const seasonFactor = 1 + 0.2 * Math.sin((date.getMonth() / 12) * 2 * Math.PI);
    const weatherFactor = Math.random() < 0.1 ? rnd(0.5, 0.75) : rnd(0.9, 1.0);
    const arrivals = Math.round((isWeekend ? 8 : 15) * seasonFactor * weatherFactor * rnd(0.8, 1.2));
    const congestion = Math.min(0.95, rnd(0.2, 0.6) * (1 / weatherFactor));

    kpis.push({
      kpi_date:             date.toISOString().slice(0,10),
      vessel_arrivals:      arrivals,
      vessel_departures:    Math.max(0, arrivals + rndInt(-3,3)),
      vessel_count_peak:    arrivals + rndInt(5,15),
      throughput_tons:      Math.round(arrivals * rnd(3000,8000) * weatherFactor),
      container_teu:        Math.round(arrivals * rnd(200,600)),
      avg_wait_hours:       +(rnd(4, 24) * (1 + congestion)).toFixed(1),
      avg_turnaround_hours: +(rnd(12, 48)).toFixed(1),
      congestion_index:     +congestion.toFixed(3),
      berth_occupancy_pct:  +(Math.min(98, congestion * 130)).toFixed(1),
      anchorage_count_peak: rndInt(5, 25),
      weather_factor:       +weatherFactor.toFixed(3),
    });
  }
  const { error: kpiErr } = await supabase.from('port_kpis').upsert(kpis, { onConflict: 'kpi_date' });
  if (kpiErr) console.warn('KPI upsert warn:', kpiErr.message);
  else console.log(`   ✅ ${kpis.length} daily KPI records seeded`);

  // ── Generate anomaly samples ──
  console.log('\n🚨 Seeding anomaly samples...');
  const anomalySamples = [
    { anomaly_type:'congestion', severity:'critical', title:'Tắc nghẽn luồng Lạch Huyện',
      description:'Mật độ tàu vượt ngưỡng 150% tại luồng Lạch Huyện — 23 tàu chờ neo.',
      lat:20.73, lng:106.83, status:'open',
      metadata:{ vessel_count:23, threshold:15, zone:'Lạch Huyện Fairway' } },
    { anomaly_type:'eta_deviation', severity:'warning', title:'Lệch ETA > 6 giờ',
      description:'Tàu chở container tới muộn hơn ETA 8 giờ do thời tiết xấu.',
      lat:20.50, lng:107.10, status:'open',
      metadata:{ original_eta:'2026-05-11T08:00:00Z', current_est:'2026-05-11T16:00:00Z' } },
    { anomaly_type:'abnormal_anchorage', severity:'warning', title:'Neo quá thời gian cho phép',
      description:'Tàu hàng khô neo tại vùng Cát Hải quá 48 giờ — cần kiểm tra.',
      lat:20.79, lng:106.92, status:'acknowledged',
      metadata:{ anchor_hours:51, max_allowed:48 } },
    { anomaly_type:'suspicious_movement', severity:'info', title:'Hành trình bất thường',
      description:'Tàu cá thay đổi hành trình đột ngột tại khu vực hạn chế.',
      lat:20.60, lng:107.20, status:'open',
      metadata:{ speed_change:8.5, heading_change:145 } },
    { anomaly_type:'traffic_surge', severity:'warning', title:'Gia tăng lưu lượng bất thường',
      description:'Số tàu vào cảng tăng 80% so với trung bình — nguy cơ tắc nghẽn bến.',
      lat:20.75, lng:106.82, status:'open',
      metadata:{ current_count:28, average_count:15, surge_pct:87 } },
  ];
  const { error: anErr } = await supabase.from('anomalies').insert(anomalySamples);
  if (anErr) console.warn('Anomaly insert warn:', anErr.message);
  else console.log(`   ✅ ${anomalySamples.length} anomaly samples seeded`);

  console.log('\n🎉 Maritime intelligence demo data seeded successfully!');
  console.log(`   • Vessels: ${allVessels.length}`);
  console.log(`   • AIS records: ~${totalAis}`);
  console.log(`   • KPI history: 90 days`);
  console.log(`   • Anomaly samples: ${anomalySamples.length}`);
}

main().catch(console.error);
