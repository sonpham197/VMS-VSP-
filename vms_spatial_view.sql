-- ================================================================
-- VMS Marine – Spatial Utility Views
-- ================================================================

-- Tạo View để trả về dữ liệu vùng kèm theo chuỗi WKT để Frontend dễ xử lý
CREATE OR REPLACE VIEW zones_wkt_view AS
SELECT 
    id, 
    name, 
    type, 
    description, 
    severity, 
    ST_AsText(geom) as geom_wkt
FROM zones;

-- Cấp quyền truy cập cho public (vì chúng ta đang dùng anon key)
GRANT SELECT ON zones_wkt_view TO anon;
GRANT SELECT ON zones_wkt_view TO authenticated;
GRANT SELECT ON zones_wkt_view TO service_role;
