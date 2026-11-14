import { useEffect, useId, useState, type ReactNode } from "react";
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
