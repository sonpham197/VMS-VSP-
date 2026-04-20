-- ================================================================
-- VMS Marine – Automatic Alert Trigger
-- ================================================================

-- 1. Hàm trigger trung gian
-- Gọi process_vessel_track_alerts sau khi có bản ghi mới trong vessel_tracks
CREATE OR REPLACE FUNCTION trg_process_vessel_track()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM process_vessel_track_alerts(
        NEW."Vessel_id",
        NEW.lat,
        NEW.lng,
        NEW.speed,
        NEW.id -- Giả định vessel_tracks có cột id là uuid
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Tạo trigger
DROP TRIGGER IF EXISTS on_vessel_track_insert ON vessel_tracks;
CREATE TRIGGER on_vessel_track_insert
AFTER INSERT ON vessel_tracks
FOR EACH ROW
EXECUTE FUNCTION trg_process_vessel_track();
