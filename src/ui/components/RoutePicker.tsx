import { useId } from 'react';
import { useFlow } from '../FlowProvider';
import { SwapIcon } from './Icons';

function ScreenSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { state } = useFlow();
  const id = useId();
  const screens = state.graph?.screens ?? [];
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Choose a screen</option>
        {screens.map((screen) => (
          <option key={screen.id} value={screen.id}>
            {screen.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** What is selected on the canvas, and what can be done with it. */
function CanvasSelection() {
  const { state, dispatch } = useFlow();
  const { selection, graph, startId, goalId } = state;
  if (!graph) return null;

  const only =
    selection.screenIds.length === 1 ? (selection.screenIds[0] ?? null) : null;
  const screen = graph.screens.find((item) => item.id === only);

  if (selection.count === 0) {
    return (
      <p className="hint">
        Select a screen on the canvas to use it as From or To.
      </p>
    );
  }
  if (!screen) {
    return (
      <p className="hint">
        Select one screen, or a layer inside it, to use it as From or To.
      </p>
    );
  }
  return (
    <div className="selection-strip">
      <span>
        Selected on the canvas: <strong>{screen.name}</strong>
      </span>
      <span className="row">
        <button
          type="button"
          disabled={screen.id === startId}
          onClick={() => dispatch({ type: 'start', id: screen.id })}
        >
          Use as From
        </button>
        <button
          type="button"
          disabled={screen.id === goalId}
          onClick={() => dispatch({ type: 'goal', id: screen.id })}
        >
          Use as To
        </button>
      </span>
    </div>
  );
}

export function RoutePicker() {
  const { state, dispatch } = useFlow();
  return (
    <section aria-labelledby="route-heading">
      <h2 id="route-heading">Route</h2>
      <div className="route">
        <ScreenSelect
          label="From"
          value={state.startId}
          onChange={(id) => dispatch({ type: 'start', id })}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Swap From and To"
          title="Swap From and To"
          disabled={!state.startId && !state.goalId}
          onClick={() => dispatch({ type: 'swap' })}
        >
          <SwapIcon />
        </button>
        <ScreenSelect
          label="To"
          value={state.goalId}
          onChange={(id) => dispatch({ type: 'goal', id })}
        />
      </div>
      <CanvasSelection />
    </section>
  );
}
