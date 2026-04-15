import { useEffect, useState, useCallback } from 'react';
import {
  X, Wind, Thermometer, Droplets, Waves, Eye,
  Navigation, RefreshCw, AlertTriangle, Loader2, Cloud
} from 'lucide-react';

// ─── WMO Weather Code → Mô tả + Emoji ─────────────────────────────────────
const WMO_CODES = {
  0: { label: 'Trời quang', emoji: '☀️' },
  1: { label: 'Phần lớn quang', emoji: '🌤️' },
  2: { label: 'Có mây rải rác', emoji: '⛅' },
  3: { label: 'Nhiều mây', emoji: '☁️' },
  45: { label: 'Sương mù', emoji: '🌫️' },
  48: { label: 'Sương muối', emoji: '🌫️' },
  51: { label: 'Mưa phùn nhẹ', emoji: '🌦️' },
  53: { label: 'Mưa phùn vừa', emoji: '🌦️' },
  55: { label: 'Mưa phùn dày', emoji: '🌧️' },
  61: { label: 'Mưa nhỏ', emoji: '🌧️' },
  63: { label: 'Mưa vừa', emoji: '🌧️' },
  65: { label: 'Mưa to', emoji: '🌧️' },
  71: { label: 'Tuyết nhẹ', emoji: '🌨️' },
  73: { label: 'Tuyết vừa', emoji: '❄️' },
  75: { label: 'Tuyết dày', emoji: '❄️' },
  80: { label: 'Mưa rào nhẹ', emoji: '🌦️' },
  81: { label: 'Mưa rào vừa', emoji: '🌧️' },
  82: { label: 'Mưa rào mạnh', emoji: '⛈️' },
  95: { label: 'Dông bão', emoji: '⛈️' },
  96: { label: 'Dông có mưa đá', emoji: '⛈️' },
  99: { label: 'Dông mưa đá lớn', emoji: '🌩️' },
};

const getWeatherInfo = (code) => WMO_CODES[code] ?? { label: 'Không rõ', emoji: '❓' };

// Chuyển độ gió → tên hướng tiếng Việt
const degToDir = (deg) => {
  const dirs = ['Bắc', 'ĐB', 'Đông', 'ĐN', 'Nam', 'TN', 'Tây', 'TB'];
  return dirs[Math.round(deg / 45) % 8];
};

// Sức gió Beaufort
const getBeaufort = (ms) => {
  if (ms < 0.5) return { level: 0, label: 'Yên lặng' };
  if (ms < 1.6) return { level: 1, label: 'Gió rất nhẹ' };
  if (ms < 3.4) return { level: 2, label: 'Gió nhẹ' };
  if (ms < 5.5) return { level: 3, label: 'Gió vừa nhẹ' };
  if (ms < 8.0) return { level: 4, label: 'Gió vừa' };
  if (ms < 10.8) return { level: 5, label: 'Gió mạnh vừa' };
  if (ms < 13.9) return { level: 6, label: 'Gió mạnh' };
  if (ms < 17.2) return { level: 7, label: 'Gió rất mạnh' };
  if (ms < 20.8) return { level: 8, label: 'Gió bão nhỏ' };
  if (ms < 24.5) return { level: 9, label: 'Bão' };
  if (ms < 28.5) return { level: 10, label: 'Bão mạnh' };
  if (ms < 32.7) return { level: 11, label: 'Bão rất mạnh' };
  return { level: 12, label: 'Siêu bão' };
};

const getWaveLabel = (h) => {
  if (h < 0.1) return 'Sóng lặng';
  if (h < 0.5) return 'Sóng lăn tăn';
  if (h < 1.25) return 'Sóng nhẹ';
  if (h < 2.5) return 'Sóng vừa';
  if (h < 4.0) return 'Sóng khá cao';
  if (h < 6.0) return 'Sóng cao';
  return 'Sóng rất cao / nguy hiểm';
};

