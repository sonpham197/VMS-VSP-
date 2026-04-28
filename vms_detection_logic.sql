-- ================================================================
-- VMS Marine – Detection Engine Logic (PostGIS)
-- ================================================================

-- 1. Hàm kiểm tra vi phạm vùng cấm (Zone Violation)
-- Trả về bảng các vùng mà tọa đối đang nằm trong
CREATE OR REPLACE FUNCTION check_zone_violation(v_lat double precision, v_lng double precision)
RETURNS TABLE (
    zone_id uuid,
    zone_name text,
    zone_type text,
    zone_severity text
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, name, type, severity
    FROM zones
    WHERE ST_Contains(geom, ST_SetSRID(ST_Point(v_lng, v_lat), 4326));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hàm xử lý khi có track mới (Main Detection Entry Point)
-- Thường được gọi sau khi Insert vào vessel_tracks
CREATE OR REPLACE FUNCTION process_vessel_track_alerts(
    p_vessel_id text,
    p_lat double precision,
    p_lng double precision,
    p_speed double precision,
    p_track_id bigint 
)
RETURNS void AS $$
DECLARE
    r_zone RECORD;
    v_rule_id uuid;
    v_alert_id uuid;
    v_track_status text := 'normal';
BEGIN
    -- [A] KIỂM TRA VI PHẠM VÙNG CẤM
    FOR r_zone IN SELECT * FROM check_zone_violation(p_lat, p_lng) LOOP
        
        -- Cập nhật v_track_status nếu severity của zone cao hơn hiện tại
        IF r_zone.zone_severity = 'danger' THEN
            v_track_status := 'danger';
        ELSIF r_zone.zone_severity = 'warning' AND v_track_status = 'normal' THEN
            v_track_status := 'warning';
        END IF;

        -- Lấy rule_id cho ZONE_VIOLATION
        SELECT id INTO v_rule_id FROM anomaly_rules WHERE code = 'ZONE_VIOLATION';

        -- Tìm alert hiện có đang "Open" cho tàu này và rule này
        SELECT id INTO v_alert_id 
        FROM alerts 
        WHERE vessel_id = p_vessel_id 
          AND rule_id = v_rule_id 
          AND status = 'open'
        LIMIT 1;

        IF v_alert_id IS NULL THEN
            -- Tạo alert mới
            INSERT INTO alerts (
                vessel_id, rule_id, severity, description, last_position, metadata
            ) VALUES (
                p_vessel_id, 
                v_rule_id, 
                r_zone.zone_severity, 
                'Tàu xâm nhập vùng: ' || r_zone.zone_name,
                ST_SetSRID(ST_Point(p_lng, p_lat), 4326),
                jsonb_build_object('zone_id', r_zone.zone_id, 'zone_name', r_zone.zone_name)
            );
        ELSE
            -- Cập nhật alert hiện có
            UPDATE alerts SET 
                event_count = event_count + 1,
                last_position = ST_SetSRID(ST_Point(p_lng, p_lat), 4326),
                updated_at = now()
            WHERE id = v_alert_id;
        END IF;
    END LOOP;

    -- [B] KIỂM TRA QUÁ TỐC ĐỘ
    IF p_speed > 25 THEN
        -- Cập nhật status lên warning nếu đang là normal
        IF v_track_status = 'normal' THEN
            v_track_status := 'warning';
        END IF;

        SELECT id INTO v_rule_id FROM anomaly_rules WHERE code = 'SPEED_LIMIT';
        
        SELECT id INTO v_alert_id 
        FROM alerts 
        WHERE vessel_id = p_vessel_id AND rule_id = v_rule_id AND status = 'open'
        LIMIT 1;

        IF v_alert_id IS NULL THEN
            INSERT INTO alerts (vessel_id, rule_id, severity, description, last_position)
            VALUES (p_vessel_id, v_rule_id, 'warning', 'Tàu chạy quá tốc độ (>' || p_speed || ' kn)', ST_SetSRID(ST_Point(p_lng, p_lat), 4326));
        ELSE
            UPDATE alerts SET 
                event_count = event_count + 1,
                last_position = ST_SetSRID(ST_Point(p_lng, p_lat), 4326),
                updated_at = now()
            WHERE id = v_alert_id;
        END IF;
    END IF;

    -- [C] CẬP NHẬT TRẠNG THÁI VÀO BẢNG TRACKS (Vị trí hiện tại)
    UPDATE vessel_tracks SET status = v_track_status WHERE id = p_track_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
