import { useId, useState } from 'react';
import { DEFAULT_FIELD_CHARS } from '../../shared/graph';
import { plural } from '../format';
import { useFlow } from '../FlowProvider';

/** Corrects what Flow Cost guessed: which layers are input fields, where flows end. */
export function Teach() {
  const { state, bridge } = useFlow();
  const charsId = useId();
  const [chars, setChars] = useState(DEFAULT_FIELD_CHARS);
  const { selection } = state;
  const hasLayers = selection.count > 0;
  const hasScreens = selection.screenIds.length > 0;

  return (
    <details className="panel">
      <summary>Teach Flow Cost</summary>
      <h3>Input fields</h3>
      <p className="hint">
        Fields are found by layer names such as &quot;Email input&quot;. If it
        guessed wrong, select the layers on the canvas and tell it here.
        {hasLayers
          ? ` Selected: ${plural(selection.count, 'layer', 'layers')}.`
          : ' Select layers on the canvas first.'}
      </p>
      <div className="field">
        <label htmlFor={charsId}>Characters typed into each field</label>
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
          disabled={!hasLayers}
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
          These are input fields
        </button>
        <button
          type="button"
          disabled={!hasLayers}
          onClick={() =>
            bridge.post({ type: 'MARK_INPUT', mark: { kind: 'not-input' } })
          }
        >
          These are not
        </button>
        <button
          type="button"
          disabled={!hasLayers}
          onClick={() =>
            bridge.post({ type: 'MARK_INPUT', mark: { kind: 'clear' } })
          }
        >
          Forget my choice
        </button>
      </div>

      <h3>Where a flow ends</h3>
      <p className="hint">
        A confirmation or success screen is meant to be the last one. Mark it,
        and Check stops listing it as having no way out.
        {hasScreens
          ? ''
          : ' Select a screen, or a layer inside it, on the canvas first.'}
      </p>
      <div className="row wrap">
        <button
          type="button"
          disabled={!hasScreens}
          onClick={() => bridge.post({ type: 'MARK_ENDING', value: true })}
        >
          Mark selected screen as an end
        </button>
        <button
          type="button"
          disabled={!hasScreens}
          onClick={() => bridge.post({ type: 'MARK_ENDING', value: false })}
        >
          Remove the mark
        </button>
      </div>
      <p className="hint">
        Marks are saved in this file and change nothing in your design.
      </p>
    </details>
  );
}
