import type { FrictionKind } from '../shared/analysis';
import type { SummaryKey } from '../shared/compare';

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

export const SUMMARY_LABELS: Record<SummaryKey, string> = {
  actions: 'Actions',
  screens: 'Screens',
  seconds: 'Time',
  taps: 'Taps',
  typedChars: 'Typed characters',
  friction: 'Friction points',
};

export const FRICTION_LABELS: Record<FrictionKind, string> = {
  'small-target': 'Small target',
  'far-target': 'Far target',
  overlay: 'Overlay',
  scroll: 'Scroll',
  form: 'Long form',
  wait: 'Wait',
};
