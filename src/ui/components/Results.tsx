import { useId } from 'react';
import type { PathResult } from '../../shared/analysis';
import { useFlow } from '../FlowProvider';
import { FRICTION_LABELS, SUMMARY_LABELS, formatSeconds } from '../format';

function Summary({ path }: { path: PathResult }) {
  const items: [string, string][] = [
    [SUMMARY_LABELS.actions, String(path.actions)],
    [SUMMARY_LABELS.screens, String(path.screens)],
    [SUMMARY_LABELS.seconds, formatSeconds(path.seconds)],
    [SUMMARY_LABELS.taps, String(path.taps)],
    [SUMMARY_LABELS.typedChars, String(path.typedChars)],
    [SUMMARY_LABELS.friction, String(path.friction.length)],
  ];
  return (
    <dl className="summary">
      {items.map(([label, value]) => (
        <div key={label} className="metric">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PathChoice() {
  const { state, dispatch, analysis } = useFlow();
  const id = useId();
  if (!analysis) return null;
  const choice = state.path;
  const alternatives = analysis.alternatives;
  return (
    <div className="field">
      <span id={id} className="label">
        Path
      </span>
      <div className="segments" role="group" aria-labelledby={id}>
        <button
          type="button"
          aria-pressed={choice.kind === 'fastest'}
          onClick={() => dispatch({ type: 'path', path: { kind: 'fastest' } })}
        >
          Fastest
        </button>
        <button
          type="button"
          aria-pressed={choice.kind === 'fewest'}
          onClick={() => dispatch({ type: 'path', path: { kind: 'fewest' } })}
        >
          Fewest steps
        </button>
      </div>
      {alternatives.length > 1 && (
        <select
          aria-label="Other paths"
          value={choice.kind === 'alternative' ? String(choice.index) : ''}
          onChange={(event) => {
            const value = event.target.value;
            dispatch({
              type: 'path',
              path:
                value === ''
                  ? { kind: 'fastest' }
                  : { kind: 'alternative', index: Number(value) },
            });
          }}
        >
          <option value="">Other paths ({alternatives.length})</option>
          {alternatives.map((path, index) => (
            <option key={index} value={index}>
              {`#${index + 1}: ${formatSeconds(path.seconds)}, ${path.actions} actions`}
            </option>
          ))}
        </select>
      )}
      {analysis.truncated && (
        <p className="hint">
          The search stopped at its limit, so some paths are not listed.
        </p>
      )}
    </div>
  );
}

function Steps({ path }: { path: PathResult }) {
  const { bridge } = useFlow();
  if (path.steps.length === 0) {
    return <p className="hint">Start and goal are the same screen.</p>;
  }
  return (
    <ol className="steps">
      {path.steps.map((step) => (
        <li key={`${step.index}-${step.linkId}`}>
          <details>
            <summary>
              <span className="step-title">
                {step.index}. {step.label}
                {step.automatic ? ' (timer)' : ''}
              </span>
              <span className="step-time">{formatSeconds(step.seconds)}</span>
            </summary>
            <p className="hint">
              {step.screenName} to {step.toScreenName}
              {step.conditional ? ' (conditional branch)' : ''}
            </p>
            <table>
              <caption className="visually-hidden">
                How step {step.index} adds up
              </caption>
              <thead>
                <tr>
                  <th scope="col">Op</th>
                  <th scope="col">What</th>
                  <th scope="col">Seconds</th>
                </tr>
              </thead>
              <tbody>
                {step.operators.map((operator, i) => (
                  <tr key={i}>
                    <td>{operator.kind}</td>
                    <td>{operator.label}</td>
                    <td>{operator.seconds.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() =>
                bridge.post({ type: 'REVEAL', nodeId: step.nodeId })
              }
            >
              Show layer
            </button>
          </details>
        </li>
      ))}
    </ol>
  );
}

function Friction({ path }: { path: PathResult }) {
  const { bridge } = useFlow();
  if (path.friction.length === 0) {
    return <p className="hint">No friction points on this path.</p>;
  }
  return (
    <ul className="issues">
      {path.friction.map((point, i) => (
        <li key={i}>
          <div>
            <strong>{FRICTION_LABELS[point.kind]}</strong>, step {point.step}
            <div className="hint">{point.message}</div>
          </div>
          <button
            type="button"
            onClick={() =>
              bridge.post({ type: 'REVEAL', nodeId: point.nodeId })
            }
          >
            Show
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Results() {
  const { state, analysis, chosen } = useFlow();
  const { graph, startId, goalId } = state;

  if (!graph) return <p className="hint">Reading the page…</p>;
  if (graph.screens.length === 0) {
    return (
      <p className="hint">
        This page has no frames. Open a page with a prototype.
      </p>
    );
  }
  if (!startId || !goalId || !analysis) {
    return (
      <p className="hint">
        Choose where the flow starts and where it ends to see what it costs.
      </p>
    );
  }
  if (!chosen) {
    return (
      <p role="status" className="empty">
        There is no path from the start to the goal. Check the Health tab for
        broken links and dead ends.
      </p>
    );
  }
  return (
    <section aria-label="Result">
      <Summary path={chosen} />
      {chosen.assumed && (
        <p className="hint">
          This path crosses a conditional branch. Variable values are not
          simulated, so the branch is counted as possible.
        </p>
      )}
      <PathChoice />
      <h2>Steps</h2>
      <Steps path={chosen} />
      <h2>Friction</h2>
      <Friction path={chosen} />
    </section>
  );
}
