// What the plugin keeps between runs: settings on this machine, snapshots in
// the document so teammates see the same comparison.

import type { Snapshot } from '../shared/compare';
import {
  MAX_SNAPSHOTS,
  defaultSettings,
  isRecord,
  parseSnapshot,
  sanitizeAssumptions,
  type Settings,
} from '../shared/messages';

const SETTINGS_KEY = 'flowcost:settings';
const SNAPSHOTS_KEY = 'flowcost:snapshots';

export async function loadSettings(): Promise<Settings> {
  try {
    const stored: unknown = await figma.clientStorage.getAsync(SETTINGS_KEY);
    if (isRecord(stored)) {
      return { assumptions: sanitizeAssumptions(stored.assumptions) };
    }
  } catch {
    // Settings are a convenience: fall back to the defaults.
  }
  return defaultSettings();
}

export function saveSettings(settings: Settings): void {
  figma.clientStorage.setAsync(SETTINGS_KEY, settings).catch(() => undefined);
}

export function loadSnapshots(): Snapshot[] {
  const text = figma.root.getPluginData(SNAPSHOTS_KEY);
  if (text === '') return [];
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) return [];
    const snapshots: Snapshot[] = [];
    for (const item of value) {
      const snapshot = parseSnapshot(item);
      if (snapshot) snapshots.push(snapshot);
    }
    return snapshots;
  } catch {
    return [];
  }
}

function writeSnapshots(snapshots: readonly Snapshot[]): void {
  figma.root.setPluginData(SNAPSHOTS_KEY, JSON.stringify(snapshots));
}

/** Newest first; the oldest fall off past the limit. */
export function addSnapshot(snapshot: Snapshot): Snapshot[] {
  const next = [
    snapshot,
    ...loadSnapshots().filter((item) => item.id !== snapshot.id),
  ].slice(0, MAX_SNAPSHOTS);
  writeSnapshots(next);
  return next;
}

export function removeSnapshot(id: string): Snapshot[] {
  const next = loadSnapshots().filter((item) => item.id !== id);
  writeSnapshots(next);
  return next;
}
