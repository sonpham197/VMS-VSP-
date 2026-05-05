-- ================================================================
-- VMS Marine – FULL FIX: Alert Detection Pipeline
-- Chạy TỪNG BƯỚC trong Supabase SQL Editor
-- ================================================================

-- ─── BƯỚC 1: KIỂM TRA DỮ LIỆU THỰC TẾ ───────────────────────────────────────
-- Kiểm tra xem bảng alerts có bản ghi nào không
SELECT id, vessel_id, severity, status, description, created_at
FROM alerts
ORDER BY created_at DESC
LIMIT 20;

-- Kiểm tra vessel_tracks có cột id kiểu gì
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vessel_tracks';

-- Kiểm tra trigger đã tồn tại chưa
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'vessel_tracks';

-- Kiểm tra Realtime đã bật cho bảng alerts chưa
-- (Xem kết quả trong Supabase Dashboard > Database > Replication)

-- ─── BƯỚC 2: SỬA HÀM check_zone_violation (trả về đúng alias) ────────────────
-- Phải DROP trước vì thay đổi kiểu trả về / tham số OUT
DROP FUNCTION IF EXISTS check_zone_violation(double precision, double precision);
DROP FUNCTION IF EXISTS process_vessel_track_alerts(text, double precision, double precision, double precision, bigint);
DROP FUNCTION IF EXISTS process_vessel_track_alerts(text, double precision, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION check_zone_violation(v_lat double precision, v_lng double precision)
RETURNS TABLE (
    zone_id   uuid,
    zone_name text,
    zone_type text,
    zone_severity text
) AS $$
BEGIN
    RETURN QUERY
    SELECT z.id, z.name, z.type, z.severity
    FROM zones z
    WHERE ST_Contains(z.geom, ST_SetSRID(ST_Point(v_lng, v_lat), 4326));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── BƯỚC 3: SỬA HÀM CHÍNH – Dùng bigint nếu vessel_tracks.id là serial/int8 ──
-- Nếu vessel_tracks.id là UUID, đổi bigint → uuid ở dòng p_track_id
CREATE OR REPLACE FUNCTION process_vessel_track_alerts(
    p_vessel_id  text,
    p_lat        double precision,
    p_lng        double precision,
    p_speed      double precision,
    p_track_id   bigint          -- Đổi thành uuid nếu cần thiết
)
RETURNS void AS $$
DECLARE
    r_zone         RECORD;
    v_rule_id      uuid;
    v_alert_id     uuid;
    v_track_status text := 'normal';
    v_point        geometry(Point, 4326);
BEGIN
    v_point := ST_SetSRID(ST_Point(p_lng, p_lat), 4326);

    -- [A] VI PHẠM VÙNG CẤM
    FOR r_zone IN SELECT * FROM check_zone_violation(p_lat, p_lng) LOOP
        -- Gán status cao nhất
        IF r_zone.zone_severity = 'danger' THEN
            v_track_status := 'danger';
        ELSIF r_zone.zone_severity = 'warning' AND v_track_status = 'normal' THEN
            v_track_status := 'warning';
        END IF;

        SELECT id INTO v_rule_id FROM anomaly_rules WHERE code = 'ZONE_VIOLATION' LIMIT 1;
        SELECT id INTO v_alert_id FROM alerts
            WHERE vessel_id = p_vessel_id AND rule_id = v_rule_id AND status = 'open'
            LIMIT 1;

        IF v_alert_id IS NULL THEN
            INSERT INTO alerts (vessel_id, rule_id, severity, status, description, last_position, metadata)
            VALUES (
                p_vessel_id, v_rule_id, r_zone.zone_severity, 'open',
                'Tàu xâm nhập vùng: ' || r_zone.zone_name,
                v_point,
                jsonb_build_object('zone_id', r_zone.zone_id, 'zone_name', r_zone.zone_name)
            );
        ELSE
            UPDATE alerts SET
                event_count  = event_count + 1,
                last_position = v_point,
                updated_at   = now()
            WHERE id = v_alert_id;
        END IF;
    END LOOP;

    -- [B] QUÁ TỐC ĐỘ
    IF p_speed > 25 THEN
        IF v_track_status = 'normal' THEN v_track_status := 'warning'; END IF;

        SELECT id INTO v_rule_id FROM anomaly_rules WHERE code = 'SPEED_LIMIT' LIMIT 1;
        SELECT id INTO v_alert_id FROM alerts
            WHERE vessel_id = p_vessel_id AND rule_id = v_rule_id AND status = 'open'
            LIMIT 1;

        IF v_alert_id IS NULL THEN
            INSERT INTO alerts (vessel_id, rule_id, severity, status, description, last_position)
            VALUES (
                p_vessel_id, v_rule_id, 'warning', 'open',
                'Tàu chạy quá tốc độ (' || p_speed::text || ' kn)',
                v_point
            );
        ELSE
            UPDATE alerts SET
                event_count  = event_count + 1,
                last_position = v_point,
                updated_at   = now()
            WHERE id = v_alert_id;
        END IF;
    END IF;

    -- [C] CẬP NHẬT STATUS VÀO VESSEL_TRACKS
    UPDATE vessel_tracks SET status = v_track_status WHERE id = p_track_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── BƯỚC 4: TÁI TẠO TRIGGER ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_process_vessel_track()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM process_vessel_track_alerts(
        NEW."Vessel_id",
        NEW.lat,
        NEW.lng,
        COALESCE(NEW.speed, 0),
        NEW.id::bigint  -- Đổi thành NEW.id::uuid nếu dùng UUID
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vessel_track_insert ON vessel_tracks;
CREATE TRIGGER on_vessel_track_insert
    AFTER INSERT ON vessel_tracks
    FOR EACH ROW EXECUTE FUNCTION trg_process_vessel_track();

-- ─── BƯỚC 5: BẬT REALTIME CHO BẢNG ALERTS ───────────────────────────────────
-- (Nếu đã bật rồi thì bỏ qua bước này - lỗi "already member" là bình thường)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'alerts already in publication, skipping.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE vessel_tracks;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'vessel_tracks already in publication, skipping.';
END $$;

-- ─── BƯỚC 6: KIỂM TRA THỬ TRIGGER ───────────────────────────────────────────
-- Chạy lệnh này để test một lần thủ công (thay vessel_id thực tế)
-- SELECT process_vessel_track_alerts('TEN_TAU_CUA_BAN', 16.47, 111.6, 30, 9999999);
-- Sau đó: SELECT * FROM alerts ORDER BY created_at DESC LIMIT 5;

-- ─── BƯỚC 7: KIỂM TRA RLS ────────────────────────────────────────────────────
-- Đảm bảo bảng alerts có thể insert từ trigger (chạy với SECURITY DEFINER nên ổn)
-- Nhưng cũng cần policy cho SELECT từ frontend:
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_public_all" ON alerts;
CREATE POLICY "alerts_public_all" ON alerts FOR ALL USING (true) WITH CHECK (true);
