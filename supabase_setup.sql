-- ================================================================
-- VMS Marine – Supabase Full Schema Setup v2
-- Chạy trong Supabase SQL Editor: https://supabase.com/dashboard
-- ================================================================

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 1: Tái cấu trúc bảng vessels
-- Xóa các trường động, thêm các trường thông tin tĩnh của tàu
-- ─────────────────────────────────────────────────────────────────

-- 1a. Xóa các cột động (nay nằm trong vessel_tracks)
ALTER TABLE vessels DROP COLUMN IF EXISTS lat;
ALTER TABLE vessels DROP COLUMN IF EXISTS lng;
ALTER TABLE vessels DROP COLUMN IF EXISTS speed;
ALTER TABLE vessels DROP COLUMN IF EXISTS heading;
ALTER TABLE vessels DROP COLUMN IF EXISTS status;

-- 1b. Thêm các cột thông tin tĩnh của tàu
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS IMO         TEXT;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS MMSI        TEXT;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS vessel_type TEXT;  -- cargo, tanker, fishing, passenger...
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS flag        TEXT;  -- VN, SG, JP...
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS length_m    NUMERIC;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS width_m     NUMERIC;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS gross_tonnage NUMERIC;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS year_built  INTEGER;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS owner       TEXT;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS image_url   TEXT;

-- 1c. Đảm bảo Vessel_id là Primary Key (nếu chưa có)
-- ALTER TABLE vessels ADD PRIMARY KEY (Vessel_id);

-- 1d. Đảm bảo Vessel_name là UNIQUE
-- ALTER TABLE vessels ADD CONSTRAINT vessels_name_unique UNIQUE (Vessel_name);

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 2: Thêm cột status vào vessel_tracks (nếu chưa có)
-- (status là dữ liệu động: normal/warning/danger)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE vessel_tracks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'normal';

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 3: Khóa ngoại (Foreign Key) vessel_tracks → vessels
-- Đảm bảo toàn vẹn dữ liệu: mỗi track phải thuộc về một tàu tồn tại
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE vessel_tracks
  ADD CONSTRAINT fk_vessel_tracks_vessel
  FOREIGN KEY ("Vessel_id")
  REFERENCES vessels("Vessel_id")
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 4: Tạo VIEW hợp nhất dữ liệu tĩnh + vị trí mới nhất
-- (Dùng cho dashboard map nếu muốn query đơn giản từ Supabase)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vessel_current_positions AS
SELECT
  v.*,
  t.lat,
  t.lng,
  t.speed,
  t.heading,
  t.status,
  t.created_at AS last_seen
FROM vessels v
LEFT JOIN LATERAL (
  SELECT lat, lng, speed, heading, status, created_at
  FROM vessel_tracks vt
  WHERE vt."Vessel_id" = v."Vessel_id"
  ORDER BY vt.created_at DESC
  LIMIT 1
) t ON true;

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 5: Supabase Storage Buckets
-- ─────────────────────────────────────────────────────────────────

-- 5a. Bucket cho ảnh tàu (vessel-images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vessel-images', 'vessel-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5b. Bucket cho ảnh đại diện khách hàng (avatars) - từ setup cũ
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 6: Storage RLS Policies
-- ─────────────────────────────────────────────────────────────────

-- Vessel images: public read, allow upload/update/delete
CREATE POLICY IF NOT EXISTS "vessel_images_read"   ON storage.objects FOR SELECT USING (bucket_id = 'vessel-images');
CREATE POLICY IF NOT EXISTS "vessel_images_insert"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vessel-images');
CREATE POLICY IF NOT EXISTS "vessel_images_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'vessel-images');
CREATE POLICY IF NOT EXISTS "vessel_images_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'vessel-images');

-- Avatars: public read, allow upload/update/delete
CREATE POLICY IF NOT EXISTS "avatars_read"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_insert"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_update"  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
CREATE POLICY IF NOT EXISTS "avatars_delete"  ON storage.objects FOR DELETE USING (bucket_id = 'avatars');

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 7: RLS cho các bảng dữ liệu
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE vessels ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "vessels_all" ON vessels FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE vessel_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "vessel_tracks_all" ON vessel_tracks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "customer_all" ON "Customer" FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- BƯỚC 8: Thêm cột avatar_url vào Customer (nếu chưa có)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ─────────────────────────────────────────────────────────────────
-- Kiểm tra kết quả
-- ─────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vessels'
ORDER BY ordinal_position;
