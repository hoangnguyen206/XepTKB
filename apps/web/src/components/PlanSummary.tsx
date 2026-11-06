import { useId, useState } from "react";
import { canonicalSectionId, type Plan } from "@ky-nay/domain";
import { describeConflict, formatDate } from "@ky-nay/export";
import { courseOf, sectionOf, type AppCatalog } from "../model/catalog.js";
import { describeCampus, groupOptions } from "../model/picker.js";
import { rebasePreview, type PlanView } from "../model/plan-view.js";
import type { TermRegistrationNotes } from "../storage/local-data.js";
import { Notice } from "./common.js";
import { Week1Fields, type Week1Choice } from "./Onboarding.js";

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
  const unchanged = preview !== undefined && preview.removed.length === 0 && preview.groupCleared.length === 0 && preview.needsGroup.length === 0;
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
          <div className="actions">
            <button type="button" className="button primary" onClick={props.onRebase}>Xác nhận cập nhật</button>
            <button type="button" className="button secondary" onClick={() => setConfirming(false)}>Hủy</button>
          </div>
        </div>
      ) : null}
    </Notice>
  );
}

export function PlanSummary(props: {
  plan: Plan;
  view: PlanView;
  catalog: AppCatalog;
  registrationNotes?: TermRegistrationNotes;
  onUnpick: (sectionId: string) => void;
  onSelectGroup?: (sectionId: string, group: string) => void;
  onWeek1: (choice: Week1Choice) => void;
  onDeleteFinalPlan?: () => void;
}) {
  const id = useId();
  const { plan, view, catalog } = props;
  const [editing, setEditing] = useState(false);
  const [week1Choice, setWeek1Choice] = useState<Week1Choice | undefined>(undefined);
  const [confirmDeleteFinal, setConfirmDeleteFinal] = useState(false);

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

  return (
    <section className="plan-summary" aria-labelledby="plan-heading">
      <h3 id="plan-heading" className="visually-hidden">Tóm tắt phương án</h3>
      <dl className="facts">
        <div><dt>Loại phương án</dt><dd>{plan.planKind === "final" ? "Phương án chính thức (từ kết quả ĐKMH)" : "Phương án nháp (tự chọn)"}</dd></div>
        <div><dt>Học kỳ</dt><dd>{catalog.term.name}</dd></div>
        <div><dt>Tuần 1</dt><dd>{view.week1 ? `${formatDate(view.week1.date)} (${view.week1.source === "user" ? "tự nhập" : plan.cohort ? `theo khóa ${plan.cohort}` : "theo lịch trường"})` : "chưa xác định"}</dd></div>
        <div>
          <dt>Tổng tín chỉ</dt>
          <dd>
            <strong className="credits">{view.credits.knownTotal}</strong>
            {view.credits.unknownCourseCodes.length > 0 ? ` (chưa rõ tín chỉ: ${view.credits.unknownCourseCodes.join(", ")})` : ""}
          </dd>
        </div>
      </dl>
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
            {props.registrationNotes.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <h3>Lớp đã chọn ({plan.picks.length})</h3>
      {plan.picks.length === 0 ? <p className="muted">Chưa chọn lớp nào. Hãy tìm môn hoặc nhập kết quả ĐKMH để bắt đầu.</p> : (
        <ul className="pick-list">
          {plan.picks.map((pick) => {
            const section = sectionOf(catalog, pick.sectionId);
            const course = section ? courseOf(catalog, section.courseCode) : undefined;
            const issues = issueFor(pick.sectionId);
            const pickOverrides = overridesForPick(pick.sectionId);
            const uniqueBadges = [...new Set(pickOverrides.map((item) => item.badge))];
            const groups = section ? groupOptions(section) : [];
            return (
              <li key={pick.sectionId}>
                <div>
                  <strong>{pick.sectionId}</strong> {course?.name ?? "(không còn trong dữ liệu)"}
                  {pick.group ? ` · nhóm ${pick.group}` : ""}
                  {course ? ` · ${course.credits === undefined ? "chưa rõ tín chỉ" : `${course.credits} TC`}` : ""}
                  {section?.online ? " · trực tuyến" : ""}
                  {uniqueBadges.length > 0 ? (
                    <span className="badges inline-badges">
                      {uniqueBadges.map((badge) => (
                        <span key={badge} className="badge badge-override">{badge}</span>
                      ))}
                    </span>
                  ) : null}
                  {pickOverrides.length > 0 ? (
                    <ul className="override-list">
                      {pickOverrides.map((ov, index) => (
                        <li key={`${ov.field}-${index}`} className="override-detail">★ {ov.detail}</li>
                      ))}
                    </ul>
                  ) : null}
                  {[...new Set(issues.map((issue) => issue.code))].filter((code) => PICK_ISSUE_TEXT[code]).map((code) => <p key={code} className="field-error">⚠ {PICK_ISSUE_TEXT[code]}</p>)}
                  {groups.length > 1 && props.onSelectGroup ? (
                    <div className="inline-group-select">
                      <label htmlFor={`${id}-grp-${pick.sectionId}`}>Nhóm thực hành</label>
                      <select
                        id={`${id}-grp-${pick.sectionId}`}
                        value={pick.group && groups.includes(pick.group) ? pick.group : ""}
                        onChange={(event) => {
                          if (event.target.value) props.onSelectGroup?.(pick.sectionId, event.target.value);
                        }}
                      >
                        <option value="" disabled>-- Chọn nhóm --</option>
                        {groups.map((option) => (
                          <option key={option} value={option}>Nhóm {option}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                <button type="button" className="button secondary small" onClick={() => props.onUnpick(pick.sectionId)} aria-label={`Bỏ chọn lớp ${pick.sectionId}`}>Bỏ chọn</button>
              </li>
            );
          })}
        </ul>
      )}

      {view.conflicts.length > 0 || view.campusWarnings.length > 0 || view.unresolved.length > 0 ? (
        <div className="conflict-summary">
          <h3>Cần kiểm tra</h3>
          <ul>
            {view.unresolved.length > 0 ? <li className="conflict-text">⚠ Chưa kiểm tra đủ trùng lịch: {view.unresolved.length} lớp cần xử lý ({view.unresolved.map((entry) => entry.sectionId).join(", ")}).</li> : null}
            {view.conflicts.map((conflict) => <li key={`${conflict.left.sessionId}|${conflict.right.sessionId}`} className="conflict-text">⚠ {describeConflict(conflict, undefined, lookup)}</li>)}
            {view.campusWarnings.map((warning) => <li key={`c|${warning.left.sessionId}|${warning.right.sessionId}`} className="campus-text">ⓘ {describeCampus(warning)}</li>)}
          </ul>
        </div>
      ) : plan.picks.length > 0 ? <p className="ok-text">✓ Không có lớp nào trùng lịch.</p> : null}

      <details className="settings" open={editing} onToggle={(event) => setEditing((event.target as HTMLDetailsElement).open)}>
        <summary>Thiết lập tuần 1</summary>
        {editing ? (
          <div>
            <Week1Fields term={catalog.term} initial={{ ...(plan.cohort ? { cohort: plan.cohort } : {}), ...(plan.week1 ? { week1: plan.week1 } : {}) }} onChange={setWeek1Choice} />
            <button type="button" className="button primary" disabled={!week1Choice} onClick={() => { if (week1Choice) { props.onWeek1(week1Choice); setEditing(false); } }}>Lưu tuần 1</button>
          </div>
        ) : null}
      </details>

      {plan.planKind === "final" && props.onDeleteFinalPlan ? (
        <div className="final-plan-actions">
          {confirmDeleteFinal ? (
            <div className="actions">
              <span>Xóa Phương án chính thức này? Phương án nháp của bạn vẫn được giữ nguyên.</span>
              <button type="button" className="button danger small" onClick={() => { setConfirmDeleteFinal(false); props.onDeleteFinalPlan?.(); }}>Xác nhận xóa phương án chính thức</button>
              <button type="button" className="button secondary small" onClick={() => setConfirmDeleteFinal(false)}>Hủy</button>
            </div>
          ) : (
            <button type="button" className="button secondary small" onClick={() => setConfirmDeleteFinal(true)}>Xóa phương án chính thức</button>
          )}
        </div>
      ) : null}
    </section>
  );
}
