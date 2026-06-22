import { useRef, useEffect, useCallback, useState } from "react";

function fmtDateShort(d) {
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtDateFull(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ─────────────────────────────────────────────
// DRAW FUNCTION (pure canvas) — une courbe par point (couleur = identité du
// point), axe X proportionnel aux dates réelles, ligne de seuil pointillée,
// et repère d'alerte sur les dates où une salmonelle a été détectée.
// Renvoie la liste des points dessinés (position pixel + données) pour
// permettre le survol/info-bulle sans recalcul côté React.
// ─────────────────────────────────────────────
export function drawChart(canvas, series, seuil) {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext("2d");
  const cw = canvas.width, ch = canvas.height;

  const pad = { top: 18, right: 16, bottom: 28, left: 40 };
  const W = cw - pad.left - pad.right;
  const H = ch - pad.top - pad.bottom;

  ctx.clearRect(0, 0, cw, ch);

  const allPoints = (series || []).flatMap(s => s.points || []);
  if (allPoints.length === 0) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Aucune donnée pour cette sélection", cw / 2, ch / 2);
    return [];
  }

  const allUfc = allPoints.map(p => p.ufc).filter(v => v !== null && v !== undefined);
  const maxVal = Math.max(...allUfc, seuil ?? 0, 10);
  const minVal = Math.min(...allUfc, 0);

  const times = allPoints.map(p => new Date(p.date).getTime());
  const xMin = Math.min(...times);
  const xMax = Math.max(...times);
  const singleDate = xMax === xMin;

  const xPix = (t) => singleDate ? pad.left + W / 2 : pad.left + ((t - xMin) / (xMax - xMin)) * W;
  const yPix = (v) => maxVal > minVal ? pad.top + H * (1 - (v - minVal) / (maxVal - minVal)) : pad.top + H / 2;

  // Grid + Y axis labels
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    const y = pad.top + H * (1 - t);
    ctx.strokeStyle = "#e4e7ec";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + W, y);
    ctx.stroke();
    ctx.fillStyle = "#9ca3af";
    ctx.font      = "10px 'DM Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(Math.round(minVal + (maxVal - minVal) * t), pad.left - 6, y + 4);
  });

  // X axis labels
  ctx.fillStyle = "#9ca3af";
  ctx.font      = "10px 'DM Mono', monospace";
  ctx.textAlign = "center";
  if (singleDate) {
    ctx.fillText(fmtDateShort(new Date(xMin)), pad.left + W / 2, pad.top + H + 18);
  } else {
    for (let i = 0; i <= 4; i++) {
      const t = xMin + (i / 4) * (xMax - xMin);
      ctx.fillText(fmtDateShort(new Date(t)), xPix(t), pad.top + H + 18);
    }
  }

  // Threshold line (seuil dynamique de la zone)
  if (seuil != null && seuil >= minVal && seuil <= maxVal) {
    const ty = yPix(seuil);
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

  const hitPoints = [];

  (series || []).forEach((s) => {
    const valid = (s.points || []).filter(p => p.ufc !== null && p.ufc !== undefined);
    if (valid.length === 0) return;
    const pix = valid.map(p => ({ x: xPix(new Date(p.date).getTime()), y: yPix(p.ufc), src: p }));

    if (pix.length > 1) {
      ctx.beginPath();
      pix.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = s.color;
      ctx.lineWidth   = 2;
      ctx.lineJoin    = "round";
      ctx.stroke();
    }

    pix.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.lineWidth   = 1.5;
      ctx.strokeStyle = "#fff";
      ctx.stroke();

      // Repère salmonelle : icône d'alerte au-dessus du point sur la courbe EB
      if (p.src.salmonella === true) {
        ctx.beginPath();
        ctx.arc(p.x, p.y - 12, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#bf3b2e";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font      = "bold 9px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", p.x, p.y - 9);
      }

      // Repère Cronobacter : même principe, décalé pour ne pas chevaucher le
      // repère salmonelle si les deux sont détectés sur le même relevé.
      if (p.src.cronobacter === true) {
        ctx.beginPath();
        ctx.arc(p.x + 10, p.y - 12, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#7c3aed";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font      = "bold 9px 'DM Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", p.x + 10, p.y - 9);
      }

      hitPoints.push({
        x: p.x, y: p.y,
        pointId: s.pointId, label: s.label, description: s.description, color: s.color,
        ufc: p.src.ufc, date: p.src.date, salmonella: p.src.salmonella, cronobacter: p.src.cronobacter,
      });
    });
  });

  return hitPoints;
}

// ─────────────────────────────────────────────
// TREND CHART COMPONENT — series: [{ pointId, label, color, points: [{date, ufc, salmonella}] }]
// ─────────────────────────────────────────────
export default function TrendChart({ series, seuil }) {
  const canvasRef    = useRef(null);
  const wrapRef       = useRef(null);
  const hitPointsRef  = useRef([]);
  const [hover, setHover] = useState(null);

  const redraw = useCallback(() => {
    if (canvasRef.current) {
      hitPointsRef.current = drawChart(canvasRef.current, series, seuil);
    }
  }, [series, seuil]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const ro = new ResizeObserver(redraw);
    if (canvasRef.current) ro.observe(canvasRef.current.parentElement);
    return () => ro.disconnect();
  }, [redraw]);

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = null, bestDist = 169; // rayon de capture ~13px
    for (const hp of hitPointsRef.current) {
      const d = (hp.x - mx) ** 2 + (hp.y - my) ** 2;
      if (d < bestDist) { bestDist = d; best = hp; }
    }
    setHover(best);
  };

  const wrapWidth = wrapRef.current?.clientWidth || 320;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor: hover ? "pointer" : "default" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(hover.x, 72), wrapWidth - 72),
            top: Math.max(hover.y - 14, 0),
            transform: "translate(-50%, -100%)",
            background: "rgba(0,0,0,0.82)",
            color: "#fff",
            borderRadius: 3,
            padding: "6px 9px",
            fontSize: 11,
            fontFamily: "'DM Sans', sans-serif",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 50,
            boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: hover.color, display: "inline-block", flexShrink: 0 }} />
            {hover.label || hover.pointId}
          </div>
          {hover.description && (
            <div style={{ color: "#cbd5e1", marginTop: 2, whiteSpace: "normal", maxWidth: 220 }}>
              {hover.description}
            </div>
          )}
          <div style={{ color: "#60a5fa", marginTop: 2 }}>{fmtDateFull(new Date(hover.date))}</div>
          <div style={{ color: "#fbbf24" }}>{hover.ufc} UFC/cm²</div>
          {hover.salmonella === true && (
            <div style={{ color: "#ff8a7a", fontWeight: 700, marginTop: 2 }}>⚠ Salmonelles détectées</div>
          )}
          {hover.cronobacter === true && (
            <div style={{ color: "#c4b5fd", fontWeight: 700, marginTop: 2 }}>⚠ Cronobacter détecté</div>
          )}
        </div>
      )}
    </div>
  );
}
