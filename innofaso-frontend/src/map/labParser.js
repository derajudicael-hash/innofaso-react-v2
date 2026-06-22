import mammoth from 'mammoth';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Salmonelles ET Cronobacter (Enterobacter sakazakii) sont des paramètres de
// présence/absence — pas de comptage. Cronobacter est le pathogène de
// surveillance environnementale le plus spécifiquement critique pour un RUTF
// (aliment thérapeutique prêt à l'emploi, cf. référentiels WHO/UNICEF/Codex),
// au même titre que Salmonelles : un résultat détecté est toujours critique,
// quel que soit l'UFC entérobactéries du même point.
const PRESENCE_PARAMETERS = ['salmonelles', 'cronobacter'];

export function getLevel(result) {
  if (PRESENCE_PARAMETERS.includes(result.parameter)) {
    if (result.detected === null) return 'unknown';
    return result.detected ? 'present' : 'absent';
  }
  if (result.numericValue === null) return 'unknown';
  const spec = result.spec;
  if (spec === null) return 'unknown';
  if (result.numericValue < spec * 0.5) return 'green';
  if (result.numericValue < spec) return 'orange';
  return 'red';
}

export const LEVEL_COLORS = {
  green:   '#22c55e',
  orange:  '#f59e0b',
  red:     '#ef4444',
  absent:  '#22c55e',
  present: '#ef4444',
  unknown: '#94a3b8',
};

export const LEVEL_LABELS = {
  green:   'Conforme',
  orange:  'Attention',
  red:     'Non conforme',
  absent:  'Non détectée',
  present: 'DÉTECTÉE',
  unknown: 'Sans données',
};

export function getZoneLevel(results, pointIds) {
  const levels = pointIds
    .filter(id => results.has(id))
    .flatMap(id => results.get(id).map(r => getLevel(r)));
  if (levels.length === 0) return 'unknown';
  if (levels.includes('present') || levels.includes('red')) return 'red';
  if (levels.includes('orange')) return 'orange';
  if (levels.every(l => l === 'absent' || l === 'green')) return 'green';
  return 'unknown';
}

export function getPointOverallLevel(results) {
  if (results.length === 0) return 'unknown';
  const levels = results.map(getLevel);
  if (levels.includes('present') || levels.includes('red')) return 'red';
  if (levels.includes('orange')) return 'orange';
  if (levels.every(l => l === 'absent' || l === 'green')) return 'green';
  return 'unknown';
}

// ─── Parsing helpers ────────────────────────────────────────

