/**
 * Class sheet, one per course (DESIGN-M6-001 §8, AC-M6-09): section chips (a conflicting section is marked "⚠ Trùng"
 * in text, not colour only), the selected section as an article "Lớp {id}" with its sessions, group chips ("Nhóm N"),
 * the conflict / campus texts, a mini-calendar of the whole term, and the action button. The button table is the one
 * of the former SectionCard with the M6 wording; adding a conflicting class only needs the "Vẫn …" button.
 */
import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { canonicalSectionId, isFixedSession, normalizeGroup, sessionsForPick, type Plan, type PlanPick, type Section, type Session } from "@ky-nay/domain";
import { buildGridLayout, conflictKeys, dayLabel, formatPeriods, formatSessionExtras, formatWeeks, kindText, periodTimes } from "@ky-nay/export";
import type { AppCatalog, CourseResult } from "../model/catalog.js";
import { visiblePeriods } from "../model/grid-view.js";
import type { CourseColor } from "../model/palette.js";
import { candidatePlan, groupOptions, isPicked, pickForCourse, previewPick, previewTargetFor, sectionFits } from "../model/picker.js";
import { buildPlanView } from "../model/plan-view.js";
import { Notice } from "./common.js";
import { ReportIssueForm, useReportIssue } from "./ReportIssue.js";
import { Button } from "./ui/Button.js";
import { ChipRadio } from "./ui/Chip.js";
import { Sheet } from "./ui/Sheet.js";
import { WeekGrid } from "./WeekGrid.js";

/** Hover / focus handlers that preview a pick on the desktop grid (F4 §8); empty off desktop. */
export type PreviewHandlers = {
  onPointerEnter?: (event: PointerEvent) => void;
  onPointerLeave?: () => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
};
export type PreviewProps = (pick: () => PlanPick) => PreviewHandlers;

export function sessionText(session: Session, catalog: AppCatalog): string {
  const group = normalizeGroup(session.group);
  const groupText = group && group !== "CL" ? ` · nhóm ${group}` : "";
  const place = session.campus && !(session.room ?? "").includes(session.campus) ? [session.room, session.campus].filter(Boolean).join(" · ") : session.room ?? "";
  const lecturers = session.lecturers.length > 0 ? ` · GV ${session.lecturers.join(", ")}` : "";
  const extras = formatSessionExtras(session.rawNote, session.info);
  const note = extras ? ` · ${extras}` : "";
  if (!isFixedSession(session)) {
    return `Không có giờ cố định${kindText(session.kind) ? ` (${kindText(session.kind)})` : ""}${groupText} · tuần ${formatWeeks(session.weeks)}${place ? ` · ${place}` : ""}${lecturers}${note}`;
  }
  const times = periodTimes(catalog.frame, session.startPeriod, session.endPeriod);
  return `${dayLabel(session.day)}, ${formatPeriods(session.startPeriod, session.endPeriod)}${times ? ` (${times.start}–${times.end})` : ""}${kindText(session.kind) ? ` · ${kindText(session.kind)}` : ""}${groupText} · tuần ${formatWeeks(session.weeks)}${place ? ` · ${place}` : ""}${lecturers}${note}`;
}

/** The whole term with the candidate section in its course colour, the rest grey, overlaps striped red. Decorative. */
function MiniCalendar(props: { plan: Plan; catalog: AppCatalog; pick: PlanPick; colorOf: (courseCode: string) => CourseColor }) {
  const { plan, catalog, pick } = props;
  const data = useMemo(() => {
    const view = buildPlanView(candidatePlan(plan, catalog, pick), catalog);
    const id = canonicalSectionId(pick.sectionId);
    const keys = new Set(view.sessions.filter((session) => canonicalSectionId(session.sectionId) === id && session.fixed).map((session) => session.key));
    if (keys.size === 0) return undefined;
    const layout = buildGridLayout(view.sessions, { maxPeriod: visiblePeriods(view.sessions, catalog.maxPeriod), conflictKeys: conflictKeys(view.conflicts) });
    return { layout, keys };
  }, [plan, catalog, pick]);
  if (!data) return null;
  return (
    <figure className="mini-cal">
      <WeekGrid layout={data.layout} frame={catalog.frame} week1="" week="all" caption="" variant="compact" colorOf={props.colorOf} ghostKeys={data.keys} />
      <figcaption className="mini-cal-caption" aria-hidden="true">Cả học kỳ · sọc đỏ là chỗ trùng</figcaption>
    </figure>
  );
}

