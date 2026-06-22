import ExcelJS from "exceljs";
import { drawChart } from "../components/TrendChart.jsx";
import { chunkSeries } from "./chunkSeries.js";
import { TYPE_SEUIL } from "../hooks/useComputedZones.js";

// ─────────────────────────────────────────────────────────────────────────
// Reproduit la structure du fichier de référence ("Tendance contrôle
// environnement suivi") avec les données réelles de l'application :
//   - "EB"                  : saisie hebdomadaire brute, SC/N2/NS par point,
//                             regroupée par Environnement (1-4) puis par
//                             Salle (2e segment de l'ID E.S.N).
//   - "EB & Salmo E1".."E4" : tableau + graphiques EB et Salmo par
//                             Environnement (5 courbes max par graphique).
//   - "Feuil1"              : synthèse hebdomadaire du taux de conformité.
//
// Choix actés avec l'utilisateur (juin 2026) :
//   - Regroupement par Environnement (1-4), comme les onglets exacts du
//     fichier de référence — pas par zone physique.
//   - Colonnes "Eau"/"Air" gardées à zéro (fidélité visuelle ; l'app ne fait
//     que des prélèvements de surface).
//   - La feuille "EB" brute est un vrai livrable à reproduire entièrement,
//     pas juste les feuilles graphiques — l'admin la complète ensuite à la
//     main (Type Prélèvement, N2) si besoin.
//   - Les points aléatoires n'ont jamais de courbe propre (cohérent avec la
//     règle déjà appliquée à l'écran, dans Word et dans le CSV).
// ─────────────────────────────────────────────────────────────────────────

const ENVIRONMENTS = ["1", "2", "3", "4"];
const WEEK_MS  = 7 * 24 * 60 * 60 * 1000;
const EB_CHART_W = 720, EB_CHART_H = 260, EB_CHART_ROW_SPAN = Math.ceil(EB_CHART_H / 20) + 2;
const SALMO_CHART_W = 720, SALMO_CHART_H = 180, SALMO_CHART_ROW_SPAN = Math.ceil(SALMO_CHART_H / 20) + 2;

function fmtDateFull(d) {
  const dd = new Date(d);
  return `${String(dd.getDate()).padStart(2, "0")}/${String(dd.getMonth() + 1).padStart(2, "0")}/${dd.getFullYear()}`;
}

// Les points aléatoires gardent la forme brute renvoyée par le backend
// (champ "series"), les points fixes sont déjà normalisés (champ "points").
function pointsOf(p) {
  return p.points || p.series || [];
}

function byPointId(a, b) {
  return String(a.pointId).localeCompare(String(b.pointId), undefined, { numeric: true });
}

// Salle = 2e segment d'un ID E.S.N (ex. "1.5.3" → 5). Purement dérivé de
// données réelles — jamais de libellé de salle inventé.
function parsePointRoom(pointId) {
  const m = String(pointId).match(/^\d+\.(\d+)\.\d+$/);
  return m ? Number(m[1]) : null;
}

const ufcMapper   = (p) => (p.ufc === null || p.ufc === undefined) ? null : p.ufc;
const salmoMapper = (p) => (p.salmonella === null || p.salmonella === undefined) ? null : (p.salmonella ? 1 : 0);

// ── Axe des semaines : ancré sur le relevé le plus ancien (max 52 semaines,
// cohérent avec la fenêtre de rétention de 365 jours) — partagé par toutes
// les feuilles du classeur pour que "Semaine N" désigne la même période
// partout.
function computeWeekAxis(allSeries) {
  const dates = allSeries
    .flatMap((s) => pointsOf(s).map((p) => new Date(p.date).getTime()))
    .filter((t) => !Number.isNaN(t));
  const now      = Date.now();
  const earliest = dates.length ? Math.min(...dates) : now;
  const anchor   = Math.min(earliest, now);
  const numWeeks = Math.min(52, Math.max(1, Math.ceil((now - anchor) / WEEK_MS) + 1));
  return {
    numWeeks,
    weekOf(date) {
      const idx = Math.floor((new Date(date).getTime() - anchor) / WEEK_MS) + 1;
      return Math.min(Math.max(idx, 1), numWeeks);
    },
  };
}

