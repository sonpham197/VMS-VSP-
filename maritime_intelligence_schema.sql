-- ================================================================
-- AI Maritime Intelligence Module — Database Schema
-- VMS Marine · Supabase PostgreSQL
-- Run in Supabase SQL Editor
-- ================================================================

-- ─────────────────────────────────────────────────────────────────
-- TABLE 1: ais_messages — Raw AIS position records
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ais_messages (
  id              BIGSERIAL PRIMARY KEY,
  vessel_id       TEXT NOT NULL REFERENCES vessels("Vessel_id") ON DELETE CASCADE,
  mmsi            TEXT,
  imo             TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat             NUMERIC(10,6) NOT NULL,
  lng             NUMERIC(10,6) NOT NULL,
  speed           NUMERIC(6,2),          -- knots
  heading         NUMERIC(6,2),          -- degrees 0-359
  cog             NUMERIC(6,2),          -- course over ground
  nav_status      INTEGER DEFAULT 0,     -- AIS navigational status code (0=underway, 1=anchor, 5=moored...)
  nav_status_text TEXT,                  -- human label
  draft           NUMERIC(5,2),          -- metres
  destination     TEXT,
  eta             TIMESTAMPTZ,
  voyage_id       BIGINT,                -- FK to voyages (set after voyage detection)
  source          TEXT DEFAULT 'simulation'
);