const getWaveColor = (h) => {
  if (h < 1.25) return '#34d399';
  if (h < 2.5) return '#fbbf24';
  if (h < 4.0) return '#f97316';
  return '#ef4444';
};

// ─── Main Component ────────────────────────────────────────────────────────
export default function WeatherPanel({ vessel, onClose }) {
  const [weather, setWeather] = useState(null);
  const [marine, setMarine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWeather = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { lat, lng } = vessel;
      const [atmRes, marineRes] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,` +
          `wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,` +
          `precipitation,visibility,pressure_msl&wind_speed_unit=ms&timezone=auto`
        ),
        fetch(
          `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
          `&current=wave_height,wave_direction,wave_period,wind_wave_height,` +
          `wind_wave_direction,swell_wave_height,swell_wave_direction,sea_surface_temperature`
        )
      ]);
      const atmData = await atmRes.json();
      const marineData = await marineRes.json();

      if (atmData.current) setWeather(atmData.current);
      else setError('Không lấy được dữ liệu khí tượng.');

      if (marineData.current) setMarine(marineData.current);
      // marine is optional — don't error if missing

      setLastUpdated(new Date());
    } catch (err) {
      setError('Lỗi kết nối API. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vessel]);

  useEffect(() => { fetchWeather(); }, [fetchWeather]);

  const beaufort = weather ? getBeaufort(weather.wind_speed_10m) : null;
  const weatherInfo = weather ? getWeatherInfo(weather.weather_code) : null;

  return (
    <div className="weather-panel">
      {/* Header */}
      <div className="wp-header">
        <div className="wp-title-row">
          <div className="wp-vessel-chip">
            <span className="wp-vessel-dot" />
            {vessel.Vessel_name}
          </div>
          <div className="wp-actions">
            <button
              className="wp-icon-btn"
              onClick={() => fetchWeather(true)}
              disabled={refreshing || loading}
              title="Làm mới"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            </button>
            <button className="wp-icon-btn wp-close" onClick={onClose} title="Đóng">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="wp-coords">
          📍 {vessel.lat?.toFixed(4)}°N, {vessel.lng?.toFixed(4)}°E
          {lastUpdated && (
            <span className="wp-updated">
              · Cập nhật {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="wp-body">
        {/* Loading */}
        {loading && (
          <div className="wp-loading">
            <Loader2 size={28} className="spin" />
            <span>Đang tải dữ liệu thời tiết...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="wp-error">
            <AlertTriangle size={20} />
            <span>{error}</span>
            <button onClick={() => fetchWeather()}>Thử lại</button>
          </div>
        )}

        {/* Weather Data */}
        {!loading && weather && (
          <>
            {/* Hero: Weather condition + Temperature */}
            <div className="wp-hero">
              <div className="wp-condition">
                <span className="wp-emoji">{weatherInfo.emoji}</span>
                <div>
                  <div className="wp-temp">{Math.round(weather.temperature_2m)}°C</div>
                  <div className="wp-feels">Cảm giác {Math.round(weather.apparent_temperature)}°C</div>
                </div>
              </div>
              <div className="wp-condition-label">{weatherInfo.label}</div>
            </div>

            {/* Atmosphere Grid */}
            <div className="wp-section-label">🌡 Khí tượng</div>
            <div className="wp-grid">
              <div className="wp-card">
                <Wind size={16} className="wp-card-icon wind-icon" />
                <div className="wp-card-value">{weather.wind_speed_10m?.toFixed(1)} m/s</div>
                <div className="wp-card-sub">
                  {degToDir(weather.wind_direction_10m)} · Cấp {beaufort.level}
                </div>
                <div className="wp-card-label">{beaufort.label}</div>
              </div>

              <div className="wp-card">
                <Wind size={16} className="wp-card-icon gust-icon" />
                <div className="wp-card-value">{weather.wind_gusts_10m?.toFixed(1)} m/s</div>
                <div className="wp-card-sub">Giật tối đa</div>
                <div className="wp-card-label">Gió giật</div>
              </div>

              <div className="wp-card">
                <Droplets size={16} className="wp-card-icon hum-icon" />
                <div className="wp-card-value">{weather.relative_humidity_2m}%</div>
                <div className="wp-card-sub">Áp suất {weather.pressure_msl?.toFixed(0)} hPa</div>
                <div className="wp-card-label">Độ ẩm</div>
              </div>

              <div className="wp-card">
                <Eye size={16} className="wp-card-icon vis-icon" />
                <div className="wp-card-value">
                  {weather.visibility >= 1000
                    ? `${(weather.visibility / 1000).toFixed(1)} km`
                    : `${weather.visibility} m`}
                </div>
                <div className="wp-card-sub">Mưa {weather.precipitation?.toFixed(1)} mm</div>
                <div className="wp-card-label">Tầm nhìn</div>
              </div>
            </div>

            {/* Wind direction indicator */}
            <div className="wp-wind-dir">
              <div
                className="wp-compass-arrow"
                style={{ transform: `rotate(${weather.wind_direction_10m}deg)` }}
              >
                <Navigation size={20} />
              </div>
              <span className="wp-wind-dir-label">
                Hướng gió: {weather.wind_direction_10m}° ({degToDir(weather.wind_direction_10m)})
              </span>
            </div>

            {/* Marine Data */}
            {marine && (
              <>
                <div className="wp-section-label" style={{ marginTop: 14 }}>🌊 Hải văn</div>
                <div className="wp-marine-hero">
                  <div className="wp-wave-main">
                    <Waves size={22} style={{ color: getWaveColor(marine.wave_height) }} />
                    <div>
                      <div
                        className="wp-wave-h"
                        style={{ color: getWaveColor(marine.wave_height) }}
                      >
                        {marine.wave_height?.toFixed(2)} m
                      </div>
                      <div className="wp-wave-label">{getWaveLabel(marine.wave_height)}</div>
                    </div>
                  </div>
                  {marine.sea_surface_temperature != null && (
                    <div className="wp-sea-temp">
                      <Thermometer size={14} />
                      <span>Nhiệt độ biển: <strong>{marine.sea_surface_temperature?.toFixed(1)}°C</strong></span>
                    </div>
                  )}
                </div>
                <div className="wp-grid wp-grid-3">
                  <div className="wp-card wp-card-sm">
                    <div className="wp-card-value sm">{marine.wave_period?.toFixed(1)}s</div>
                    <div className="wp-card-sub">{degToDir(marine.wave_direction)}</div>
                    <div className="wp-card-label">Chu kỳ sóng</div>
                  </div>
                  <div className="wp-card wp-card-sm">
                    <div className="wp-card-value sm">{marine.wind_wave_height?.toFixed(2)} m</div>
                    <div className="wp-card-sub">{degToDir(marine.wind_wave_direction)}</div>
                    <div className="wp-card-label">Sóng gió</div>
                  </div>
                  {marine.swell_wave_height != null && (
                    <div className="wp-card wp-card-sm">
                      <div className="wp-card-value sm">{marine.swell_wave_height?.toFixed(2)} m</div>
                      <div className="wp-card-sub">{degToDir(marine.swell_wave_direction)}</div>
                      <div className="wp-card-label">Sóng lừng</div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Footer */}
            <div className="wp-footer">
              Nguồn: Open-Meteo · Marine-API
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .weather-panel {
          position: fixed;
          top: 80px;
          right: 340px;
          width: 320px;
          max-height: calc(100vh - 100px);
          overflow-y: auto;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 18px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
          z-index: 1200;
          color: white;
          font-family: inherit;
          animation: panelIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          scrollbar-width: thin;
          scrollbar-color: rgba(56,189,248,0.3) transparent;
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .wp-header {
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: linear-gradient(135deg, rgba(56,189,248,0.08), rgba(99,102,241,0.08));
        }
        .wp-title-row {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
        }
        .wp-vessel-chip {
          display: flex; align-items: center; gap: 7px;
          font-weight: 700; font-size: 0.95rem; color: #f1f5f9;
        }
        .wp-vessel-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #34d399; box-shadow: 0 0 6px #34d399;
          animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        .wp-actions { display: flex; gap: 6px; }
        .wp-icon-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8; border-radius: 7px;
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .wp-icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: white; }
        .wp-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .wp-close:hover { background: rgba(239,68,68,0.15) !important; color: #f87171 !important; border-color: rgba(239,68,68,0.3) !important; }
        .wp-coords {
          font-size: 0.73rem; color: #64748b;
        }
        .wp-updated { color: #38bdf8; }
        .wp-body { padding: 14px 16px 16px; }
        .wp-loading {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 32px 0; color: #64748b; font-size: 0.85rem;
        }
        .wp-error {
          display: flex; flex-direction: column; align-items: center;
          gap: 8px; padding: 20px 0; color: #f87171; font-size: 0.85rem; text-align: center;
        }
        .wp-error button {
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
          color: #f87171; border-radius: 8px; padding: 6px 16px; cursor: pointer;
          font-size: 0.8rem; transition: all 0.2s;
        }
        .wp-error button:hover { background: rgba(239,68,68,0.2); }
        /* Hero */
        .wp-hero {
          display: flex; flex-direction: column; align-items: center;
          padding: 12px 0 10px;
        }
        .wp-condition { display: flex; align-items: center; gap: 16px; margin-bottom: 4px; }
        .wp-emoji { font-size: 2.8rem; line-height: 1; }
        .wp-temp { font-size: 2.2rem; font-weight: 800; color: #f1f5f9; line-height: 1; }
        .wp-feels { font-size: 0.78rem; color: #64748b; margin-top: 3px; }
        .wp-condition-label { font-size: 0.88rem; color: #94a3b8; }
        /* Section label */
        .wp-section-label {
          font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px;
        }
        /* Grid */
        .wp-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;
        }
        .wp-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
        .wp-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 10px 12px;
          display: flex; flex-direction: column; gap: 2px;
          transition: background 0.2s;
        }
        .wp-card:hover { background: rgba(255,255,255,0.07); }
        .wp-card-sm { padding: 8px 10px; }
        .wp-card-icon { margin-bottom: 4px; }
        .wind-icon { color: #38bdf8; }
        .gust-icon { color: #a78bfa; }
        .hum-icon { color: #34d399; }
        .vis-icon { color: #fbbf24; }
        .wp-card-value { font-size: 1.05rem; font-weight: 700; color: #f1f5f9; }
        .wp-card-value.sm { font-size: 0.95rem; }
        .wp-card-sub { font-size: 0.72rem; color: #64748b; }
        .wp-card-label { font-size: 0.7rem; color: #475569; margin-top: 1px; }
        /* Wind direction */
        .wp-wind-dir {
          display: flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 8px 12px; margin-bottom: 2px;
        }
        .wp-compass-arrow {
          color: #38bdf8; transition: transform 0.5s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .wp-wind-dir-label { font-size: 0.8rem; color: #94a3b8; }
        /* Marine hero */
        .wp-marine-hero {
          background: rgba(56,189,248,0.05);
          border: 1px solid rgba(56,189,248,0.12);
          border-radius: 12px; padding: 12px 14px;
          margin-bottom: 8px;
        }
        .wp-wave-main { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .wp-wave-h { font-size: 1.6rem; font-weight: 800; line-height: 1; }
        .wp-wave-label { font-size: 0.78rem; color: #94a3b8; margin-top: 3px; }
        .wp-sea-temp {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.78rem; color: #64748b;
        }
        .wp-sea-temp strong { color: #f97316; }
        /* Footer */
        .wp-footer {
          margin-top: 12px; text-align: center;
          font-size: 0.65rem; color: #334155;
        }
        /* Spin */
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
