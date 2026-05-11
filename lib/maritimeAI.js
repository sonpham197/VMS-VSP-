/**
 * lib/maritimeAI.js — Pure-JS cargo estimation + anomaly scoring engine
 */

// ─── Cargo Estimation ─────────────────────────────────────────────────────────
const UTILIZATION = {
  container:       { loaded: 0.85, ballast: 0.35 },
  bulk_carrier:    { loaded: 0.92, ballast: 0.30 },
  tanker:          { loaded: 0.90, ballast: 0.32 },
  general_cargo:   { loaded: 0.80, ballast: 0.40 },
  tugboat:         { loaded: 0.00, ballast: 0.00 },
  fishing:         { loaded: 0.10, ballast: 0.05 },
  passenger:       { loaded: 0.00, ballast: 0.00 },
  offshore_support:{ loaded: 0.30, ballast: 0.10 },
};

export function estimateCargo({ class_code, dwt, draft, max_draft_m, turnaround_hours }) {
  if (!dwt || dwt === 0) return 0;
  const u = UTILIZATION[class_code] || { loaded: 0.5, ballast: 0.2 };
  const draftRatio = max_draft_m ? Math.min(1, (draft || max_draft_m) / max_draft_m) : 0.75;
  const isLoaded = draftRatio > 0.6;
  const utilization = isLoaded ? u.loaded : u.ballast;
  // Berth productivity factor: longer stay = more cargo (up to saturation)
  const berthFactor = turnaround_hours
    ? Math.min(1.2, 0.6 + Math.log1p(turnaround_hours) / 10)
    : 1.0;
  return Math.round(dwt * utilization * berthFactor);
}

// ─── Congestion Index ─────────────────────────────────────────────────────────
export function calcCongestionIndex({ anchoredCount, berthCount, maxBerths = 10, maxAnchorage = 30 }) {
  const berthOcc = Math.min(1, berthCount / maxBerths);
  const anchorOcc = Math.min(1, anchoredCount / maxAnchorage);
  // Weighted: berth saturation matters 60%, anchorage 40%
  return +(berthOcc * 0.6 + anchorOcc * 0.4).toFixed(3);
}

// ─── XGBoost-style JS forecast (gradient boosting approximation) ──────────────
export function xgboostForecast(history, horizon) {
  if (!history || history.length < 7) return [];
  const vals = history.map(d => d.throughput_tons);
  const n = vals.length;

  // Feature extraction
  const trend = (() => {
    const xm = (n-1)/2, ym = vals.reduce((s,v)=>s+v,0)/n;
    let num=0, den=0;
    vals.forEach((v,i) => { num+=(i-xm)*(v-ym); den+=(i-xm)**2; });
    return den ? num/den : 0;
  })();

  const last7avg = vals.slice(-7).reduce((s,v)=>s+v,0)/7;
  const last30avg = vals.slice(-30).reduce((s,v)=>s+v,0)/Math.min(30,n);
  const avgCong = history.slice(-7).reduce((s,d)=>s+d.congestion_index,0)/7;

  return Array.from({ length: horizon }, (_, d) => {
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + d + 1);
    const dow = forecastDate.getDay();
    // DOW seasonality: weekends lower by ~20%
    const dowFactor = (dow === 0 || dow === 6) ? 0.80 : 1.05;
    // Tree node decisions (simplified boosting):
    const base = last7avg * 0.5 + last30avg * 0.3 + trend * (d+1) * 0.2;
    const predicted = Math.max(0, base * dowFactor * (1 - avgCong * 0.1));
    const ci = predicted * 0.12;
    return {
      day: d+1,
      date: forecastDate.toISOString().slice(0,10),
      throughput_tons: Math.round(predicted),
      congestion_index: Math.min(0.95, avgCong + d * 0.008),
      confidence_low:  Math.round(predicted - ci),
      confidence_high: Math.round(predicted + ci),
    };
  });
}

// ─── Vessel class icon map ────────────────────────────────────────────────────
export const CLASS_ICONS = {
  container:       '🚢', bulk_carrier: '⚓', tanker:   '🛢',
  general_cargo:   '📦', tugboat:     '🔧', fishing:  '🎣',
  passenger:       '🛳', offshore_support: '🏗',
};

export const CLASS_COLORS = {
  container:    '#3b82f6', bulk_carrier: '#f59e0b', tanker:  '#ef4444',
  general_cargo:'#10b981', tugboat:     '#8b5cf6', fishing: '#06b6d4',
  passenger:    '#f97316', offshore_support: '#64748b',
};
