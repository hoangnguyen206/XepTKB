import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { canonicalSectionId, normalizeGroup, type Plan, type PlanPick } from "@ky-nay/domain";
import { buildGridLayout, conflictKeys, dayLabel, formatDate, formatPeriods, formatWeeks, kindText, nonFixedSessions, periodTimes } from "@ky-nay/export";
import type { AppCatalog } from "../model/catalog.js";
import { exportDisclaimer, provenanceLine } from "../model/labels.js";
import { applyPick, candidatePlan, isPicked, unpick } from "../model/picker.js";
import { buildPlanView, rebasePlan, setPickedGroup, type PlanView as PlanViewModel } from "../model/plan-view.js";
import { defaultWeek, todayInVietnam, weekLabel } from "../model/week.js";
import type { TermRegistrationNotes } from "../storage/local-data.js";
import type { AppView } from "./BottomNav.js";
import { Notice, useMediaQuery, type WeekChoice } from "./common.js";
import type { Week1Choice } from "./Onboarding.js";
import { PlanView, StalePlanNotice } from "./PlanView.js";
import { Sheet } from "./ui/Sheet.js";
import { LocalErrorBoundary } from "./ErrorBoundary.js";
import { createLazyRegistrationPanel, prefetchRegistrationImport, resetRegistrationImport } from "./registration-lazy.js";
import { useCourseColors, type CourseColorLookup } from "./useCourseColors.js";
import { WeekGrid } from "./WeekGrid.js";
import { NonFixedList, WeekView } from "./WeekView.js";
import type { CourseColorId } from "../model/palette.js";
import { visiblePeriods } from "../model/grid-view.js";
import { AddClassView } from "./AddClassView.js";
import { useSearchShortcut } from "./useSearchShortcut.js";
import { prefetchExporters } from "../export/exporters-lazy.js";
import { creditsLine } from "../export/files.js";
import type { HintId } from "../model/hints.js";
import { IconCalendar } from "./icons.js";
import { Button } from "./ui/Button.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Hint } from "./ui/Hint.js";

const ISSUE_TEXT: Record<string, string> = {
  GROUP_REQUIRED: "Lớp này có nhiều nhóm — hãy chọn nhóm trước.",
  GROUP_NOT_FOUND: "Nhóm đã chọn không có trong lớp này.",
  SECTION_NOT_FOUND: "Lớp không có trong dữ liệu đang dùng.",
  DUPLICATE_PLAN_PICK: "Lớp này đã có trong phương án.",
  DUPLICATE_COURSE_SELECTION: "Môn này đã có lớp khác trong phương án.",
};