export function SectionDetail(props: {
  section: Section;
  plan: Plan;
  catalog: AppCatalog;
  colorOf: (courseCode: string) => CourseColor;
  onPick: (sectionId: string, group?: string) => string | undefined;
  onUnpick: (sectionId: string) => void;
  preview?: PreviewProps;
}) {
  const id = useId();
  const { section, plan, catalog } = props;
  const groups = groupOptions(section);
  const picked = isPicked(plan, section);
  // A picked group can stop existing after a dataset revision (REV-M3-001, QA-M3-101).
  const pickedNeedsGroup = picked !== undefined && sessionsForPick(section, picked).issues.length > 0;
  const sameCourse = pickForCourse(plan, catalog, section);
  const pickedGroup = normalizeGroup(picked?.group);
  const [group, setGroup] = useState<string | undefined>(() => pickedGroup);
  const [error, setError] = useState<string | undefined>(undefined);
  const reportContext = useReportIssue();
  const [reportOpen, setReportOpen] = useState(false);
  const reportToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setGroup(pickedGroup);
  }, [pickedGroup, section.id]);
  const selectedGroup = group !== undefined && (groups.length === 0 || groups.includes(group)) ? group : undefined;
  const needsGroup = groups.length > 0 && selectedGroup === undefined;
  const pickedSameGroup = picked !== undefined && !pickedNeedsGroup && pickedGroup === selectedGroup;
  const pick = useMemo<PlanPick>(() => (selectedGroup ? { sectionId: section.id, group: selectedGroup } : { sectionId: section.id }), [section.id, selectedGroup]);
  // A picked section keeps showing its conflicts (QA-M3-007): previewing the current pick resolves to the Plan itself.
  const preview = !needsGroup ? previewPick(plan, catalog, pick) : undefined;
  const conflicting = (preview?.conflictTexts.length ?? 0) > 0;
  const untimed = section.sessions.every((session) => !isFixedSession(session));
  const action = pickedSameGroup ? "Bỏ lớp này"
    : picked ? (conflicting ? "Vẫn đổi nhóm" : "Đổi nhóm")
      : sameCourse ? (conflicting ? "Vẫn đổi sang lớp này" : "Đổi sang lớp này")
        : conflicting ? "Vẫn thêm lớp này" : "Thêm vào lịch";
  const run = () => {
    if (pickedSameGroup) {
      props.onUnpick(section.id);
      return;
    }
    setError(props.onPick(section.id, selectedGroup));
  };
  return (
    <article className={`class-detail${picked ? " is-picked" : ""}${conflicting ? " is-conflict" : ""}`} aria-labelledby={`${id}-title`}>
      <header className="section-head">
        <h3 id={`${id}-title`}>Lớp {section.id}</h3>
        <div className="badges">
          {picked ? <span className="badge badge-picked">✓ Đã chọn{picked.group ? ` · nhóm ${picked.group}` : ""}</span> : null}
          {pickedNeedsGroup ? <span className="badge badge-conflict">⚠ Cần chọn lại nhóm</span> : null}
          {section.online ? <span className="badge badge-online">Trực tuyến · không xếp lịch tuần</span>
            : untimed ? <span className="badge badge-online">Không có lịch cố định</span> : null}
          {conflicting ? <span className="badge badge-conflict">⚠ Trùng lịch</span> : null}
        </div>
      </header>
      {section.homeClasses.length > 0 ? <p className="muted">Lớp khóa: {section.homeClasses.join(", ")}</p> : null}
      <ul className="session-list">
        {section.sessions.map((session) => <li key={session.id}>{sessionText(session, catalog)}</li>)}
      </ul>
      {groups.length > 0 ? (
        <fieldset className="chip-group">
          <legend>Chọn nhóm (bắt buộc)</legend>
          {groups.map((option) => (
            <span key={option} className="chip-slot" {...(props.preview?.(() => ({ sectionId: section.id, group: option })) ?? {})}>
              <ChipRadio name={`${id}-group`} id={`${id}-g-${option}`} value={option} checked={selectedGroup === option} onChange={setGroup}>Nhóm {option}</ChipRadio>
            </span>
          ))}
        </fieldset>
      ) : null}
      {preview && (preview.conflictTexts.length > 0 || preview.campusTexts.length > 0) ? (
        <ul className="preview-list" aria-label={`Kiểm tra lịch cho lớp ${section.id}`}>
          {preview.conflictTexts.map((text) => <li key={text} className="conflict-text">⚠ {text}</li>)}
          {preview.campusTexts.map((text) => <li key={text} className="campus-text">ⓘ {text}</li>)}
        </ul>
      ) : null}
      {needsGroup ? <p className="field-hint">Chọn nhóm để kiểm tra trùng lịch.</p> : <MiniCalendar plan={plan} catalog={catalog} pick={pick} colorOf={props.colorOf} />}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="class-actions">
        <Button variant={pickedSameGroup ? "secondary" : conflicting ? "danger" : "primary"} disabled={!pickedSameGroup && needsGroup} onClick={run}>
          {action}
        </Button>
        {picked && !pickedSameGroup ? <Button variant="secondary" onClick={() => props.onUnpick(section.id)}>Bỏ lớp này</Button> : null}
      </div>
      {reportContext ? (
        <div className="section-report">
          {/* M5-B: per-section report; the form only sees the public section id and course code. */}
          <button
            ref={reportToggleRef}
            type="button"
            className="button link small"
            aria-expanded={reportOpen}
            aria-controls={reportOpen ? `${id}-report` : undefined}
            aria-describedby={`${id}-title`}
            onClick={() => setReportOpen((open) => !open)}
          >
            Báo sai dữ liệu
          </button>
          {reportOpen ? (
            <div id={`${id}-report`}>
              <ReportIssueForm section={{ sectionId: section.id, courseCode: section.courseCode }} idPrefix={`${id}-r`} onClose={() => { setReportOpen(false); reportToggleRef.current?.focus(); }} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ClassSheetBody(props: {
  result: CourseResult;
  plan: Plan;
  catalog: AppCatalog;
  filter: boolean;
  colorOf: (courseCode: string) => CourseColor;
  onPick: (sectionId: string, group?: string) => string | undefined;
  onUnpick: (sectionId: string) => void;
  preview?: PreviewProps;
}) {
  const id = useId();
  const { result, plan, catalog } = props;
  const fits = useMemo(() => new Map(result.sections.map((section) => [section.id, sectionFits(plan, catalog, section)])), [result, plan, catalog]);
  const shown = props.filter ? result.sections.filter((section) => fits.get(section.id)) : result.sections;
  const hidden = result.sections.length - shown.length;
  const [sectionId, setSectionId] = useState(() => (shown.find((section) => isPicked(plan, section)) ?? shown.find((section) => fits.get(section.id)) ?? shown[0] ?? result.sections[0]!).id);
  const section = shown.find((item) => item.id === sectionId) ?? shown[0] ?? result.sections[0]!;
  const { course } = result;
  return (
    <>
      <p className="muted">{course.credits === undefined ? "Chưa rõ tín chỉ" : `${course.credits} tín chỉ`} · {result.sections.length} lớp</p>
      <fieldset className="chip-group class-chips">
        <legend>Lớp học phần</legend>
        {shown.map((item) => {
          const picked = isPicked(plan, item) !== undefined;
          return (
            <span key={item.id} className="chip-slot" {...(props.preview?.(() => previewTargetFor(plan, catalog, item)) ?? {})}>
              <ChipRadio name={`${id}-section`} id={`${id}-s-${item.id}`} value={item.id} checked={item.id === section.id} onChange={setSectionId}>
                <span className="visually-hidden">Lớp </span>{item.id}
                {picked ? <span className="chip-mark"><span aria-hidden="true">✓</span><span className="visually-hidden"> đã chọn</span></span> : null}
                {!fits.get(item.id) ? <span className="chip-mark is-conflict"><span aria-hidden="true">⚠</span> Trùng</span> : null}
              </ChipRadio>
            </span>
          );
        })}
      </fieldset>
      {hidden > 0 ? <p className="muted">Ẩn {hidden} lớp trùng lịch.</p> : null}
      <SectionDetail key={section.id} section={section} plan={plan} catalog={catalog} colorOf={props.colorOf} onPick={props.onPick} onUnpick={props.onUnpick} {...(props.preview ? { preview: props.preview } : {})} />
    </>
  );
}

export function ClassSheet(props: {
  result?: CourseResult;
  plan: Plan;
  catalog: AppCatalog;
  filter: boolean;
  colorOf: (courseCode: string) => CourseColor;
  onPick: (sectionId: string, group?: string) => string | undefined;
  onUnpick: (sectionId: string) => void;
  onClose: () => void;
  preview?: PreviewProps;
}) {
  const { result } = props;
  return (
    <Sheet open={result !== undefined} onClose={props.onClose} title={result ? `${result.course.code} ${result.course.name}` : ""}>
      {result ? (
        <ClassSheetBody
          key={result.course.code}
          result={result}
          plan={props.plan}
          catalog={props.catalog}
          filter={props.filter}
          colorOf={props.colorOf}
          onPick={props.onPick}
          onUnpick={props.onUnpick}
          {...(props.preview ? { preview: props.preview } : {})}
        />
      ) : null}
    </Sheet>
  );
}
