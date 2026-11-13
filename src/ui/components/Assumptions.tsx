import { useId } from 'react';
import {
  defaultAssumptions,
  type Assumptions,
  type Device,
  type Skill,
} from '../../shared/cost';
import { sanitizeAssumptions } from '../../shared/messages';
import { useFlow } from '../FlowProvider';

type NumericKey =
  | 'mental'
  | 'home'
  | 'keystroke'
  | 'pointFixed'
  | 'press'
  | 'scroll'
  | 'drag'
  | 'fittsA'
  | 'fittsB'
  | 'minTarget'
  | 'farIndex'
  | 'hickB'
  | 'manyChoices';

const NUMERIC_FIELDS: readonly {
  key: NumericKey;
  label: string;
  unit: string;
  step: number;
}[] = [
  { key: 'mental', label: 'Mental step (M)', unit: 's', step: 0.05 },
  { key: 'home', label: 'Hands to keyboard (H)', unit: 's', step: 0.05 },
  { key: 'keystroke', label: 'Key press (K)', unit: 's', step: 0.01 },
  { key: 'pointFixed', label: 'Pointing, fixed (P)', unit: 's', step: 0.05 },
  { key: 'press', label: 'Click or tap', unit: 's', step: 0.05 },
  { key: 'scroll', label: 'Scroll', unit: 's', step: 0.1 },
  { key: 'drag', label: 'Drag', unit: 's', step: 0.1 },
  { key: 'fittsA', label: "Fitts's a", unit: 's', step: 0.01 },
  { key: 'fittsB', label: "Fitts's b", unit: 's/bit', step: 0.01 },
  { key: 'hickB', label: "Hick's b", unit: 's/bit', step: 0.01 },
  { key: 'manyChoices', label: 'Many options from', unit: 'options', step: 1 },
  { key: 'minTarget', label: 'Smallest target', unit: 'px', step: 1 },
  { key: 'farIndex', label: 'Far target above', unit: 'bits', step: 0.1 },
];

export function AssumptionsPanel() {
  const { state, dispatch, bridge } = useFlow();
  const assumptions = state.settings.assumptions;
  const skillId = useId();
  const deviceId = useId();

  const apply = (next: Assumptions) => {
    const settings = { assumptions: sanitizeAssumptions(next) };
    dispatch({ type: 'settings', settings });
    bridge.post({ type: 'SETTINGS_SAVE', settings });
  };

  const setProfile = (skill: Skill, device: Device) =>
    apply({
      ...defaultAssumptions(skill, device),
      useFitts: assumptions.useFitts,
      useHick: assumptions.useHick,
    });

  return (
    <details className="panel">
      <summary>Profile and assumptions</summary>
      <div className="field">
        <label htmlFor={skillId}>Skill</label>
        <select
          id={skillId}
          value={assumptions.skill}
          onChange={(event) =>
            setProfile(event.target.value as Skill, assumptions.device)
          }
        >
          <option value="expert">Expert</option>
          <option value="regular">Regular</option>
          <option value="novice">Novice</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={deviceId}>Device</label>
        <select
          id={deviceId}
          value={assumptions.device}
          onChange={(event) =>
            setProfile(assumptions.skill, event.target.value as Device)
          }
        >
          <option value="mouse">Mouse</option>
          <option value="touch">Touch</option>
        </select>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={assumptions.useFitts}
          onChange={(event) =>
            apply({ ...assumptions, useFitts: event.target.checked })
          }
        />
        Point with Fitts&apos;s law
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={assumptions.useHick}
          onChange={(event) =>
            apply({ ...assumptions, useHick: event.target.checked })
          }
        />
        Add choice time by Hick&apos;s law
      </label>
      <p className="hint">
        These numbers are working assumptions. The model estimates a person who
        knows the task; it is not a measurement of real users.
      </p>
      <div className="grid-fields">
        {NUMERIC_FIELDS.map((item) => (
          <NumberField
            key={item.key}
            label={item.label}
            unit={item.unit}
            step={item.step}
            value={assumptions[item.key]}
            onCommit={(value) => apply({ ...assumptions, [item.key]: value })}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setProfile(assumptions.skill, assumptions.device)}
      >
        Reset to defaults
      </button>
    </details>
  );
}

function NumberField({
  label,
  unit,
  step,
  value,
  onCommit,
}: {
  label: string;
  unit: string;
  step: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="field compact">
      <label htmlFor={id}>{label}</label>
      <div className="row">
        <input
          id={id}
          type="number"
          step={step}
          min={0}
          value={value}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (Number.isFinite(next)) onCommit(next);
          }}
        />
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}
