-- ============================================================
-- collision_warning_setup.sql
-- Migration bổ sung bảng alerts để hỗ trợ Collision Warning
-- Chạy trên Supabase SQL Editor
-- ============================================================

-- 1. Thêm cột phân loại loại alert
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS alert_type  TEXT DEFAULT 'zone_violation';

COMMENT ON COLUMN alerts.alert_type IS
  'Loại cảnh báo: zone_violation | collision_risk | speed_limit';

-- 2. Thêm cột tàu thứ hai trong cặp va chạm
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS vessel_id_b TEXT REFERENCES vessels("Vessel_id") ON DELETE SET NULL;

COMMENT ON COLUMN alerts.vessel_id_b IS
  'Tàu thứ hai trong cặp va chạm (chỉ dùng với alert_type = collision_risk)';

-- 3. Thêm chỉ số CPA / TCPA
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS cpa_nm    NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS tcpa_min  NUMERIC(8,1);

COMMENT ON COLUMN alerts.cpa_nm   IS 'Khoảng cách gần nhất (Hải lý)';
COMMENT ON COLUMN alerts.tcpa_min IS 'Thời gian đến điểm gần nhất (phút)';

-- 4. Index hỗ trợ truy vấn nhanh theo alert_type
CREATE INDEX IF NOT EXISTS idx_alerts_type
  ON alerts (alert_type, status, created_at DESC);

-- 5. Cập nhật giá trị mặc định cho dữ liệu cũ
UPDATE alerts SET alert_type = 'zone_violation' WHERE alert_type IS NULL;

-- 6. Thêm ràng buộc CHECK hợp lệ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_alerts_type'
  ) THEN
    ALTER TABLE alerts
      ADD CONSTRAINT chk_alerts_type
      CHECK (alert_type IN ('zone_violation', 'collision_risk', 'speed_limit'));
  END IF;
END $$;

-- Kiểm tra kết quả
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'alerts'
ORDER BY ordinal_position;
