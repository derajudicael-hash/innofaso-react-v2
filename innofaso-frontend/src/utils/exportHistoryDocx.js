import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, ImageRun,
} from "docx";
import { drawChart } from "../components/TrendChart.jsx";
import { chunkSeries } from "./chunkSeries.js";

const CHART_W = 680;
const CHART_H = 280;

function dataUrlToUint8Array(dataUrl) {
  const base64  = dataUrl.split(",")[1];
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function fmtDateFull(d) {
  const dd = new Date(d);
  return `${String(dd.getDate()).padStart(2, "0")}/${String(dd.getMonth() + 1).padStart(2, "0")}/${dd.getFullYear()}`;
}

// Rendu hors-écran de la courbe d'une zone, réutilisant le même moteur de
// dessin que le graphique affiché à l'écran (TrendChart.drawChart) — le
// graphique exporté est donc visuellement identique à celui vu par l'admin.
function renderChartPng(series, seuil) {
  const container = document.createElement("div");
  container.style.position   = "fixed";
  container.style.left       = "-9999px";
  container.style.top        = "0";
  container.style.width      = `${CHART_W}px`;
  container.style.height     = `${CHART_H}px`;
  document.body.appendChild(container);
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  drawChart(canvas, series, seuil);
  const dataUrl = canvas.toDataURL("image/png");
  document.body.removeChild(container);
  return dataUrl;
}

function statsOf(series) {
  const values = series.flatMap(s => (s.points || []).map(p => p.ufc)).filter(v => v !== null && v !== undefined);
  if (!values.length) return null;
  return {
    avg:   Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    max:   Math.max(...values),
    min:   Math.min(...values),
    count: values.length,
  };
}

function legendTable(series) {
  const rows = series.map(s => new TableRow({
    children: [
      new TableCell({
        width:   { size: 8, type: WidthType.PERCENTAGE },
        shading: { fill: s.color.replace("#", "") },
        children: [new Paragraph("")],
      }),
      new TableCell({
        width: { size: 92, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [
            new TextRun({ text: s.pointId, bold: true }),
            new TextRun({ text: "  " + (s.label || ""), color: "555555" }),
          ],
        })],
      }),
    ],
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function randomPointsParagraphs(randomPoints) {
  if (!randomPoints.length) {
    return [new Paragraph({
      children: [new TextRun({ text: "Aucun point aléatoire mesuré sur cette période.", italics: true, color: "888888" })],
    })];
  }
  return randomPoints.map(rp => {
    const last     = rp.series[rp.series.length - 1];
    const hasSalmo = rp.series.some(s => s.salmonella === true);
    const hasCrono = rp.series.some(s => s.cronobacter === true);
    return new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${rp.pointId} `, bold: true }),
        new TextRun({ text: `(${rp.label || "point aléatoire"}) — ` }),
        new TextRun({ text: last ? `${last.ufc} UFC/cm² le ${fmtDateFull(last.date)}` : "aucun relevé" }),
        ...(hasSalmo ? [new TextRun({ text: "   ⚠ Salmonelles détectées", bold: true, color: "BF3B2E" })] : []),
        ...(hasCrono ? [new TextRun({ text: "   ⚠ Cronobacter détecté", bold: true, color: "7C3AED" })] : []),
      ],
    });
  });
}

// zonesData: [{ zone: { label, seuil }, series, randomPoints }]
export async function exportHistoryToDocx(zonesData) {
  const today = new Date();
  const children = [
    new Paragraph({ text: "Historique des contrôles microbiologiques — InnoFaso", heading: HeadingLevel.TITLE }),
    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun({
        text: `Exporté le ${fmtDateFull(today)} — fenêtre glissante de rétention (les relevés plus anciens sont automatiquement retirés de l'historique en direct ; voir le bandeau de rappel pour l'échéance exacte).`,
        italics: true, color: "666666",
      })],
    }),
  ];

  for (const { zone, series, randomPoints, seuil } of zonesData) {
    children.push(new Paragraph({ text: zone.label, heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 } }));

    if (series.length === 0 && randomPoints.length === 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "Aucune donnée d'historique sur les 30 derniers jours.", italics: true, color: "888888" })],
      }));
      continue;
    }

    const stats = statsOf(series);
    if (stats) {
      children.push(new Paragraph({
        spacing: { after: 150 },
        children: [new TextRun({
          text: `Seuil : ${seuil} UFC/cm²  ·  Moyenne : ${stats.avg}  ·  Min : ${stats.min}  ·  Max : ${stats.max}  ·  ${stats.count} relevé(s)`,
          color: "444444",
        })],
      }));
    }

    if (series.length > 0) {
      // Au-delà de 5 courbes sur un même graphique, les couleurs se
      // confondent : on découpe en plusieurs graphiques empilés de 5 max.
      const chunks = chunkSeries(series, 5);
      chunks.forEach((chunk, idx) => {
        const dataUrl = renderChartPng(chunk, seuil);
        const bytes   = dataUrlToUint8Array(dataUrl);
        const rangeLabel = chunks.length > 1
          ? `Points ${idx * 5 + 1}–${idx * 5 + chunk.length} sur ${series.length}`
          : "Légende des points";
        children.push(new Paragraph({ text: rangeLabel, heading: HeadingLevel.HEADING_3, spacing: { before: idx > 0 ? 200 : 0, after: 80 } }));
        children.push(new Paragraph({
          spacing: { after: 150 },
          children: [new ImageRun({ type: "png", data: bytes, transformation: { width: CHART_W, height: CHART_H } })],
        }));
        children.push(legendTable(chunk));
      });
    }

    children.push(new Paragraph({ text: "Points aléatoires", heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 } }));
    children.push(...randomPointsParagraphs(randomPoints));
  }

  const doc  = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `innofaso_historique_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
