import {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
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
}

const FlowContext = createContext<FlowContextValue | null>(null);

export function useFlow(): FlowContextValue {
  const value = use(FlowContext);
  if (!value) throw new Error('useFlow must be used inside FlowProvider');
  return value;
}

export function FlowProvider({
  bridge,
  children,
}: {
  bridge: Bridge;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const stop = bridge.subscribe((message) =>
      dispatch({ type: 'plugin', message }),
    );
    bridge.post({ type: 'READY' });
    return stop;
  }, [bridge]);

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
    () => ({ state, dispatch, bridge, analysis, chosen }),
    [state, bridge, analysis, chosen],
  );

  return <FlowContext value={value}>{children}</FlowContext>;
}
