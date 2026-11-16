import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { resolveWeek1, validateIsoDate, type Term } from "@ky-nay/domain";
import { formatDate, weekRange } from "@ky-nay/export";
import type { TermOption } from "../data/loader.js";
import { INDEPENDENCE_NOTE } from "../model/labels.js";
import { isMonday } from "../model/week.js";
import { Button } from "./ui/Button.js";
import { ChipRadio } from "./ui/Chip.js";

export type Week1Choice = { cohort?: string; week1?: string };

type Mode = "cohort" | "manual";

export function cohortsOf(term: Term): string[] {
  return [...new Set(term.starts.flatMap((start) => start.cohorts))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
}

/** Week-1 resolution through the domain engine; returns the date or a Vietnamese error. */
export function previewWeek1(term: Term, mode: Mode, cohort: string, manual: string): { date?: string; error?: string } {
  if (mode === "manual") {
    if (!manual) return { error: "Hãy chọn ngày bắt đầu tuần 1." };
    if (!validateIsoDate(manual)) return { error: "Ngày không hợp lệ." };
    if (!isMonday(manual)) return { error: "Ngày bắt đầu tuần 1 phải là Thứ Hai." };
    return { date: manual };
  }
  const resolved = resolveWeek1(term, cohort ? { cohort } : {});
  if ("code" in resolved) {
    return { error: resolved.code === "AMBIGUOUS_WEEK1" ? "Các khóa bắt đầu tuần 1 khác nhau — hãy chọn khóa của bạn." : "Chưa có ngày tuần 1 cho khóa này — hãy tự nhập ngày." };
  }
  return { date: resolved.date };
}

/** Cohort-or-date choice for week 1 (C-08: both paths are offered). */
export function Week1Fields(props: { term: Term; initial?: Week1Choice; onChange: (choice: Week1Choice | undefined) => void }) {
  const id = useId();
  const cohorts = cohortsOf(props.term);
  const [mode, setMode] = useState<Mode>(props.initial?.week1 ? "manual" : "cohort");
  const [cohort, setCohort] = useState(props.initial?.cohort ?? "");
  const [manual, setManual] = useState(props.initial?.week1 ?? "");
  const preview = previewWeek1(props.term, mode, cohort, manual);
  const report = (nextMode: Mode, nextCohort: string, nextManual: string) => {
    const next = previewWeek1(props.term, nextMode, nextCohort, nextManual);
    props.onChange(next.date ? (nextMode === "manual" ? { week1: nextManual, ...(nextCohort ? { cohort: nextCohort } : {}) } : nextCohort ? { cohort: nextCohort } : {}) : undefined);
  };
  const last = preview.date ? weekRange(preview.date, props.term.teachingWeeks).end : undefined;
  return (
    <fieldset className="fieldset">
      <legend>Tuần 1 bắt đầu từ ngày nào?</legend>
      <div className="radio-row">
        <input type="radio" id={`${id}-cohort`} name={`${id}-mode`} checked={mode === "cohort"} onChange={() => { setMode("cohort"); report("cohort", cohort, manual); }} />
        <label htmlFor={`${id}-cohort`}>Theo khóa của tôi (lịch nhà trường đã cấu hình)</label>
      </div>
      {mode === "cohort" ? (
        <div className="field indent">
          <label htmlFor={`${id}-cohort-select`}>Khóa</label>
          <select id={`${id}-cohort-select`} value={cohort} onChange={(event) => { setCohort(event.target.value); report("cohort", event.target.value, manual); }}>
            <option value="">— Chọn khóa —</option>
            {cohorts.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      ) : null}
      <div className="radio-row">
        <input type="radio" id={`${id}-manual`} name={`${id}-mode`} checked={mode === "manual"} onChange={() => { setMode("manual"); report("manual", cohort, manual); }} />
        <label htmlFor={`${id}-manual`}>Tự nhập ngày Thứ Hai của tuần 1</label>
      </div>
      {mode === "manual" ? (
        <div className="field indent">
          <label htmlFor={`${id}-date`}>Ngày bắt đầu tuần 1</label>
          <input id={`${id}-date`} type="date" value={manual} aria-describedby={`${id}-preview`} onChange={(event) => { setManual(event.target.value); report("manual", cohort, event.target.value); }} />
        </div>
      ) : null}
      <p id={`${id}-preview`} className={preview.error ? "field-error" : "field-hint"} aria-live="polite">
        {preview.date && last ? `Tuần 1 bắt đầu Thứ Hai ${formatDate(preview.date)}; tuần ${props.term.teachingWeeks} kết thúc ${formatDate(last)}.` : preview.error}
      </p>
    </fieldset>
  );
}

/** Decorative: a few course-coloured blocks on a grid (aria-hidden, colours from tokens). */
function StartArt() {
  return (
    <svg className="start-art" viewBox="0 0 120 72" aria-hidden="true" focusable="false">
      <rect className="a0" x="0" y="0" width="120" height="72" rx="12" />
      <rect className="a1" x="12" y="10" width="20" height="30" rx="4" />
      <rect className="a2" x="38" y="22" width="20" height="40" rx="4" />
      <rect className="a3" x="64" y="10" width="20" height="22" rx="4" />
      <rect className="a4" x="64" y="38" width="20" height="24" rx="4" />
      <rect className="a5" x="90" y="16" width="20" height="34" rx="4" />
    </svg>
  );
}

/**
 * The start screen (DESIGN-M6-001 §9, AC-M6-11): one screen, cohort chips from `Term.starts`, "Tự chọn ngày" opens
 * a date field (checked by `previewWeek1`), "Bắt đầu" — two taps from a chip to the calendar. The term select shows
 * only when there is more than one term. ≤ 25 visible words, plus the independence sentence at the end (A-M6-1).
 */
export function Onboarding(props: { terms: readonly TermOption[]; term: Term; loadingTerm: boolean; onSwitchTerm: (term: string) => void; onCreate: (choice: Week1Choice) => void }) {
  const id = useId();
  const cohorts = cohortsOf(props.term);
  const [mode, setMode] = useState<Mode>("cohort");
  const [cohort, setCohort] = useState("");
  const [manual, setManual] = useState("");
  const dateRef = useRef<HTMLInputElement>(null);
  const preview = previewWeek1(props.term, mode, cohort, manual);
  useEffect(() => {
    if (mode === "manual") dateRef.current?.focus();
  }, [mode]);
  // Errors only after the user acted: an ambiguous term simply waits for a chip.
  const message = mode === "manual"
    ? (manual ? (preview.date ? `Tuần 1: ${formatDate(preview.date)}` : preview.error) : undefined)
    : (cohort && preview.error ? preview.error : undefined);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!preview.date) return;
    props.onCreate(mode === "manual" ? { week1: manual, ...(cohort ? { cohort } : {}) } : cohort ? { cohort } : {});
  };
  return (
    <>
      <form className="start" onSubmit={submit} aria-labelledby={`${id}-title`}>
        <StartArt />
        <h2 id={`${id}-title`} className="visually-hidden">Bắt đầu xếp thời khóa biểu</h2>
        {props.terms.length > 1 ? (
          <div className="start-term">
            <label className="visually-hidden" htmlFor={`${id}-term`}>Học kỳ</label>
            <select id={`${id}-term`} value={props.term.id} disabled={props.loadingTerm} onChange={(event) => props.onSwitchTerm(event.target.value)}>
              {props.terms.map((term) => <option key={term.term} value={term.term}>{term.termName}</option>)}
            </select>
          </div>
        ) : null}
        <fieldset className="chip-group start-cohorts">
          <legend>Bạn khóa mấy?</legend>
          {cohorts.map((item) => (
            <ChipRadio key={item} name={`${id}-cohort`} id={`${id}-c-${item}`} value={item} checked={mode === "cohort" && cohort === item} onChange={(value) => { setMode("cohort"); setCohort(value); }}>
              {item}
            </ChipRadio>
          ))}
        </fieldset>
        {mode === "manual" ? (
          <div className="field start-date">
            <label htmlFor={`${id}-date`}>Ngày bắt đầu tuần 1</label>
            <input ref={dateRef} id={`${id}-date`} type="date" value={manual} aria-describedby={`${id}-msg`} onChange={(event) => setManual(event.target.value)} />
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="start-manual" onClick={() => setMode("manual")}>Tự chọn ngày</Button>
        )}
        <p id={`${id}-msg`} className={preview.error && message === preview.error ? "field-error" : "field-hint"} aria-live="polite">{message}</p>
        <Button type="submit" variant="primary" size="lg" disabled={!preview.date}>Bắt đầu</Button>
      </form>
      <p className="independence-note">{INDEPENDENCE_NOTE}</p>
    </>
  );
}
