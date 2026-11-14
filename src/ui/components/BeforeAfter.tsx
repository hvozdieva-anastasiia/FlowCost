import { useId, useState } from 'react';
import { compare, summarize } from '../../shared/compare';
import { useFlow } from '../FlowProvider';
import {
  SUMMARY_LABELS,
  formatChange,
  formatPercent,
  formatSeconds,
} from '../format';

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Saves today's numbers so the person can change the design and compare. */
export function BeforeAfter() {
  const { state, dispatch, bridge, chosen } = useFlow();
  const labelId = useId();
  const pickId = useId();
  const [label, setLabel] = useState('');

  const names = (id: string | null) =>
    state.graph?.screens.find((screen) => screen.id === id)?.name ?? '';
  const startName = names(state.startId);
  const goalName = names(state.goalId);
  const suggestion = `${startName} to ${goalName}`;

  const saved = state.snapshots.find((item) => item.id === state.compareId);
  const deltas =
    saved && chosen ? compare(saved.summary, summarize(chosen)) : [];

  return (
    <details className="panel">
      <summary>Compare before and after</summary>
      <p className="hint">
        Save this result, change your prototype, then compare. Saved results
        live in this file.
      </p>
      <div className="field">
        <label htmlFor={labelId}>Name for this result</label>
        <div className="row">
          <input
            id={labelId}
            type="text"
            value={label}
            placeholder={suggestion}
            maxLength={120}
            onChange={(event) => setLabel(event.target.value)}
          />
          <button
            type="button"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              bridge.post({
                type: 'SNAPSHOT_SAVE',
                snapshot: {
                  id: newId(),
                  label: label.trim() || suggestion,
                  createdAt: Date.now(),
                  startName,
                  goalName,
                  summary: summarize(chosen),
                },
              });
              dispatch({
                type: 'notice',
                notice: { level: 'info', text: 'Result saved in this file.' },
              });
              setLabel('');
            }}
          >
            Save result
          </button>
        </div>
        {!chosen && (
          <p className="hint">Choose a route first, then save its result.</p>
        )}
      </div>

      {state.snapshots.length > 0 && (
        <div className="field">
          <label htmlFor={pickId}>Compare the current route with</label>
          <div className="row">
            <select
              id={pickId}
              value={state.compareId ?? ''}
              onChange={(event) =>
                dispatch({ type: 'compare', id: event.target.value || null })
              }
            >
              <option value="">Choose a saved result</option>
              {state.snapshots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({formatSeconds(item.summary.seconds)})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!saved}
              onClick={() =>
                saved && bridge.post({ type: 'SNAPSHOT_DELETE', id: saved.id })
              }
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {saved && chosen && (
        <table>
          <caption>{saved.label}, compared with the current route</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Before</th>
              <th scope="col">Now</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((delta) => (
              <tr key={delta.key}>
                <th scope="row">{SUMMARY_LABELS[delta.key]}</th>
                <td>
                  {delta.key === 'seconds'
                    ? delta.before.toFixed(1)
                    : delta.before}
                </td>
                <td>
                  {delta.key === 'seconds'
                    ? delta.after.toFixed(1)
                    : delta.after}
                </td>
                <td
                  className={
                    delta.change < 0
                      ? 'better'
                      : delta.change > 0
                        ? 'worse'
                        : ''
                  }
                >
                  {formatChange(delta.key, delta.change)}{' '}
                  {formatPercent(delta.percent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
