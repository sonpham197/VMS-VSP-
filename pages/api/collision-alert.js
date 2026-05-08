/**
 * pages/api/collision-alert.js
 * ──────────────────────────────────────────────────────────────────────────
 * API endpoint ghi Collision Risk vào bảng alerts của Supabase.
 * Chỉ ghi khi severity = 'danger' để tránh spam database.
 *
 * POST /api/collision-alert
 * Body: { vesselIdA, vesselIdB, cpa_nm, tcpa_min, severity, description }
 * ──────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vesselIdA, vesselIdB, cpa_nm, tcpa_min, severity, description } = req.body;

  // Validation
  if (!vesselIdA || !vesselIdB) {
    return res.status(400).json({ error: 'vesselIdA và vesselIdB là bắt buộc' });
  }
  if (!['danger', 'warning', 'info'].includes(severity)) {
    return res.status(400).json({ error: 'severity phải là danger | warning | info' });
  }
  // Chỉ persist khi danger để tránh spam
  if (severity !== 'danger') {
    return res.status(200).json({ success: true, persisted: false, reason: 'Chỉ lưu khi danger' });
  }

  try {
    // Sắp xếp ID theo alphabet để tạo composite key nhất quán (A-B = B-A)
    const [idA, idB] = [vesselIdA, vesselIdB].sort();
    const compositeKey = `COLLISION:${idA}__${idB}`;

    // Tìm xem đã có alert OPEN cho cặp này chưa → tránh duplicate
    const { data: existing } = await supabase
      .from('alerts')
      .select('id, event_count')
      .eq('alert_type', 'collision_risk')
      .eq('vessel_id', idA)
      .eq('vessel_id_b', idB)
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      // Cập nhật alert hiện tại: tăng event_count và cập nhật CPA mới nhất
      const { error } = await supabase
        .from('alerts')
        .update({
          event_count: (existing[0].event_count || 1) + 1,
          cpa_nm: parseFloat(cpa_nm?.toFixed(3)),
          tcpa_min: parseFloat(tcpa_min?.toFixed(1)),
          description: description || `Va chạm tiềm ẩn: CPA ${cpa_nm?.toFixed(2)} NM, TCPA ${Math.round(tcpa_min)} phút`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id);

      if (error) throw error;
      return res.status(200).json({ success: true, action: 'updated', id: existing[0].id });
    }

    // Tạo alert mới
    const { data: newAlert, error: insertError } = await supabase
      .from('alerts')
      .insert({
        vessel_id: idA,
        vessel_id_b: idB,
        alert_type: 'collision_risk',
        severity,
        status: 'open',
        event_count: 1,
        cpa_nm: parseFloat(cpa_nm?.toFixed(3)),
        tcpa_min: parseFloat(tcpa_min?.toFixed(1)),
        description: description || `Va chạm tiềm ẩn: CPA ${cpa_nm?.toFixed(2)} NM, TCPA ${Math.round(tcpa_min)} phút`,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return res.status(201).json({ success: true, action: 'created', alert: newAlert });

  } catch (err) {
    console.error('[collision-alert API]', err);
    return res.status(500).json({ error: err.message });
  }
}
