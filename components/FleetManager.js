import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Check, Ship, Hash, Palette } from 'lucide-react';

export default function FleetManager({ onClose, vessels, onFleetsChange }) {
  const [fleets, setFleets] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#38bdf8');
  const [selectedVessels, setSelectedVessels] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('vms_fleets');
    if (saved) {
      try {
        setFleets(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveFleets = (newFleets) => {
    setFleets(newFleets);
    localStorage.setItem('vms_fleets', JSON.stringify(newFleets));
    if (onFleetsChange) onFleetsChange(newFleets);
  };

  const handleAddFleet = () => {
    const newFleet = {
      id: 'fleet_' + Date.now(),
      name: 'Nhóm tàu mới',
      color: '#38bdf8',
      vessels: []
    };
    saveFleets([...fleets, newFleet]);
    startEdit(newFleet);
  };

  const startEdit = (fleet) => {
    setEditingId(fleet.id);
    setEditName(fleet.name);
    setEditColor(fleet.color || '#38bdf8');
    setSelectedVessels([...(fleet.vessels || [])]);
  };

  const saveEdit = () => {
    const newFleets = fleets.map(f => {
      if (f.id === editingId) {
        return { ...f, name: editName, color: editColor, vessels: selectedVessels };
      }
      return f;
    });
    saveFleets(newFleets);
    setEditingId(null);
  };

  const deleteFleet = (id) => {
    if (confirm('Bạn có chắc muốn xoá nhóm tàu này?')) {
      saveFleets(fleets.filter(f => f.id !== id));
      if (editingId === id) setEditingId(null);
    }
  };

  const toggleVessel = (vesselId) => {
    if (selectedVessels.includes(vesselId)) {
      setSelectedVessels(selectedVessels.filter(id => id !== vesselId));
    } else {
      setSelectedVessels([...selectedVessels, vesselId]);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>Quản lý Nhóm tàu (Fleets)</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="fleet-sidebar">
            <div className="fs-header">
              <h3>Danh sách Nhóm</h3>
              <button className="add-btn" onClick={handleAddFleet}><Plus size={14} /> Thêm mới</button>
            </div>
            <div className="fleet-list">
              {fleets.length === 0 ? (
                <div className="empty-msg">Chưa có nhóm tàu nào.</div>
              ) : (
                fleets.map(f => (
                  <div key={f.id} className={`fleet-item ${editingId === f.id ? 'active' : ''}`} onClick={() => startEdit(f)}>
                    <div className="fi-color" style={{ backgroundColor: f.color || '#38bdf8' }}></div>
                    <div className="fi-info">
                      <div className="fi-name">{f.name}</div>
                      <div className="fi-count">{f.vessels?.length || 0} tàu</div>
                    </div>
                    <div className="fi-actions">
                      <button onClick={(e) => { e.stopPropagation(); deleteFleet(f.id); }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="fleet-editor">
            {editingId ? (
              <div className="editor-content">
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Tên nhóm tàu</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label><Palette size={14} /> Màu sắc</label>
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="color-picker" />
                  </div>
                </div>

                <div className="vessel-selector">
                  <h4>Chọn tàu vào nhóm ({selectedVessels.length})</h4>
                  <div className="vessel-list">
                    {vessels.map(v => (
                      <label key={v.Vessel_id} className={`vessel-item ${selectedVessels.includes(v.Vessel_id) ? 'selected' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={selectedVessels.includes(v.Vessel_id)} 
                          onChange={() => toggleVessel(v.Vessel_id)}
                          hidden
                        />
                        <div className="vi-check">
                          {selectedVessels.includes(v.Vessel_id) && <Check size={12} />}
                        </div>
                        <div className="vi-info">
                          <span className="vi-name">{v.Vessel_name}</span>
                          <span className="vi-id"><Hash size={10} /> {v.Vessel_id}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="editor-actions">
                  <button className="btn-save" onClick={saveEdit}>Lưu thay đổi</button>
                </div>
              </div>
            ) : (
              <div className="editor-empty">
                <Ship size={40} className="ee-icon" />
                <p>Chọn một nhóm tàu để chỉnh sửa hoặc tạo mới.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px; }
        .modal-box { background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:16px; width:100%; max-width:800px; height:600px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.6); }
        .modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.08); }
        .modal-header h2 { font-size:1.1rem; font-weight:700; color:white; margin:0; }
        .icon-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; border-radius:8px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; }
        .icon-btn:hover { background:rgba(239,68,68,0.2); color:#f87171; }
        
        .modal-body { display:flex; flex:1; overflow:hidden; }
        
        .fleet-sidebar { width:260px; background:rgba(0,0,0,0.15); border-right:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; }
        .fs-header { padding:14px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); }
        .fs-header h3 { font-size:0.85rem; color:#cbd5e1; margin:0; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
        .add-btn { display:flex; align-items:center; gap:4px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.2); color:#38bdf8; border-radius:6px; padding:4px 8px; font-size:0.75rem; cursor:pointer; transition:all 0.2s; }
        .add-btn:hover { background:rgba(56,189,248,0.2); }
        
        .fleet-list { flex:1; overflow-y:auto; padding:8px; }
        .empty-msg { padding:20px; text-align:center; color:#64748b; font-size:0.85rem; }
        .fleet-item { display:flex; align-items:center; padding:10px; border-radius:8px; cursor:pointer; transition:all 0.2s; border:1px solid transparent; margin-bottom:4px; }
        .fleet-item:hover { background:rgba(255,255,255,0.03); }
        .fleet-item.active { background:rgba(56,189,248,0.1); border-color:rgba(56,189,248,0.2); }
        .fi-color { width:12px; height:12px; border-radius:50%; margin-right:12px; flex-shrink:0; box-shadow:0 0 8px currentColor; }
        .fi-info { flex:1; min-width:0; }
        .fi-name { font-size:0.88rem; color:#f1f5f9; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .fi-count { font-size:0.75rem; color:#94a3b8; margin-top:2px; }
        .fi-actions button { background:none; border:none; color:#64748b; cursor:pointer; padding:4px; border-radius:4px; transition:all 0.2s; opacity:0; }
        .fleet-item:hover .fi-actions button { opacity:1; }
        .fi-actions button:hover { color:#ef4444; background:rgba(239,68,68,0.1); }
        
        .fleet-editor { flex:1; display:flex; flex-direction:column; background:#0f172a; }
        .editor-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#475569; }
        .ee-icon { margin-bottom:12px; opacity:0.5; }
        
        .editor-content { flex:1; display:flex; flex-direction:column; padding:20px; overflow:hidden; }
        .form-row { display:flex; gap:16px; margin-bottom:20px; }
        .form-group { display:flex; flex-direction:column; gap:6px; }
        .flex-1 { flex:1; }
        .form-group label { font-size:0.75rem; color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:6px; }
        .form-group input[type="text"] { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; border-radius:8px; padding:10px 12px; font-size:0.9rem; outline:none; transition:all 0.2s; }
        .form-group input[type="text"]:focus { border-color:#38bdf8; background:rgba(0,0,0,0.2); }
        .color-picker { width:40px; height:40px; padding:0; border:none; border-radius:8px; overflow:hidden; cursor:pointer; background:none; }
        .color-picker::-webkit-color-swatch-wrapper { padding:0; }
        .color-picker::-webkit-color-swatch { border:none; border-radius:8px; }
        
        .vessel-selector { flex:1; display:flex; flex-direction:column; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; overflow:hidden; }
        .vessel-selector h4 { margin:0; padding:12px 16px; font-size:0.85rem; color:#e2e8f0; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.05); }
        .vessel-list { flex:1; overflow-y:auto; padding:12px; display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; align-content:start; }
        
        .vessel-item { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:10px 12px; border-radius:8px; cursor:pointer; transition:all 0.2s; }
        .vessel-item:hover { background:rgba(255,255,255,0.08); }
        .vessel-item.selected { background:rgba(56,189,248,0.1); border-color:rgba(56,189,248,0.3); }
        
        .vi-check { width:18px; height:18px; border-radius:4px; border:1px solid #64748b; display:flex; align-items:center; justify-content:center; color:white; transition:all 0.2s; }
        .vessel-item.selected .vi-check { background:#38bdf8; border-color:#38bdf8; }
        
        .vi-info { display:flex; flex-direction:column; gap:2px; }
        .vi-name { font-size:0.85rem; color:#f1f5f9; font-weight:600; }
        .vi-id { font-size:0.65rem; color:#64748b; display:flex; align-items:center; gap:3px; }
        
        .editor-actions { padding-top:20px; display:flex; justify-content:flex-end; }
        .btn-save { background:linear-gradient(135deg,#0891b2,#0e7490); border:none; color:white; border-radius:8px; padding:10px 24px; font-weight:600; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 12px rgba(8,145,178,0.2); }
        .btn-save:hover { background:linear-gradient(135deg,#06b6d4,#0891b2); transform:translateY(-1px); }
      `}</style>
    </div>
  );
}