function extractId(cell) {
  const m = cell.trim().match(/^(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
}

function extractDesc(cell) {
  return cell.replace(/^\d+\.\d+(?:\.\d+)?\s*/, '').trim();
}

// Les bulletins réels notent le résultat en notation scientifique, ex:
// "Ns= 1,2.10 1" = 1,2 × 10^1 = 12 UFC/cm² (l'exposant était en exposant
// dans le document Word, et perd sa mise en forme lors de la conversion en
// texte, d'où le chiffre "1" séparé par un espace après ".10"). Quand le
// résultat est sous le seuil de quantification, le bulletin écrit
// "Ns= inférieur à 1.10 0" : on retient alors 0 (non détecté).
function parseUFCValue(raw) {
  const lower = raw.toLowerCase().trim();

  const sci = lower.match(/(\d+(?:[.,]\d+)?)\s*\.?\s*10\s*(\d+)/);
  if (sci) {
    if (/inf[eé]rieur/.test(lower)) return 0;
    const mantissa = parseFloat(sci[1].replace(',', '.'));
    const exponent = parseInt(sci[2], 10);
    if (isNaN(mantissa) || isNaN(exponent)) return null;
    return mantissa * Math.pow(10, exponent);
  }

  // Repli pour d'éventuels formats simples ("<10", "10", "1,5"...).
  if (/(?:inf[eé]rieur\s*[aà]|<)\s*[\d.,]+/.test(lower)) return 0;
  const n = parseFloat(lower.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseDetected(raw) {
  const l = raw.toLowerCase();
  if (l.includes('non détect') || l.includes('non detect') || l.includes('absence') || l.includes('absent')) return false;
  if (l.includes('détect') || l.includes('detect') || l.includes('présent')) return true;
  return null;
}

function parseSpec(raw) {
  if (!raw) return null;
  const m = raw.match(/<\s*(\d+)/);
  return m ? parseFloat(m[1]) : null;
}

function detectParam(text) {
  const l = text.toLowerCase();
  if (l.includes('salmonell')) return 'salmonelles';
  if (l.includes('cronobacter') || l.includes('sakazakii')) return 'cronobacter';
  if (l.includes('entérobact') || l.includes('enterobact')) return 'enterobacteries';
  return 'unknown';
}

// Cherche toutes les dates associées à un libellé précis du bulletin (ex:
// "Date de réception : 15/12/2026 et 16/12/2025" — un lot couvrant deux
// prélèvements peut afficher deux dates, parfois avec une coquille d'année
// sur l'une d'elles). On renvoie TOUTES les dates trouvées juste après le
// libellé, dans l'ordre où elles apparaissent, pour que l'appelant puisse
// essayer la suivante si la première s'avère invalide (ex: date future).
function extractLabeledDates(text, labelPattern) {
  const re = new RegExp(
    labelPattern + '\\s*[:\\s]+((?:\\d{1,2}\\/\\d{1,2}\\/\\d{4}(?:\\s*(?:et|,)\\s*)?)+)',
    'i'
  );
  const m = text.match(re);
  if (!m) return [];
  return m[1].match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
}

// Convertit une date "JJ/MM/AAAA" (telle qu'extraite des bulletins) en objet Date.
// Retourne null si le format est invalide ou absent — utilisé pour trier les
// bulletins importés par ordre chronologique réel (historique).
export function parseFrDate(str) {
  if (!str) return null;
  const m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

// ─── DOCX parser ────────────────────────────────────────────

export async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const param = detectParam(plain);
  const methodM = plain.match(/Méthode\s*[:\s]+([^\s<]+(?:\s+[^\s<]+){0,3})/i);
  const method = methodM ? methodM[1].trim() : 'Inconnu';
  // Date retenue pour l'historique/les courbes : date de réception du
  // prélèvement (la plus proche du moment réel du contrôle en usine), avec
  // repli sur d'autres dates du bulletin si celle-ci est absente ou invalide
  // (ex: coquille d'année donnant une date future), et en dernier recours la
  // première date trouvée dans le document (en-tête). dateCandidates liste
  // TOUTES les dates possibles dans cet ordre de priorité ; le backend essaie
  // chacune jusqu'à en trouver une valide (cf. labResults.js pickReportDate).
  const dateM = plain.match(/(\d{2}\/\d{2}\/\d{4})/);
  const dateCandidates = [
    ...extractLabeledDates(plain, 'Date de r[ée]ception'),
    ...extractLabeledDates(plain, 'Date de lecture'),
    ...extractLabeledDates(plain, "Date d'analyse"),
    ...(dateM ? [dateM[1]] : []),
  ];
  const date = dateCandidates[0] || '';
  const refM = plain.match(/N°\s*([\w-]+)/i);
  const reportRef = refM ? refM[1] : '';
  const weekM = plain.match(/Semaine\s*N°\s*[:\s]*(\d+)/i);
  const weekNum = weekM ? weekM[1] : '';

  const rows = [];
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const cells = [];
    const tdPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdM;
    while ((tdM = tdPattern.exec(trMatch[1])) !== null) {
      const text = tdM[1].replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ')
        .replace(/\s+/g, ' ').trim();
      cells.push(text);
    }
    if (cells.length < 2) continue;
    const pointId = extractId(cells[0]);
    if (!pointId) continue;
    if (cells[0].toLowerCase().includes('points de prél')) continue;

    const rawValue = cells[1] || '';
    const specRaw = cells[2] || '';

    rows.push({
      pointId,
      description: extractDesc(cells[0]),
      rawValue,
      numericValue: !PRESENCE_PARAMETERS.includes(param) ? parseUFCValue(rawValue) : null,
      detected: PRESENCE_PARAMETERS.includes(param) ? parseDetected(rawValue) : null,
      spec: parseSpec(specRaw),
      parameter: param,
      method,
      date,
      dateCandidates,
      reportRef,
      weekNum,
      replicates: 1,
    });
  }

  return mergeReplicates(rows);
}

// ─── CSV parser ─────────────────────────────────────────────

export async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data }) => {
        try {
          const results = data.map(row => {
            const pointId = (row['point_id'] || row['Point ID'] || row['id'] || row['ID'] || '').trim();
            const rawValue = row['value'] || row['Value'] || row['resultat'] || row['résultat'] || '';
            const specRaw = row['spec'] || row['Spec'] || row['specification'] || '';
            const paramRaw = (row['parametre'] || row['parameter'] || '').toLowerCase();
            const param = paramRaw.includes('salmo') ? 'salmonelles'
              : paramRaw.includes('crono') || paramRaw.includes('sakazakii') ? 'cronobacter'
              : 'enterobacteries';
            const numVal = parseFloat(rawValue.replace(',', '.'));
            return {
              pointId, description: row['description'] || '',
              rawValue,
              numericValue: isNaN(numVal) ? null : numVal,
              detected: null,
              spec: parseSpec(specRaw) ?? (parseInt(pointId) === 1 ? 10 : parseInt(pointId) === 2 ? 50 : parseInt(pointId) === 3 ? 100 : 500),
              parameter: param,
              method: row['method'] || row['methode'] || 'CSV',
              date: row['date'] || row['Date'] || '',
              reportRef: row['ref'] || '',
              weekNum: row['semaine'] || row['week'] || '',
              replicates: 1,
            };
          }).filter(r => r.pointId);
          resolve(mergeReplicates(results));
        } catch(e) { reject(e); }
      },
      error: reject,
    });
  });
}