CREATE INDEX IF NOT EXISTS idx_ais_vessel_time  ON ais_messages (vessel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ais_time         ON ais_messages (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ais_nav_status   ON ais_messages (nav_status);
CREATE INDEX IF NOT EXISTS idx_ais_mmsi         ON ais_messages (mmsi);

-- ─────────────────────────────────────────────────────────────────
-- TABLE 2: port_zones — Named geographic zones
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS port_zones (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  zone_type   TEXT NOT NULL,   -- anchorage | berth | fairway | pilot_station | port_limit | restricted
  port        TEXT DEFAULT 'Hai Phong',
  geom_wkt    TEXT NOT NULL,   -- WKT POLYGON
  max_vessels INTEGER DEFAULT 20,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_port_zones_type ON port_zones (zone_type);

-- ─────────────────────────────────────────────────────────────────
-- TABLE 3: voyages — Detected voyage segments
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voyages (
  id                BIGSERIAL PRIMARY KEY,
  vessel_id         TEXT NOT NULL REFERENCES vessels("Vessel_id") ON DELETE CASCADE,
  departure_port    TEXT,
  arrival_port      TEXT,
  departure_time    TIMESTAMPTZ,
  arrival_time      TIMESTAMPTZ,
  berth_start       TIMESTAMPTZ,
  berth_end         TIMESTAMPTZ,
  anchor_start      TIMESTAMPTZ,
  anchor_end        TIMESTAMPTZ,
  wait_hours        NUMERIC(8,2),    -- calculated: berth_start - anchor_end in hours
  turnaround_hours  NUMERIC(8,2),    -- berth_end - berth_start in hours
  cargo_est_tons    NUMERIC(12,2),   -- estimated cargo loaded/discharged
  cargo_direction   TEXT,            -- import | export
  status            TEXT DEFAULT 'active', -- active | completed | cancelled
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voyages_vessel     ON voyages (vessel_id);
CREATE INDEX IF NOT EXISTS idx_voyages_departure  ON voyages (departure_time DESC);
CREATE INDEX IF NOT EXISTS idx_voyages_status     ON voyages (status);

-- ─────────────────────────────────────────────────────────────────
-- TABLE 4: vessel_events — Discrete operational events
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vessel_events (
  id          BIGSERIAL PRIMARY KEY,
  vessel_id   TEXT NOT NULL REFERENCES vessels("Vessel_id") ON DELETE CASCADE,
  voyage_id   BIGINT REFERENCES voyages(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,  -- arrived_port_limit | anchored | pilot_boarded | berthed | departed_berth | departed_port
  event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat         NUMERIC(10,6),
  lng         NUMERIC(10,6),
  zone_id     INTEGER REFERENCES port_zones(id),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_vessel ON vessel_events (vessel_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_type   ON vessel_events (event_type, event_time DESC);

-- ─────────────────────────────────────────────────────────────────
-- TABLE 5: port_kpis — Daily aggregated KPIs
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS port_kpis (
  id                   SERIAL PRIMARY KEY,
  kpi_date             DATE NOT NULL UNIQUE,
  vessel_arrivals      INTEGER DEFAULT 0,
  vessel_departures    INTEGER DEFAULT 0,
  vessel_count_peak    INTEGER DEFAULT 0,
  throughput_tons      NUMERIC(15,2) DEFAULT 0,
  container_teu        INTEGER DEFAULT 0,
  avg_wait_hours       NUMERIC(8,2) DEFAULT 0,
  avg_turnaround_hours NUMERIC(8,2) DEFAULT 0,
  congestion_index     NUMERIC(5,3) DEFAULT 0,  -- 0.0 to 1.0
  berth_occupancy_pct  NUMERIC(5,2) DEFAULT 0,  -- 0 to 100
  anchorage_count_peak INTEGER DEFAULT 0,
  weather_factor       NUMERIC(4,3) DEFAULT 1.0, -- 1.0 = normal, 0.5 = storm
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpis_date ON port_kpis (kpi_date DESC);

-- ─────────────────────────────────────────────────────────────────
-- TABLE 6: ai_forecasts — AI forecast outputs
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_forecasts (
  id                    SERIAL PRIMARY KEY,
  generated_at          TIMESTAMPTZ DEFAULT NOW(),
  model_version         TEXT DEFAULT 'v1.0',
  forecast_for_date     DATE NOT NULL,
  horizon_days          INTEGER NOT NULL,   -- 7 or 30
  throughput_tons       NUMERIC(15,2),
  container_teu         INTEGER,
  vessel_arrivals_pred  INTEGER,
  congestion_index      NUMERIC(5,3),
  berth_occupancy_pct   NUMERIC(5,2),
  wait_hours_pred       NUMERIC(8,2),
  confidence_low        NUMERIC(15,2),
  confidence_high       NUMERIC(15,2),
  features_used         JSONB,             -- feature snapshot used for this forecast
  UNIQUE (forecast_for_date, horizon_days, model_version)
);

CREATE INDEX IF NOT EXISTS idx_forecasts_date    ON ai_forecasts (forecast_for_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_horizon ON ai_forecasts (horizon_days);

-- ─────────────────────────────────────────────────────────────────
-- TABLE 7: anomalies — Detected anomalies + anomaly history
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomalies (
  id              BIGSERIAL PRIMARY KEY,
  vessel_id       TEXT REFERENCES vessels("Vessel_id") ON DELETE SET NULL,
  anomaly_type    TEXT NOT NULL,
  -- Types: congestion | eta_deviation | abnormal_anchorage | suspicious_movement
  --        speed_anomaly | traffic_surge | dark_vessel | zone_intrusion
  severity        TEXT DEFAULT 'warning',   -- info | warning | critical
  title           TEXT NOT NULL,
  description     TEXT,
  lat             NUMERIC(10,6),
  lng             NUMERIC(10,6),
  zone_id         INTEGER REFERENCES port_zones(id),
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  status          TEXT DEFAULT 'open',      -- open | acknowledged | resolved
  metadata        JSONB
);

CREATE INDEX IF NOT EXISTS idx_anomalies_status   ON anomalies (status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_vessel   ON anomalies (vessel_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_type     ON anomalies (anomaly_type, detected_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- EXTEND vessels table with maritime intelligence fields
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS dwt          NUMERIC(12,2);  -- Deadweight tonnage
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS loa_m        NUMERIC(8,2);   -- Length overall (metres)
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS beam_m       NUMERIC(8,2);   -- Beam (metres)
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS max_draft_m  NUMERIC(5,2);   -- Maximum draft
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS call_sign    TEXT;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS class_code   TEXT;
-- class_code: container | bulk_carrier | tanker | general_cargo | tugboat
--             fishing | passenger | offshore_support

-- ─────────────────────────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────────────────────────

-- Current anchorage occupancy
CREATE OR REPLACE VIEW anchorage_occupancy AS
SELECT
  pz.id   AS zone_id,
  pz.name AS zone_name,
  pz.max_vessels,
  COUNT(DISTINCT a.vessel_id) AS current_vessels,
  ROUND(COUNT(DISTINCT a.vessel_id)::NUMERIC / NULLIF(pz.max_vessels,0) * 100, 1) AS occupancy_pct,
  AVG(EXTRACT(EPOCH FROM (NOW() - a.timestamp)) / 3600.0) AS avg_wait_hours
FROM port_zones pz
LEFT JOIN ais_messages a ON
  a.nav_status IN (1, 3, 5)  -- at anchor / moored
  AND a.timestamp >= NOW() - INTERVAL '1 hour'
WHERE pz.zone_type = 'anchorage'
GROUP BY pz.id, pz.name, pz.max_vessels;

-- Voyage stats summary (last 30 days)
CREATE OR REPLACE VIEW voyage_stats_30d AS
SELECT
  v.vessel_id,
  vs.vessel_type,
  vs.class_code,
  COUNT(*) AS voyage_count,
  SUM(v.cargo_est_tons) AS total_cargo_tons,
  AVG(v.wait_hours) AS avg_wait_hours,
  AVG(v.turnaround_hours) AS avg_turnaround_hours
FROM voyages v
JOIN vessels vs ON vs."Vessel_id" = v.vessel_id
WHERE v.departure_time >= NOW() - INTERVAL '30 days'
GROUP BY v.vessel_id, vs.vessel_type, vs.class_code;

-- Hourly vessel density (last 24h)
CREATE OR REPLACE VIEW vessel_density_hourly AS
SELECT
  date_trunc('hour', timestamp) AS hour_bucket,
  COUNT(DISTINCT vessel_id) AS vessel_count,
  AVG(speed) AS avg_speed,
  COUNT(CASE WHEN nav_status IN (1,3) THEN 1 END) AS anchored_count,
  COUNT(CASE WHEN nav_status = 0 THEN 1 END) AS underway_count
FROM ais_messages
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour_bucket
ORDER BY hour_bucket DESC;

-- ─────────────────────────────────────────────────────────────────
-- SEED: Hai Phong Port Zones
-- ─────────────────────────────────────────────────────────────────
INSERT INTO port_zones (name, zone_type, port, geom_wkt, max_vessels, description) VALUES
('Vùng neo chờ Cát Hải',     'anchorage',     'Hai Phong',
 'POLYGON((106.88 20.76, 106.95 20.76, 106.95 20.82, 106.88 20.82, 106.88 20.76))',
 30, 'Khu vực neo chờ chính ngoài cảng Cát Hải'),
('Vùng neo chờ Lạch Huyện',  'anchorage',     'Hai Phong',
 'POLYGON((106.79 20.73, 106.87 20.73, 106.87 20.78, 106.79 20.78, 106.79 20.73))',
 20, 'Neo chờ trước cảng Lạch Huyện'),
('Cảng Lạch Huyện',          'berth',         'Hai Phong',
 'POLYGON((106.80 20.74, 106.85 20.74, 106.85 20.77, 106.80 20.77, 106.80 20.74))',
 10, 'Khu bến Cảng Lạch Huyện — container quốc tế'),
('Cảng Hải Phòng Nội Địa',   'berth',         'Hai Phong',
 'POLYGON((106.63 20.85, 106.72 20.85, 106.72 20.90, 106.63 20.90, 106.63 20.85))',
 15, 'Khu bến nội địa sông Cấm'),
('Luồng Lạch Huyện',         'fairway',       'Hai Phong',
 'POLYGON((106.76 20.70, 106.90 20.70, 106.90 20.74, 106.76 20.74, 106.76 20.70))',
 5,  'Luồng hàng hải vào cảng Lạch Huyện'),
('Trạm hoa tiêu Lạch Huyện', 'pilot_station', 'Hai Phong',
 'POLYGON((106.87 20.71, 106.90 20.71, 106.90 20.74, 106.87 20.74, 106.87 20.71))',
 3,  'Điểm đón hoa tiêu')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE ais_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_zones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_kpis     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_forecasts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies     ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY không hỗ trợ IF NOT EXISTS → dùng DO block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ais_all' AND tablename = 'ais_messages') THEN
    CREATE POLICY "ais_all" ON ais_messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'zones_all' AND tablename = 'port_zones') THEN
    CREATE POLICY "zones_all" ON port_zones FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'voyages_all' AND tablename = 'voyages') THEN
    CREATE POLICY "voyages_all" ON voyages FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'events_all' AND tablename = 'vessel_events') THEN
    CREATE POLICY "events_all" ON vessel_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'kpis_all' AND tablename = 'port_kpis') THEN
    CREATE POLICY "kpis_all" ON port_kpis FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'forecasts_all' AND tablename = 'ai_forecasts') THEN
    CREATE POLICY "forecasts_all" ON ai_forecasts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anomalies_all' AND tablename = 'anomalies') THEN
    CREATE POLICY "anomalies_all" ON anomalies FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

