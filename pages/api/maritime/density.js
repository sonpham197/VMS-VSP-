/**
 * pages/api/maritime/density.js
 * Vessel density heatmap data + hourly vessel count
 * GET /api/maritime/density?hours=24
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const hours = Math.min(72, parseInt(req.query.hours) || 24);
    // Get the latest timestamp in ais_messages to determine the relative "now" for simulated data
    let baseTime = Date.now();
    const { data: maxTimeData, error: maxTimeErr } = await supabase
      .from('ais_messages')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (!maxTimeErr && maxTimeData?.[0]?.timestamp) {
      const dbLatest = new Date(maxTimeData[0].timestamp).getTime();
      // If the database latest timestamp is in the past compared to the current time window, use it as baseTime
      if (dbLatest < baseTime) {
        baseTime = dbLatest;
      }
    }

    const since = new Date(baseTime - hours * 3600000).toISOString();

    // Heatmap points: lat/lng + weight (speed-based: slower = denser cluster)
    const { data: positions, error } = await supabase
      .from('ais_messages')
      .select('lat, lng, speed, nav_status, timestamp')
      .gte('timestamp', since)
      .lte('timestamp', new Date(baseTime).toISOString())
      .limit(5000);

    if (error) throw error;

    // Format for Leaflet.heat: [lat, lng, intensity]
    const heatmapPoints = (positions || []).map(p => [
      p.lat,
      p.lng,
      // Anchored/moored vessels contribute more to congestion heatmap
      p.nav_status === 1 || p.nav_status === 5 ? 0.9 :
      p.speed < 3 ? 0.7 : 0.4,
    ]);

    // Hourly counts (last 24h binned by hour)
    const hourlyCounts = {};
    (positions || []).forEach(p => {
      const h = new Date(p.timestamp).toISOString().slice(0,13) + ':00';
      hourlyCounts[h] = (hourlyCounts[h] || 0) + 1;
    });
    const hourlyArray = Object.entries(hourlyCounts)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }));

    // Nav status breakdown
    const statusCount = { underway: 0, anchored: 0, moored: 0, fishing: 0, other: 0 };
    (positions || []).forEach(p => {
      if (p.nav_status === 0) statusCount.underway++;
      else if (p.nav_status === 1 || p.nav_status === 3) statusCount.anchored++;
      else if (p.nav_status === 5) statusCount.moored++;
      else if (p.nav_status === 7) statusCount.fishing++;
      else statusCount.other++;
    });

    res.status(200).json({
      heatmapPoints,
      hourlyArray,
      statusCount,
      totalRecords: positions?.length || 0,
    });
  } catch (err) {
    console.error('[maritime/density]', err);
    res.status(500).json({ error: err.message });
  }
}
