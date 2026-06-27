'use client';

import { useState, useEffect, useCallback } from 'react';
import { parseFile } from './labParser.js';

const KEY_ENTRIES = 'hygienemap_entries_v2';
const KEY_RESULTS = 'hygienemap_results_v2';
const SYNC_EVENT = 'hygienemap-files-changed';

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('localStorage write failed:', e); }
}

function notifySync() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

let _nextId = 1;

export function usePersistedFiles() {
  const [fileEntries, setFileEntries] = useState([]);
  const [fileResults, setFileResults] = useState({});
  const [activeFileId, setActiveFileId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrate = () => {
      const entries = safeGet(KEY_ENTRIES, []);
      const results = safeGet(KEY_RESULTS, {});
      if (entries.length > 0) {
        const maxId = Math.max(...entries.map(e => parseInt(e.id) || 0));
        _nextId = Math.max(_nextId, maxId + 1);
        setActiveFileId(prev => prev && entries.some(e => e.id === prev) ? prev : entries[entries.length - 1].id);
      } else {
        setActiveFileId(null);
      }
      setFileEntries(entries);
      setFileResults(results);
      setHydrated(true);
    };

    hydrate();
    window.addEventListener(SYNC_EVENT, hydrate);
    window.addEventListener('storage', hydrate);
    return () => {
      window.removeEventListener(SYNC_EVENT, hydrate);
      window.removeEventListener('storage', hydrate);
    };
  }, []);

  const addFile = useCallback((results, name) => {
    const first = results[0];
    const id = String(_nextId++);
    const entry = {
      id, name,
      parameter: first?.parameter ?? 'unknown',
      count: results.length,
      date: first?.date ?? '',
      weekNum: first?.weekNum ?? '',
      reportRef: first?.reportRef ?? '',
    };
    setFileEntries(prev => { const n = [...prev, entry]; safeSet(KEY_ENTRIES, n); return n; });
    setFileResults(prev => { const n = { ...prev, [id]: results }; safeSet(KEY_RESULTS, n); notifySync(); return n; });
    setActiveFileId(id);
  }, []);

  const removeFile = useCallback((id) => {
    setFileEntries(prev => { const n = prev.filter(e => e.id !== id); safeSet(KEY_ENTRIES, n); return n; });
    setFileResults(prev => { const n = { ...prev }; delete n[id]; safeSet(KEY_RESULTS, n); notifySync(); return n; });
    setActiveFileId(prev => prev === id ? null : prev);
  }, []);

  const clearAll = useCallback(() => {
    setFileEntries([]); setFileResults({}); setActiveFileId(null);
    localStorage.removeItem(KEY_ENTRIES); localStorage.removeItem(KEY_RESULTS);
    notifySync();
  }, []);

  const activeResults = new Map();
  if (activeFileId && fileResults[activeFileId]) {
    for (const r of fileResults[activeFileId]) {
      if (!activeResults.has(r.pointId)) activeResults.set(r.pointId, []);
      const arr = activeResults.get(r.pointId);
      const idx = arr.findIndex(x => x.parameter === r.parameter);
      if (idx >= 0) arr[idx] = r; else arr.push(r);
    }
  }

  return { fileEntries, fileResults, activeFileId, activeResults, hydrated, addFile, removeFile, clearAll, setActiveFileId };
}
