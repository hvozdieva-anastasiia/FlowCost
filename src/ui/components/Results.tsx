import { useId } from 'react';
import type { PathResult } from '../../shared/analysis';
import { useFlow } from '../FlowProvider';
import {
  FRICTION_LABELS,
  OPERATOR_NAMES,
  SUMMARY_LABELS,
  audienceText,
  formatSeconds,
  headline,
  plural,
} from '../format';

function Facts({ items }: { items: readonly [string, string][] }) {
  return (
    <dl className="facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RouteChoice() {
  const { state, dispatch, analysis } = useFlow();
  const id = useId();
  if (!analysis) return null;
  const choice = state.path;
  const alternatives = analysis.alternatives;
  return (
    <div className="field">
      <span id={id} className="label">
        Which route
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
          Fewest actions
        </button>
      </div>
      {alternatives.length > 1 && (
        <select
          aria-label="Other routes"
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
          <option value="">Other routes ({alternatives.length})</option>
          {alternatives.map((path, index) => (
            <option key={index} value={index}>
              {`${formatSeconds(path.seconds)}, ${plural(path.actions, 'action', 'actions')}`}
            </option>
          ))}
        </select>
      )}
      {analysis.truncated && (
        <p className="hint">
          The search stopped at its limit, so some routes are not listed.
        </p>
      )}
    </div>
  );
}

function Steps({ path }: { path: PathResult }) {
  const { bridge } = useFlow();
  if (path.steps.length === 0) {
    return <p className="hint">From and To are the same screen.</p>;
  }
  return (
    <ol className="steps">
      {path.steps.map((step) => (
        <li key={`${step.index}-${step.linkId}`}>
          <details>
            <summary>
              <span className="step-title">
                {step.index}. {step.label}
                {step.automatic ? ' (happens by itself)' : ''}
              </span>
              <span className="step-time">{formatSeconds(step.seconds)}</span>
            </summary>
            <p className="hint">
              On &quot;{step.screenName}&quot;, leads to &quot;
              {step.toScreenName}&quot;
              {step.conditional ? '. Only on one branch of a condition.' : '.'}
            </p>
            <table>
              <caption className="visually-hidden">
                How step {step.index} adds up
              </caption>
              <thead>
                <tr>
                  <th scope="col">Part</th>
                  <th scope="col">What happens</th>
                  <th scope="col">Seconds</th>
                </tr>
              </thead>
              <tbody>
                {step.operators.map((operator, i) => (
                  <tr key={i}>
                    <td>{OPERATOR_NAMES[operator.kind]}</td>
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
              Show on canvas
            </button>
          </details>
        </li>
      ))}
    </ol>
  );
}

function Problems({ path }: { path: PathResult }) {
  const { bridge } = useFlow();
  if (path.friction.length === 0) {
    return <p className="hint">Nothing slows this route down.</p>;
  }
  return (
    <ul className="issues">
      {path.friction.map((point, i) => (
        <li key={i}>
          <div>
            <strong>{FRICTION_LABELS[point.kind]}</strong>
            <span className="hint"> · step {point.step}</span>
            <div>{point.message}</div>
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

function Shape({ path }: { path: PathResult }) {
  const { analysis } = useFlow();
  const flow = analysis?.flow ?? null;
  const items: [string, string][] = [
    [SUMMARY_LABELS.decisionPoints, String(path.decisionPoints)],
    [SUMMARY_LABELS.noReturn, String(path.noReturn)],
    [
      'Longest way back',
      path.longestReturn === 0
        ? 'none'
        : plural(path.longestReturn, 'action', 'actions'),
    ],
  ];
  if (flow) {
    items.push(
      ['Screens between From and To', String(flow.screens)],
      ['Connections between them', String(flow.links)],
      ['Screens with a fork', String(flow.decisionScreens)],
      ['Independent routes', String(flow.cyclomatic)],
    );
  }
  return (
    <details className="panel">
      <summary>Shape of the flow</summary>
      <p className="hint">
        How tangled the prototype is between these two screens, not only along
        this route.
      </p>
      <Facts items={items} />
    </details>
  );
}

/** Says what to do when there is nothing to show yet. */
function EmptyState() {
  const { state, dispatch } = useFlow();
  const { graph, startId, goalId } = state;
  if (!graph) {
    return (
      <p className="empty" role="status">
        Reading the prototype…
      </p>
    );
  }
  if (graph.screens.length === 0) {
    return (
      <div className="empty">
        <p>
          <strong>No screens on this page.</strong>
        </p>
        <p>
          Flow Cost works on top-level frames connected in the Prototype tab.
          Open a page that has them.
        </p>
      </div>
    );
  }
  if (!startId || !goalId) {
    const startName = graph.screens.find((s) => s.id === startId)?.name;
    return (
      <div className="empty">
        <p>
          <strong>
            {startName
              ? 'Choose where the flow ends.'
              : 'Choose where the flow starts and ends.'}
          </strong>
        </p>
        <p>
          {startName
            ? `Flow Cost follows your prototype connections from "${startName}" and works out how long a person needs, and how many clicks, how much typing and how many choices it takes.`
            : 'Flow Cost follows your prototype connections between the two screens and works out how long a person needs, and how many clicks, how much typing and how many choices it takes.'}
        </p>
        {!startId && (
          <p className="hint">
            This page has no flow start, so pick the From screen too.
          </p>
        )}
      </div>
    );
  }
  const name = (id: string) =>
    graph.screens.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="empty" role="status">
      <p>
        <strong>
          No connection leads from &quot;{name(startId)}&quot; to &quot;
          {name(goalId)}&quot;.
        </strong>
      </p>
      <p>
        The prototype has no path between them, so there is nothing to price.
        The Check tab shows broken or missing connections.
      </p>
      <button
        type="button"
        onClick={() => dispatch({ type: 'tab', tab: 'check' })}
      >
        Open Check
      </button>
    </div>
  );
}

export function Results() {
  const { state, analysis, chosen } = useFlow();
  const { graph, startId, goalId } = state;

  if (!graph || !startId || !goalId || !analysis || !chosen) {
    return (
      <section aria-labelledby="result-heading">
        <h2 id="result-heading">Result</h2>
        <EmptyState />
      </section>
    );
  }

  const name = (id: string) =>
    graph.screens.find((s) => s.id === id)?.name ?? id;

  return (
    <section aria-labelledby="result-heading">
      <h2 id="result-heading">Result</h2>
      <p className="headline">{headline(chosen)}</p>
      <p className="hint">
        From {name(startId)} to {name(goalId)}, for{' '}
        {audienceText(state.settings.assumptions)}.
      </p>
      {chosen.assumed && (
        <p className="hint">
          This route crosses a condition. Variable values are not simulated, so
          the branch is counted as possible.
        </p>
      )}
      <Facts
        items={[
          [SUMMARY_LABELS.seconds, formatSeconds(chosen.seconds)],
          [SUMMARY_LABELS.actions, String(chosen.actions)],
          [SUMMARY_LABELS.screens, String(chosen.screens)],
          [SUMMARY_LABELS.typedChars, String(chosen.typedChars)],
          [SUMMARY_LABELS.friction, String(chosen.friction.length)],
        ]}
      />
      <RouteChoice />
      <h3>Steps</h3>
      <Steps path={chosen} />
      <h3>Problems on this route</h3>
      <Problems path={chosen} />
      <Shape path={chosen} />
    </section>
  );
}
