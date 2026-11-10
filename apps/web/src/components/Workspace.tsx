import { Suspense, useEffect, useMemo, useState } from "react";
import type { Plan } from "@ky-nay/domain";
import { buildGridLayout, conflictKeys, dayLabel, formatDate, formatPeriods, formatWeeks, kindText, nonFixedSessions, periodTimes } from "@ky-nay/export";
import type { AppCatalog } from "../model/catalog.js";
import { exportDisclaimer, provenanceLine } from "../model/labels.js";
import { applyPick, unpick } from "../model/picker.js";
import { buildPlanView, rebasePlan, setPickedGroup, type PlanView } from "../model/plan-view.js";
import { defaultWeek, todayInVietnam, weekLabel } from "../model/week.js";
import type { TermRegistrationNotes } from "../storage/local-data.js";
import { Notice, TabPanel, Tabs, useMediaQuery, WeekPicker, type WeekChoice } from "./common.js";
import { ExportPanel } from "./ExportPanel.js";
import type { Week1Choice } from "./Onboarding.js";
import { PlanSummary, StalePlanNotice } from "./PlanSummary.js";
import { LocalErrorBoundary } from "./ErrorBoundary.js";
import { createLazyRegistrationPanel, prefetchRegistrationImport, resetRegistrationImport } from "./registration-lazy.js";
import { DayList, NonFixedList, WeekGrid } from "./Schedule.js";
import { SearchPanel } from "./SearchPanel.js";
import { creditsLine } from "../export/files.js";

const ISSUE_TEXT: Record<string, string> = {
  GROUP_REQUIRED: "Lớp này có nhiều nhóm — hãy chọn nhóm trước.",
  GROUP_NOT_FOUND: "Nhóm đã chọn không có trong lớp này.",
  SECTION_NOT_FOUND: "Lớp không có trong dữ liệu đang dùng.",
  DUPLICATE_PLAN_PICK: "Lớp này đã có trong phương án.",
  DUPLICATE_COURSE_SELECTION: "Môn này đã có lớp khác trong phương án.",
};

