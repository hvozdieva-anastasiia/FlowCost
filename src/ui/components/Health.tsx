import { useMemo } from 'react';
import { checkHealth, type HealthIssue } from '../../shared/health';
import { useFlow } from '../FlowProvider';

const ORDER = { error: 0, warning: 1, info: 2 } as const;
const SEVERITY_LABEL = {
  error: 'Error',
  warning: 'Warning',
  info: 'Note',
} as const;

export function useHealth(): readonly HealthIssue[] {
  const { state } = useFlow();
  const graph = state.graph;
  return useMemo(
    () =>
      graph
        ? checkHealth(graph).sort(
            (a, b) => ORDER[a.severity] - ORDER[b.severity],
          )
        : [],
    [graph],
  );
}

export function Health() {
  const { state, bridge } = useFlow();
  const issues = useHealth();

  if (!state.graph) return <p className="hint">Reading the page…</p>;
  if (issues.length === 0) {
    return (
      <p role="status" className="hint">
        No problems found in the prototype links on this page.
      </p>
    );
  }
  return (
    <ul className="issues" aria-label="Prototype problems">
      {issues.map((issue, i) => (
        <li key={i} className={`issue ${issue.severity}`}>
          <div>
            <strong>{SEVERITY_LABEL[issue.severity]}</strong>
            <div>{issue.message}</div>
          </div>
          {issue.nodeId && (
            <button
              type="button"
              onClick={() =>
                issue.nodeId &&
                bridge.post({ type: 'REVEAL', nodeId: issue.nodeId })
              }
            >
              Show
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
