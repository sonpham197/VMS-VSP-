-- ================================================================
-- VMS Marine – Alert & Geo-fencing System Setup
-- ================================================================

-- 1. Thêm extension PostGIS (nếu chưa có)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Bảng Khu vực (Zones)
CREATE TABLE IF NOT EXISTS zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL, -- 'restricted', 'warning', 'port', 'shipping_lane'
    description text,
    severity text DEFAULT 'warning', -- 'warning', 'danger'
    geom geometry(Polygon, 4326),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index không gian cho zones
CREATE INDEX IF NOT EXISTS zones_geom_idx ON zones USING GIST (geom);

-- 3. Bảng Quy tắc phát hiện (Anomaly Rules)
CREATE TABLE IF NOT EXISTS anomaly_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL, -- 'SPEED_VIOLATION', 'ZONE_ENTRY', 'DARK_VESSEL'
    name text NOT NULL,
    description text,
    severity text DEFAULT 'warning',
    thresholds jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 4. Bảng Cảnh báo (Alerts)
-- Dùng để gộp các anomaly_events thành một alert duy nhất cho một tàu
CREATE TABLE IF NOT EXISTS alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id text REFERENCES vessels("Vessel_id") ON DELETE CASCADE,
    rule_id uuid REFERENCES anomaly_rules(id) ON DELETE SET NULL,
    severity text NOT NULL, -- 'info', 'warning', 'danger'
    status text DEFAULT 'open', -- 'open', 'acknowledged', 'resolved', 'dismissed'
    description text,
    event_count int DEFAULT 1,
    last_position geometry(Point, 4326),
    metadata jsonb DEFAULT '{}', -- Lưu thông tin chi tiết (ví dụ: zone_id, speed_val)
    assigned_to uuid, -- Link to a user/operator if needed
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_vessel_id_idx ON alerts(vessel_id);
CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status);

-- 5. Bảng Cấu hình thông báo (Notification Channels)
CREATE TABLE IF NOT EXISTS notification_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid, -- Nếu có hệ thống Auth
    type text NOT NULL, -- 'email', 'telegram', 'web_push'
    config jsonb NOT NULL, -- Example: {"chat_id": "123456"}
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 6. Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 7. Seed một số quy tắc mặc định
INSERT INTO anomaly_rules (code, name, severity, thresholds) VALUES
('ZONE_VIOLATION', 'Vi phạm vùng cấm', 'danger', '{"buffer_nm": 1.0}'),
('SPEED_LIMIT', 'Quá tốc độ quy định', 'warning', '{"max_speed": 25}'),
('DARK_VESSEL', 'Mất tín hiệu AIS', 'warning', '{"timeout_mins": 30}'),
('PROXIMITY_RISK', 'Nguy cơ va chạm', 'danger', '{"min_dist_nm": 0.5}')
ON CONFLICT (code) DO NOTHING;

-- 8. RLS Policies
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones_public_read" ON zones FOR SELECT USING (true);
CREATE POLICY "zones_admin_all" ON zones FOR ALL USING (true) WITH CHECK (true); -- Đơn giản hóa cho dev

ALTER TABLE anomaly_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_public_read" ON anomaly_rules FOR SELECT USING (true);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_public_all" ON alerts FOR ALL USING (true) WITH CHECK (true);
