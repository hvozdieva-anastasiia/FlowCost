import { useId } from 'react';
import {
  defaultAssumptions,
  type Assumptions,
  type Device,
  type Skill,
} from '../../shared/cost';
import { sanitizeAssumptions } from '../../shared/messages';
import { useFlow } from '../FlowProvider';
import { Segmented } from './Segmented';

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
  | 'hickB'
  | 'manyChoices'
  | 'minTarget'
  | 'farIndex';

const TIMINGS: readonly {
  key: NumericKey;
  label: string;
  unit: string;
  step: number;
}[] = [
  { key: 'mental', label: 'Thinking before an action', unit: 's', step: 0.05 },
  { key: 'home', label: 'Hand to keyboard', unit: 's', step: 0.05 },
  { key: 'keystroke', label: 'One key press', unit: 's', step: 0.01 },
  { key: 'press', label: 'Click or tap', unit: 's', step: 0.05 },
  { key: 'scroll', label: 'One scroll', unit: 's', step: 0.1 },
  { key: 'drag', label: 'One drag', unit: 's', step: 0.1 },
  {
    key: 'pointFixed',
    label: 'Pointing, when not by distance',
    unit: 's',
    step: 0.05,
  },
  { key: 'fittsA', label: "Pointing: Fitts's a", unit: 's', step: 0.01 },
  { key: 'fittsB', label: "Pointing: Fitts's b", unit: 's/bit', step: 0.01 },
  { key: 'hickB', label: "Choosing: Hick's b", unit: 's/bit', step: 0.01 },
  { key: 'manyChoices', label: 'Many options from', unit: 'options', step: 1 },
  {
    key: 'minTarget',
    label: 'Smallest comfortable target',
    unit: 'px',
    step: 1,
  },
  { key: 'farIndex', label: 'Far target above', unit: 'bits', step: 0.1 },
];

const SKILLS: readonly { value: Skill; label: string }[] = [
  { value: 'expert', label: 'Expert' },
  { value: 'regular', label: 'Regular' },
  { value: 'novice', label: 'Beginner' },
];

const DEVICES: readonly { value: Device; label: string }[] = [
  { value: 'mouse', label: 'Mouse' },
  { value: 'touch', label: 'Touch' },
];

export function Audience() {
  const { state, dispatch, bridge } = useFlow();
  const assumptions = state.settings.assumptions;

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
    <section aria-labelledby="audience-heading">
      <h2 id="audience-heading">Who is using it?</h2>
      <div className="row wrap">
        <Segmented
          legend="Experience"
          value={assumptions.skill}
          options={SKILLS}
          onChange={(skill) => setProfile(skill, assumptions.device)}
        />
        <Segmented
          legend="Input"
          value={assumptions.device}
          options={DEVICES}
          onChange={(device) => setProfile(assumptions.skill, device)}
        />
      </div>
      <details className="panel">
        <summary>Advanced timings</summary>
        <p className="hint">
          Every change applies at once. These are working assumptions for a
          person who knows the task, not measurements of real users.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={assumptions.useFitts}
            onChange={(event) =>
              apply({ ...assumptions, useFitts: event.target.checked })
            }
          />
          Pointing takes longer for small, distant targets (Fitts&apos;s law)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={assumptions.useHick}
            onChange={(event) =>
              apply({ ...assumptions, useHick: event.target.checked })
            }
          />
          Choosing takes longer with more options (Hick&apos;s law)
        </label>
        <div className="grid-fields">
          {TIMINGS.map((item) => (
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
          Reset timings for this profile
        </button>
      </details>
    </section>
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
