/**
 * Phương án (DESIGN-M6-001 §6/§13 F6, AC-M6-13): the plan bar (name, draft/final switch, "Nhập kết quả ĐKMH"), a
 * credits StatCard with a colour bar (one segment per course with known credits, so the bar adds up to the total), the
 * conflicts as chips that jump to the cell on the calendar, a compact list of classes with group chips, week 1,
 * deleting the final plan, and the export tiles.
 */
import { useId, useState, type ReactNode } from "react";
import { canonicalSectionId, normalizeCourseCode, type HardConflict, type Plan } from "@ky-nay/domain";
import { describeConflict, formatDate, sessionKey } from "@ky-nay/export";
import { courseOf, sectionOf, type AppCatalog } from "../model/catalog.js";
import { courseColorStyle } from "../model/palette.js";
import { describeCampus, groupOptions } from "../model/picker.js";
import { rebasePreview, type PlanView as PlanViewModel } from "../model/plan-view.js";
import type { TermRegistrationNotes } from "../storage/local-data.js";
import { Notice, type WeekChoice } from "./common.js";
import { ExportPanel } from "./ExportPanel.js";
import { IconPlus, IconTrash, IconWarning } from "./icons.js";
import { Week1Fields, type Week1Choice } from "./Onboarding.js";
import { Button } from "./ui/Button.js";
import { ChipRadio } from "./ui/Chip.js";
import { EmptyState } from "./ui/EmptyState.js";
import { StatCard } from "./ui/StatCard.js";
import type { CourseColorLookup } from "./useCourseColors.js";

/** Per-pick explanation of an unresolved pick (REV-M3-001). */
const PICK_ISSUE_TEXT: Record<string, string> = {
  GROUP_REQUIRED: "Chưa chọn nhóm — hãy chọn nhóm ở bên dưới hoặc trong mục Tìm môn. Mới kiểm tra trùng lịch cho buổi chung của lớp.",
  GROUP_NOT_FOUND: "Nhóm đã chọn không còn trong dữ liệu — hãy chọn lại nhóm. Mới kiểm tra trùng lịch cho buổi chung của lớp.",
  SECTION_NOT_FOUND: "Lớp không có trong dữ liệu đang dùng.",
  DUPLICATE_PLAN_PICK: "Lớp bị chọn hai lần — hãy bỏ một lần chọn.",
  DUPLICATE_COURSE_SELECTION: "Môn này đã có lớp khác trong phương án — hãy bỏ một lớp.",
};

