-- ================================================================
-- VMS Marine – DIAGNOSE & FIX: Zone Violation Detection
-- Chạy TỪNG BLOCK (;) một trong Supabase SQL Editor
-- ================================================================

-- ╔══════════════════════════════════════════════════════╗
-- ║  BƯỚC 1: CHẨN ĐOÁN – Kiểm tra dữ liệu thực tế      ║
-- ╚══════════════════════════════════════════════════════╝

-- 1A. Tàu "Hoa Biển 1" – lấy Vessel_id chính xác
SELECT "Vessel_id", "Vessel_name" FROM vessels WHERE "Vessel_name" ILIKE '%hoa bi%';

-- 1B. Vị trí mới nhất của tàu
SELECT vt."Vessel_id", vt.lat, vt.lng, vt.status, vt.created_at
FROM vessel_tracks vt
WHERE vt."Vessel_id" = (SELECT "Vessel_id" FROM vessels WHERE "Vessel_name" ILIKE '%hoa bi%' LIMIT 1)
ORDER BY vt.created_at DESC
LIMIT 5;

-- 1C. Kiểm tra các vùng cấm đang có
SELECT id, name, severity, type FROM zones;

-- 1D. Kiểm tra tọa độ tàu CÓ NẰM trong vùng cấm không (test thủ công)
SELECT z.name, z.severity
FROM zones z
WHERE ST_Contains(
    z.geom,
    ST_SetSRID(ST_Point(
        (SELECT lng FROM vessel_tracks
         WHERE "Vessel_id" = (SELECT "Vessel_id" FROM vessels WHERE "Vessel_name" ILIKE '%hoa bi%' LIMIT 1)
         ORDER BY created_at DESC LIMIT 1),
        (SELECT lat FROM vessel_tracks
         WHERE "Vessel_id" = (SELECT "Vessel_id" FROM vessels WHERE "Vessel_name" ILIKE '%hoa bi%' LIMIT 1)
         ORDER BY created_at DESC LIMIT 1)
    ), 4326)
);

-- 1E. Kiểm tra alerts đang mở cho tàu này
SELECT * FROM alerts
WHERE vessel_id = (SELECT "Vessel_id" FROM vessels WHERE "Vessel_name" ILIKE '%hoa bi%' LIMIT 1);

-- 1F. Kiểm tra trigger đã tồn tại chưa
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'vessel_tracks';

-- 1G. Kiểm tra anomaly_rules có đủ không
SELECT * FROM anomaly_rules WHERE code = 'ZONE_VIOLATION';


-- ╔══════════════════════════════════════════════════════╗
-- ║  BƯỚC 2: FIX – Tái tạo hàm check_zone_violation     ║
-- ╚══════════════════════════════════════════════════════╝
-- Alias trả về phải nhất quán với những gì hàm chính đọc

DROP FUNCTION IF EXISTS check_zone_violation(double precision, double precision);

CREATE OR REPLACE FUNCTION check_zone_violation(v_lat double precision, v_lng double precision)
RETURNS TABLE (
    zone_id       uuid,
    zone_name     text,
    zone_type     text,
    zone_severity text
) AS $$
BEGIN
    RETURN QUERY
    SELECT z.id, z.name, z.type, z.severity
    FROM zones z
    WHERE ST_Contains(z.geom, ST_SetSRID(ST_Point(v_lng, v_lat), 4326));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ╔══════════════════════════════════════════════════════╗
-- ║  BƯỚC 3: FIX – Hàm xử lý chính (tự phát hiện bigint/uuid) ║
-- ╚══════════════════════════════════════════════════════╝

