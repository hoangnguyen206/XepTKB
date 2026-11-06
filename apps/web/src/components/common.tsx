import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { weekLabel } from "../model/week.js";

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export type TabItem = { id: string; label: string };

/** WAI-ARIA tabs with roving focus (Arrow keys, Home, End). */
export function Tabs(props: { label: string; tabs: readonly TabItem[]; active: string; onChange: (id: string) => void; idPrefix: string }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = props.tabs.findIndex((tab) => tab.id === props.active);
    const next = event.key === "ArrowRight" ? (index + 1) % props.tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + props.tabs.length) % props.tabs.length
        : event.key === "Home" ? 0
          : event.key === "End" ? props.tabs.length - 1
            : -1;
    if (next < 0) return;
    event.preventDefault();
    const tab = props.tabs[next]!;
    props.onChange(tab.id);
    refs.current.get(tab.id)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={props.label} onKeyDown={move}>
      {props.tabs.map((tab) => {
        const selected = tab.id === props.active;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) refs.current.set(tab.id, element);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${props.idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${props.idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => props.onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel(props: { idPrefix: string; id: string; active: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${props.idPrefix}-panel-${props.id}`} aria-labelledby={`${props.idPrefix}-tab-${props.id}`} hidden={!props.active} className="tab-panel">
      {props.active ? props.children : null}
    </div>
  );
}

export type WeekChoice = number | "all";

export function WeekPicker(props: { week1: string; teachingWeeks: number; value: WeekChoice; onChange: (value: WeekChoice) => void }) {
  const id = useId();
  const weeks = Array.from({ length: props.teachingWeeks }, (_, index) => index + 1);
  const current = props.value === "all" ? 0 : props.value;
  return (
    <div className="week-picker">
      <button type="button" className="button secondary icon" aria-label="Tuần trước" disabled={props.value === "all" || current <= 1} onClick={() => props.onChange(current - 1)}>
        ‹
      </button>
      <label htmlFor={id} className="visually-hidden">Chọn tuần</label>
      <select id={id} value={String(props.value)} onChange={(event) => props.onChange(event.target.value === "all" ? "all" : Number(event.target.value))}>
        <option value="all">Tất cả các tuần</option>
        {weeks.map((week) => (
          <option key={week} value={week}>{weekLabel(props.week1, week)}</option>
        ))}
      </select>
      <button type="button" className="button secondary icon" aria-label="Tuần sau" disabled={props.value === "all" || current >= props.teachingWeeks} onClick={() => props.onChange(current + 1)}>
        ›
      </button>
    </div>
  );
}

export function Notice(props: { tone: "info" | "warning" | "error" | "success"; title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`notice notice-${props.tone}`} role={props.tone === "error" ? "alert" : undefined}>
      <div>
        {props.title ? <strong className="notice-title">{props.title}</strong> : null}
        <div>{props.children}</div>
      </div>
      {props.action ? <div className="notice-action">{props.action}</div> : null}
    </div>
  );
}
