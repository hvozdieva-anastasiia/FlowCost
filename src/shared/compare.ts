// A summary of one priced path, and the difference between two of them.

import type { PathResult } from './analysis';

export interface Summary {
  readonly actions: number;
  readonly screens: number;
  readonly seconds: number;
  readonly taps: number;
  readonly typedChars: number;
  readonly friction: number;
  readonly decisionPoints: number;
  readonly noReturn: number;
}

export function summarize(path: PathResult): Summary {
  return {
    actions: path.actions,
    screens: path.screens,
    seconds: path.seconds,
    taps: path.taps,
    typedChars: path.typedChars,
    friction: path.friction.length,
    decisionPoints: path.decisionPoints,
    noReturn: path.noReturn,
  };
}

export type SummaryKey = keyof Summary;

export const SUMMARY_KEYS: readonly SummaryKey[] = [
  'actions',
  'screens',
  'seconds',
  'taps',
  'typedChars',
  'friction',
  'decisionPoints',
  'noReturn',
];

export interface Delta {
  readonly key: SummaryKey;
  readonly before: number;
  readonly after: number;
  readonly change: number;
  /** Null when `before` is zero, where a percentage means nothing. */
  readonly percent: number | null;
}

/** How `after` differs from `before`; a negative change is an improvement. */
export function compare(before: Summary, after: Summary): Delta[] {
  return SUMMARY_KEYS.map((key) => {
    const from = before[key];
    const to = after[key];
    return {
      key,
      before: from,
      after: to,
      change: to - from,
      percent: from === 0 ? null : ((to - from) / from) * 100,
    };
  });
}

export interface Snapshot {
  readonly id: string;
  readonly label: string;
  readonly createdAt: number;
  readonly startName: string;
  readonly goalName: string;
  readonly summary: Summary;
}
