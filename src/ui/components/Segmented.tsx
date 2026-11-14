import { useId } from 'react';

interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** One choice out of a few, shown as a row of buttons; radio inputs underneath. */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend>{legend}</legend>
      <div className="segments">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
