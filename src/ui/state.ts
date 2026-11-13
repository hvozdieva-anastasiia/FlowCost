// The window's state: what Plugin Main last sent plus what the person chose.

import type { Snapshot } from '../shared/compare';
import type { FlowGraph } from '../shared/graph';
import {
  defaultSettings,
  type PluginMessage,
  type Settings,
} from '../shared/messages';

export type Tab = 'analyze' | 'health';

/** Which priced path the results show. */
export type PathChoice =
  | { readonly kind: 'fastest' }
  | { readonly kind: 'fewest' }
  | { readonly kind: 'alternative'; readonly index: number };

export interface Notice {
  readonly level: 'info' | 'error';
  readonly text: string;
}

export interface FlowState {
  readonly tab: Tab;
  readonly settings: Settings;
  readonly snapshots: readonly Snapshot[];
  readonly graph: FlowGraph | null;
  /** The page changed since the graph was read. */
  readonly stale: boolean;
  readonly selection: readonly string[];
  readonly startId: string | null;
  readonly goalId: string | null;
  readonly path: PathChoice;
  readonly compareId: string | null;
  readonly notice: Notice | null;
}

export const initialState: FlowState = {
  tab: 'analyze',
  settings: defaultSettings(),
  snapshots: [],
  graph: null,
  stale: false,
  selection: [],
  startId: null,
  goalId: null,
  path: { kind: 'fastest' },
  compareId: null,
  notice: null,
};

export type Action =
  | { readonly type: 'plugin'; readonly message: PluginMessage }
  | { readonly type: 'tab'; readonly tab: Tab }
  | { readonly type: 'start'; readonly id: string | null }
  | { readonly type: 'goal'; readonly id: string | null }
  | { readonly type: 'path'; readonly path: PathChoice }
  | { readonly type: 'compare'; readonly id: string | null }
  | { readonly type: 'settings'; readonly settings: Settings }
  | { readonly type: 'dismiss' };

function hasScreen(graph: FlowGraph | null, id: string | null): boolean {
  return (
    id !== null && graph !== null && graph.screens.some((s) => s.id === id)
  );
}

function applyGraph(state: FlowState, graph: FlowGraph): FlowState {
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
    stale: false,
    startId,
    goalId,
    path: { kind: 'fastest' },
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
          return applyGraph(state, message.graph);
        case 'SELECTION':
          return { ...state, selection: message.screenIds };
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
          return { ...state, stale: true };
        case 'NOTICE':
          return {
            ...state,
            notice: { level: message.level, text: message.text },
          };
      }
      return state;
    }
    case 'tab':
      return { ...state, tab: action.tab };
    case 'start':
      return { ...state, startId: action.id, path: { kind: 'fastest' } };
    case 'goal':
      return { ...state, goalId: action.id, path: { kind: 'fastest' } };
    case 'path':
      return { ...state, path: action.path };
    case 'compare':
      return { ...state, compareId: action.id };
    case 'settings':
      return { ...state, settings: action.settings, path: { kind: 'fastest' } };
    case 'dismiss':
      return { ...state, notice: null };
  }
}
