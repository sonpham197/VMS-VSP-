/**
 * components/maritime/ForecastChart.js
 * Canvas-based line chart for throughput forecast + confidence interval
 */
import { useEffect, useRef } from 'react';

export default function ForecastChart({ data = [], history = [], height = 260 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Merge history + forecast
    const histPoints = (history || []).slice(-14).map(d => ({
      date: d.kpi_date,
      value: d.throughput_tons,
      type: 'history',
    }));
    const fcstPoints = data.map(d => ({
      date: d.date,
      value: d.throughput_tons,
      low:  d.confidence_low,
      high: d.confidence_high,
      type: 'forecast',
    }));
    const allPoints = [...histPoints, ...fcstPoints];
    if (!allPoints.length) return;

    const PAD = { t: 20, r: 20, b: 40, l: 60 };
    const cW = W - PAD.l - PAD.r;
    const cH = H - PAD.t - PAD.b;

    const allVals = allPoints.flatMap(p => [p.value, p.low ?? p.value, p.high ?? p.value]).filter(Boolean);
    const minVal = Math.min(...allVals) * 0.9;
    const maxVal = Math.max(...allVals) * 1.05;
    const valRange = maxVal - minVal || 1;

    const xOf = (i) => PAD.l + (i / (allPoints.length - 1)) * cW;
    const yOf = (v) => PAD.t + cH - ((v - minVal) / valRange * cH);

    // ── Grid lines ──
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + (i / 4) * cH;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
      const val = Math.round(maxVal - (i/4) * valRange);
      ctx.fillStyle = '#475569';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${(val/1000).toFixed(0)}k`, PAD.l - 6, y + 4);
    }

    // ── Confidence band (forecast only) ──
    const fcstStart = histPoints.length;
    if (fcstPoints.length > 0) {
      ctx.beginPath();
      fcstPoints.forEach((p, i) => {
        const x = xOf(fcstStart + i);
        const y = yOf(p.high || p.value);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      [...fcstPoints].reverse().forEach((p, i) => {
        const x = xOf(fcstStart + fcstPoints.length - 1 - i);
        ctx.lineTo(x, yOf(p.low || p.value));
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(56,189,248,0.10)';
      ctx.fill();
    }

    // ── History line ──
    if (histPoints.length) {
      ctx.beginPath();
      histPoints.forEach((p, i) => {
        const x = xOf(i), y = yOf(p.value);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(148,163,184,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Forecast line ──
    if (fcstPoints.length) {
      ctx.beginPath();
      fcstPoints.forEach((p, i) => {
        const x = xOf(fcstStart + i), y = yOf(p.value);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      const grad = ctx.createLinearGradient(xOf(fcstStart), 0, xOf(allPoints.length - 1), 0);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#a78bfa');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Dots
      fcstPoints.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(xOf(fcstStart + i), yOf(p.value), 3, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      });
    }

    // ── Separator line (history | forecast) ──
    if (histPoints.length && fcstPoints.length) {
      const sepX = xOf(histPoints.length - 1);
      ctx.beginPath();
      ctx.moveTo(sepX, PAD.t);
      ctx.lineTo(sepX, H - PAD.b);
      ctx.strokeStyle = 'rgba(167,139,250,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Dự báo →', sepX + 30, PAD.t + 12);
    }

    // ── X-axis labels ──
    ctx.fillStyle = '#475569';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(allPoints.length / 8));
    allPoints.forEach((p, i) => {
      if (i % step === 0) {
        const label = p.date?.slice(5) || '';
        ctx.fillText(label, xOf(i), H - PAD.b + 14);
      }
    });

    // ── Legend ──
    ctx.font = '10px system-ui'; ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(148,163,184,0.7)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(PAD.l, H-8); ctx.lineTo(PAD.l+20, H-8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#64748b'; ctx.fillText('Lịch sử', PAD.l+24, H-5);
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(PAD.l+90, H-8); ctx.lineTo(PAD.l+110, H-8); ctx.stroke();
    ctx.fillStyle = '#38bdf8'; ctx.fillText('Dự báo AI', PAD.l+114, H-5);
  }, [data, history, height]);

  return (
    <div style={{ width:'100%', height }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>
    </div>
  );
}
