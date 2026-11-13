// Turns the reactions Figma reports into the plain facts the graph needs.
// The input types describe only the fields read, so Figma's own Reaction type
// fits them and tests can use small literals.

import type { NavigationKind, TriggerKind } from './graph';

export interface RawAction {
  readonly type: string;
  readonly destinationId?: string | null;
  readonly navigation?: string;
  readonly transition?: { readonly duration: number } | null;
  readonly conditionalBlocks?: readonly {
    readonly actions: readonly RawAction[];
  }[];
}

export interface RawReaction {
  readonly trigger: {
    readonly type: string;
    readonly timeout?: number;
    readonly delay?: number;
  } | null;
  readonly actions?: readonly RawAction[];
  /** The older single action, kept for files that still report it. */
  readonly action?: RawAction | null;
}

export interface ParsedAction {
  readonly trigger: TriggerKind;
  readonly delaySeconds: number;
  readonly navigation: NavigationKind;
  readonly destinationId: string | null;
  readonly transitionSeconds: number;
  readonly conditional: boolean;
}

/**
 * The Plugin API reports durations and timeouts in seconds (its own examples
 * use 0.2). A value above this is read as milliseconds, in case a file or a
 * future version reports them that way.
 */
const MILLISECOND_GUESS = 30;

export function toSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > MILLISECOND_GUESS ? value / 1000 : value;
}

export function triggerKind(type: string): TriggerKind {
  switch (type) {
    case 'ON_CLICK':
    case 'MOUSE_UP':
    case 'MOUSE_DOWN':
      return 'CLICK';
    case 'ON_PRESS':
      return 'PRESS';
    case 'ON_HOVER':
      return 'HOVER';
    case 'ON_DRAG':
      return 'DRAG';
    case 'AFTER_TIMEOUT':
      return 'TIMEOUT';
    case 'ON_KEY_DOWN':
      return 'KEY';
    default:
      return 'OTHER';
  }
}

function navigationKind(action: RawAction): NavigationKind | null {
  switch (action.type) {
    case 'BACK':
      return 'BACK';
    case 'CLOSE':
      return 'CLOSE';
    case 'URL':
      return 'EXTERNAL';
    case 'NODE':
      switch (action.navigation) {
        case 'NAVIGATE':
        case 'OVERLAY':
        case 'SWAP':
        case 'CHANGE_TO':
        case 'SCROLL_TO':
          return action.navigation;
        default:
          return null;
      }
    default:
      // Variable changes and media controls do not move the person.
      return null;
  }
}

function flatten(
  actions: readonly RawAction[],
  conditional: boolean,
): { action: RawAction; conditional: boolean }[] {
  const out: { action: RawAction; conditional: boolean }[] = [];
  for (const action of actions) {
    if (action.type === 'CONDITIONAL') {
      for (const block of action.conditionalBlocks ?? []) {
        out.push(...flatten(block.actions, true));
      }
    } else {
      out.push({ action, conditional });
    }
  }
  return out;
}

export function parseReaction(reaction: RawReaction): ParsedAction[] {
  const trigger = reaction.trigger;
  if (!trigger) return [];
  const actions =
    reaction.actions && reaction.actions.length > 0
      ? reaction.actions
      : reaction.action
        ? [reaction.action]
        : [];
  const kind = triggerKind(trigger.type);
  const delay =
    kind === 'TIMEOUT'
      ? toSeconds(trigger.timeout ?? 0)
      : toSeconds(trigger.delay ?? 0);

  const parsed: ParsedAction[] = [];
  for (const { action, conditional } of flatten(actions, false)) {
    const navigation = navigationKind(action);
    if (navigation === null) continue;
    const hasDestination =
      navigation === 'NAVIGATE' ||
      navigation === 'OVERLAY' ||
      navigation === 'SWAP';
    parsed.push({
      trigger: kind,
      delaySeconds: kind === 'TIMEOUT' ? delay : 0,
      navigation,
      destinationId: hasDestination ? (action.destinationId ?? null) : null,
      transitionSeconds: action.transition
        ? toSeconds(action.transition.duration)
        : 0,
      conditional,
    });
  }
  return parsed;
}