/** Print-only sheet (A4 landscape via print CSS): grid of the selected week plus the session table. */
function PrintSheet(props: { plan: Plan; view: PlanView; catalog: AppCatalog; week: WeekChoice }) {
  const { plan, view, catalog } = props;
  const week = props.week === "all" ? undefined : props.week;
  const layout = buildGridLayout(view.sessions, { ...(week !== undefined ? { week } : {}), maxPeriod: catalog.maxPeriod, conflictKeys: conflictKeys(view.conflicts, week) });
  const fixed = view.sessions.filter((session) => session.fixed);
  return (
    <div className="print-only" aria-hidden="true">
      <h2>{plan.name} — {catalog.term.name}</h2>
      <p>{week !== undefined && view.week1 ? weekLabel(view.week1.date, week) : "Tất cả các tuần"}{view.week1 ? ` · Tuần 1 bắt đầu ${formatDate(view.week1.date)}` : ""} · {creditsLine(view)}</p>
      {view.week1 ? <WeekGrid layout={layout} frame={catalog.frame} week1={view.week1.date} week={props.week} caption="Bản in lưới thời khóa biểu" print /> : null}
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
  onPlanChange: (plan: Plan) => void;
  onSelectSlot: (slot: "draft" | "final") => void;
  onConfirmRegistration: (finalPlan: Plan, notes: TermRegistrationNotes) => void;
  onDeleteFinalPlan?: () => void;
}) {
  const { plan, draftPlan, finalPlan, activeSlot, catalog } = props;
  const desktop = useMediaQuery("(min-width: 1200px)");
  const view = useMemo(() => buildPlanView(plan, catalog), [plan, catalog]);
  const today = todayInVietnam();
  const [week, setWeek] = useState<WeekChoice>(() => (view.week1 ? defaultWeek(view.week1.date, catalog.term.teachingWeeks, today) : "all"));
  const [tab, setTab] = useState<string>("search");
  const [pickError, setPickError] = useState<string | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  // M5-F: the registration import chunk is loaded lazily; a retry after a failed load needs a fresh lazy component.
  const [RegistrationImportPanel, setRegistrationImportPanel] = useState(() => createLazyRegistrationPanel());
  useEffect(() => {
    // Prefetch right after mount (DESIGN-M5-001 §5): opening the panel must not issue a request (AC-M4-02 / AC-04).
    prefetchRegistrationImport();
  }, []);
  const activeTab = desktop && tab === "search" ? "week" : tab;
  const tabs = [
    ...(desktop ? [] : [{ id: "search", label: "Tìm môn" }]),
    { id: "week", label: desktop ? "Lịch tuần" : "Tuần" },
    { id: "day", label: desktop ? "Theo ngày" : "Ngày" },
    { id: "plan", label: `Phương án (${plan.picks.length})` },
  ];
  const now = () => new Date().toISOString();
  const weekNumber = week === "all" ? undefined : week;
  const layout = useMemo(
    () => buildGridLayout(view.sessions, { ...(weekNumber !== undefined ? { week: weekNumber } : {}), maxPeriod: catalog.maxPeriod, conflictKeys: conflictKeys(view.conflicts, weekNumber) }),
    [view, weekNumber, catalog.maxPeriod],
  );
  const keys = useMemo(() => conflictKeys(view.conflicts, weekNumber), [view.conflicts, weekNumber]);
  const activeOverrideCount = useMemo(
    () => view.sessions.reduce((sum, session) => sum + (session.overrides?.length ?? 0), 0),
    [view.sessions],
  );

  const onPick = (sectionId: string, group?: string) => {
    const result = applyPick(plan, catalog, group ? { sectionId, group } : { sectionId }, now());
    if (result.plan) {
      setPickError(undefined);
      props.onPlanChange(result.plan);
    } else {
      setPickError(result.issues.map((issue) => ISSUE_TEXT[issue.code] ?? issue.message).join(" "));
    }
  };
  const onUnpick = (sectionId: string) => props.onPlanChange(unpick(plan, sectionId, now()));
  const onSelectGroup = (sectionId: string, group: string) => {
    setPickError(undefined);
    props.onPlanChange(setPickedGroup(plan, sectionId, group, now()));
  };
  const onWeek1 = (choice: Week1Choice) => {
    const { cohort: _cohort, week1: _week1, ...rest } = plan;
    props.onPlanChange({ ...rest, ...(choice.cohort ? { cohort: choice.cohort } : {}), ...(choice.week1 ? { week1: choice.week1 } : {}), updatedAt: now() });
  };
  const search = <SearchPanel catalog={catalog} plan={plan} onPick={onPick} onUnpick={onUnpick} headingLevel={desktop ? "h2" : "h3"} />;

  return (
    <div className={desktop ? "workspace two-col" : "workspace"}>
      {desktop ? <aside className="pane-left card" aria-label="Tìm và chọn lớp">{search}</aside> : null}
      <div className="pane-main">
        <div className="plan-bar">
          <div className="plan-bar-top">
            <h2>{plan.name}</h2>
            <div className="plan-slot-controls">
              <div className="slot-switcher" role="group" aria-label="Chọn phương án">
                <button
                  type="button"
                  className={`button small ${activeSlot === "draft" ? "primary" : "secondary"}`}
                  aria-pressed={activeSlot === "draft"}
                  onClick={() => props.onSelectSlot("draft")}
                >
                  Phương án nháp ({draftPlan.picks.length})
                </button>
                {finalPlan ? (
                  <button
                    type="button"
                    className={`button small ${activeSlot === "final" ? "primary" : "secondary"}`}
                    aria-pressed={activeSlot === "final"}
                    onClick={() => props.onSelectSlot("final")}
                  >
                    Phương án chính thức ({finalPlan.picks.length})
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="button secondary small"
                aria-expanded={importOpen}
                onClick={() => setImportOpen((open) => !open)}
              >
                {finalPlan ? "Cập nhật từ file ĐKMH" : "Nhập kết quả ĐKMH"}
              </button>
            </div>
          </div>
          <p className="muted">
            {/* AC-M3-11: unknown credits are "chưa rõ", never counted as 0 (QA-M3-008). */}
            {catalog.term.name} · {plan.picks.length} lớp · {view.credits.knownTotal === 0 && view.credits.unknownCourseCodes.length > 0 ? "chưa rõ" : view.credits.knownTotal} tín chỉ
            {view.credits.unknownCourseCodes.length > 0 && view.credits.knownTotal > 0 ? ` + ${view.credits.unknownCourseCodes.length} môn chưa rõ tín chỉ` : ""}
            {activeOverrideCount > 0 ? <strong className="override-count"> · ★ {activeOverrideCount} thay đổi từ ĐKMH</strong> : null}
            {view.conflicts.length > 0 ? <strong className="conflict-count"> · ⚠ {view.conflicts.length} chỗ trùng lịch</strong> : null}
            {view.unresolved.length > 0 ? <strong className="conflict-count"> · ⚠ {view.unresolved.length} lớp cần xử lý</strong> : null}
          </p>
        </div>
        {importOpen ? (
          <LocalErrorBoundary
            onRetry={() => {
              resetRegistrationImport();
              setRegistrationImportPanel(() => createLazyRegistrationPanel());
            }}
            fallback={(retry) => (
              <Notice tone="error" title="Chưa tải được phần nhập ĐKMH" action={<button type="button" className="button secondary small" onClick={retry}>Thử lại</button>}>
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
        ) : null}
        {view.stale ? <StalePlanNotice plan={plan} catalog={catalog} onRebase={() => props.onPlanChange(rebasePlan(plan, catalog, now()))} /> : null}
        {view.week1Issue ? <Notice tone="warning">Chưa xác định được tuần 1 cho phương án này. Hãy mở Phương án → Thiết lập tuần 1.</Notice> : null}
        {pickError ? <Notice tone="error">{pickError}</Notice> : null}
        <Tabs label="Các phần của phương án" tabs={tabs} active={activeTab} onChange={setTab} idPrefix="ws" />
        {desktop ? null : <TabPanel idPrefix="ws" id="search" active={activeTab === "search"}>{search}</TabPanel>}
        <TabPanel idPrefix="ws" id="week" active={activeTab === "week"}>
          <h3 className="visually-hidden">Lịch tuần</h3>
          {view.week1 ? (
            <>
              <WeekPicker week1={view.week1.date} teachingWeeks={catalog.term.teachingWeeks} value={week} onChange={setWeek} />
              {view.sessions.length === 0 ? <p className="muted">Chưa có lớp nào. Hãy tìm môn và chọn lớp.</p> : null}
              <WeekGrid layout={layout} frame={catalog.frame} week1={view.week1.date} week={week} caption={week === "all" ? "Lưới thời khóa biểu tất cả các tuần" : `Lưới thời khóa biểu tuần ${week}`} />
              <NonFixedList sessions={nonFixedSessions(view.sessions)} />
            </>
          ) : null}
        </TabPanel>
        <TabPanel idPrefix="ws" id="day" active={activeTab === "day"}>
          <h3 className="visually-hidden">Lịch theo ngày</h3>
          {view.week1 ? (
            <>
              <WeekPicker week1={view.week1.date} teachingWeeks={catalog.term.teachingWeeks} value={week} onChange={setWeek} />
              <DayList sessions={view.sessions} frame={catalog.frame} week1={view.week1.date} week={week} today={today} conflictKeys={keys} />
              <NonFixedList sessions={nonFixedSessions(view.sessions)} />
            </>
          ) : null}
        </TabPanel>
        <TabPanel idPrefix="ws" id="plan" active={activeTab === "plan"}>
          <PlanSummary
            plan={plan}
            view={view}
            catalog={catalog}
            {...(props.registrationNotes ? { registrationNotes: props.registrationNotes } : {})}
            onUnpick={onUnpick}
            onSelectGroup={onSelectGroup}
            onWeek1={onWeek1}
            {...(props.onDeleteFinalPlan ? { onDeleteFinalPlan: props.onDeleteFinalPlan } : {})}
          />
          <ExportPanel plan={plan} view={view} catalog={catalog} week={week} />
        </TabPanel>
      </div>
      <PrintSheet plan={plan} view={view} catalog={catalog} week={week} />
    </div>
  );
}
