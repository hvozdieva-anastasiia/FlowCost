// What the window and Plugin Main say to each other. Nothing here carries Figma
// objects: only plain data that survives postMessage.

import type { Snapshot } from './compare';
import type { Assumptions } from './cost';
import { defaultAssumptions } from './cost';
import type { FlowGraph } from './graph';

export interface Settings {
  readonly assumptions: Assumptions;
}

export const MAX_SNAPSHOTS = 50;

/** What the person says about the selected nodes: they are inputs, are not, or nothing. */
export type InputMark =
  | { readonly kind: 'input'; readonly chars: number }
  | { readonly kind: 'not-input' }
  | { readonly kind: 'clear' };

export type UiMessage =
  | { readonly type: 'READY' }
  | { readonly type: 'SCAN' }
  | { readonly type: 'REVEAL'; readonly nodeId: string }
  | { readonly type: 'MARK_INPUT'; readonly mark: InputMark }
  | { readonly type: 'MARK_ENDING'; readonly value: boolean }
  | { readonly type: 'SNAPSHOT_SAVE'; readonly snapshot: Snapshot }
  | { readonly type: 'SNAPSHOT_DELETE'; readonly id: string }
  | { readonly type: 'SETTINGS_SAVE'; readonly settings: Settings };

export type PluginMessage =
  | {
      readonly type: 'STATE';
      readonly settings: Settings;
      readonly snapshots: readonly Snapshot[];
    }
  | { readonly type: 'SCAN_RESULT'; readonly graph: FlowGraph }
  | { readonly type: 'SELECTION'; readonly screenIds: readonly string[] }
  | { readonly type: 'SNAPSHOTS'; readonly snapshots: readonly Snapshot[] }
  | { readonly type: 'PAGE_CHANGED' }
  | {
      readonly type: 'NOTICE';
      readonly level: 'info' | 'error';
      readonly text: string;
    };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Reads a message from the window; anything else is ignored. */
export function parseUiMessage(raw: unknown): UiMessage | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  switch (raw.type) {
    case 'READY':
    case 'SCAN':
      return { type: raw.type };
    case 'REVEAL':
      return typeof raw.nodeId === 'string'
        ? { type: 'REVEAL', nodeId: raw.nodeId }
        : null;
    case 'MARK_INPUT': {
      const mark = raw.mark;
      if (!isRecord(mark)) return null;
      if (mark.kind === 'not-input' || mark.kind === 'clear') {
        return { type: 'MARK_INPUT', mark: { kind: mark.kind } };
      }
      return mark.kind === 'input' &&
        finite(mark.chars) &&
        mark.chars >= 1 &&
        mark.chars <= 500
        ? {
            type: 'MARK_INPUT',
            mark: { kind: 'input', chars: Math.round(mark.chars) },
          }
        : null;
    }
    case 'MARK_ENDING':
      return typeof raw.value === 'boolean'
        ? { type: 'MARK_ENDING', value: raw.value }
        : null;
    case 'SNAPSHOT_SAVE': {
      const snapshot = parseSnapshot(raw.snapshot);
      return snapshot ? { type: 'SNAPSHOT_SAVE', snapshot } : null;
    }
    case 'SNAPSHOT_DELETE':
      return typeof raw.id === 'string'
        ? { type: 'SNAPSHOT_DELETE', id: raw.id }
        : null;
    case 'SETTINGS_SAVE':
      return isRecord(raw.settings)
        ? {
            type: 'SETTINGS_SAVE',
            settings: {
              assumptions: sanitizeAssumptions(raw.settings.assumptions),
            },
          }
        : null;
    default:
      return null;
  }
}

export function parseSnapshot(value: unknown): Snapshot | null {
  if (!isRecord(value)) return null;
  const { id, label, createdAt, startName, goalName, summary } = value;
  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    !finite(createdAt) ||
    typeof startName !== 'string' ||
    typeof goalName !== 'string' ||
    !isRecord(summary)
  ) {
    return null;
  }
  const { actions, screens, seconds, taps, typedChars, friction } = summary;
  if (
    !finite(actions) ||
    !finite(screens) ||
    !finite(seconds) ||
    !finite(taps) ||
    !finite(typedChars) ||
    !finite(friction)
  ) {
    return null;
  }
  return {
    id,
    label: label.slice(0, 120),
    createdAt,
    startName,
    goalName,
    summary: { actions, screens, seconds, taps, typedChars, friction },
  };
}

/**
 * Takes stored or received assumptions and fills anything missing or invalid
 * from the defaults of the chosen skill and device.
 */
export function sanitizeAssumptions(value: unknown): Assumptions {
  const source = isRecord(value) ? value : {};
  const skill =
    source.skill === 'expert' || source.skill === 'novice'
      ? source.skill
      : 'regular';
  const device = source.device === 'touch' ? 'touch' : 'mouse';
  const base = defaultAssumptions(skill, device);
  const number = (key: keyof Assumptions, min: number, max: number): number => {
    const candidate = source[key];
    const fallback = base[key];
    if (typeof fallback !== 'number') return 0;
    return finite(candidate) && candidate >= min && candidate <= max
      ? candidate
      : fallback;
  };
  return {
    skill,
    device,
    mental: number('mental', 0, 20),
    home: number('home', 0, 5),
    keystroke: number('keystroke', 0, 5),
    pointFixed: number('pointFixed', 0, 10),
    press: number('press', 0, 5),
    scroll: number('scroll', 0, 10),
    drag: number('drag', 0, 10),
    useFitts:
      typeof source.useFitts === 'boolean' ? source.useFitts : base.useFitts,
    fittsA: number('fittsA', 0, 5),
    fittsB: number('fittsB', 0, 5),
    minTarget: number('minTarget', 1, 200),
    farIndex: number('farIndex', 1, 20),
  };
}

export function defaultSettings(): Settings {
  return { assumptions: defaultAssumptions() };
}
