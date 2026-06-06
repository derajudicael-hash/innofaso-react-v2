'use client';

import { useState, useEffect, useCallback } from 'react';
import { LabResult, ParameterType } from '../utils/labParser';
import { FileEntry } from '../components/FileSidebar';

const KEY_ENTRIES = 'hygienemap_entries_v2';
const KEY_RESULTS = 'hygienemap_results_v2';

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function safeSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('localStorage write failed:', e); }
}

let _nextId = 1;

export function usePersistedFiles() {
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [fileResults, setFileResults] = useState<Record<string, LabResult[]>>({});
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  useEffect(() => {
    const entries = safeGet<FileEntry[]>(KEY_ENTRIES, []);
    const results = safeGet<Record<string, LabResult[]>>(KEY_RESULTS, {});
    if (entries.length > 0) {
      const maxId = Math.max(...entries.map(e => parseInt(e.id) || 0));
      _nextId = maxId + 1;
      setActiveFileId(entries[entries.length - 1].id);
    }
    setFileEntries(entries);
    setFileResults(results);
  }, []);

  const addFile = useCallback((results: LabResult[], name: string) => {
    const first = results[0];
    const id = String(_nextId++);
    const entry: FileEntry = {
      id, name,
      parameter: (first?.parameter ?? 'unknown') as ParameterType,
      count: results.length,
      date: first?.date ?? '',
      weekNum: first?.weekNum ?? '',
      reportRef: first?.reportRef ?? '',
    };
    setFileEntries(prev => { const n = [...prev, entry]; safeSet(KEY_ENTRIES, n); return n; });
    setFileResults(prev => { const n = { ...prev, [id]: results }; safeSet(KEY_RESULTS, n); return n; });
    setActiveFileId(id);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFileEntries(prev => { const n = prev.filter(e => e.id !== id); safeSet(KEY_ENTRIES, n); return n; });
    setFileResults(prev => { const n = { ...prev }; delete n[id]; safeSet(KEY_RESULTS, n); return n; });
    setActiveFileId(prev => prev === id ? null : prev);
  }, []);

  const clearAll = useCallback(() => {
    setFileEntries([]); setFileResults({}); setActiveFileId(null);
    localStorage.removeItem(KEY_ENTRIES); localStorage.removeItem(KEY_RESULTS);
  }, []);

  const activeResults = new Map<string, LabResult[]>();
  if (activeFileId && fileResults[activeFileId]) {
    for (const r of fileResults[activeFileId]) {
      if (!activeResults.has(r.pointId)) activeResults.set(r.pointId, []);
      const arr = activeResults.get(r.pointId)!;
      const idx = arr.findIndex(x => x.parameter === r.parameter);
      if (idx >= 0) arr[idx] = r; else arr.push(r);
    }
  }

  return { fileEntries, activeFileId, activeResults, addFile, removeFile, clearAll, setActiveFileId };
}
