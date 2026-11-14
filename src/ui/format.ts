import type { FrictionKind, PathResult } from '../shared/analysis';
import type { SummaryKey } from '../shared/compare';
import type { Assumptions, OperatorKind } from '../shared/cost';

export function formatSeconds(value: number): string {
  return `${value.toFixed(1)} s`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return '';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function formatChange(key: SummaryKey, change: number): string {
  const text =
    key === 'seconds' ? change.toFixed(1) : String(Math.round(change));
  return `${change > 0 ? '+' : ''}${text}`;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "about 3 seconds", "about 1.5 minutes": a rough length in plain words. */
export function roughDuration(seconds: number): string {
  if (seconds < 1) return 'under a second';
  if (seconds >= 90) return `about ${(seconds / 60).toFixed(1)} minutes`;
  const rounded = Math.round(seconds);
  return `about ${plural(rounded, 'second', 'seconds')}`;
}

/** One sentence that says what the route costs. */
export function headline(path: PathResult): string {
  const time = roughDuration(path.seconds);
  const sentence =
    path.actions === 0
      ? `${time}, with nothing to do`
      : `${time} and ${plural(path.actions, 'action', 'actions')}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function audienceText(assumptions: Assumptions): string {
  const skill = assumptions.skill === 'novice' ? 'beginner' : assumptions.skill;
  const device = assumptions.device === 'touch' ? 'touch' : 'a mouse';
  return `a ${skill} person using ${device}`;
}

export const SUMMARY_LABELS: Record<SummaryKey, string> = {
  actions: 'Actions',
  screens: 'Screens passed',
  seconds: 'Modelled time',
  taps: 'Clicks or taps',
  typedChars: 'Characters typed',
  friction: 'Problems on the route',
  decisionPoints: 'Choices along the route',
  noReturn: 'Steps you cannot take back',
};

export const FRICTION_LABELS: Record<FrictionKind, string> = {
  'small-target': 'Small target',
  'far-target': 'Far target',
  overlay: 'Overlay',
  scroll: 'Scroll needed',
  form: 'Long form',
  wait: 'Waiting',
  'many-choices': 'Many options',
};

export const OPERATOR_NAMES: Record<OperatorKind, string> = {
  M: 'Think',
  P: 'Point',
  B: 'Click',
  H: 'Hand move',
  K: 'Type',
  S: 'Scroll',
  D: 'Drag',
  R: 'Wait',
  C: 'Choose',
};