function weeklyValues(rawPoints, axis, mapper) {
  const arr    = new Array(axis.numWeeks).fill(null);
  const sorted = [...(rawPoints || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const p of sorted) {
    const v = mapper(p);
    if (v === null) continue;
    arr[axis.weekOf(p.date) - 1] = v;
  }
  return arr;
}

// ── Rendu hors-écran (canvas) ────────────────────────────────────────────
function renderPngDataUrl(width, height, drawFn) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left     = "-9999px";
  container.style.top      = "0";
  container.style.width    = `${width}px`;
  container.style.height   = `${height}px`;
  document.body.appendChild(container);
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  drawFn(canvas);
  const dataUrl = canvas.toDataURL("image/png");
  document.body.removeChild(container);
  return dataUrl;
}

// Même moteur de dessin que l'écran/Word — visuel cohérent partout.
function renderEbChartPng(chunk, seuil) {
  return renderPngDataUrl(EB_CHART_W, EB_CHART_H, (canvas) => drawChart(canvas, chunk, seuil));
}

// Présence/absence Salmonelles (0/1) — graphique dédié, plus simple que
// drawChart (pas de seuil, domaine Y fixe), mais même logique d'axe X par
// dates réelles et mêmes couleurs par point pour rester reconnaissable.
function drawPresenceChart(canvas, series) {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  const ctx = canvas.getContext("2d");
  const cw = canvas.width, ch = canvas.height;
  const pad = { top: 18, right: 16, bottom: 28, left: 74 };
  const W = cw - pad.left - pad.right;
  const H = ch - pad.top - pad.bottom;
  ctx.clearRect(0, 0, cw, ch);

  const allPoints = series.flatMap((s) => s.points || []);
  if (allPoints.length === 0) {
    ctx.fillStyle = "#9ca3af";
    ctx.font      = "12px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Aucune recherche de Salmonelles sur cette période", cw / 2, ch / 2);
    return;
  }

  const times     = allPoints.map((p) => new Date(p.date).getTime());
  const xMin      = Math.min(...times), xMax = Math.max(...times);
  const singleDate = xMax === xMin;
  const xPix = (t) => singleDate ? pad.left + W / 2 : pad.left + ((t - xMin) / (xMax - xMin)) * W;
  const yPix = (v) => pad.top + H * (1 - v);

  [0, 1].forEach((v) => {
    const y = yPix(v);
    ctx.strokeStyle = "#e4e7ec";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + W, y);
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.font      = "10px 'DM Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(v === 1 ? "Présence" : "Absence", pad.left - 6, y + 3);
  });

  if (!singleDate) {
    ctx.fillStyle = "#9ca3af";
    ctx.font      = "10px 'DM Mono', monospace";
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const t = xMin + (i / 4) * (xMax - xMin);
      ctx.fillText(fmtDateFull(t).slice(0, 5), xPix(t), pad.top + H + 18);
    }
  }

  series.forEach((s) => {
    const valid = (s.points || []).filter((p) => p.value === 0 || p.value === 1);
    if (!valid.length) return;
    const pix = valid.map((p) => ({ x: xPix(new Date(p.date).getTime()), y: yPix(p.value) }));
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
    });
  });
}

function renderPresenceChartPng(chunk) {
  const series = chunk.map((s) => ({
    pointId: s.pointId,
    color:   s.color,
    points: pointsOf(s)
      .filter((p) => p.salmonella !== null && p.salmonella !== undefined)
      .map((p) => ({ date: p.date, value: p.salmonella ? 1 : 0 })),
  }));
  return renderPngDataUrl(SALMO_CHART_W, SALMO_CHART_H, (canvas) => drawPresenceChart(canvas, series));
}

function embedImage(wb, ws, dataUrl, rowNumber1Based, colNumber0Based, width, height) {
  const imageId = wb.addImage({ base64: dataUrl, extension: "png" });
  ws.addImage(imageId, { tl: { col: colNumber0Based, row: rowNumber1Based - 1 }, ext: { width, height } });
}