/** Print-only sheet (A4 landscape via print CSS): grid of the selected week plus the session table. */
function PrintSheet(props: { plan: Plan; view: PlanViewModel; catalog: AppCatalog; week: WeekChoice; colors: CourseColorLookup }) {
  const { plan, view, catalog } = props;
  const week = props.week === "all" ? undefined : props.week;
  const layout = buildGridLayout(view.sessions, { ...(week !== undefined ? { week } : {}), maxPeriod: visiblePeriods(view.sessions, catalog.maxPeriod), conflictKeys: conflictKeys(view.conflicts, week) });
  const fixed = view.sessions.filter((session) => session.fixed);
  return (
    <div className="print-only" aria-hidden="true">
      <h2>{plan.name} — {catalog.term.name}</h2>
      <p>{week !== undefined && view.week1 ? weekLabel(view.week1.date, week) : "Tất cả các tuần"}{view.week1 ? ` · Tuần 1 bắt đầu ${formatDate(view.week1.date)}` : ""} · {creditsLine(view)}</p>
      {view.week1 ? <WeekGrid layout={layout} frame={catalog.frame} week1={view.week1.date} week={props.week} caption="Bản in lưới thời khóa biểu" variant="print" colorOf={props.colors.colorOf} /> : null}
      <table className="print-table">
        <thead><tr><th>Thứ</th><th>Tiết (giờ)</th><th>Môn</th><th>Lớp</th><th>Loại</th><th>Phòng</th><th>Tuần</th></tr></thead>
        <tbody>
          {fixed.map((session) => {
            const times = periodTimes(catalog.frame, session.startPeriod!, session.endPeriod!);
            const overrideNote = session.overrides && session.overrides.length > 0 ? ` (${session.overrides.map((item) => item.detail).join("; ")})` : "";
            return (
              <tr key={session.key}>
                <td>{dayLabel(session.day!)}</td>
                <td>{formatPeriods(session.startPeriod!, session.endPeriod!)}{times ? ` (${times.start}–${times.end})` : ""}</td>
                <td>{session.courseCode} {session.courseName}</td>
                <td>{session.sectionId}{session.group && session.group !== "CL" ? ` · nhóm ${session.group}` : ""}</td>
                <td>{kindText(session.kind)}</td>
                <td>{session.room ?? ""}{overrideNote}</td>
                <td>{formatWeeks(session.weeks)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <NonFixedList sessions={nonFixedSessions(view.sessions)} />
      <p>{provenanceLine(catalog.entry)}</p>
      <p><em>{exportDisclaimer(catalog.entry)}</em></p>
    </div>
  );
}

export function Workspace(props: {
  plan: Plan;
  draftPlan: Plan;
  finalPlan?: Plan;
  activeSlot: "draft" | "final";
  registrationNotes?: TermRegistrationNotes;
  catalog: AppCatalog;
  /** M6-D (F2): which main view is on screen; owned by App so the navigation can sit in the app bar on desktop. */
  view: AppView;
  onViewChange: (view: AppView) => void;
  onPlanChange: (plan: Plan) => void;
  onSelectSlot: (slot: "draft" | "final") => void;
  onConfirmRegistration: (finalPlan: Plan, notes: TermRegistrationNotes) => void;
  onDeleteFinalPlan?: () => void;
  /** M6-E (F3): course colours chosen on this device and the setter (DESIGN-M6-001 §3/§7). */
  courseColors: Readonly<Record<string, CourseColorId>>;
  onCourseColor: (courseCode: string, color: CourseColorId | undefined) => void;
  /** M6-G (F5): one-time hints already seen on this device, and the setter (DESIGN-M6-001 §9). */
  seenHints?: Readonly<Partial<Record<HintId, true>>>;
  onHintSeen?: (id: HintId) => void;
}) {
  const { plan, draftPlan, finalPlan, activeSlot, catalog } = props;
  const colors = useCourseColors(draftPlan.planKind === "draft" ? draftPlan : undefined, finalPlan, catalog, props.courseColors);
  const desktop = useMediaQuery("(min-width: 1200px)");
  const view = useMemo(() => buildPlanView(plan, catalog), [plan, catalog]);
  const today = todayInVietnam();
  const [week, setWeek] = useState<WeekChoice>(() => (view.week1 ? defaultWeek(view.week1.date, catalog.term.teachingWeeks, today) : "all"));
  const [importOpen, setImportOpen] = useState(false);
  // AC-M6-13: a conflict chip on Phương án opens the calendar with that cell focused.
  const [focusKey, setFocusKey] = useState<string | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearchOnShow = useRef(false);
  // F4 §8: the class previewed on the desktop grid while a course row or class chip is hovered or focused.
  const [previewTarget, setPreviewTarget] = useState<PlanPick | undefined>(undefined);
  // M5-F: the registration import chunk is loaded lazily; a retry after a failed load needs a fresh lazy component.
  const [RegistrationImportPanel, setRegistrationImportPanel] = useState(() => createLazyRegistrationPanel());
  useEffect(() => {
    // Prefetch right after mount (DESIGN-M5-001 §5): opening the panel must not issue a request (AC-M4-02 / AC-04).
    prefetchRegistrationImport();
    // DESIGN-M6-001 §14: export builders are a lazy chunk; prefetched here so an export makes no request.
    prefetchExporters();
  }, []);
  // Desktop keeps the search in the left column: "Thêm lớp" shows the calendar and moves focus to the search box.
  const shown: AppView = desktop && props.view === "add" ? "week" : props.view;
  const focusSearch = () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  };
  useEffect(() => {
    if ((desktop && props.view === "add") || (props.view === "add" && focusSearchOnShow.current)) focusSearch();
    focusSearchOnShow.current = false;
  }, [desktop, props.view]);
  // Ctrl/⌘ K: desktop focuses the search in the left column; phones and tablets open Thêm lớp with the box focused.
  useSearchShortcut(() => {
    if (desktop || props.view === "add") focusSearch();
    else {
      focusSearchOnShow.current = true;
      props.onViewChange("add");
    }
  });
  useEffect(() => {
    if (!desktop) setPreviewTarget(undefined);
  }, [desktop]);
  const ghost = useMemo(() => {
    if (!desktop || !previewTarget) return undefined;
    const section = catalog.sectionById.get(canonicalSectionId(previewTarget.sectionId));
    if (!section) return undefined;
    const picked = isPicked(plan, section);
    if (picked && normalizeGroup(picked.group) === normalizeGroup(previewTarget.group)) return undefined;
    const candidate = buildPlanView(candidatePlan(plan, catalog, previewTarget), catalog);
    const id = canonicalSectionId(section.id);
    const keys = new Set(candidate.sessions.filter((session) => canonicalSectionId(session.sectionId) === id).map((session) => session.key));
    return { sessions: candidate.sessions, conflicts: candidate.conflicts, keys, sectionId: section.id };
  }, [desktop, previewTarget, plan, catalog]);

  // F5 §9: at most one hint at a time — the first unseen one that applies to what is on screen.
  const coarse = useMediaQuery("(pointer: coarse)");
  const seen = props.seenHints ?? {};
  const hintSeen = (id: HintId) => {
    if (!seen[id]) props.onHintSeen?.(id);
  };
  const hasSessions = view.sessions.some((session) => session.fixed);
  const candidates: HintId[] = [
    ...(shown === "week" && hasSessions && coarse ? ["week-swipe" as const] : []),
    ...(shown === "week" && hasSessions ? ["block-tap" as const] : []),
    ...(desktop || shown === "add" ? ["add-filter" as const] : []),
    ...(shown === "plan" && !finalPlan ? ["plan-import" as const] : []),
  ];
  const activeHint = props.onHintSeen ? candidates.find((id) => !seen[id]) : undefined;
  const hintFor = (id: HintId) => (activeHint === id ? <Hint id={id} onDismiss={hintSeen} /> : null);

  const now = () => new Date().toISOString();

  const onPick = (sectionId: string, group?: string): string | undefined => {
    const result = applyPick(plan, catalog, group ? { sectionId, group } : { sectionId }, now());
    if (!result.plan) return result.issues.map((issue) => ISSUE_TEXT[issue.code] ?? issue.message).join(" ");
    setPreviewTarget(undefined);
    props.onPlanChange(result.plan);
    return undefined;
  };
  const onUnpick = (sectionId: string) => props.onPlanChange(unpick(plan, sectionId, now()));
  const onSelectGroup = (sectionId: string, group: string) => {
    props.onPlanChange(setPickedGroup(plan, sectionId, group, now()));
  };
  const onWeek1 = (choice: Week1Choice) => {
    const { cohort: _cohort, week1: _week1, ...rest } = plan;
    props.onPlanChange({ ...rest, ...(choice.cohort ? { cohort: choice.cohort } : {}), ...(choice.week1 ? { week1: choice.week1 } : {}), updatedAt: now() });
  };
  const search = (
    <AddClassView
      catalog={catalog}
      plan={plan}
      colorOf={colors.colorOf}
      onPick={onPick}
      onUnpick={onUnpick}
      headingLevel={desktop ? "h2" : "h3"}
      searchRef={searchRef}
      hint={hintFor("add-filter")}
      onFilterUsed={() => hintSeen("add-filter")}
      {...(desktop ? { onPreview: setPreviewTarget } : {})}
    />
  );
  const planNotices = (
    <>
      {view.stale ? <StalePlanNotice plan={plan} catalog={catalog} onRebase={() => props.onPlanChange(rebasePlan(plan, catalog, now()))} /> : null}
      {view.week1Issue ? <Notice tone="warning">Chưa xác định được tuần 1 cho phương án này. Hãy mở Phương án → Tuần 1.</Notice> : null}
    </>
  );

  return (
    <div className={desktop ? "workspace two-col" : "workspace"}>
      {desktop ? <aside className="pane-left card" aria-label="Tìm và chọn lớp">{search}</aside> : null}
      <div className="pane-main">
        {shown === "add" ? (
          <section className="view view-add" aria-labelledby="view-add-heading">
            <h2 id="view-add-heading" className="visually-hidden">Thêm lớp</h2>
            {search}
          </section>
        ) : null}
        {shown === "week" ? (
          <section className="view view-week" aria-labelledby="view-week-heading">
            <h2 id="view-week-heading" className="visually-hidden">Lịch</h2>
            {planNotices}
            {view.week1 ? (
              <WeekView
                sessions={view.sessions}
                conflicts={view.conflicts}
                frame={catalog.frame}
                maxPeriod={catalog.maxPeriod}
                week1={view.week1.date}
                teachingWeeks={catalog.term.teachingWeeks}
                week={week}
                onWeekChange={setWeek}
                colors={colors}
                onCourseColor={props.onCourseColor}
                onUnpick={onUnpick}
                {...(ghost ? { ghost } : {})}
                {...(focusKey ? { focusKey, onFocused: () => setFocusKey(undefined) } : {})}
                hint={hintFor("week-swipe") ?? hintFor("block-tap")}
                onAction={(action) => hintSeen(action === "swipe" ? "week-swipe" : "block-tap")}
                empty={view.sessions.length === 0 ? (
                  <EmptyState icon={<IconCalendar />} title="Chưa có lớp nào" action={<Button variant="primary" onClick={() => props.onViewChange("add")}>Thêm lớp</Button>} />
                ) : null}
              />
            ) : null}
          </section>
        ) : null}
        {shown === "plan" ? (
          <section className="view view-plan" aria-label="Phương án">
            <PlanView
              plan={plan}
              draftPlan={draftPlan}
              {...(finalPlan ? { finalPlan } : {})}
              activeSlot={activeSlot}
              view={view}
              catalog={catalog}
              week={week}
              colors={colors}
              {...(props.registrationNotes ? { registrationNotes: props.registrationNotes } : {})}
              importOpen={importOpen}
              onOpenImport={() => {
                setImportOpen(true);
                hintSeen("plan-import");
              }}
              onSelectSlot={props.onSelectSlot}
              onUnpick={onUnpick}
              onSelectGroup={onSelectGroup}
              onWeek1={onWeek1}
              onAdd={() => props.onViewChange("add")}
              onJumpToConflict={(key, conflictWeek) => {
                setWeek(conflictWeek);
                setFocusKey(key);
                props.onViewChange("week");
              }}
              {...(props.onDeleteFinalPlan ? { onDeleteFinalPlan: props.onDeleteFinalPlan } : {})}
              notices={<>{hintFor("plan-import")}{planNotices}</>}
            />
          </section>
        ) : null}
      </div>
      {/* F6 (DESIGN-M6-001 §6): the registration import is a sheet; its chunk is prefetched on mount (AC-M4-02). */}
      <Sheet open={importOpen} onClose={() => setImportOpen(false)} title="Nhập kết quả đăng ký môn học (ĐKMH)" size="full">
        <LocalErrorBoundary
          onRetry={() => {
            resetRegistrationImport();
            setRegistrationImportPanel(() => createLazyRegistrationPanel());
          }}
          fallback={(retry) => (
            <Notice tone="error" title="Chưa tải được phần nhập ĐKMH" action={<Button variant="secondary" size="sm" onClick={retry}>Thử lại</Button>}>
              Hãy kết nối mạng rồi thử lại. Phương án của bạn không bị ảnh hưởng.
            </Notice>
          )}
        >
          <Suspense fallback={<p className="loading" role="status">Đang mở phần nhập kết quả ĐKMH…</p>}>
            <RegistrationImportPanel
              catalog={catalog}
              draftPlan={draftPlan}
              {...(finalPlan ? { existingFinalPlan: finalPlan } : {})}
              onConfirm={(nextFinalPlan, notes) => {
                setImportOpen(false);
                props.onConfirmRegistration(nextFinalPlan, notes);
              }}
              onClose={() => setImportOpen(false)}
            />
          </Suspense>
        </LocalErrorBoundary>
      </Sheet>
      <PrintSheet plan={plan} view={view} catalog={catalog} week={week} colors={colors} />
    </div>
  );
}
