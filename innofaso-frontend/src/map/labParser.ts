import mammoth from 'mammoth';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type ParameterType = 'enterobacteries' | 'salmonelles' | 'unknown';

export interface LabResult {
  pointId: string;
  description: string;
  rawValue: string;
  numericValue: number | null;
  detected: boolean | null;
  spec: number | null;
  parameter: ParameterType;
  method: string;
  date: string;
  reportRef: string;
  weekNum: string;
  replicates: number;
}

export type ResultLevel = 'green' | 'orange' | 'red' | 'absent' | 'present' | 'unknown';

export function getLevel(result: LabResult): ResultLevel {
  if (result.parameter === 'salmonelles') {
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

export const LEVEL_COLORS: Record<ResultLevel, string> = {
  green:   '#22c55e',
  orange:  '#f59e0b',
  red:     '#ef4444',
  absent:  '#22c55e',
  present: '#ef4444',
  unknown: '#94a3b8',
};

export const LEVEL_LABELS: Record<ResultLevel, string> = {
  green:   'Conforme',
  orange:  'Attention',
  red:     'Non conforme',
  absent:  'Non détectée',
  present: 'DÉTECTÉE',
  unknown: 'Sans données',
};

export function getZoneLevel(results: Map<string, LabResult[]>, pointIds: string[]): ResultLevel {
  const levels = pointIds
    .filter(id => results.has(id))
    .flatMap(id => results.get(id)!.map(r => getLevel(r)));
  if (levels.length === 0) return 'unknown';
  if (levels.includes('present') || levels.includes('red')) return 'red';
  if (levels.includes('orange')) return 'orange';
  if (levels.every(l => l === 'absent' || l === 'green')) return 'green';
  return 'unknown';
}

export function getPointOverallLevel(results: LabResult[]): ResultLevel {
  if (results.length === 0) return 'unknown';
  const levels = results.map(getLevel);
  if (levels.includes('present') || levels.includes('red')) return 'red';
  if (levels.includes('orange')) return 'orange';
  if (levels.every(l => l === 'absent' || l === 'green')) return 'green';
  return 'unknown';
}

// ─── Parsing helpers ────────────────────────────────────────

function extractId(cell: string): string {
  const m = cell.trim().match(/^(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
}

function extractDesc(cell: string): string {
  return cell.replace(/^\d+\.\d+(?:\.\d+)?\s*/, '').trim();
}

// "Ns= inférieur à 1.100" → 1.1
// In French lab docs: 1.100 with dot = 1,1 (French decimal was comma)
// These are UFC values near 0 (<1 basically)
function parseUFCValue(raw: string): number | null {
  const lower = raw.toLowerCase().trim();
  // Extract the numeric part after "inférieur à" or "<"
  const m = lower.match(/(?:inf[eé]rieur\s*[aà]|<)\s*([\d.,]+)/);
  if (!m) {
    const n = parseFloat(lower.replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  let numStr = m[1];
  // French: 1.100 means 1,1 (thousands sep = dot, decimal = comma)
  // But in this doc they write "1.100" for ~1.1 UFC
  // Heuristic: if 3 digits after dot → thousands sep → treat as X.Y
  numStr = numStr.replace(/(\d+)\.(\d{3})$/, '$1$2').replace(',', '.').replace(/\.(\d)/, '.$1');
  // simpler: just treat the whole thing as <1.1
  // Actually for "1.100" → remove the trailing zeros → 1.1
  if (/^\d+\.\d+$/.test(numStr)) {
    // already decimal
  } else if (/^\d+\.\d{3}$/.test(m[1])) {
    // "1.100" → "1.1"
    numStr = m[1].replace(/\.(\d)0+$/, '.$1');
  }
  const val = parseFloat(numStr);
  return isNaN(val) ? null : val;
}

function parseDetected(raw: string): boolean | null {
  const l = raw.toLowerCase();
  if (l.includes('non détect') || l.includes('non detect') || l.includes('absence') || l.includes('absent')) return false;
  if (l.includes('détect') || l.includes('detect') || l.includes('présent')) return true;
  return null;
}

function parseSpec(raw: string): number | null {
  if (!raw) return null;
  const m = raw.match(/<\s*(\d+)/);
  return m ? parseFloat(m[1]) : null;
}

function detectParam(text: string): ParameterType {
  const l = text.toLowerCase();
  if (l.includes('salmonell')) return 'salmonelles';
  if (l.includes('entérobact') || l.includes('enterobact')) return 'enterobacteries';
  return 'unknown';
}

// ─── DOCX parser ────────────────────────────────────────────

export async function parseDocx(file: File): Promise<LabResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  // Extract metadata from plain text
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const param = detectParam(plain);
  const methodM = plain.match(/Méthode\s*[:\s]+([^\s<]+(?:\s+[^\s<]+){0,3})/i);
  const method = methodM ? methodM[1].trim() : 'Inconnu';
  const dateM = plain.match(/(\d{2}\/\d{2}\/\d{4})/);
  const date = dateM ? dateM[1] : '';
  const refM = plain.match(/N°\s*([\w-]+)/i);
  const reportRef = refM ? refM[1] : '';
  const weekM = plain.match(/Semaine\s*N°\s*[:\s]*(\d+)/i);
  const weekNum = weekM ? weekM[1] : '';

  // Parse table rows from HTML
  const rows: LabResult[] = [];
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const cells: string[] = [];
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
    // Skip header rows
    if (cells[0].toLowerCase().includes('points de prél')) continue;

    const rawValue = cells[1] || '';
    const specRaw = cells[2] || '';

    rows.push({
      pointId,
      description: extractDesc(cells[0]),
      rawValue,
      numericValue: param !== 'salmonelles' ? parseUFCValue(rawValue) : null,
      detected: param === 'salmonelles' ? parseDetected(rawValue) : null,
      spec: parseSpec(specRaw),
      parameter: param,
      method,
      date,
      reportRef,
      weekNum,
      replicates: 1,
    });
  }

  return mergeReplicates(rows);
}

// ─── CSV parser ─────────────────────────────────────────────

export async function parseCSV(file: File): Promise<LabResult[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data }) => {
        try {
          const rows = data as Record<string, string>[];
          const results: LabResult[] = rows.map(row => {
            const pointId = (row['point_id'] || row['Point ID'] || row['id'] || row['ID'] || '').trim();
            const rawValue = row['value'] || row['Value'] || row['resultat'] || row['résultat'] || '';
            const specRaw = row['spec'] || row['Spec'] || row['specification'] || '';
            const paramRaw = (row['parametre'] || row['parameter'] || '').toLowerCase();
            const param: ParameterType = paramRaw.includes('salmo') ? 'salmonelles'
              : paramRaw.includes('entero') || paramRaw.includes('entéro') ? 'enterobacteries' : 'enterobacteries';
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

export async function parseXLSX(file: File): Promise<LabResult[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const results: LabResult[] = rows.map(row => {
    const pointId = String(row['point_id'] || row['Point ID'] || row['id'] || row['ID'] || '').trim();
    const rawValue = String(row['value'] || row['Value'] || row['resultat'] || row['résultat'] || '');
    const specRaw = String(row['spec'] || row['Spec'] || '');
    const numVal = parseFloat(rawValue.replace(',', '.'));
    const paramRaw = String(row['parametre'] || row['parameter'] || '').toLowerCase();
    const param: ParameterType = paramRaw.includes('salmo') ? 'salmonelles'
      : paramRaw.includes('entero') || paramRaw.includes('entéro') ? 'enterobacteries' : 'enterobacteries';
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

export async function parseFile(file: File): Promise<LabResult[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'docx') return parseDocx(file);
  if (ext === 'csv') return parseCSV(file);
  if (ext === 'xlsx' || ext === 'xls') return parseXLSX(file);
  // Try docx as fallback for .doc
  if (ext === 'doc') return parseDocx(file);
  throw new Error(`Format non supporté: .${ext}`);
}

function mergeReplicates(rows: LabResult[]): LabResult[] {
  const map = new Map<string, LabResult>();
  for (const r of rows) {
    const key = r.pointId + '|' + r.parameter;
    if (!map.has(key)) {
      map.set(key, { ...r });
    } else {
      const ex = map.get(key)!;
      ex.replicates++;
      if (r.numericValue !== null && ex.numericValue !== null)
        ex.numericValue = Math.max(ex.numericValue, r.numericValue);
      if (r.detected === true) ex.detected = true;
    }
  }
  return Array.from(map.values());
}

export function mergeResults(allResults: LabResult[][]): Map<string, LabResult[]> {
  const map = new Map<string, LabResult[]>();
  for (const batch of allResults) {
    for (const r of batch) {
      if (!map.has(r.pointId)) map.set(r.pointId, []);
      const arr = map.get(r.pointId)!;
      const idx = arr.findIndex(x => x.parameter === r.parameter);
      if (idx >= 0) arr[idx] = r; else arr.push(r);
    }
  }
  return map;
}