-- Xóa các phiên bản cũ (tất cả overload)
DROP FUNCTION IF EXISTS process_vessel_track_alerts(text, double precision, double precision, double precision, bigint);
DROP FUNCTION IF EXISTS process_vessel_track_alerts(text, double precision, double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION process_vessel_track_alerts(
    p_vessel_id  text,
    p_lat        double precision,
    p_lng        double precision,
    p_speed      double precision,
    p_track_id   bigint
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
        ELSIF r_zone.zone_severity = 'warning' AND v_track_status != 'danger' THEN
            v_track_status := 'warning';
        END IF;

        SELECT id INTO v_rule_id FROM anomaly_rules WHERE code = 'ZONE_VIOLATION' LIMIT 1;

        -- Tìm alert đang mở cho tàu + rule này + cùng zone
        SELECT id INTO v_alert_id
        FROM alerts
        WHERE vessel_id = p_vessel_id
          AND rule_id   = v_rule_id
          AND status    = 'open'
          AND metadata->>'zone_id' = r_zone.zone_id::text
        LIMIT 1;

        IF v_alert_id IS NULL THEN
            INSERT INTO alerts (
                vessel_id, rule_id, severity, status, description,
                last_position, metadata
            ) VALUES (
                p_vessel_id,
                v_rule_id,
                r_zone.zone_severity,
                'open',
                'Tàu xâm nhập vùng: ' || r_zone.zone_name,
                v_point,
                jsonb_build_object(
                    'zone_id',   r_zone.zone_id,
                    'zone_name', r_zone.zone_name,
                    'zone_type', r_zone.zone_type
                )
            );
        ELSE
            UPDATE alerts SET
                event_count   = event_count + 1,
                last_position = v_point,
                severity      = r_zone.zone_severity,  -- cập nhật severity nếu zone đổi
                updated_at    = now()
            WHERE id = v_alert_id;
        END IF;
    END LOOP;

    -- Tàu đã ra khỏi TẤT CẢ vùng cấm → tự động đóng alert zone
    IF v_track_status = 'normal' THEN
        UPDATE alerts
        SET status = 'resolved', updated_at = now()
        WHERE vessel_id = p_vessel_id
          AND rule_id   = (SELECT id FROM anomaly_rules WHERE code = 'ZONE_VIOLATION' LIMIT 1)
          AND status    = 'open';
    END IF;

    -- [B] QUÁ TỐC ĐỘ
    IF p_speed > 25 THEN
        IF v_track_status = 'normal' THEN v_track_status := 'warning'; END IF;

        SELECT id INTO v_rule_id FROM anomaly_rules WHERE code = 'SPEED_LIMIT' LIMIT 1;
        SELECT id INTO v_alert_id
        FROM alerts
        WHERE vessel_id = p_vessel_id AND rule_id = v_rule_id AND status = 'open'
        LIMIT 1;

        IF v_alert_id IS NULL THEN
            INSERT INTO alerts (vessel_id, rule_id, severity, status, description, last_position)
            VALUES (
                p_vessel_id, v_rule_id, 'warning', 'open',
                'Tàu chạy quá tốc độ (' || round(p_speed::numeric, 1) || ' kn)',
                v_point
            );
        ELSE
            UPDATE alerts SET
                event_count   = event_count + 1,
                last_position = v_point,
                updated_at    = now()
            WHERE id = v_alert_id;
        END IF;
    END IF;

    -- [C] CẬP NHẬT STATUS VÀO VESSEL_TRACKS
    UPDATE vessel_tracks SET status = v_track_status WHERE id = p_track_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ╔══════════════════════════════════════════════════════╗
-- ║  BƯỚC 4: FIX – Tái tạo Trigger                      ║
-- ╚══════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION trg_process_vessel_track()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM process_vessel_track_alerts(
        NEW."Vessel_id",
        NEW.lat,
        NEW.lng,
        COALESCE(NEW.speed, 0),
        NEW.id::bigint
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vessel_track_insert ON vessel_tracks;
CREATE TRIGGER on_vessel_track_insert
    AFTER INSERT ON vessel_tracks
    FOR EACH ROW EXECUTE FUNCTION trg_process_vessel_track();


-- ╔══════════════════════════════════════════════════════╗
-- ║  BƯỚC 5: TEST THỦ CÔNG – Kích hoạt alert ngay       ║
-- ╚══════════════════════════════════════════════════════╝
-- Thay 'HOA_BIEN_1_VESSEL_ID' bằng Vessel_id thực từ BƯỚC 1A
-- Toạ độ 112.5, 16.5 nằm trong vùng Hoàng Sa (danger zone)

/*
DO $$
DECLARE
    v_vessel_id text;
BEGIN
    SELECT "Vessel_id" INTO v_vessel_id
    FROM vessels WHERE "Vessel_name" ILIKE '%hoa bi%' LIMIT 1;

    -- Insert track nằm trong vùng Hoàng Sa
    INSERT INTO vessel_tracks ("Vessel_id", lat, lng, speed, heading)
    VALUES (v_vessel_id, 16.5, 112.5, 10, 90);

    RAISE NOTICE 'Test track inserted for vessel: %', v_vessel_id;
END $$;

-- Kiểm tra kết quả:
SELECT id, vessel_id, severity, status, description, created_at
FROM alerts ORDER BY created_at DESC LIMIT 5;
*/


-- ╔══════════════════════════════════════════════════════╗
-- ║  BƯỚC 6: Bật Realtime cho bảng alerts               ║
-- ╚══════════════════════════════════════════════════════╝
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'alerts already in publication: %', SQLERRM;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vessel_tracks;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'vessel_tracks already in publication: %', SQLERRM;
END $$;


-- ╔══════════════════════════════════════════════════════╗
-- ║  BƯỚC 7: Đảm bảo RLS cho phép đọc/ghi              ║
-- ╚══════════════════════════════════════════════════════╝
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_public_all" ON alerts;
CREATE POLICY "alerts_public_all" ON alerts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zones_public_read" ON zones;
CREATE POLICY "zones_public_read" ON zones FOR SELECT USING (true);

-- XONG! Kiểm tra lần cuối:
SELECT id, vessel_id, severity, status, description, created_at
FROM alerts ORDER BY created_at DESC LIMIT 10;