export function StalePlanNotice(props: { plan: Plan; catalog: AppCatalog; onRebase: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const preview = confirming ? rebasePreview(props.plan, props.catalog) : undefined;
  const droppedOverrides = preview?.droppedOverrides ?? [];
  const unchanged =
    preview !== undefined &&
    preview.removed.length === 0 &&
    preview.groupCleared.length === 0 &&
    preview.needsGroup.length === 0 &&
    droppedOverrides.length === 0;
  return (
    <Notice
      tone="warning"
      title="Dữ liệu thời khóa biểu đã có phiên bản khác"
      action={confirming ? null : <button type="button" className="button secondary" onClick={() => setConfirming(true)}>Cập nhật phương án</button>}
    >
      <p>Phương án được tạo với dữ liệu {props.plan.datasetVersion}; dữ liệu đang dùng là {props.catalog.entry.datasetVersion}. Hãy kiểm tra lại phòng/giờ các lớp đã chọn.</p>
      {preview ? (
        <div>
          {unchanged ? <p>Mọi lớp và nhóm đã chọn vẫn còn trong dữ liệu mới.</p> : null}
          {preview.removed.length > 0 ? <p>Các lớp không còn trong dữ liệu mới sẽ bị bỏ khỏi phương án: {preview.removed.join(", ")}.</p> : null}
          {preview.groupCleared.length > 0 ? <p>Nhóm đã chọn không còn trong dữ liệu mới, sẽ bỏ nhóm của: {preview.groupCleared.join(", ")}.</p> : null}
          {preview.needsGroup.length > 0 ? <p className="field-error">Sau khi cập nhật cần chọn lại nhóm cho: {preview.needsGroup.join(", ")}.</p> : null}
          {droppedOverrides.length > 0 ? (
            <p className="field-error">
              Thay đổi phòng/giờ từ ĐKMH của các lớp sau không còn khớp cấu trúc buổi học mới và sẽ bị bỏ (hãy nhập lại file ĐKMH nếu cần): {droppedOverrides.join(", ")}.
            </p>
          ) : null}
          <div className="actions">
            <button type="button" className="button primary" onClick={props.onRebase}>Xác nhận cập nhật</button>
            <button type="button" className="button secondary" onClick={() => setConfirming(false)}>Hủy</button>
          </div>
        </div>
      ) : null}
    </Notice>
  );
}

/** One segment per course with known credits, in plan order; the segments add up to `credits.knownTotal`. */
export function creditSegments(plan: Plan, catalog: AppCatalog): { code: string; credits: number }[] {
  const seen = new Set<string>();
  const segments: { code: string; credits: number }[] = [];
  for (const pick of plan.picks) {
    const section = sectionOf(catalog, pick.sectionId);
    const course = section ? courseOf(catalog, section.courseCode) : undefined;
    if (!course || course.credits === undefined) continue;
    const code = normalizeCourseCode(course.code);
    if (seen.has(code)) continue;
    seen.add(code);
    segments.push({ code: course.code, credits: course.credits });
  }
  return segments;
}

export function PlanView(props: {
  plan: Plan;
  draftPlan: Plan;
  finalPlan?: Plan;
  activeSlot: "draft" | "final";
  view: PlanViewModel;
  catalog: AppCatalog;
  week: WeekChoice;
  colors: CourseColorLookup;
  registrationNotes?: TermRegistrationNotes;
  importOpen: boolean;
  onOpenImport: () => void;
  onSelectSlot: (slot: "draft" | "final") => void;
  onUnpick: (sectionId: string) => void;
  onSelectGroup?: (sectionId: string, group: string) => void;
  onWeek1: (choice: Week1Choice) => void;
  onDeleteFinalPlan?: () => void;
  onAdd: () => void;
  /** AC-M6-13: a conflict chip opens the calendar on the first overlapping week with the cell focused. */
  onJumpToConflict: (sessionKey: string, week: number) => void;
  /** Notices (stale data, week 1) and the one-time hint, placed under the plan bar. */
  notices?: ReactNode;
}) {
  const id = useId();
  const { plan, view, catalog, draftPlan, finalPlan, activeSlot } = props;
  const [editing, setEditing] = useState(false);
  const [week1Choice, setWeek1Choice] = useState<Week1Choice | undefined>(undefined);
  const [confirmDeleteFinal, setConfirmDeleteFinal] = useState(false);
  const overrideCount = view.sessions.reduce((sum, session) => sum + (session.overrides?.length ?? 0), 0);
  const credits = view.credits;
  // AC-M3-11: unknown credits are "chưa rõ", never counted as 0 (QA-M3-008).
  const creditsText = credits.knownTotal === 0 && credits.unknownCourseCodes.length > 0 ? "chưa rõ" : String(credits.knownTotal);
  const segments = creditSegments(plan, catalog);

  const lookup = (sectionId: string) => {
    const section = sectionOf(catalog, sectionId);
    const course = section ? courseOf(catalog, section.courseCode) : undefined;
    return course ? { courseName: course.name } : undefined;
  };
  const issueFor = (sectionId: string) =>
    view.resolution.issues.filter((issue) => issue.sectionId !== undefined && canonicalSectionId(issue.sectionId) === canonicalSectionId(sectionId));
  const overridesForPick = (sectionId: string) => {
    const key = canonicalSectionId(sectionId);
    return view.sessions
      .filter((session) => canonicalSectionId(session.sectionId) === key && session.overrides && session.overrides.length > 0)
      .flatMap((session) => session.overrides ?? []);
  };
  const jump = (conflict: HardConflict) => {
    const week = conflict.weekIntersection[0];
    if (week !== undefined) props.onJumpToConflict(sessionKey(conflict.left.sectionId, conflict.left.sessionId), week);
  };
  const slotClass = (active: boolean) => `btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`;

  return (
    <>
      <div className="plan-bar">
        <div className="plan-bar-top">
          <h2 id="view-plan-heading">{plan.name}</h2>
          <div className="plan-slot-controls">
            <div className="slot-switcher" role="group" aria-label="Chọn phương án">
              <button type="button" className={slotClass(activeSlot === "draft")} aria-pressed={activeSlot === "draft"} onClick={() => props.onSelectSlot("draft")}>
                Phương án nháp ({draftPlan.picks.length})
              </button>
              {finalPlan ? (
                <button type="button" className={slotClass(activeSlot === "final")} aria-pressed={activeSlot === "final"} onClick={() => props.onSelectSlot("final")}>
                  Phương án chính thức ({finalPlan.picks.length})
                </button>
              ) : null}
            </div>
            <Button variant="secondary" size="sm" aria-expanded={props.importOpen} onClick={props.onOpenImport}>
              {finalPlan ? "Cập nhật từ file ĐKMH" : "Nhập kết quả ĐKMH"}
            </Button>
          </div>
        </div>
        <p className="muted">
          {catalog.term.name} · {plan.picks.length} lớp · {creditsText} tín chỉ
          {credits.unknownCourseCodes.length > 0 && credits.knownTotal > 0 ? ` + ${credits.unknownCourseCodes.length} môn chưa rõ tín chỉ` : ""}
          {overrideCount > 0 ? <strong className="override-count"> · ★ {overrideCount} thay đổi từ ĐKMH</strong> : null}
          {view.conflicts.length > 0 ? <strong className="conflict-count"> · ⚠ {view.conflicts.length} chỗ trùng lịch</strong> : null}
          {view.unresolved.length > 0 ? <strong className="conflict-count"> · ⚠ {view.unresolved.length} lớp cần xử lý</strong> : null}
        </p>
      </div>
      {props.notices}

      <section className="plan-summary" aria-labelledby={`${id}-summary`}>
        <h3 id={`${id}-summary`} className="visually-hidden">Tóm tắt phương án</h3>
        {plan.picks.length > 0 ? (
          <StatCard label="Tín chỉ" value={creditsText} meta={credits.unknownCourseCodes.length > 0 ? `Chưa rõ tín chỉ: ${credits.unknownCourseCodes.join(", ")}` : `${segments.length} môn`}>
            {segments.length > 0 ? (
              <div className="credit-bar" aria-hidden="true">
                {segments.map((segment) => (
                  <span key={segment.code} className="credit-seg course-color" data-credits={segment.credits} style={{ ...courseColorStyle(props.colors.colorOf(segment.code)), flexGrow: segment.credits }} />
                ))}
              </div>
            ) : null}
          </StatCard>
        ) : null}
        {view.creditCheck ? (
          <Notice tone="warning">{view.creditCheck.kind === "below" ? `Ít hơn mức tối thiểu ${view.creditCheck.limit} tín chỉ của kỳ.` : `Vượt mức tối đa ${view.creditCheck.limit} tín chỉ của kỳ.`}</Notice>
        ) : null}

        {plan.planKind === "final" && props.registrationNotes && props.registrationNotes.unmatched.length > 0 ? (
          <Notice tone="warning" title={`Có ${props.registrationNotes.unmatched.length} lớp trong file ĐKMH chưa khớp dữ liệu TKB`}>
            <p>Các lớp dưới đây có trong file Kết quả đăng ký môn học nhưng không có (hoặc bị trùng mã) trong dữ liệu thời khóa biểu đang dùng:</p>
            <ul>
              {props.registrationNotes.unmatched.map((item) => (
                <li key={item.sectionId}>
                  <strong>{item.sectionId}</strong> (môn {item.courseCode}): {item.sessionsSummary.join("; ")}
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}
        {plan.planKind === "final" && props.registrationNotes && props.registrationNotes.warnings.length > 0 ? (
          <Notice tone="info" title="Ghi chú từ kết quả ĐKMH">
            <ul>
              {props.registrationNotes.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </Notice>
        ) : null}

        {view.conflicts.length > 0 || view.campusWarnings.length > 0 || view.unresolved.length > 0 ? (
          <div className="conflict-summary">
            <h3>Cần kiểm tra</h3>
            <ul>
              {view.unresolved.length > 0 ? <li className="conflict-text">⚠ Chưa kiểm tra đủ trùng lịch: {view.unresolved.length} lớp cần xử lý ({view.unresolved.map((entry) => entry.sectionId).join(", ")}).</li> : null}
              {view.conflicts.map((conflict) => (
                <li key={`${conflict.left.sessionId}|${conflict.right.sessionId}`}>
                  <button type="button" className="conflict-chip" onClick={() => jump(conflict)}>
                    <IconWarning size={16} />
                    <span>{describeConflict(conflict, undefined, lookup)}</span>
                  </button>
                </li>
              ))}
              {view.campusWarnings.map((warning) => <li key={`c|${warning.left.sessionId}|${warning.right.sessionId}`} className="campus-text">ⓘ {describeCampus(warning)}</li>)}
            </ul>
          </div>
        ) : plan.picks.length > 0 ? <p className="ok-text">✓ Không có lớp nào trùng lịch.</p> : null}

        <h3>Lớp đã chọn ({plan.picks.length})</h3>
        {plan.picks.length === 0 ? (
          <EmptyState icon={<IconPlus />} title="Chưa chọn lớp nào" action={<Button variant="primary" onClick={props.onAdd}>Thêm lớp</Button>} />
        ) : (
          <ul className="list pick-list">
            {plan.picks.map((pick) => {
              const section = sectionOf(catalog, pick.sectionId);
              const course = section ? courseOf(catalog, section.courseCode) : undefined;
              const issues = issueFor(pick.sectionId);
              const pickOverrides = overridesForPick(pick.sectionId);
              const uniqueBadges = [...new Set(pickOverrides.map((item) => item.badge))];
              const groups = section ? groupOptions(section) : [];
              const meta = [pick.group ? `nhóm ${pick.group}` : "", course ? (course.credits === undefined ? "chưa rõ tín chỉ" : `${course.credits} TC`) : "", section?.online ? "trực tuyến" : ""].filter(Boolean).join(" · ");
              return (
                <li key={pick.sectionId} className="pick-row">
                  <span className="list-row-dot course-color" style={courseColorStyle(props.colors.colorOf(section?.courseCode ?? pick.sectionId))} aria-hidden="true" />
                  <div className="pick-main">
                    <span className="list-row-title"><strong>{pick.sectionId}</strong> {course?.name ?? "(không còn trong dữ liệu)"}</span>
                    <span className="list-row-meta">
                      {meta}
                      {uniqueBadges.map((badge) => <span key={badge} className="badge badge-override">{badge}</span>)}
                    </span>
                    {pickOverrides.length > 0 ? (
                      <ul className="override-list">
                        {pickOverrides.map((ov, index) => <li key={`${ov.field}-${index}`} className="override-detail">★ {ov.detail}</li>)}
                      </ul>
                    ) : null}
                    {[...new Set(issues.map((issue) => issue.code))].filter((code) => PICK_ISSUE_TEXT[code]).map((code) => <p key={code} className="field-error">⚠ {PICK_ISSUE_TEXT[code]}</p>)}
                    {groups.length > 1 && props.onSelectGroup ? (
                      <fieldset className="chip-group pick-groups">
                        <legend>Nhóm thực hành</legend>
                        {groups.map((option) => (
                          <ChipRadio key={option} name={`${id}-g-${pick.sectionId}`} id={`${id}-g-${pick.sectionId}-${option}`} value={option} checked={pick.group === option} onChange={(value) => props.onSelectGroup?.(pick.sectionId, value)}>
                            Nhóm {option}
                          </ChipRadio>
                        ))}
                      </fieldset>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="sm" label={`Bỏ lớp ${pick.sectionId}`} icon={<IconTrash size={18} />} onClick={() => props.onUnpick(pick.sectionId)} />
                </li>
              );
            })}
          </ul>
        )}

        <details className="settings" open={editing} onToggle={(event) => setEditing((event.target as HTMLDetailsElement).open)}>
          <summary>
            Tuần 1: {view.week1 ? `${formatDate(view.week1.date)} (${view.week1.source === "user" ? "tự nhập" : plan.cohort ? `theo khóa ${plan.cohort}` : "theo lịch trường"})` : "chưa xác định"}
          </summary>
          {editing ? (
            <div>
              <Week1Fields term={catalog.term} initial={{ ...(plan.cohort ? { cohort: plan.cohort } : {}), ...(plan.week1 ? { week1: plan.week1 } : {}) }} onChange={setWeek1Choice} />
              <Button variant="primary" disabled={!week1Choice} onClick={() => { if (week1Choice) { props.onWeek1(week1Choice); setEditing(false); } }}>Lưu tuần 1</Button>
            </div>
          ) : null}
        </details>

        {plan.planKind === "final" && props.onDeleteFinalPlan ? (
          <div className="final-plan-actions">
            {confirmDeleteFinal ? (
              <div className="actions">
                <span>Xóa Phương án chính thức này? Phương án nháp của bạn vẫn được giữ nguyên.</span>
                <Button variant="danger" size="sm" onClick={() => { setConfirmDeleteFinal(false); props.onDeleteFinalPlan?.(); }}>Xác nhận xóa phương án chính thức</Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteFinal(false)}>Hủy</Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteFinal(true)}>Xóa phương án chính thức</Button>
            )}
          </div>
        ) : null}
      </section>
      <ExportPanel plan={plan} view={view} catalog={catalog} week={props.week} />
    </>
  );
}