// ─── XLSX parser ────────────────────────────────────────────

export async function parseXLSX(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const results = rows.map(row => {
    const pointId = String(row['point_id'] || row['Point ID'] || row['id'] || row['ID'] || '').trim();
    const rawValue = String(row['value'] || row['Value'] || row['resultat'] || row['résultat'] || '');
    const specRaw = String(row['spec'] || row['Spec'] || '');
    const numVal = parseFloat(rawValue.replace(',', '.'));
    const paramRaw = String(row['parametre'] || row['parameter'] || '').toLowerCase();
    const param = paramRaw.includes('salmo') ? 'salmonelles'
      : paramRaw.includes('crono') || paramRaw.includes('sakazakii') ? 'cronobacter'
      : 'enterobacteries';
    return {
      pointId, description: String(row['description'] || ''),
      rawValue,
      numericValue: isNaN(numVal) ? null : numVal,
      detected: null,
      spec: parseSpec(specRaw),
      parameter: param,
      method: String(row['method'] || row['methode'] || 'Excel'),
      date: String(row['date'] || row['Date'] || ''),
      reportRef: String(row['ref'] || ''),
      weekNum: String(row['semaine'] || row['week'] || ''),
      replicates: 1,
    };
  }).filter(r => r.pointId);

  return mergeReplicates(results);
}

// ─── Main entry ─────────────────────────────────────────────

export async function parseFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx') return parseDocx(file);
  if (ext === 'csv') return parseCSV(file);
  if (ext === 'xlsx' || ext === 'xls') return parseXLSX(file);
  if (ext === 'doc') return parseDocx(file);
  throw new Error(`Format non supporté: .${ext}`);
}

function mergeReplicates(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.pointId + '|' + r.parameter;
    if (!map.has(key)) {
      map.set(key, { ...r });
    } else {
      const ex = map.get(key);
      ex.replicates++;
      if (r.numericValue !== null && ex.numericValue !== null)
        ex.numericValue = Math.max(ex.numericValue, r.numericValue);
      if (r.detected === true) ex.detected = true;
    }
  }
  return Array.from(map.values());
}

export function mergeResults(allResults) {
  const map = new Map();
  for (const batch of allResults) {
    for (const r of batch) {
      if (!map.has(r.pointId)) map.set(r.pointId, []);
      const arr = map.get(r.pointId);
      const idx = arr.findIndex(x => x.parameter === r.parameter);
      if (idx >= 0) arr[idx] = r; else arr.push(r);
    }
  }
  return map;
}
