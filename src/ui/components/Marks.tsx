import { useId, useState } from 'react';
import { DEFAULT_FIELD_CHARS } from '../../shared/graph';
import { useFlow } from '../FlowProvider';

export function Marks() {
  const { bridge } = useFlow();
  const charsId = useId();
  const [chars, setChars] = useState(DEFAULT_FIELD_CHARS);

  return (
    <details className="panel">
      <summary>Marks</summary>
      <p className="hint">
        Fields are found by their layer names. Select layers on the canvas to
        correct that. Marks are stored in this file and change nothing in the
        design.
      </p>
      <div className="field">
        <label htmlFor={charsId}>Characters typed into a field</label>
        <input
          id={charsId}
          type="number"
          min={1}
          max={500}
          value={chars}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) setChars(next);
          }}
        />
      </div>
      <div className="row wrap">
        <button
          type="button"
          onClick={() =>
            bridge.post({
              type: 'MARK_INPUT',
              mark: {
                kind: 'input',
                chars: Math.min(500, Math.max(1, Math.round(chars))),
              },
            })
          }
        >
          Selected layers are inputs
        </button>
        <button
          type="button"
          onClick={() =>
            bridge.post({ type: 'MARK_INPUT', mark: { kind: 'not-input' } })
          }
        >
          Not inputs
        </button>
        <button
          type="button"
          onClick={() =>
            bridge.post({ type: 'MARK_INPUT', mark: { kind: 'clear' } })
          }
        >
          Clear input marks
        </button>
      </div>
      <div className="row wrap">
        <button
          type="button"
          onClick={() => bridge.post({ type: 'MARK_ENDING', value: true })}
        >
          Selected screen is an ending
        </button>
        <button
          type="button"
          onClick={() => bridge.post({ type: 'MARK_ENDING', value: false })}
        >
          Clear ending mark
        </button>
      </div>
    </details>
  );
}
