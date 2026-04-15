import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import {
  Ship, Plus, Search, Edit2, Trash2, X, Save,
  Upload, Hash, Flag, Ruler, Weight, Calendar,
  User, FileText, AlertTriangle, CheckCircle,
  Loader2, Eye, ChevronLeft, Anchor, Camera, Info
} from 'lucide-react';

// ─── Upload ảnh tàu → Supabase Storage ──────────────────────────────────────
async function uploadVesselImage(file) {
  const ext = file.name.split('.').pop();
  const fileName = `vessel_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('vessel-images')
    .upload(fileName, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from('vessel-images')
    .getPublicUrl(fileName);
  return urlData.publicUrl;
}

// Danh sách loại tàu
const VESSEL_TYPES = [
  'Tàu hàng tổng hợp', 'Tàu container', 'Tàu chở dầu',
  'Tàu chở hóa chất', 'Tàu chở khí hóa lỏng', 'Tàu hành khách',
  'Tàu ro-ro', 'Tàu đánh cá', 'Tàu cần cẩu', 'Tàu khảo sát',
  'Tàu hải quan / tuần tra', 'Phà', 'Tàu lai dắt', 'Khác',
];

const FLAGS = [
  { code: 'VN', name: 'Việt Nam 🇻🇳' },
  { code: 'SG', name: 'Singapore 🇸🇬' },
  { code: 'JP', name: 'Nhật Bản 🇯🇵' },
  { code: 'KR', name: 'Hàn Quốc 🇰🇷' },
  { code: 'CN', name: 'Trung Quốc 🇨🇳' },
  { code: 'PA', name: 'Panama 🇵🇦' },
  { code: 'MH', name: 'Marshall Islands 🇲🇭' },
  { code: 'LR', name: 'Liberia 🇱🇷' },
  { code: 'BS', name: 'Bahamas 🇧🇸' },
  { code: 'OTHER', name: 'Khác' },
];

const EMPTY_FORM = {
  Vessel_id: '', Vessel_name: '', IMO: '', MMSI: '',
  vessel_type: '', flag: 'VN',
  length_m: '', width_m: '', gross_tonnage: '', year_built: '',
  owner: '', description: '', image_url: '',
};

// ─── Vessel Detail Modal (View) ──────────────────────────────────────────────
function VesselDetailModal({ vessel, onClose, onEdit }) {
  const fields = [
    { label: 'Vessel ID', value: vessel.Vessel_id, icon: <Hash size={14} /> },
    { label: 'IMO', value: vessel.IMO, icon: <Anchor size={14} /> },
    { label: 'MMSI', value: vessel.MMSI, icon: <Hash size={14} /> },
    { label: 'Loại tàu', value: vessel.vessel_type, icon: <Ship size={14} /> },
    { label: 'Cờ hiệu', value: FLAGS.find(f => f.code === vessel.flag)?.name || vessel.flag, icon: <Flag size={14} /> },
    { label: 'Chiều dài', value: vessel.length_m ? `${vessel.length_m} m` : null, icon: <Ruler size={14} /> },
    { label: 'Chiều rộng', value: vessel.width_m ? `${vessel.width_m} m` : null, icon: <Ruler size={14} /> },
    { label: 'Tổng trọng tải', value: vessel.gross_tonnage ? `${Number(vessel.gross_tonnage).toLocaleString()} DWT` : null, icon: <Weight size={14} /> },
    { label: 'Năm đóng', value: vessel.year_built, icon: <Calendar size={14} /> },
    { label: 'Chủ tàu', value: vessel.owner, icon: <User size={14} /> },
  ];
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="detail-box">
        {/* Hero image */}
        <div className="detail-hero">
          {vessel.image_url
            ? <img src={vessel.image_url} alt={vessel.Vessel_name} className="detail-img" />
            : <div className="detail-img-placeholder"><Ship size={56} /></div>}
          <div className="detail-hero-overlay">
            <div className="detail-type-badge">{vessel.vessel_type || 'Tàu biển'}</div>
            <h2 className="detail-name">{vessel.Vessel_name}</h2>
          </div>
          <button className="detail-close" onClick={onClose}><X size={18} /></button>
        </div>
        {/* Info grid */}
        <div className="detail-body">
          <div className="detail-grid">
            {fields.map(f => f.value && (
              <div className="detail-field" key={f.label}>
                <div className="detail-field-icon">{f.icon}</div>
                <div>
                  <div className="detail-field-label">{f.label}</div>
                  <div className="detail-field-value">{f.value}</div>
                </div>
              </div>
            ))}
          </div>
          {vessel.description && (
            <div className="detail-desc">
              <FileText size={14} />
              <p>{vessel.description}</p>
            </div>
          )}
          <div className="detail-actions">
            <button className="btn-secondary" onClick={onClose}>Đóng</button>
            <button className="btn-primary" onClick={() => { onClose(); onEdit(vessel); }}>
              <Edit2 size={15} /> Chỉnh sửa
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .modal-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;}
        .detail-box{background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:100%;max-width:520px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.6);max-height:90vh;overflow-y:auto;}
        .detail-hero{position:relative;height:200px;background:#0f172a;overflow:hidden;}
        .detail-img{width:100%;height:100%;object-fit:cover;}
        .detail-img-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#334155;}
        .detail-hero-overlay{position:absolute;bottom:0;left:0;right:0;padding:16px 20px;background:linear-gradient(to top,rgba(0,0,0,0.9),transparent);}
        .detail-type-badge{display:inline-block;background:rgba(56,189,248,0.2);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;border-radius:6px;padding:2px 10px;font-size:0.7rem;font-weight:600;margin-bottom:6px;}
        .detail-name{color:white;font-size:1.4rem;font-weight:800;margin:0;}
        .detail-close{position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;}
        .detail-close:hover{background:rgba(239,68,68,0.3);}
        .detail-body{padding:20px;}
        .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;}
        .detail-field{display:flex;align-items:flex-start;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px;}
        .detail-field-icon{color:#64748b;margin-top:2px;flex-shrink:0;}
        .detail-field-label{font-size:0.68rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;}
        .detail-field-value{font-size:0.9rem;color:#f1f5f9;font-weight:500;margin-top:2px;}
        .detail-desc{display:flex;gap:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px;margin-bottom:16px;color:#94a3b8;font-size:0.85rem;line-height:1.5;}
        .detail-actions{display:flex;gap:10px;justify-content:flex-end;}
        .btn-secondary{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:10px;padding:9px 18px;cursor:pointer;font-size:0.88rem;transition:all 0.2s;}
        .btn-secondary:hover{background:rgba(255,255,255,0.1);color:white;}
        .btn-primary{background:linear-gradient(135deg,#0891b2,#0e7490);border:none;color:white;border-radius:10px;padding:9px 20px;cursor:pointer;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:7px;transition:all 0.2s;}
        .btn-primary:hover{background:linear-gradient(135deg,#06b6d4,#0891b2);}
      `}</style>
    </div>
  );
}

