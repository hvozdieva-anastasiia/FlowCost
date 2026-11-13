import { useId } from 'react';
import { useFlow } from '../FlowProvider';

function Picker({
  label,
  value,
  onChange,
  onUseSelection,
  canUseSelection,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  onUseSelection: () => void;
  canUseSelection: boolean;
}) {
  const { state } = useFlow();
  const id = useId();
  const screens = state.graph?.screens ?? [];
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row">
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
        <button
          type="button"
          onClick={onUseSelection}
          disabled={!canUseSelection}
          title="Use the screen that is selected on the canvas"
        >
          Use selection
        </button>
      </div>
    </div>
  );
}

export function ScreenPicker() {
  const { state, dispatch } = useFlow();
  const selected =
    state.selection.length === 1 ? (state.selection[0] ?? null) : null;
  const known =
    selected !== null &&
    (state.graph?.screens.some((screen) => screen.id === selected) ?? false);
  return (
    <section aria-label="Flow">
      <Picker
        label="Start"
        value={state.startId}
        onChange={(id) => dispatch({ type: 'start', id })}
        onUseSelection={() => dispatch({ type: 'start', id: selected })}
        canUseSelection={known}
      />
      <Picker
        label="Goal"
        value={state.goalId}
        onChange={(id) => dispatch({ type: 'goal', id })}
        onUseSelection={() => dispatch({ type: 'goal', id: selected })}
        canUseSelection={known}
      />
    </section>
  );
}
