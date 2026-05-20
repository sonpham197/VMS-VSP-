import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import {
  Users, Plus, Search, Edit2, Trash2, X, Save,
  Upload, Mail, Phone, Lock, User, LogOut, ChevronLeft,
  AlertTriangle, CheckCircle, Loader2, Eye, EyeOff, Camera
} from 'lucide-react';

// ─── Helper: upload ảnh lên Supabase Storage ─────────────────────────────────
async function uploadAvatar(file) {
  const ext = file.name.split('.').pop();
  const fileName = `avatar_${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ─── Modal Component ─────────────────────────────────────────────────────────
function CustomerModal({ customer, onClose, onSaved }) {
  const isEdit = !!customer?.id;
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    pasword: '',
    avatar_url: customer?.avatar_url || '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(customer?.avatar_url || null);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Chỉ chấp nhận file ảnh.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Kích thước ảnh tối đa 5MB.'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let avatarUrl = form.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        avatar_url: avatarUrl,
      };
      if (!isEdit || form.pasword) {
        payload.pasword = form.pasword;
      }
      let result;
      if (isEdit) {
        result = await supabase.from('Customer').update(payload).eq('id', customer.id).select().single();
      } else {
        if (!form.pasword) throw new Error('Vui lòng nhập mật khẩu.');
        result = await supabase.from('Customer').insert(payload).select().single();
      }
      if (result.error) throw result.error;
      onSaved(result.data, isEdit);
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>{isEdit ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Avatar Upload */}
          <div className="avatar-upload-area">
            <div className="avatar-preview" onClick={() => fileRef.current.click()}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" />
              ) : (
                <div className="avatar-placeholder">
                  <Camera size={28} />
                  <span>Tải ảnh lên</span>
                </div>
              )}
              <div className="avatar-overlay"><Upload size={20} /></div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
            <p className="avatar-hint">Nhấp vào ảnh để thay đổi (tối đa 5MB)</p>
          </div>

          {error && (
            <div className="form-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label><User size={14} /> Tên đầy đủ *</label>
              <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Nguyễn Văn A" />
            </div>
            <div className="form-group">
              <label><Mail size={14} /> Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="example@email.com" />
            </div>
            <div className="form-group">
              <label><Phone size={14} /> Số điện thoại</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="0901 234 567" />
            </div>
            <div className="form-group">
              <label><Lock size={14} /> {isEdit ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}</label>
              <div className="input-with-icon">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.pasword}
                  onChange={e => setForm(f => ({...f, pasword: e.target.value}))}
                  placeholder="••••••••"
                  required={!isEdit}
                />
                <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={16} className="spin" /> Đang lưu...</> : <><Save size={16} /> {isEdit ? 'Cập nhật' : 'Tạo mới'}</>}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .modal-box {
          background: #1e293b; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; width: 100%; max-width: 560px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.6); overflow: hidden;
        }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 0; color: white;
        }
        .modal-header h2 { font-size: 1.2rem; font-weight: 700; }
        .icon-btn {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; border-radius: 8px; padding: 6px; cursor: pointer;
          transition: all 0.2s;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.1); color: white; }
        .modal-form { padding: 20px 24px 24px; }
        .avatar-upload-area { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 20px; }
        .avatar-preview {
          width: 100px; height: 100px; border-radius: 50%; overflow: hidden; cursor: pointer;
          position: relative; background: rgba(255,255,255,0.05);
          border: 2px dashed rgba(56,189,248,0.4); transition: all 0.3s;
        }
        .avatar-preview:hover { border-color: #38bdf8; }
        .avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 6px; color: #64748b; font-size: 0.7rem; }
        .avatar-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center; color: white; opacity: 0; transition: opacity 0.2s;
        }
        .avatar-preview:hover .avatar-overlay { opacity: 1; }
        .avatar-hint { font-size: 0.72rem; color: #64748b; }
        .form-error {
          display: flex; align-items: center; gap: 8px; background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 8px;
          padding: 10px 14px; font-size: 0.85rem; margin-bottom: 16px;
        }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label {
          display: flex; align-items: center; gap: 6px; font-size: 0.8rem;
          color: #94a3b8; font-weight: 500;
        }
        .form-group input {
          background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
          color: white; border-radius: 10px; padding: 10px 12px; font-size: 0.9rem;
          width: 100%; transition: border-color 0.2s; outline: none; box-sizing: border-box;
        }
        .form-group input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.1); }
        .input-with-icon { position: relative; }
        .input-with-icon input { padding-right: 40px; }
        .pwd-toggle {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #64748b; cursor: pointer; padding: 4px;
        }
        .pwd-toggle:hover { color: #94a3b8; }
        .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
        .btn-secondary {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; border-radius: 10px; padding: 10px 20px; cursor: pointer;
          font-size: 0.9rem; transition: all 0.2s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); color: white; }
        .btn-primary {
          background: linear-gradient(135deg, #0891b2, #0e7490); border: none;
          color: white; border-radius: 10px; padding: 10px 24px; cursor: pointer;
          font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 8px;
          transition: all 0.2s; box-shadow: 0 0 20px rgba(8,145,178,0.3);
        }
        .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #06b6d4, #0891b2); transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────
function DeleteModal({ customer, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const handleDelete = async () => {
    setLoading(true);
    await supabase.from('Customer').delete().eq('id', customer.id);
    onDeleted(customer.id);
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="del-box">
        <div className="del-icon"><Trash2 size={28} /></div>
        <h3>Xoá khách hàng?</h3>
        <p>Bạn có chắc muốn xoá <strong>{customer.name}</strong>? Hành động này không thể hoàn tác.</p>
        <div className="del-actions">
          <button className="btn-cancel" onClick={onClose}>Huỷ</button>
          <button className="btn-del" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
            {loading ? 'Đang xoá...' : 'Xoá'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .modal-overlay { position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px; }
        .del-box { background:#1e293b;border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.6); }
        .del-icon { width:64px;height:64px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#f87171; }
        .del-box h3 { color:white;font-size:1.2rem;font-weight:700;margin:0 0 8px; }
        .del-box p { color:#94a3b8;font-size:0.9rem;margin:0 0 24px;line-height:1.5; }
        .del-box strong { color:#f8fafc; }
        .del-actions { display:flex;gap:12px;justify-content:center; }
        .btn-cancel { background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:10px;padding:10px 24px;cursor:pointer;font-size:0.9rem;transition:all 0.2s; }
        .btn-cancel:hover { background:rgba(255,255,255,0.1);color:white; }
        .btn-del { background:linear-gradient(135deg,#dc2626,#b91c1c);border:none;color:white;border-radius:10px;padding:10px 24px;cursor:pointer;font-size:0.9rem;font-weight:600;display:flex;align-items:center;gap:8px;transition:all 0.2s; }
        .btn-del:hover:not(:disabled) { background:linear-gradient(135deg,#ef4444,#dc2626);transform:translateY(-1px); }
        .btn-del:disabled { opacity:0.6;cursor:not-allowed; }
        .spin { animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Toast helper
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('vms_session');
    if (session) {
      Promise.resolve().then(() => {
        setCurrentUser(JSON.parse(session));
      });
    }
  }, []);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('Customer').select('*').order('id', { ascending: false });
    if (error) console.error(error);
    else setCustomers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (isMounted) {
        await fetchCustomers();
      }
    }
    init();
    return () => { isMounted = false; };
  }, [fetchCustomers]);

  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setCustomers(prev => prev.map(c => c.id === saved.id ? saved : c));
      showToast('Cập nhật khách hàng thành công!');
    } else {
      setCustomers(prev => [saved, ...prev]);
      showToast('Thêm khách hàng mới thành công!');
    }
  };

  const handleDeleted = (id) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    showToast('Đã xoá khách hàng.', 'error');
  };

  const handleLogout = () => {
    localStorage.removeItem('vms_session');
    router.push('/login');
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <Head>
        <title>Quản lý Khách hàng | VMS Marine</title>
        <meta name="description" content="Trang quản lý thông tin khách hàng VMS Marine" />
      </Head>

      {/* Background decoration */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />

      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => router.push('/')}>
            <ChevronLeft size={18} /> Về Dashboard
          </button>
          <div className="page-title">
            <Users size={22} className="title-icon" />
            <div>
              <h1>Quản lý Khách hàng</h1>
              <p>{customers.length} tài khoản trong hệ thống</p>
            </div>
          </div>
        </div>
        <div className="header-right">
          {currentUser && (
            <div className="user-chip">
              <div className="user-avatar-mini">
                {currentUser.avatar_url
                  ? <img src={currentUser.avatar_url} alt="" />
                  : currentUser.name?.charAt(0).toUpperCase()}
              </div>
              <span>{currentUser.name}</span>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            placeholder="Tìm theo tên, email, số điện thoại..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="add-btn" onClick={() => { setEditTarget(null); setShowModal(true); }}>
          <Plus size={18} /> Thêm khách hàng
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading-state">
            <Loader2 size={36} className="spin" />
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>{search ? 'Không tìm thấy kết quả' : 'Chưa có khách hàng nào'}</p>
            {!search && <button className="add-btn" onClick={() => { setEditTarget(null); setShowModal(true); }}><Plus size={16} /> Thêm ngay</button>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>ID</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id} style={{ animationDelay: `${idx * 40}ms` }}>
                  <td>
                    <div className="customer-cell">
                      <div className="customer-avatar">
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt={c.name} />
                          : <span>{c.name?.charAt(0)?.toUpperCase() || '?'}</span>}
                      </div>
                      <div>
                        <div className="customer-name">{c.name}</div>
                        <div className="customer-badge">Khách hàng</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="cell-text">{c.email || <span className="empty-cell">—</span>}</span></td>
                  <td><span className="cell-text">{c.phone || <span className="empty-cell">—</span>}</span></td>
                  <td><span className="id-badge">#{c.id}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="action-edit" title="Chỉnh sửa" onClick={() => { setEditTarget(c); setShowModal(true); }}>
                        <Edit2 size={15} />
                      </button>
                      <button className="action-del" title="Xoá" onClick={() => setDeleteTarget(c)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <CustomerModal
          customer={editTarget}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          customer={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #0f172a;
          color: white;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        .bg-glow {
          position: fixed; border-radius: 50%;
          filter: blur(120px); pointer-events: none; z-index: 0;
        }
        .bg-glow-1 { top: -10%; left: -5%; width: 500px; height: 500px; background: rgba(6,182,212,0.08); }
        .bg-glow-2 { bottom: -10%; right: -5%; width: 500px; height: 500px; background: rgba(99,102,241,0.08); }
        .page-header {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 32px;
          background: rgba(15,23,42,0.9); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .header-right { display: flex; align-items: center; gap: 12px; }
        .back-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; border-radius: 10px; padding: 8px 14px; cursor: pointer;
          font-size: 0.85rem; transition: all 0.2s;
        }
        .back-btn:hover { background: rgba(255,255,255,0.1); color: white; }
        .page-title { display: flex; align-items: center; gap: 12px; }
        .title-icon { color: #38bdf8; }
        .page-title h1 { font-size: 1.2rem; font-weight: 700; margin: 0; }
        .page-title p { font-size: 0.78rem; color: #64748b; margin: 0; }
        .user-chip {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 6px 12px; font-size: 0.85rem; color: #cbd5e1;
        }
        .user-avatar-mini {
          width: 26px; height: 26px; border-radius: 50%;
          background: linear-gradient(135deg, #0891b2, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 700; overflow: hidden;
        }
        .user-avatar-mini img { width: 100%; height: 100%; object-fit: cover; }
        .logout-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          color: #f87171; border-radius: 10px; padding: 8px 14px; cursor: pointer;
          font-size: 0.85rem; transition: all 0.2s;
        }
        .logout-btn:hover { background: rgba(239,68,68,0.2); color: #fca5a5; }
        .toolbar {
          display: flex; align-items: center; gap: 16px;
          padding: 20px 32px;
          position: relative; z-index: 1;
        }
        .search-box {
          flex: 1; position: relative; max-width: 420px;
        }
        .search-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #64748b; pointer-events: none;
        }
        .search-box input {
          width: 100%; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); color: white;
          border-radius: 12px; padding: 11px 14px 11px 40px;
          font-size: 0.9rem; outline: none; transition: all 0.2s;
          box-sizing: border-box;
        }
        .search-box input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.1); }
        .add-btn {
          display: flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #0891b2, #0e7490); border: none;
          color: white; border-radius: 12px; padding: 11px 20px;
          cursor: pointer; font-size: 0.9rem; font-weight: 600;
          box-shadow: 0 0 20px rgba(8,145,178,0.3); transition: all 0.2s; white-space: nowrap;
        }
        .add-btn:hover { background: linear-gradient(135deg, #06b6d4, #0891b2); transform: translateY(-1px); box-shadow: 0 4px 24px rgba(8,145,178,0.4); }
        .table-wrapper {
          margin: 0 32px 32px; border-radius: 16px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(30,41,59,0.6); backdrop-filter: blur(8px);
          position: relative; z-index: 1;
        }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table thead tr {
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .data-table th {
          padding: 14px 20px; text-align: left;
          font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.06em; color: #64748b;
        }
        .data-table tbody tr {
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.15s;
          animation: fadeSlideIn 0.4s ease both;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .data-table tbody tr:last-child { border-bottom: none; }
        .data-table tbody tr:hover { background: rgba(255,255,255,0.03); }
        .data-table td { padding: 14px 20px; vertical-align: middle; }
        .customer-cell { display: flex; align-items: center; gap: 12px; }
        .customer-avatar {
          width: 42px; height: 42px; border-radius: 12px; overflow: hidden; flex-shrink: 0;
          background: linear-gradient(135deg, #0891b2, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; font-weight: 700; color: white;
        }
        .customer-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .customer-name { font-weight: 600; font-size: 0.95rem; color: #f1f5f9; }
        .customer-badge {
          display: inline-block; background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.2); color: #38bdf8;
          border-radius: 6px; padding: 1px 8px; font-size: 0.7rem; font-weight: 500; margin-top: 3px;
        }
        .cell-text { color: #cbd5e1; font-size: 0.9rem; }
        .empty-cell { color: #475569; }
        .id-badge {
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          color: #a5b4fc; border-radius: 8px; padding: 3px 10px; font-size: 0.8rem; font-weight: 600;
        }
        .action-btns { display: flex; gap: 8px; }
        .action-edit, .action-del {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px; cursor: pointer; border: none; transition: all 0.2s;
        }
        .action-edit { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .action-edit:hover { background: rgba(56,189,248,0.2); transform: scale(1.1); }
        .action-del { background: rgba(239,68,68,0.1); color: #f87171; }
        .action-del:hover { background: rgba(239,68,68,0.2); transform: scale(1.1); }
        .loading-state, .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 80px 20px; gap: 16px; color: #64748b;
        }
        .empty-state p { font-size: 1rem; }
        .toast {
          position: fixed; bottom: 32px; right: 32px; z-index: 99999;
          display: flex; align-items: center; gap: 10px;
          padding: 14px 20px; border-radius: 12px; font-size: 0.9rem; font-weight: 500;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4); animation: slideUp 0.3s ease;
        }
        .toast-success { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; }
        .toast-error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