// ─── Add / Edit Modal ───────────────────────────────────────────────────────
function VesselModal({ vessel, onClose, onSaved }) {
  const isEdit = !!vessel?.Vessel_id;
  const [form, setForm] = useState(vessel ? {
    ...EMPTY_FORM, ...vessel,
    length_m: vessel.length_m ?? '', width_m: vessel.width_m ?? '',
    gross_tonnage: vessel.gross_tonnage ?? '', year_built: vessel.year_built ?? '',
  } : { ...EMPTY_FORM });
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(vessel?.image_url || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Chỉ nhận file ảnh.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Ảnh tối đa 10MB.'); return; }
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Vessel_id?.trim() || !form.Vessel_name?.trim()) {
      setError('Vessel ID và Tên tàu là bắt buộc.');
      return;
    }
    setLoading(true); setError(null);
    try {
      let imageUrl = form.image_url;
      if (imgFile) imageUrl = await uploadVesselImage(imgFile);
      const payload = {
        Vessel_id: form.Vessel_id?.trim(),
        Vessel_name: form.Vessel_name?.trim(),
        IMO: form.IMO?.trim() || null,
        MMSI: form.MMSI?.trim() || null,
        vessel_type: form.vessel_type || null,
        flag: form.flag || null,
        length_m: form.length_m !== '' && form.length_m !== null ? Number(form.length_m) : null,
        width_m: form.width_m !== '' && form.width_m !== null ? Number(form.width_m) : null,
        gross_tonnage: form.gross_tonnage !== '' && form.gross_tonnage !== null ? Number(form.gross_tonnage) : null,
        year_built: form.year_built !== '' && form.year_built !== null ? Number(form.year_built) : null,
        owner: form.owner?.trim() || null,
        description: form.description?.trim() || null,
        image_url: imageUrl || null,
      };
      let result;
      if (isEdit) {
        result = await supabase.from('vessels').update(payload).eq('Vessel_id', vessel.Vessel_id).select();
      } else {
        result = await supabase.from('vessels').insert(payload).select();
      }
      if (result.error) throw result.error;
      const responseData = result.data?.[0];
      if (!responseData) throw new Error('Không thể trả về kết quả sau khi lưu.');
      onSaved(responseData, isEdit);
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, icon, children }) => (
    <div className="form-group">
      <label>{icon} {label}</label>
      {children}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>{isEdit ? `Chỉnh sửa: ${vessel.Vessel_name}` : 'Thêm tàu mới'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Image upload */}
          <div className="img-upload-row">
            <div className="img-preview" onClick={() => fileRef.current.click()}>
              {imgPreview
                ? <img src={imgPreview} alt="" />
                : <div className="img-placeholder"><Camera size={24} /><span>Ảnh tàu</span></div>}
              <div className="img-overlay"><Upload size={18} /></div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
            <div className="img-hint">
              <p>Nhấp vào ảnh để tải lên</p>
              <p>Hỗ trợ: JPG, PNG, WebP (tối đa 10MB)</p>
            </div>
          </div>

          {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}

          <div className="section-title">Thông tin định danh</div>
          <div className="form-grid">
            <Field label="Vessel ID *" icon={<Hash size={13} />}>
              <input required value={form.Vessel_id} disabled={isEdit}
                onChange={e => upd('Vessel_id', e.target.value)} placeholder="VMS-001" />
            </Field>
            <Field label="Tên tàu *" icon={<Ship size={13} />}>
              <input required value={form.Vessel_name}
                onChange={e => upd('Vessel_name', e.target.value)} placeholder="MV Ocean Star" />
            </Field>
            <Field label="Số IMO" icon={<Anchor size={13} />}>
              <input value={form.IMO} onChange={e => upd('IMO', e.target.value)} placeholder="IMO 1234567" />
            </Field>
            <Field label="Số MMSI" icon={<Hash size={13} />}>
              <input value={form.MMSI} onChange={e => upd('MMSI', e.target.value)} placeholder="574000000" />
            </Field>
          </div>

          <div className="section-title">Phân loại</div>
          <div className="form-grid">
            <Field label="Loại tàu" icon={<Ship size={13} />}>
              <select value={form.vessel_type} onChange={e => upd('vessel_type', e.target.value)}>
                <option value="">-- Chọn loại tàu --</option>
                {VESSEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Cờ hiệu / Quốc tịch" icon={<Flag size={13} />}>
              <select value={form.flag} onChange={e => upd('flag', e.target.value)}>
                {FLAGS.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="section-title">Thông số kỹ thuật</div>
          <div className="form-grid form-grid-4">
            <Field label="Dài (m)" icon={<Ruler size={13} />}>
              <input type="number" min="0" step="0.1" value={form.length_m} onChange={e => upd('length_m', e.target.value)} placeholder="180" />
            </Field>
            <Field label="Rộng (m)" icon={<Ruler size={13} />}>
              <input type="number" min="0" step="0.1" value={form.width_m} onChange={e => upd('width_m', e.target.value)} placeholder="28" />
            </Field>
            <Field label="Trọng tải (DWT)" icon={<Weight size={13} />}>
              <input type="number" min="0" value={form.gross_tonnage} onChange={e => upd('gross_tonnage', e.target.value)} placeholder="35000" />
            </Field>
            <Field label="Năm đóng" icon={<Calendar size={13} />}>
              <input type="number" min="1900" max="2030" value={form.year_built} onChange={e => upd('year_built', e.target.value)} placeholder="2015" />
            </Field>
          </div>

          <div className="section-title">Thông tin bổ sung</div>
          <div className="form-grid-1">
            <Field label="Chủ tàu / Công ty" icon={<User size={13} />}>
              <input value={form.owner} onChange={e => upd('owner', e.target.value)} placeholder="Công ty Hàng hải Việt Nam" />
            </Field>
            <Field label="Mô tả / Ghi chú" icon={<FileText size={13} />}>
              <textarea rows={3} value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Thông tin thêm về con tàu..." />
            </Field>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={15} className="spin" />Đang lưu...</> : <><Save size={15} />{isEdit ? 'Cập nhật' : 'Thêm tàu'}</>}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;}
        .modal-box{background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.6);}
        .modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0;color:white;position:sticky;top:0;background:#1e293b;z-index:10;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);}
        .modal-header h2{font-size:1.1rem;font-weight:700;}
        .icon-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:8px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
        .icon-btn:hover{background:rgba(255,255,255,0.1);color:white;}
        .modal-form{padding:20px 24px 24px;}
        .img-upload-row{display:flex;gap:16px;align-items:center;margin-bottom:20px;}
        .img-preview{width:120px;height:80px;border-radius:12px;overflow:hidden;cursor:pointer;position:relative;background:rgba(255,255,255,0.04);border:2px dashed rgba(56,189,248,0.3);transition:border-color 0.2s;flex-shrink:0;}
        .img-preview:hover{border-color:#38bdf8;}
        .img-preview img{width:100%;height:100%;object-fit:cover;}
        .img-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px;color:#64748b;font-size:0.68rem;}
        .img-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:white;opacity:0;transition:opacity 0.2s;}
        .img-preview:hover .img-overlay{opacity:1;}
        .img-hint p{font-size:0.75rem;color:#64748b;margin:0 0 3px;}
        .section-title{font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);}
        .form-error{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:8px;padding:10px 14px;font-size:0.84rem;margin-bottom:14px;}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .form-grid-4{grid-template-columns:1fr 1fr 1fr 1fr;}
        .form-grid-1{display:grid;grid-template-columns:1fr;gap:12px;}
        .form-group{display:flex;flex-direction:column;gap:5px;}
        .form-group label{display:flex;align-items:center;gap:5px;font-size:0.75rem;color:#94a3b8;font-weight:600;}
        .form-group input,.form-group select,.form-group textarea{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:white;border-radius:9px;padding:9px 12px;font-size:0.88rem;width:100%;outline:none;transition:border-color 0.2s;font-family:inherit;box-sizing:border-box;}
        .form-group input:focus,.form-group select,.form-group textarea:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,0.1);}
        .form-group select option{background:#1e293b;}
        .form-group textarea{resize:vertical;min-height:70px;}
        .form-group input:disabled{opacity:0.5;cursor:not-allowed;}
        .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;}
        .btn-secondary{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:10px;padding:9px 18px;cursor:pointer;font-size:0.88rem;transition:all 0.2s;}
        .btn-secondary:hover{background:rgba(255,255,255,0.1);color:white;}
        .btn-primary{background:linear-gradient(135deg,#0891b2,#0e7490);border:none;color:white;border-radius:10px;padding:9px 22px;cursor:pointer;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:7px;transition:all 0.2s;box-shadow:0 0 20px rgba(8,145,178,0.3);}
        .btn-primary:hover:not(:disabled){background:linear-gradient(135deg,#06b6d4,#0891b2);}
        .btn-primary:disabled{opacity:0.6;cursor:not-allowed;}
        .spin{animation:spin 1s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>
    </div>
  );
}

// ─── Delete Confirm ──────────────────────────────────────────────────────────
function DeleteModal({ vessel, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('vessels').delete().eq('Vessel_id', vessel.Vessel_id);
    if (error) {
      if (error.code === '23503') setError('Không thể xóa: Tàu này đang có dữ liệu hành trình liên kết.');
      else setError(error.message);
      setLoading(false);
    } else {
      onDeleted(vessel.Vessel_id);
      onClose();
    }
  };
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="del-box">
        <div className="del-icon"><Trash2 size={26}/></div>
        <h3>Xoá tàu?</h3>
        <p>Bạn có chắc muốn xoá tàu <strong>{vessel.Vessel_name}</strong>?<br/>Hành động này không thể hoàn tác.</p>
        {error && <div className="del-error"><AlertTriangle size={14}/>{error}</div>}
        <div className="del-actions">
          <button className="btn-cancel" onClick={onClose}>Huỷ</button>
          <button className="btn-del" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 size={15} className="spin"/> : <Trash2 size={15}/>}
            {loading ? 'Đang xoá...' : 'Xoá tàu'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .modal-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;}
        .del-box{background:#1e293b;border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.6);}
        .del-icon{width:60px;height:60px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#f87171;}
        .del-box h3{color:white;font-size:1.15rem;font-weight:700;margin:0 0 8px;}
        .del-box p{color:#94a3b8;font-size:0.88rem;line-height:1.5;margin:0 0 20px;}
        .del-box strong{color:#f1f5f9;}
        .del-error{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;border-radius:8px;padding:8px 12px;font-size:0.82rem;margin-bottom:16px;text-align:left;}
        .del-actions{display:flex;gap:10px;justify-content:center;}
        .btn-cancel{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:10px;padding:9px 22px;cursor:pointer;font-size:0.88rem;}
        .btn-del{background:linear-gradient(135deg,#dc2626,#b91c1c);border:none;color:white;border-radius:10px;padding:9px 22px;cursor:pointer;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:7px;}
        .btn-del:hover:not(:disabled){opacity:0.9;}
        .btn-del:disabled{opacity:0.6;cursor:not-allowed;}
        .spin{animation:spin 1s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VesselsPage() {
  const router = useRouter();
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchVessels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('vessels').select('*').order('Vessel_name');
    if (error) console.error(error);
    else setVessels(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVessels(); }, [fetchVessels]);

  const handleSaved = (saved, isEdit) => {
    if (isEdit) setVessels(prev => prev.map(v => v.Vessel_id === saved.Vessel_id ? saved : v));
    else setVessels(prev => [saved, ...prev]);
    showToast(isEdit ? 'Cập nhật thông tin tàu thành công!' : 'Thêm tàu mới thành công!');
  };

  const handleDeleted = (id) => {
    setVessels(prev => prev.filter(v => v.Vessel_id !== id));
    showToast('Đã xoá tàu.', 'warning');
  };

  const types = [...new Set(vessels.map(v => v.vessel_type).filter(Boolean))];

  const filtered = vessels.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || [v.Vessel_name, v.Vessel_id, v.IMO, v.MMSI, v.owner, v.vessel_type]
      .some(f => f?.toLowerCase().includes(q));
    const matchType = !filterType || v.vessel_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="page">
      <Head>
        <title>Quản lý Tàu | VMS Marine</title>
        <meta name="description" content="Quản lý thông tin đội tàu VMS Marine" />
      </Head>
      <div className="bg-glow g1"/><div className="bg-glow g2"/>

      {/* Header */}
      <header className="page-header">
        <div className="hl">
          <button className="back-btn" onClick={() => router.push('/')}>
            <ChevronLeft size={16}/> Về Dashboard
          </button>
          <div className="page-title">
            <Ship size={20} className="title-icon"/>
            <div>
              <h1>Quản lý Đội tàu</h1>
              <p>{vessels.length} tàu trong hệ thống</p>
            </div>
          </div>
        </div>
        <button className="add-btn" onClick={() => setShowAddModal(true)}>
          <Plus size={17}/> Thêm tàu
        </button>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={15} className="si"/>
          <input type="search" placeholder="Tìm theo tên, IMO, MMSI, chủ tàu..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="type-filter" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tất cả loại tàu</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Vessel Grid */}
      <div className="grid-area">
        {loading ? (
          <div className="center-state"><Loader2 size={36} className="spin"/><p>Đang tải...</p></div>
        ) : filtered.length === 0 ? (
          <div className="center-state">
            <Ship size={52}/>
            <p>{search || filterType ? 'Không tìm thấy tàu phù hợp' : 'Chưa có tàu nào trong hệ thống'}</p>
            {!search && !filterType && (
              <button className="add-btn" onClick={() => setShowAddModal(true)}><Plus size={15}/> Thêm tàu đầu tiên</button>
            )}
          </div>
        ) : (
          <div className="vessel-grid">
            {filtered.map((v, i) => (
              <div key={v.Vessel_id} className="vessel-card" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="card-img-wrap" onClick={() => setViewTarget(v)}>
                  {v.image_url
                    ? <img src={v.image_url} alt={v.Vessel_name} className="card-img"/>
                    : <div className="card-img-ph"><Ship size={36}/></div>}
                  <div className="card-img-overlay">
                    <Eye size={20}/>
                  </div>
                  {v.vessel_type && <div className="card-type-badge">{v.vessel_type}</div>}
                </div>
                <div className="card-body">
                  <div className="card-name">{v.Vessel_name}</div>
                  <div className="card-id">ID: {v.Vessel_id}</div>
                  <div className="card-meta">
                    {v.IMO && <span className="meta-pill">IMO: {v.IMO}</span>}
                    {v.flag && <span className="meta-pill flag">{FLAGS.find(f=>f.code===v.flag)?.name || v.flag}</span>}
                  </div>
                  {(v.length_m || v.gross_tonnage) && (
                    <div className="card-specs">
                      {v.length_m && <span><Ruler size={11}/> {v.length_m}m</span>}
                      {v.gross_tonnage && <span><Weight size={11}/> {Number(v.gross_tonnage).toLocaleString()} DWT</span>}
                      {v.year_built && <span><Calendar size={11}/> {v.year_built}</span>}
                    </div>
                  )}
                  {v.owner && <div className="card-owner"><User size={11}/> {v.owner}</div>}
                </div>
                <div className="card-actions">
                  <button className="ca-view" onClick={() => setViewTarget(v)}><Eye size={14}/> Xem</button>
                  <button className="ca-edit" onClick={() => setEditTarget(v)}><Edit2 size={14}/></button>
                  <button className="ca-del" onClick={() => setDeleteTarget(v)}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={15}/> : <AlertTriangle size={15}/>}
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {showAddModal && <VesselModal vessel={null} onClose={() => setShowAddModal(false)} onSaved={handleSaved}/>}
      {editTarget && <VesselModal vessel={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved}/>}
      {viewTarget && <VesselDetailModal vessel={viewTarget} onClose={() => setViewTarget(null)} onEdit={v => setEditTarget(v)}/>}
      {deleteTarget && <DeleteModal vessel={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted}/>}

      <style jsx>{`
        .page{min-height:100vh;background:#0f172a;color:white;font-family:inherit;position:relative;overflow-x:hidden;}
        .bg-glow{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;}
        .g1{top:-5%;left:-5%;width:480px;height:480px;background:rgba(6,182,212,0.07);}
        .g2{bottom:-5%;right:-5%;width:480px;height:480px;background:rgba(99,102,241,0.07);}
        .page-header{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 32px;background:rgba(15,23,42,0.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.08);}
        .hl{display:flex;align-items:center;gap:20px;}
        .back-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:9px;padding:7px 13px;cursor:pointer;font-size:0.83rem;transition:all 0.2s;}
        .back-btn:hover{background:rgba(255,255,255,0.1);color:white;}
        .page-title{display:flex;align-items:center;gap:11px;}
        .title-icon{color:#38bdf8;}
        .page-title h1{font-size:1.15rem;font-weight:700;margin:0;}
        .page-title p{font-size:0.76rem;color:#64748b;margin:0;}
        .add-btn{display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#0891b2,#0e7490);border:none;color:white;border-radius:11px;padding:9px 18px;cursor:pointer;font-size:0.88rem;font-weight:600;box-shadow:0 0 20px rgba(8,145,178,0.3);transition:all 0.2s;white-space:nowrap;}
        .add-btn:hover{background:linear-gradient(135deg,#06b6d4,#0891b2);transform:translateY(-1px);}
        .toolbar{display:flex;align-items:center;gap:12px;padding:18px 32px;position:relative;z-index:1;}
        .search-box{flex:1;max-width:400px;position:relative;}
        .si{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b;pointer-events:none;}
        .search-box input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;border-radius:11px;padding:9px 12px 9px 36px;font-size:0.88rem;outline:none;transition:border-color 0.2s;box-sizing:border-box;}
        .search-box input:focus{border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,0.1);}
        .type-filter{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#cbd5e1;border-radius:11px;padding:9px 14px;font-size:0.88rem;outline:none;cursor:pointer;}
        .type-filter option{background:#1e293b;}
        .grid-area{padding:0 32px 32px;position:relative;z-index:1;}
        .center-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;gap:14px;color:#64748b;}
        .vessel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;}
        .vessel-card{background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;transition:all 0.25s;animation:fadeIn 0.4s ease both;}
        .vessel-card:hover{border-color:rgba(56,189,248,0.3);transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.4);}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        .card-img-wrap{height:160px;overflow:hidden;cursor:pointer;position:relative;background:#0f172a;}
        .card-img{width:100%;height:100%;object-fit:cover;transition:transform 0.3s;}
        .vessel-card:hover .card-img{transform:scale(1.04);}
        .card-img-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#334155;}
        .card-img-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:white;opacity:0;transition:opacity 0.2s;}
        .card-img-wrap:hover .card-img-overlay{opacity:1;}
        .card-type-badge{position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;border-radius:6px;padding:2px 9px;font-size:0.68rem;font-weight:600;}
        .card-body{padding:14px 14px 10px;}
        .card-name{font-weight:700;font-size:1rem;color:#f1f5f9;margin-bottom:2px;}
        .card-id{font-size:0.72rem;color:#64748b;margin-bottom:8px;}
        .card-meta{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;}
        .meta-pill{background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.15);color:#7dd3fc;border-radius:6px;padding:1px 8px;font-size:0.68rem;}
        .meta-pill.flag{background:rgba(99,102,241,0.08);border-color:rgba(99,102,241,0.15);color:#a5b4fc;}
        .card-specs{display:flex;gap:10px;flex-wrap:wrap;font-size:0.72rem;color:#64748b;margin-bottom:6px;}
        .card-specs span{display:flex;align-items:center;gap:3px;}
        .card-owner{font-size:0.74rem;color:#64748b;display:flex;align-items:center;gap:4px;}
        .card-actions{display:flex;gap:6px;padding:0 14px 12px;}
        .ca-view{flex:1;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);color:#38bdf8;border-radius:8px;padding:7px 0;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;gap:5px;transition:all 0.2s;}
        .ca-view:hover{background:rgba(56,189,248,0.15);}
        .ca-edit{background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);color:#fbbf24;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;transition:all 0.2s;}
        .ca-edit:hover{background:rgba(251,191,36,0.15);}
        .ca-del{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#f87171;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;transition:all 0.2s;}
        .ca-del:hover{background:rgba(239,68,68,0.15);}
        .toast{position:fixed;bottom:28px;right:28px;z-index:99999;display:flex;align-items:center;gap:9px;padding:12px 18px;border-radius:11px;font-size:0.88rem;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:slideUp 0.3s ease;}
        .toast-success{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#34d399;}
        .toast-warning{background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        .spin{animation:spin 1s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>
    </div>
  );
}
