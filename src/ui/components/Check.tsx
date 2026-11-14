import { useMemo } from 'react';
import {
  checkHealth,
  type HealthIssue,
  type Severity,
} from '../../shared/health';
import { useFlow } from '../FlowProvider';

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

const GROUPS: readonly { severity: Severity; title: string }[] = [
  { severity: 'error', title: 'Fix these' },
  { severity: 'warning', title: 'Worth a look' },
  { severity: 'info', title: 'Good to know' },
];

export function useIssues(): readonly HealthIssue[] {
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

/** Problems and warnings, not notes: the number worth showing on the tab. */
export function useProblemCount(): number {
  return useIssues().filter((issue) => issue.severity !== 'info').length;
}

function Issue({ issue }: { issue: HealthIssue }) {
  const { bridge } = useFlow();
  const nodeId = issue.nodeId;
  return (
    <li className={`issue ${issue.severity}`}>
      <div>
        <strong>{issue.title}</strong>
        <div className="hint">{issue.hint}</div>
      </div>
      <span className="row wrap">
        {nodeId && (
          <button
            type="button"
            onClick={() => bridge.post({ type: 'REVEAL', nodeId })}
          >
            Show on canvas
          </button>
        )}
        {issue.canMarkEnding && nodeId && (
          <button
            type="button"
            onClick={() =>
              bridge.post({
                type: 'MARK_ENDING',
                value: true,
                screenId: nodeId,
              })
            }
          >
            Mark as end of flow
          </button>
        )}
      </span>
    </li>
  );
}

export function Check() {
  const { state } = useFlow();
  const issues = useIssues();

  return (
    <section aria-labelledby="check-heading">
      <h2 id="check-heading">Prototype connections</h2>
      <p className="hint">
        Looks for broken or unfinished connections on this page. It says nothing
        about the design itself.
      </p>
      {!state.graph ? (
        <p className="empty" role="status">
          Reading the prototype…
        </p>
      ) : issues.length === 0 ? (
        <p className="empty" role="status">
          <strong>No problems found.</strong> Every connection leads somewhere,
          and every screen can be reached and left.
        </p>
      ) : (
        GROUPS.map(({ severity, title }) => {
          const group = issues.filter((issue) => issue.severity === severity);
          if (group.length === 0) return null;
          return (
            <div key={severity}>
              <h3>
                {title} ({group.length})
              </h3>
              <ul className="issues">
                {group.map((issue, i) => (
                  <Issue key={i} issue={issue} />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
