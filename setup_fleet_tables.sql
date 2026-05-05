-- Bảng Quản lý Đội tàu (Fleets)
CREATE TABLE IF NOT EXISTS customer_fleets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id bigint REFERENCES "Customer"(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text DEFAULT '#38bdf8',
    created_at timestamptz DEFAULT now()
);

-- Bảng trung gian liên kết Hạm đội và Tàu
CREATE TABLE IF NOT EXISTS fleet_vessels (
    fleet_id uuid REFERENCES customer_fleets(id) ON DELETE CASCADE,
    vessel_id text REFERENCES vessels("Vessel_id") ON DELETE CASCADE,
    added_at timestamptz DEFAULT now(),
    PRIMARY KEY (fleet_id, vessel_id)
);

-- Bật RLS
ALTER TABLE customer_fleets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_fleets_all" ON customer_fleets FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE fleet_vessels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_vessels_all" ON fleet_vessels FOR ALL USING (true) WITH CHECK (true);