function mergeAndLabel(ws, r1, c1, r2, c2, text) {
  if (r1 !== r2 || c1 !== c2) {
    ws.mergeCells(r1, c1, r2, c2);
  }
  const cell = ws.getCell(r1, c1);
  cell.value = text;
  cell.font  = { bold: true };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

// ── Feuille "EB" : saisie hebdomadaire brute SC/N2/NS ───────────────────
function writePointBlock(ws, col, point, axis) {
  mergeAndLabel(ws, 3, col, 3, col + 2, `${point.pointId} ${point.description || point.label || ""}`.trim());
  ["SC", "N2", "NS"].forEach((h, k) => {
    const cell = ws.getCell(4, col + k);
    cell.value = h;
    cell.font  = { bold: true };
  });

  const scValues = weeklyValues(pointsOf(point), axis, ufcMapper);
  for (let w = 1; w <= axis.numWeeks; w++) {
    const row    = 4 + w;
    const scCell = ws.getCell(row, col);
    const n2Cell = ws.getCell(row, col + 1);
    const nsCell = ws.getCell(row, col + 2);
    const v = scValues[w - 1];
    if (v !== null) scCell.value = v;
    // NS reste vide si SC n'a pas été mesuré cette semaine-là (au lieu
    // d'afficher 0, qui se confondrait avec "mesuré, zéro contamination").
    nsCell.value = {
      formula: `IF(${scCell.address}="","",((${scCell.address}/((2+(0.1*${n2Cell.address}))*0.1))*10)/100)`,
    };
  }
}

function buildEbSheet(wb, groups, axis) {
  const ws = wb.addWorksheet("EB");
  ws.getCell(4, 1).value = "Semaine";
  ws.getCell(4, 2).value = "Type Prélèvement";
  ws.getCell(4, 1).font  = ws.getCell(4, 2).font = { bold: true };

  let col = 3;
  for (const env of ENVIRONMENTS) {
    const { fixed, random } = groups[env];
    if (fixed.length === 0 && random.length === 0) continue;
    const envStartCol = col;

    let i = 0;
    while (i < fixed.length) {
      const room = parsePointRoom(fixed[i].pointId);
      let j = i + 1;
      while (j < fixed.length && parsePointRoom(fixed[j].pointId) === room) j++;
      const groupStartCol = col;
      for (let k = i; k < j; k++) {
        writePointBlock(ws, col, fixed[k], axis);
        col += 3;
      }
      if (room != null) mergeAndLabel(ws, 2, groupStartCol, 2, col - 1, `Salle ${room}`);
      i = j;
    }

    if (random.length > 0) {
      const groupStartCol = col;
      for (const r of random) {
        writePointBlock(ws, col, r, axis);
        col += 3;
      }
      mergeAndLabel(ws, 2, groupStartCol, 2, col - 1, "Points aléatoires");
    }

    mergeAndLabel(ws, 1, envStartCol, 1, col - 1, `Environnement ${env}`);
  }

  for (let w = 1; w <= axis.numWeeks; w++) {
    ws.getCell(4 + w, 1).value = w;
  }

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 4 }];
  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 16;
}

// ── Feuilles "EB & Salmo E{n}" : tableau + graphiques par Environnement ──
function buildEnvironmentSheet(wb, env, group, axis) {
  const ws    = wb.addWorksheet(`EB & Salmo E${env}`);
  const seuil = TYPE_SEUIL[env] ?? 50;
  const { fixed, random } = group;
  const allPts = [...fixed, ...random];

  let row = 1;
  ws.getCell(row, 1).value = `EB E${env}`;
  ws.getCell(row, 1).font  = { bold: true, size: 13 };
  row += 1;
  ws.getCell(row, 1).value = "Semaine";
  for (let w = 1; w <= axis.numWeeks; w++) ws.getCell(row, 1 + w).value = w;
  ws.getCell(row, 1).font = { bold: true };
  row += 1;

  for (const p of allPts) {
    ws.getCell(row, 1).value = `${p.pointId} ${p.description || p.label || ""}`.trim();
    weeklyValues(pointsOf(p), axis, ufcMapper).forEach((v, idx) => {
      if (v !== null) ws.getCell(row, 2 + idx).value = v;
    });
    row += 1;
  }
  ws.getCell(row, 1).value = "Target";
  ws.getCell(row, 1).font  = { italic: true };
  for (let w = 1; w <= axis.numWeeks; w++) ws.getCell(row, 1 + w).value = seuil;
  row += 2;

  // Points aléatoires mesurés sur la période — jamais de courbe propre,
  // cf. règle déjà appliquée partout ailleurs dans l'application.
  if (random.length > 0) {
    ws.getCell(row, 1).value = "Points aléatoires mesurés (jamais de courbe propre)";
    ws.getCell(row, 1).font  = { bold: true, italic: true };
    row += 1;
    for (const p of random) {
      const pts  = pointsOf(p);
      const last = pts[pts.length - 1];
      ws.getCell(row, 1).value = last
        ? `${p.pointId} — ${last.ufc ?? "—"} UFC/cm² le ${fmtDateFull(last.date)}`
        : `${p.pointId} — aucun relevé`;
      row += 1;
    }
    row += 1;
  }

  if (fixed.length > 0) {
    for (const chunk of chunkSeries(fixed, 5)) {
      const dataUrl = renderEbChartPng(chunk, seuil);
      embedImage(wb, ws, dataUrl, row, 0, EB_CHART_W, EB_CHART_H);
      row += EB_CHART_ROW_SPAN;
    }
  }
  row += 1;

  // ── Bloc Salmo (présence/absence) — même structure ──
  ws.getCell(row, 1).value = `Salmo E${env}`;
  ws.getCell(row, 1).font  = { bold: true, size: 13 };
  row += 1;
  ws.getCell(row, 1).value = "Semaine";
  ws.getCell(row, 1).font  = { bold: true };
  for (let w = 1; w <= axis.numWeeks; w++) ws.getCell(row, 1 + w).value = w;
  row += 1;

  for (const p of allPts) {
    ws.getCell(row, 1).value = `${p.pointId} ${p.description || p.label || ""}`.trim();
    weeklyValues(pointsOf(p), axis, salmoMapper).forEach((v, idx) => {
      if (v !== null) ws.getCell(row, 2 + idx).value = v;
    });
    row += 1;
  }
  row += 1;

  if (fixed.length > 0) {
    for (const chunk of chunkSeries(fixed, 5)) {
      const dataUrl = renderPresenceChartPng(chunk);
      embedImage(wb, ws, dataUrl, row, 0, SALMO_CHART_W, SALMO_CHART_H);
      row += SALMO_CHART_ROW_SPAN;
    }
  }

  ws.getColumn(1).width = 38;
  for (let w = 1; w <= axis.numWeeks; w++) ws.getColumn(1 + w).width = 7;
}

