/**
 * useCwaEngine.js
 * ───────────────────────────────────────────────────────────────────────────
 * React hook tích hợp Collision Warning Engine vào lifecycle ứng dụng VMS.
 *
 * Sử dụng:
 *   const { collisionRisks, acknowledgeRisk, muteState, toggleMute } =
 *     useCwaEngine(vessels);
 * ───────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { detectCollisionRisks } from '@/lib/collisionWarning';

/**
 * Thời gian debounce giữa các lần chạy engine (ms).
 * Phù hợp với polling interval 10s của ứng dụng.
 */
const ENGINE_DEBOUNCE_MS = 5000;

/**
 * Thời gian tự động xóa risk đã được acknowledge khỏi danh sách (ms).
 */
const ACK_EXPIRE_MS = 5 * 60 * 1000; // 5 phút

/**
 * @typedef {object} CwaEngineResult
 * @property {Array}    collisionRisks      - Danh sách nguy cơ va chạm hiện tại
 * @property {Set}      acknowledgedIds     - Set các ID đã được acknowledge
 * @property {Function} acknowledgeRisk     - Hàm xác nhận đã xử lý 1 risk
 * @property {Function} acknowledgeAll      - Hàm xác nhận tất cả risks
 * @property {boolean}  isMuted             - Trạng thái tắt âm thanh
 * @property {Function} toggleMute          - Bật/tắt âm thanh
 * @property {number}   dangerCount         - Số cặp ở mức 'danger'
 * @property {number}   warningCount        - Số cặp ở mức 'warning'
 * @property {number}   totalActiveCount    - Tổng số nguy cơ chưa xác nhận
 */

/**
 * Hook tính toán và quản lý trạng thái cảnh báo va chạm.
 *
 * @param {Array} vessels - Danh sách tàu (từ filteredVessels trong index.js)
 * @returns {CwaEngineResult}
 */
export function useCwaEngine(vessels) {
  const [collisionRisks, setCollisionRisks] = useState([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());
  const [isMuted, setIsMuted] = useState(() => {
    // Đọc preference từ localStorage
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('vms_cwa_muted') === 'true';
  });

  // Ref lưu danh sách risk trước để so sánh (phát hiện risk MỚI)
  const prevRisksRef = useRef(new Map()); // Map<id, risk_level>
  // Ref lưu timer debounce
  const debounceTimer = useRef(null);
  // Ref lưu timer xóa acknowledgement
  const ackTimers = useRef(new Map()); // Map<id, timeoutId>

  // ── Chạy Engine ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!vessels || vessels.length < 2) {
      setCollisionRisks([]);
      return;
    }

    // Debounce: tránh chạy lại quá nhiều lần khi vessels thay đổi liên tục
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      const newRisks = detectCollisionRisks(vessels);
      const newRisksMap = new Map(newRisks.map((r) => [r.id, r]));

      // ── Phát hiện risk MỚI để trigger notification ──
      const brandNewRisks = newRisks.filter((r) => {
        const prevLevel = prevRisksRef.current.get(r.id);
        // Là risk mới nếu: chưa tồn tại trước đó, HOẶC leo thang mức severity
        if (!prevLevel) return true;
        const order = { info: 0, warning: 1, danger: 2 };
        return (order[r.risk_level] ?? -1) > (order[prevLevel] ?? -1);
      });

      // Cập nhật state
      setCollisionRisks(newRisks);

      // Xóa acknowledge của risk không còn tồn tại
      setAcknowledgedIds((prev) => {
        const next = new Set(prev);
        for (const id of prev) {
          if (!newRisksMap.has(id)) next.delete(id);
        }
        return next;
      });

      // Trigger side effects cho risk mới
      if (brandNewRisks.length > 0) {
        triggerNotifications(brandNewRisks, isMuted);
        // Persist DANGER risks vào DB (để AlertDrawer & CollisionHistoryPanel hiển thị)
        persistDangerRisks(brandNewRisks);
      }

      // Lưu trạng thái hiện tại làm "previous" cho lần sau
      prevRisksRef.current = new Map(newRisks.map((r) => [r.id, r.risk_level]));
    }, ENGINE_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [vessels, isMuted]);

  // ── Acknowledge Risk ─────────────────────────────────────────────────────

  const acknowledgeRisk = useCallback((riskId) => {
    setAcknowledgedIds((prev) => new Set(prev).add(riskId));

    // Tự động xóa acknowledgement sau ACK_EXPIRE_MS
    // (để risk có thể cảnh báo lại nếu vẫn còn nguy hiểm)
    if (ackTimers.current.has(riskId)) {
      clearTimeout(ackTimers.current.get(riskId));
    }
    const timer = setTimeout(() => {
      setAcknowledgedIds((prev) => {
        const next = new Set(prev);
        next.delete(riskId);
        return next;
      });
      ackTimers.current.delete(riskId);
    }, ACK_EXPIRE_MS);
    ackTimers.current.set(riskId, timer);
  }, []);

  const acknowledgeAll = useCallback(() => {
    const allIds = new Set(collisionRisks.map((r) => r.id));
    setAcknowledgedIds(allIds);
  }, [collisionRisks]);

  // ── Mute Control ─────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('vms_cwa_muted', String(next));
      }
      return next;
    });
  }, []);

  // Cleanup timers khi unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      for (const t of ackTimers.current.values()) clearTimeout(t);
    };
  }, []);

  // ── Derived State ────────────────────────────────────────────────────────

  const activeRisks = collisionRisks.filter((r) => !acknowledgedIds.has(r.id));
  const dangerCount = activeRisks.filter((r) => r.risk_level === 'danger').length;
  const warningCount = activeRisks.filter((r) => r.risk_level === 'warning').length;
  const totalActiveCount = activeRisks.length;

  return {
    collisionRisks,       // Tất cả risks (kể cả đã ack)
    activeRisks,          // Chỉ risks chưa ack
    acknowledgedIds,
    acknowledgeRisk,
    acknowledgeAll,
    isMuted,
    toggleMute,
    dangerCount,
    warningCount,
    totalActiveCount,
  };
}

