/**
 * Simple one-level undo. Intentionally not a full history stack per the
 * v1 scope — only the single most recent page-management action
 * (reorder / rotate / delete / bulk delete) can be undone.
 */

import { useCallback, useRef, useState } from 'react';
import type { ActionKind, PageItem } from '../types';

interface UndoEntry {
  kind: ActionKind;
  pages: PageItem[];
}

export function useUndo() {
  const [canUndo, setCanUndo] = useState(false);
  const entryRef = useRef<UndoEntry | null>(null);

  /** Call BEFORE mutating state, with the pages array as it was before the action. */
  const recordUndoPoint = useCallback((kind: ActionKind, previousPages: PageItem[]) => {
    entryRef.current = { kind, pages: previousPages };
    setCanUndo(true);
  }, []);

  const consumeUndo = useCallback((): UndoEntry | null => {
    const entry = entryRef.current;
    entryRef.current = null;
    setCanUndo(false);
    return entry;
  }, []);

  const clearUndo = useCallback(() => {
    entryRef.current = null;
    setCanUndo(false);
  }, []);

  return { canUndo, recordUndoPoint, consumeUndo, clearUndo };
}
