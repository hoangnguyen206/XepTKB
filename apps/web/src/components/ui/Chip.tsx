/**
 * DESIGN-M6-001 §6. `Chip` is a toggle (aria-pressed). `ChipRadio` is a real radio input (hidden with
 * visually-hidden) plus its label, so `getByLabel("Nhóm 1")` and the native radio keyboard model keep working.
 * `StatusChip` shows a status; it is a button only when `onClick` is given.
 */
import type { ReactNode } from "react";

export function Chip(props: { pressed: boolean; onPressedChange: (pressed: boolean) => void; children: ReactNode; icon?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="chip" aria-pressed={props.pressed} disabled={props.disabled} onClick={() => props.onPressedChange(!props.pressed)}>
      {props.icon}
      {props.children}
    </button>
  );
}

export function ChipRadio(props: { name: string; value: string; checked: boolean; onChange: (value: string) => void; children: ReactNode; disabled?: boolean; id?: string }) {
  const id = props.id ?? `${props.name}-${props.value}`;
  return (
    <span className="chip-radio">
      <input
        className="visually-hidden"
        type="radio"
        id={id}
        name={props.name}
        value={props.value}
        checked={props.checked}
        disabled={props.disabled}
        onChange={() => props.onChange(props.value)}
      />
      <label className="chip" htmlFor={id}>{props.children}</label>
    </span>
  );
}

export type StatusTone = "info" | "warning" | "danger" | "success";

export function StatusChip(props: { tone: StatusTone; children: ReactNode; icon?: ReactNode; onClick?: () => void; label?: string }) {
  const className = `chip status-chip tone-${props.tone}`;
  if (props.onClick) {
    return (
      <button type="button" className={className} onClick={props.onClick} {...(props.label ? { "aria-label": props.label } : {})}>
        {props.icon}
        {props.children}
      </button>
    );
  }
  return (
    <span className={className}>
      {props.icon}
      {props.children}
    </span>
  );
}
