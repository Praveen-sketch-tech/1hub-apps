// App #003 — QR & Barcode Studio
// Maintains a small local (browser-only) history of recent scan results.
// Never sent to Supabase or any server. Handles malformed storage safely.

import { useCallback, useEffect, useState } from 'react';
import type { ScanHistoryEntry, ScanOutcome } from '../types';

const STORAGE_KEY = 'qbs.scanHistory.v1';
const MAX_ENTRIES = 10;

function readFromStorage(): ScanHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).slice(0, MAX_ENTRIES);
  } catch {
    // Malformed or inaccessible storage — start fresh rather than throwing.
    return [];
  }
}

function isValidEntry(value: unknown): value is ScanHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.format === 'string' &&
    typeof entry.value === 'string' &&
    typeof entry.timestamp === 'number' &&
    (entry.source === 'camera' || entry.source === 'image')
  );
}

function writeToStorage(entries: ScanHistoryEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be full or unavailable (private browsing, quota, etc).
    // Fail silently — history is a convenience feature, not core.
  }
}

export function useScanHistory() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>(() => readFromStorage());

  useEffect(() => {
    writeToStorage(entries);
  }, [entries]);

  const addEntry = useCallback((outcome: ScanOutcome) => {
    setEntries((prev) => {
      const next: ScanHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        format: outcome.format,
        value: outcome.value,
        timestamp: Date.now(),
        source: outcome.source,
      };
      return [next, ...prev].slice(0, MAX_ENTRIES);
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, addEntry, removeEntry, clearHistory };
}
