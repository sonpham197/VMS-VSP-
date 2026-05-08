/**
 * soundAlarm.js
 * ──────────────────────────────────────────────────────────────────────────
 * Standalone Web Audio API alarm module cho VMS Collision Warning System.
 * Có thể dùng độc lập hoặc tham chiếu từ useCwaEngine.
 *
 * Sử dụng:
 *   import { SoundAlarm } from '@/lib/soundAlarm';
 *   const alarm = new SoundAlarm();
 *   alarm.playWarning();    // 3 beep ngắn
 *   alarm.playDanger();     // còi khẩn cấp liên tục
 *   alarm.stop();           // dừng tất cả
 * ──────────────────────────────────────────────────────────────────────────
 */

export class SoundAlarm {
  constructor() {
    this._ctx = null;
    this._activeSources = [];
  }

  /** Khởi tạo AudioContext (lazy – cần user gesture trước) */
  _getContext() {
    if (!this._ctx || this._ctx.state === 'closed') {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return this._ctx;
  }

  /**
   * Tạo 1 tiếng beep đơn.
   * @param {number} freq       - Tần số Hz
   * @param {number} startAt    - Thời điểm bắt đầu (giây từ ctx.currentTime)
   * @param {number} duration   - Độ dài (giây)
   * @param {number} volume     - Âm lượng 0–1
   * @param {'sine'|'square'|'triangle'} type
   */
  _beep(freq, startAt, duration, volume = 0.3, type = 'sine') {
    const ctx = this._getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);

    osc.start(ctx.currentTime + startAt);
    osc.stop(ctx.currentTime + startAt + duration + 0.05);
    this._activeSources.push(osc);
  }

  /**
   * Cảnh báo mức WARNING: 3 tiếng beep ngắn, tần số 880Hz.
   */
  playWarning() {
    if (typeof window === 'undefined') return;
    try {
      const gaps = [0, 0.28, 0.56];
      gaps.forEach(t => this._beep(880, t, 0.18, 0.28, 'sine'));
    } catch (e) {
      console.warn('[SoundAlarm] playWarning blocked:', e.message);
    }
  }

  /**
   * Báo động mức DANGER: còi xen kẽ 2 tần số (kiểu còi khẩn cấp – 2 giây).
   */
  playDanger() {
    if (typeof window === 'undefined') return;
    try {
      const stepDuration = 0.18;
      const totalSteps = 10;
      for (let i = 0; i < totalSteps; i++) {
        const freq = i % 2 === 0 ? 440 : 880;
        this._beep(freq, i * stepDuration, stepDuration, 0.25, 'square');
      }
    } catch (e) {
      console.warn('[SoundAlarm] playDanger blocked:', e.message);
    }
  }

  /**
   * Phát tiếng thông báo nhẹ mức INFO (1 beep ngắn cao).
   */
  playInfo() {
    if (typeof window === 'undefined') return;
    try {
      this._beep(1200, 0, 0.12, 0.15, 'sine');
    } catch (e) {
      console.warn('[SoundAlarm] playInfo blocked:', e.message);
    }
  }

  /**
   * Dừng tất cả âm thanh đang phát.
   */
  stop() {
    this._activeSources.forEach(src => {
      try { src.stop(); } catch { /* đã stop trước đó */ }
    });
    this._activeSources = [];
  }

  /**
   * Phát theo risk level.
   * @param {'danger'|'warning'|'info'} level
   */
  playByLevel(level) {
    switch (level) {
      case 'danger':  return this.playDanger();
      case 'warning': return this.playWarning();
      case 'info':    return this.playInfo();
    }
  }
}

/**
 * Singleton instance dùng chung toàn app.
 * Chỉ khởi tạo ở client-side.
 */
let _sharedAlarm = null;
export function getSharedAlarm() {
  if (typeof window === 'undefined') return null;
  if (!_sharedAlarm) _sharedAlarm = new SoundAlarm();
  return _sharedAlarm;
}
