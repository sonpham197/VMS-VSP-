/**
 * pages/api/maritime/anomalies.js
 * Real-time anomaly detection + anomaly history
 * GET /api/maritime/anomalies
 * POST /api/maritime/anomalies  { action:'acknowledge'|'resolve', id }
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── Anomaly detection rules (run against AIS data) ──────────────────────────
async function detectLiveAnomalies() {
  const detected = [];
  
  // Get the latest timestamp in ais_messages to determine the relative "now" for simulated data
  let baseTime = Date.now();
  const { data: maxTimeData, error: maxTimeErr } = await supabase
    .from('ais_messages')
    .select('timestamp')
    .order('timestamp', { ascending: false })
    .limit(1);
  
  if (!maxTimeErr && maxTimeData?.[0]?.timestamp) {
    const dbLatest = new Date(maxTimeData[0].timestamp).getTime();
    if (dbLatest < baseTime) {
      baseTime = dbLatest;
    }
  }

  const since7d = new Date(baseTime - 7 * 86400000).toISOString();

  // Rule 1: Congestion — count unique anchored vessels in last 7 days
  const { data: anchoraged } = await supabase
    .from('ais_messages')
    .select('vessel_id')
    .in('nav_status', [1, 3])
    .gte('timestamp', since7d)
    .lte('timestamp', new Date(baseTime).toISOString())
    .limit(1000);
  const uniqueAnchored = new Set((anchoraged || []).map(r => r.vessel_id)).size;
  if (uniqueAnchored > 10) {
    detected.push({
      anomaly_type: 'congestion',
      severity: uniqueAnchored > 20 ? 'critical' : 'warning',
      title: `Tắc nghẽn vùng neo: ${uniqueAnchored} tàu`,
      description: `${uniqueAnchored} tàu đã neo chờ trong 7 ngày qua — vượt ngưỡng (10 tàu).`,
      lat: 20.79, lng: 106.92,
      status: 'open',
      metadata: { vessel_count: uniqueAnchored, threshold: 10 },
    });
  }

  // Rule 2: Traffic surge — unique vessels under way
  const { data: underway } = await supabase
    .from('ais_messages')
    .select('vessel_id')
    .eq('nav_status', 0)
    .gte('timestamp', since7d)
    .lte('timestamp', new Date(baseTime).toISOString())
    .limit(2000);
  const uniqueActive = new Set((underway || []).map(r => r.vessel_id)).size;
  if (uniqueActive > 20) {
    detected.push({
      anomaly_type: 'traffic_surge',
      severity: 'warning',
      title: `Lưu lượng cao: ${uniqueActive} tàu hành trình`,
      description: `${uniqueActive} tàu đang hành trình trong 7 ngày qua — mức cao.`,
      lat: 20.75, lng: 106.82,
      status: 'open',
      metadata: { active_vessels: uniqueActive, threshold: 20 },
    });
  }

  return detected;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const newStatus = action === 'resolve' ? 'resolved' : 'acknowledged';
    const updateData = { status: newStatus };
    if (action === 'resolve') updateData.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('anomalies').update(updateData).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'GET') return res.status(405).end();

  try {
    // Run live detection — only insert if no open anomaly of same type exists
    const liveAnomalies = await detectLiveAnomalies();
    if (liveAnomalies.length > 0) {
      const { data: existing } = await supabase
        .from('anomalies').select('anomaly_type').eq('status', 'open');
      const existingTypes = new Set((existing || []).map(a => a.anomaly_type));
      const toInsert = liveAnomalies.filter(a => !existingTypes.has(a.anomaly_type));
      if (toInsert.length > 0) await supabase.from('anomalies').insert(toInsert);
    }

    // Fetch all open anomalies
    const { data: open, error: e1 } = await supabase
      .from('anomalies')
      .select('*')
      .eq('status', 'open')
      .order('detected_at', { ascending: false });

    // Fetch recent history (last 7 days relative to the latest anomaly in DB)
    let historyBaseTime = Date.now();
    const { data: maxAnomData, error: maxAnomErr } = await supabase
      .from('anomalies')
      .select('detected_at')
      .order('detected_at', { ascending: false })
      .limit(1);
    
    if (!maxAnomErr && maxAnomData?.[0]?.detected_at) {
      const dbLatest = new Date(maxAnomData[0].detected_at).getTime();
      if (dbLatest < historyBaseTime) {
        historyBaseTime = dbLatest;
      }
    }
    const since7d = new Date(historyBaseTime - 7 * 86400000).toISOString();
    const { data: history, error: e2 } = await supabase
      .from('anomalies')
      .select('*')
      .gte('detected_at', since7d)
      .lte('detected_at', new Date(historyBaseTime).toISOString())
      .order('detected_at', { ascending: false })
      .limit(50);

    if (e1 || e2) {
      // Tables don't exist yet — return demo anomalies
      const demoAnomalies = [
        { id:1, anomaly_type:'congestion', severity:'critical', title:'Tắc nghẽn luồng Lạch Huyện',
          description:'Mật độ tàu vượt ngưỡng 150% — 23 tàu chờ neo.', lat:20.73, lng:106.83,
          status:'open', detected_at:new Date().toISOString(), metadata:{vessel_count:23,threshold:15} },
        { id:2, anomaly_type:'eta_deviation', severity:'warning', title:'Lệch ETA > 6 giờ',
          description:'Tàu container tới muộn 8 giờ do thời tiết xấu.', lat:20.50, lng:107.10,
          status:'open', detected_at:new Date(Date.now()-3600000).toISOString(), metadata:{delay_hours:8} },
        { id:3, anomaly_type:'abnormal_anchorage', severity:'warning', title:'Neo quá thời gian cho phép',
          description:'Tàu hàng khô neo Cát Hải quá 48 giờ.', lat:20.79, lng:106.92,
          status:'acknowledged', detected_at:new Date(Date.now()-86400000).toISOString(), metadata:{anchor_hours:51} },
        { id:4, anomaly_type:'suspicious_movement', severity:'info', title:'Hành trình bất thường',
          description:'Tàu cá thay đổi hướng đột ngột tại vùng hạn chế.', lat:20.60, lng:107.20,
          status:'open', detected_at:new Date(Date.now()-7200000).toISOString(), metadata:{heading_change:145} },
        { id:5, anomaly_type:'traffic_surge', severity:'warning', title:'Gia tăng lưu lượng',
          description:'Tàu vào cảng tăng 80% so với trung bình.', lat:20.75, lng:106.82,
          status:'open', detected_at:new Date(Date.now()-1800000).toISOString(), metadata:{surge_pct:80} },
      ];
      return res.status(200).json({
        open: demoAnomalies.filter(a=>a.status==='open'),
        history: demoAnomalies,
        summary: { total_open:4, by_type:{congestion:1,eta_deviation:1,traffic_surge:1,suspicious_movement:1}, by_severity:{critical:1,warning:3,info:1} },
      });
    }

    // Summary counts
    const countByType = {};
    const countBySeverity = { info: 0, warning: 0, critical: 0 };
    (open || []).forEach(a => {
      countByType[a.anomaly_type] = (countByType[a.anomaly_type] || 0) + 1;
      if (a.severity in countBySeverity) countBySeverity[a.severity]++;
    });

    res.status(200).json({
      open:    open || [],
      history: history || [],
      summary: { total_open: open?.length || 0, by_type: countByType, by_severity: countBySeverity },
    });
  } catch (err) {
    console.error('[maritime/anomalies]', err);
    res.status(500).json({ error: err.message });
  }
}
