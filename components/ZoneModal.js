import React, { useState } from 'react';
import { X, Save, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function ZoneModal({ points, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('port'); // port, restricted, warning, shipping_lane
  const [severity, setSeverity] = useState('warning'); // warning, danger
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên vùng.');
      return;
    }
    
    setLoading(true);
    setError(null);

    // Convert points to WKT POLYGON
    // PostGIS format: POLYGON((lng lat, lng lat, ..., first_lng first_lat))
    const coords = points.map(p => `${p.lng} ${p.lat}`);
    // Close the polygon by repeating the first point
    coords.push(`${points[0].lng} ${points[0].lat}`);
    const wkt = `POLYGON((${coords.join(', ')}))`;

    try {
      const { data, error: insertError } = await supabase.from('zones').insert({
        name: name.trim(),
        type,
        severity,
        description: description.trim() || null,
        geom: wkt
      }).select();

      if (insertError) throw insertError;
      
      const newZone = data[0];
      // Note: newZone returned might not have geom_wkt if it comes from the 'zones' table directly instead of 'zones_wkt_view'.
      // But we can construct the object matching the view format for the local state:
      const savedZone = {
        id: newZone.id,
        name: newZone.name,
        type: newZone.type,
        severity: newZone.severity,
        description: newZone.description,
        geom_wkt: wkt
      };

      onSaved(savedZone);
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu vùng cảnh báo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2><MapPin size={18} style={{marginRight: '8px', verticalAlign: 'middle', color: '#38bdf8'}} /> Lưu Vùng Địa Lý Mới</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <p className="summary-text">Đã vẽ đa giác với {points.length} điểm.</p>
          
          {error && <div className="form-error"><AlertTriangle size={15}/>{error}</div>}

          <div className="form-group">
            <label>Tên Vùng / Cảng *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Vd: Cảng Cát Lái, Vùng cấm quân sự..." required autoFocus />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Loại khu vực</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="port">Cảng (Port)</option>
                <option value="restricted">Vùng Cấm (Restricted)</option>
                <option value="warning">Vùng Cảnh báo (Warning)</option>
                <option value="shipping_lane">Tuyến Hàng hải (Shipping Lane)</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Mức độ cảnh báo</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)}>
                <option value="warning">Warning (Cảnh báo cam)</option>
                <option value="danger">Danger (Nguy hiểm đỏ)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Mô tả thêm</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Thông tin chi tiết về vùng này..."></textarea>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={15} className="spin" /> Đang lưu...</> : <><Save size={15} /> Lưu Vùng</>}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px; }
        .modal-box { background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:16px; width:100%; max-width:500px; box-shadow:0 25px 60px rgba(0,0,0,0.6); }
        .modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.08); }
        .modal-header h2 { font-size:1.1rem; font-weight:700; color:white; margin:0; }
        .icon-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; border-radius:8px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; }
        .icon-btn:hover { background:rgba(239,68,68,0.2); color:#f87171; }
        .modal-form { padding:20px; }
        .summary-text { font-size:0.85rem; color:#cbd5e1; margin-bottom:16px; }
        .form-error { display:flex; align-items:center; gap:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:8px; padding:10px 14px; font-size:0.84rem; margin-bottom:16px; }
        .form-row { display:flex; gap:12px; margin-bottom:16px; }
        .form-group { display:flex; flex-direction:column; gap:6px; margin-bottom:16px; }
        .flex-1 { flex:1; }
        .form-group label { font-size:0.75rem; color:#94a3b8; font-weight:600; }
        .form-group input, .form-group select, .form-group textarea { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; border-radius:8px; padding:10px 12px; font-size:0.9rem; outline:none; transition:all 0.2s; font-family:inherit; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color:#38bdf8; background:rgba(0,0,0,0.2); }
        .form-group select option { background:#1e293b; }
        .form-group textarea { resize:vertical; }
        .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:10px; }
        .btn-secondary { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; border-radius:8px; padding:9px 18px; cursor:pointer; font-size:0.88rem; transition:all 0.2s; }
        .btn-secondary:hover { background:rgba(255,255,255,0.1); color:white; }
        .btn-primary { background:linear-gradient(135deg,#0891b2,#0e7490); border:none; color:white; border-radius:8px; padding:9px 20px; font-weight:600; display:flex; align-items:center; gap:6px; cursor:pointer; transition:all 0.2s; }
        .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg,#06b6d4,#0891b2); }
        .btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
        .spin { animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
