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

export function CompareSection() {
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
      <summary>Compare with a snapshot</summary>
      <div className="field">
        <label htmlFor={labelId}>Snapshot name</label>
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
              setLabel('');
            }}
          >
            Save snapshot
          </button>
        </div>
      </div>

      {state.snapshots.length === 0 ? (
        <p className="hint">
          A snapshot keeps today&apos;s numbers in this file. Change the design,
          then compare.
        </p>
      ) : (
        <div className="field">
          <label htmlFor={pickId}>Compare with</label>
          <div className="row">
            <select
              id={pickId}
              value={state.compareId ?? ''}
              onChange={(event) =>
                dispatch({ type: 'compare', id: event.target.value || null })
              }
            >
              <option value="">Choose a snapshot</option>
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
          <caption>{saved.label} compared with the current path</caption>
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
