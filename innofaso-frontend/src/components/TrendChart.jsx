import { useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// BUILD DATASET FROM TAB SELECTION
// ─────────────────────────────────────────────
function buildDataset(history, tab) {
  const count = history.length;
  const now   = new Date();

  // Génère une label de date à partir d'aujourd'hui - daysAgo jours
  const dateLabel = (daysAgo) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  if (tab === "7j") {
    const labels = Array.from({ length: count }, (_, i) =>
      dateLabel(count - 1 - i)
    );
    return { labels, data: history };
  }

  // 30j / 90j : on espace les points réels sur la plage demandée
  // Pas de données inventées — on affiche ce qu'on a réellement
  const span = tab === "30j" ? 30 : 90;
  const step = count > 1 ? Math.floor(span / (count - 1)) : span;

  const labels = Array.from({ length: count }, (_, i) =>
    dateLabel(span - i * step)
  );

  return { labels, data: history };
}

// ─────────────────────────────────────────────
// DRAW FUNCTION (pure canvas)
// ─────────────────────────────────────────────
function drawChart(canvas, history, tab, seuil = 50) {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;

  const ctx = canvas.getContext("2d");
  const { labels, data } = buildDataset(history, tab);

  const maxVal = Math.max(...data, 65);
  const minVal = Math.min(...data, 0);
  const pad    = { top: 18, right: 16, bottom: 28, left: 40 };
  const W      = canvas.width  - pad.left - pad.right;
  const H      = canvas.height - pad.top  - pad.bottom;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines + Y axis labels
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    const y = pad.top + H * (1 - t);
    ctx.strokeStyle = "#e4e7ec";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + W, y);
    ctx.stroke();
    ctx.fillStyle  = "#9ca3af";
    ctx.font       = "10px 'DM Mono', monospace";
    ctx.textAlign  = "right";
    ctx.fillText(Math.round(minVal + (maxVal - minVal) * t), pad.left - 6, y + 4);
  });

  // Threshold line (seuil dynamique de la zone)
  if (seuil >= minVal && seuil <= maxVal) {
    const ty = pad.top + H * (1 - (seuil - minVal) / (maxVal - minVal));
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#bf3b2e";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, ty);
    ctx.lineTo(pad.left + W, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#bf3b2e";
    ctx.font      = "10px 'DM Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Seuil ${seuil}`, pad.left + 4, ty - 5);
  }

  // Data points
  const pts = data.map((v, i) => ({
    x: pad.left + (i / (data.length - 1)) * W,
    y: pad.top  + H * (1 - (v - minVal) / (maxVal - minVal)),
  }));

  // Gradient area fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + H);
  grad.addColorStop(0, "rgba(26,111,163,0.13)");
  grad.addColorStop(1, "rgba(26,111,163,0)");
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.top + H);
  pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, pad.top + H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
  );
  ctx.strokeStyle = "#1a6fa3";
  ctx.lineWidth   = 2;
  ctx.lineJoin    = "round";
  ctx.stroke();

  // Dots + X axis labels (sampled every ~8 points)
  const step = Math.ceil(data.length / 8);
  pts.forEach((p, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = data[i] >= (seuil ?? 50) ? "#bf3b2e" : "#1a6fa3";
    ctx.fill();

    ctx.fillStyle = "#9ca3af";
    ctx.font      = "10px 'DM Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], p.x, pad.top + H + 18);
  });
}

// ─────────────────────────────────────────────
// TREND CHART COMPONENT
// ─────────────────────────────────────────────
export default function TrendChart({ history, tab, seuil }) {
  const canvasRef = useRef(null);

  const redraw = useCallback(() => {
    if (canvasRef.current) drawChart(canvasRef.current, history, tab, seuil);
  }, [history, tab, seuil]);

  // Redraw when data/tab changes
  useEffect(() => {
    redraw();
  }, [redraw]);

  // Redraw on resize
  useEffect(() => {
    const ro = new ResizeObserver(redraw);
    if (canvasRef.current) ro.observe(canvasRef.current.parentElement);
    return () => ro.disconnect();
  }, [redraw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
