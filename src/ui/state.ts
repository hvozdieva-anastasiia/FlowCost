// The window's state: what Plugin Main last sent plus what the person chose.

import type { Snapshot } from '../shared/compare';
import type { FlowGraph } from '../shared/graph';
import {
  defaultSettings,
  type PluginMessage,
  type Settings,
} from '../shared/messages';

export type Tab = 'cost' | 'check';

/** Which priced path the results show. */
export type PathChoice =
  | { readonly kind: 'fastest' }
  | { readonly kind: 'fewest' }
  | { readonly kind: 'alternative'; readonly index: number };

export interface Notice {
  readonly level: 'info' | 'error';
  readonly text: string;
}

export interface Selection {
  /** The screens that hold the selected layers. */
  readonly screenIds: readonly string[];
  /** How many layers are selected. */
  readonly count: number;
}

export interface FlowState {
  readonly tab: Tab;
  readonly settings: Settings;
  readonly snapshots: readonly Snapshot[];
  readonly graph: FlowGraph | null;
  /** The prototype is being read from the canvas right now. */
  readonly scanning: boolean;
  /** When the prototype was last read, in epoch milliseconds. */
  readonly lastReadAt: number | null;
  readonly selection: Selection;
  readonly startId: string | null;
  readonly goalId: string | null;
  readonly path: PathChoice;
  readonly compareId: string | null;
  readonly notice: Notice | null;
}

export const initialState: FlowState = {
  tab: 'cost',
  settings: defaultSettings(),
  snapshots: [],
  graph: null,
  scanning: true,
  lastReadAt: null,
  selection: { screenIds: [], count: 0 },
  startId: null,
  goalId: null,
  path: { kind: 'fastest' },
  compareId: null,
  notice: null,
};

export type Action =
  /** A message from Plugin Main, with the time it arrived. */
  | {
      readonly type: 'plugin';
      readonly message: PluginMessage;
      readonly at: number;
    }
  | { readonly type: 'scanning' }
  | { readonly type: 'tab'; readonly tab: Tab }
  | { readonly type: 'start'; readonly id: string | null }
  | { readonly type: 'goal'; readonly id: string | null }
  | { readonly type: 'swap' }
  | { readonly type: 'path'; readonly path: PathChoice }
  | { readonly type: 'compare'; readonly id: string | null }
  | { readonly type: 'settings'; readonly settings: Settings }
  | { readonly type: 'notice'; readonly notice: Notice }
  | { readonly type: 'dismiss' };

function hasScreen(graph: FlowGraph | null, id: string | null): boolean {
  return (
    id !== null && graph !== null && graph.screens.some((s) => s.id === id)
  );
}

function applyGraph(state: FlowState, graph: FlowGraph, at: number): FlowState {
  const firstStart = graph.starts.find((start) =>
    graph.screens.some((screen) => screen.id === start.id),
  );
  const startId = hasScreen(graph, state.startId)
    ? state.startId
    : (firstStart?.id ?? null);
  const goalId = hasScreen(graph, state.goalId) ? state.goalId : null;
  return {
    ...state,
    graph,
    scanning: false,
    lastReadAt: at,
    startId,
    goalId,
    // Keep the chosen route when the page is read again, unless it is gone.
    path:
      startId === state.startId && goalId === state.goalId
        ? state.path
        : { kind: 'fastest' },
  };
}

export function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case 'plugin': {
      const message = action.message;
      switch (message.type) {
        case 'STATE':
          return {
            ...state,
            settings: message.settings,
            snapshots: message.snapshots,
          };
        case 'SCAN_RESULT':
          return applyGraph(state, message.graph, action.at);
        case 'SELECTION':
          return {
            ...state,
            selection: { screenIds: message.screenIds, count: message.count },
          };
        case 'SNAPSHOTS': {
          const stillThere = message.snapshots.some(
            (item) => item.id === state.compareId,
          );
          return {
            ...state,
            snapshots: message.snapshots,
            compareId: stillThere ? state.compareId : null,
          };
        }
        case 'PAGE_CHANGED':
        case 'PAGE_EDITED':
          // The provider reads the page again; nothing to change here.
          return state;
        case 'NOTICE':
          return {
            ...state,
            scanning: message.level === 'error' ? false : state.scanning,
            notice: { level: message.level, text: message.text },
          };
      }
      return state;
    }
    case 'scanning':
      return { ...state, scanning: true };
    case 'tab':
      return { ...state, tab: action.tab };
    case 'start':
      return { ...state, startId: action.id, path: { kind: 'fastest' } };
    case 'goal':
      return { ...state, goalId: action.id, path: { kind: 'fastest' } };
    case 'swap':
      return {
        ...state,
        startId: state.goalId,
        goalId: state.startId,
        path: { kind: 'fastest' },
      };
    case 'path':
      return { ...state, path: action.path };
    case 'compare':
      return { ...state, compareId: action.id };
    case 'settings':
      return { ...state, settings: action.settings, path: { kind: 'fastest' } };
    case 'notice':
      return { ...state, notice: action.notice };
    case 'dismiss':
      return { ...state, notice: null };
  }
}
