/** DESIGN-M6-001 §6: a labelled group of pressed/unpressed buttons (same semantics as the M4 slot switcher). */
import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = { value: T; label: string; count?: number; icon?: ReactNode };

export function SegmentedControl<T extends string>(props: { label: string; options: readonly SegmentedOption<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="seg-option"
          aria-pressed={option.value === props.value}
          onClick={() => {
            if (option.value !== props.value) props.onChange(option.value);
          }}
        >
          {option.icon}
          {option.label}
          {option.count !== undefined ? <span className="seg-count">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