// ── Feuille "Feuil1" : synthèse hebdomadaire du taux de conformité ──────
// Colonnes Eau/Air gardées à zéro (fidélité visuelle au fichier de
// référence) — l'application ne fait que des prélèvements de surface.
function buildFeuil1(wb, allFixed, allRandom, axis) {
  const ws = wb.addWorksheet("Feuil1");
  const headers = ["Sem", "Nbre Analyse", "N pts Eau", "N pts Air", "Pts Conform Surf", "N Con Eau", "Conf Air", "Taux conformité"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(2, 7 + i);
    cell.value = h;
    cell.font  = { bold: true };
  });

  const allPts = [...allFixed, ...allRandom];
  const valuesByPoint = allPts.map((p) => ({
    seuil:  TYPE_SEUIL[p.pointType] ?? 50,
    values: weeklyValues(pointsOf(p), axis, ufcMapper),
  }));

  for (let w = 1; w <= axis.numWeeks; w++) {
    const row = 2 + w;
    let total = 0, conform = 0;
    for (const { seuil, values } of valuesByPoint) {
      const v = values[w - 1];
      if (v === null) continue;
      total++;
      if (v < seuil) conform++;
    }
    ws.getCell(row, 7).value  = w;          // Sem
    ws.getCell(row, 8).value  = total;      // Nbre Analyse (surface)
    ws.getCell(row, 9).value  = 0;          // N pts Eau
    ws.getCell(row, 10).value = 0;          // N pts Air
    ws.getCell(row, 11).value = conform;    // Pts Conform Surf
    ws.getCell(row, 12).value = 0;          // N Con Eau
    ws.getCell(row, 13).value = 0;          // Conf Air
    ws.getCell(row, 14).value = {
      formula: `IFERROR(SUM(K${row}:M${row})/SUM(H${row}:J${row}),"")`,
    };
    ws.getCell(row, 14).numFmt = "0%";
  }

  for (let c = 7; c <= 14; c++) ws.getColumn(c).width = 14;
}

// ── Point d'entrée — zonesData: [{ zone:{label}, series, randomPoints, seuil }] ──
export async function exportHistoryToXlsx(zonesData) {
  const allFixed  = zonesData.flatMap((z) => z.series).sort(byPointId);
  const allRandom = zonesData.flatMap((z) => z.randomPoints).sort(byPointId);
  const axis      = computeWeekAxis([...allFixed, ...allRandom]);

  const groups = {};
  for (const env of ENVIRONMENTS) {
    groups[env] = {
      fixed:  allFixed.filter((s) => String(s.pointType) === env),
      random: allRandom.filter((s) => String(s.pointType) === env),
    };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "InnoFaso";
  wb.created = new Date();

  buildEbSheet(wb, groups, axis);
  for (const env of ENVIRONMENTS) {
    if (groups[env].fixed.length === 0 && groups[env].random.length === 0) continue;
    buildEnvironmentSheet(wb, env, groups[env], axis);
  }
  buildFeuil1(wb, allFixed, allRandom, axis);

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  const today  = new Date();
  a.href     = url;
  a.download = `innofaso_tendance_controle_environnement_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
