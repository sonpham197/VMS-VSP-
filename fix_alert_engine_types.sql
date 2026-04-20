-- ================================================================
-- VMS Marine – Fix Types & Constraints
-- ================================================================

-- 1. Xóa các ràng buộc Unique không hợp lý trên tọa độ
ALTER TABLE vessel_tracks DROP CONSTRAINT IF EXISTS vessel_tracks_lat_key;
ALTER TABLE vessel_tracks DROP CONSTRAINT IF EXISTS vessel_tracks_lng_key;

-- 2. Cập nhật lại Signature của hàm (Đổi uuid -> bigint cho p_track_id)
CREATE OR REPLACE FUNCTION process_vessel_track_alerts(
    p_vessel_id text,
    p_lat double precision,
    p_lng double precision,
    p_speed double precision,
    p_track_id bigint  -- Thay đổi từ uuid sang bigint để khớp với cột id của table
)
RETURNS void AS $$
DECLARE
    _z RECORD;
    _curr_rule_id uuid;
    _curr_alert_id uuid;
    _curr_point geometry(Point, 4326);
BEGIN
    -- Khởi tạo điểm tọa độ
    _curr_point := ST_SetSRID(ST_Point(p_lng, p_lat), 4326);

    -- [A] KIỂM TRA VI PHẠM VÙNG CẤM
    FOR _z IN SELECT * FROM check_zone_violation(p_lat, p_lng) LOOP
        _curr_rule_id := (SELECT id FROM anomaly_rules WHERE code = 'ZONE_VIOLATION' LIMIT 1);
        _curr_alert_id := (SELECT id FROM alerts WHERE vessel_id = p_vessel_id AND rule_id = _curr_rule_id AND status = 'open' LIMIT 1);

        IF _curr_alert_id IS NULL THEN
            INSERT INTO alerts (vessel_id, rule_id, severity, description, last_position, metadata)
            VALUES (p_vessel_id, _curr_rule_id, _z.res_zone_severity, 'Tàu xâm nhập vùng cấm: ' || _z.res_zone_name, _curr_point, jsonb_build_object('zone_id', _z.res_zone_id, 'zone_name', _z.res_zone_name));
        ELSE
            UPDATE alerts SET event_count = event_count + 1, last_position = _curr_point, updated_at = now() WHERE id = _curr_alert_id;
        END IF;
    END LOOP;

    -- [B] KIỂM TRA QUÁ TỐC ĐỘ
    IF p_speed > 25 THEN
        _curr_rule_id := (SELECT id FROM anomaly_rules WHERE code = 'SPEED_LIMIT' LIMIT 1);
        _curr_alert_id := (SELECT id FROM alerts WHERE vessel_id = p_vessel_id AND rule_id = _curr_rule_id AND status = 'open' LIMIT 1);

        IF _curr_alert_id IS NULL THEN
            INSERT INTO alerts (vessel_id, rule_id, severity, description, last_position)
            VALUES (p_vessel_id, _curr_rule_id, 'warning', 'Tàu chạy quá tốc độ (>' || p_speed || ' kn)', _curr_point);
        ELSE
            UPDATE alerts SET event_count = event_count + 1, last_position = _curr_point, updated_at = now() WHERE id = _curr_alert_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cập nhật lại Trigger
CREATE OR REPLACE FUNCTION trg_process_vessel_track()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM process_vessel_track_alerts(
        NEW."Vessel_id",
        NEW.lat,
        NEW.lng,
        NEW.speed,
        NEW.id::bigint
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