// ─── Side Effects: Notification & Sound ──────────────────────────────────────

/**
 * Kích hoạt các thông báo cho danh sách risk mới.
 * Được gọi từ bên trong hook khi phát hiện risk mới hoặc leo thang.
 *
 * @param {Array}   newRisks  - Danh sách risk mới
 * @param {boolean} isMuted   - Trạng thái tắt âm thanh
 */
/**
 * Ghi các DANGER risk mới vào DB thông qua API.
 * Fire-and-forget: không block UI, lỗi chỉ log console.
 * @param {Array} newRisks
 */
async function persistDangerRisks(newRisks) {
  const dangerRisks = newRisks.filter((r) => r.risk_level === 'danger');
  for (const risk of dangerRisks) {
    try {
      const nameA = risk.vesselA.Vessel_name || risk.vesselA.Vessel_id;
      const nameB = risk.vesselB.Vessel_name || risk.vesselB.Vessel_id;
      await fetch('/api/collision-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vesselIdA: risk.vesselA.Vessel_id,
          vesselIdB: risk.vesselB.Vessel_id,
          cpa_nm:    risk.cpa_nm,
          tcpa_min:  risk.tcpa_min,
          severity:  'danger',
          description: `Va chạm tiềm ẩn: ${nameA} ↔ ${nameB} | CPA ${risk.cpa_nm.toFixed(2)} NM, TCPA ${Math.round(risk.tcpa_min)} phút`,
        }),
      });
    } catch (err) {
      console.warn('[CWA] Không thể persist risk vào DB:', err);
    }
  }
}

function triggerNotifications(newRisks, isMuted) {
  const hasDanger  = newRisks.some((r) => r.risk_level === 'danger');
  const hasWarning = newRisks.some((r) => r.risk_level === 'warning');

  // ── 1. Âm thanh (Web Audio API) ──
  if (!isMuted && typeof window !== 'undefined') {
    try {
      if (hasDanger) {
        playDangerBeep();
      } else if (hasWarning) {
        playWarningBeep();
      }
    } catch {
      // AudioContext bị block bởi trình duyệt nếu chưa có user gesture → bỏ qua
    }
  }

  // ── 2. Browser Notification ──
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      newRisks.forEach((risk) => {
        const icon = hasDanger ? '🚨' : '⚠️';
        const nameA = risk.vesselA.Vessel_name || risk.vesselA.Vessel_id;
        const nameB = risk.vesselB.Vessel_name || risk.vesselB.Vessel_id;

        new Notification(`${icon} VMS – Nguy cơ va chạm`, {
          body:
            `${nameA} ↔ ${nameB}\n` +
            `CPA: ${risk.cpa_nm.toFixed(2)} NM | TCPA: ${Math.round(risk.tcpa_min)} phút`,
          icon: '/favicon.ico',
          // tag: đảm bảo cùng 1 cặp không spam nhiều notification
          tag: `cwa-${risk.id}`,
          renotify: true,
        });
      });
    } else if (Notification.permission === 'default') {
      // Chưa hỏi quyền → hỏi lần đầu (sau khi đã có user interaction)
      Notification.requestPermission().catch(() => {});
    }
  }
}

// ─── Web Audio API: Beep Generator ───────────────────────────────────────────

/**
 * Phát âm thanh cảnh báo mức WARNING (3 tiếng beep ngắn).
 */
function playWarningBeep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const frequencies = [880, 880, 880];
  const gaps = [0, 0.25, 0.5]; // giây

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime + gaps[i]);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + gaps[i] + 0.18);

    osc.start(ctx.currentTime + gaps[i]);
    osc.stop(ctx.currentTime + gaps[i] + 0.18);
  });

  // Đóng AudioContext sau khi hoàn thành
  setTimeout(() => ctx.close(), 1500);
}

/**
 * Phát âm thanh báo động mức DANGER (còi xen kẽ 2 tần số – kiểu còi khẩn cấp).
 */
function playDangerBeep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const duration = 2.0; // giây
  const stepDuration = 0.2;
  const steps = Math.floor(duration / stepDuration);

  for (let i = 0; i < steps; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.value = i % 2 === 0 ? 440 : 880; // Xen kẽ 440Hz / 880Hz
    gain.gain.setValueAtTime(0.25, ctx.currentTime + i * stepDuration);
    gain.gain.setValueAtTime(0.001, ctx.currentTime + (i + 0.9) * stepDuration);

    osc.start(ctx.currentTime + i * stepDuration);
    osc.stop(ctx.currentTime + (i + 1) * stepDuration);
  }

  setTimeout(() => ctx.close(), (duration + 0.5) * 1000);
}
