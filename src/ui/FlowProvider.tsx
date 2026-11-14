import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { analyze, type Analysis, type PathResult } from '../shared/analysis';
import type { Bridge } from './bridge';
import { initialState, reducer, type Action, type FlowState } from './state';

interface FlowContextValue {
  readonly state: FlowState;
  readonly dispatch: Dispatch<Action>;
  readonly bridge: Bridge;
  readonly analysis: Analysis | null;
  /** The path the person picked among the priced ones. */
  readonly chosen: PathResult | null;
  /** Reads the prototype from the canvas again. */
  readonly refresh: () => void;
}

const FlowContext = createContext<FlowContextValue | null>(null);

export function useFlow(): FlowContextValue {
  const value = use(FlowContext);
  if (!value) throw new Error('useFlow must be used inside FlowProvider');
  return value;
}

/** Edits come in bursts; read the prototype once they pause. */
const AUTO_REFRESH_MS = 600;
const NOTICE_MS = { info: 5_000, error: 9_000 } as const;

export function FlowProvider({
  bridge,
  children,
}: {
  bridge: Bridge;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const refresh = useCallback(() => {
    dispatch({ type: 'scanning' });
    bridge.post({ type: 'SCAN' });
  }, [bridge]);

  useEffect(() => {
    const stop = bridge.subscribe((message) => {
      dispatch({ type: 'plugin', message, at: Date.now() });
      if (message.type === 'PAGE_EDITED' || message.type === 'PAGE_CHANGED') {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => {
          dispatch({ type: 'scanning' });
          bridge.post({ type: 'SCAN' });
        }, AUTO_REFRESH_MS);
      }
    });
    bridge.post({ type: 'READY' });
    return () => {
      stop();
      clearTimeout(refreshTimer.current);
    };
  }, [bridge]);

  // A message stays long enough to read, then goes by itself.
  const { notice } = state;
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => dispatch({ type: 'dismiss' }),
      NOTICE_MS[notice.level],
    );
    return () => clearTimeout(timer);
  }, [notice]);

  const { graph, startId, goalId, settings, path } = state;
  const analysis = useMemo(
    () =>
      graph && startId && goalId
        ? analyze(graph, startId, goalId, settings.assumptions)
        : null,
    [graph, startId, goalId, settings.assumptions],
  );

  const chosen = useMemo(() => {
    if (!analysis) return null;
    if (path.kind === 'fewest') return analysis.fewest;
    if (path.kind === 'alternative') {
      return analysis.alternatives[path.index] ?? analysis.fastest;
    }
    return analysis.fastest;
  }, [analysis, path]);

  const value = useMemo(
    () => ({ state, dispatch, bridge, analysis, chosen, refresh }),
    [state, bridge, analysis, chosen, refresh],
  );

  return <FlowContext value={value}>{children}</FlowContext>;
}
