import { useId, useState, type FormEvent } from "react";
import { resolveWeek1, validateIsoDate, type Term } from "@ky-nay/domain";
import { formatDate, weekRange } from "@ky-nay/export";
import type { TermOption } from "../data/loader.js";
import { isMonday } from "../model/week.js";
import { Notice } from "./common.js";

export type Week1Choice = { cohort?: string; week1?: string };

type Mode = "cohort" | "manual";

function cohortsOf(term: Term): string[] {
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

export function Onboarding(props: { terms: readonly TermOption[]; term: Term; loadingTerm: boolean; onSwitchTerm: (term: string) => void; onCreate: (choice: Week1Choice) => void }) {
  const id = useId();
  const [choice, setChoice] = useState<Week1Choice | undefined>(() => (previewWeek1(props.term, "cohort", "", "").date ? {} : undefined));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (choice) props.onCreate(choice);
  };
  return (
    <form className="card onboarding" onSubmit={submit} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Bắt đầu xếp thời khóa biểu</h2>
      <p>Chọn kỳ học và ngày bắt đầu tuần 1. Bạn có thể sửa lại sau trong mục Phương án.</p>
      <div className="field">
        <label htmlFor={`${id}-school`}>Trường</label>
        <select id={`${id}-school`} value="uet" disabled>
          <option value="uet">UET</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-term`}>Học kỳ</label>
        <select id={`${id}-term`} value={props.term.id} disabled={props.loadingTerm} onChange={(event) => props.onSwitchTerm(event.target.value)}>
          {props.terms.map((term) => <option key={term.term} value={term.term}>{term.termName}</option>)}
        </select>
      </div>
      <Week1Fields key={props.term.id} term={props.term} onChange={setChoice} />
      {!choice ? <Notice tone="info">Hoàn tất lựa chọn tuần 1 để tiếp tục.</Notice> : null}
      <button type="submit" className="button primary" disabled={!choice}>Tạo phương án</button>
    </form>
  );
}
