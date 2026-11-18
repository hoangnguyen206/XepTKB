/**
 * Session details (DESIGN-M6-001 §7, AC-M6-07): full course name, periods and clock times, weeks, room, lecturers,
 * class and group, every registration override as "from → to" (M4), the conflict partners, the course colour (10
 * swatches + "Tự động", saved on this device) and "Bỏ lớp này".
 */
import type { TimeFrame } from "@ky-nay/domain";
import { dayLabel, formatPeriods, formatSessionExtras, formatWeeks, kindText, periodTimes, type ScheduledSession } from "@ky-nay/export";
import { COURSE_COLOR_LABELS, COURSE_PALETTE, courseColorStyle, type CourseColor, type CourseColorId } from "../model/palette.js";
import { Notice } from "./common.js";
import { overrideBadges } from "./CourseBlock.js";
import { IconCheck, IconTrash } from "./icons.js";
import { Button } from "./ui/Button.js";
import { Sheet } from "./ui/Sheet.js";

export function SessionSheet(props: {
  session?: ScheduledSession;
  onClose: () => void;
  frame: TimeFrame;
  partners: readonly string[];
  color: CourseColor;
  chosen?: CourseColorId;
  onColor: (color: CourseColorId | undefined) => void;
  onUnpick?: () => void;
}) {
  const session = props.session;
  const times = session?.startPeriod !== undefined && session.endPeriod !== undefined ? periodTimes(props.frame, session.startPeriod, session.endPeriod) : undefined;
  const extras = session ? formatSessionExtras(session.note, session.info) : "";
  return (
    <Sheet open={Boolean(session)} onClose={props.onClose} title={session ? `${session.courseCode} · ${session.courseName}` : ""}>
      {session ? (
        <>
          {props.partners.length > 0 ? <Notice tone="error" title="Đang trùng lịch">Trùng với {props.partners.join(", ")}.</Notice> : null}
          <dl className="facts session-facts">
            <div><dt>Thời gian</dt><dd>{session.day !== undefined && session.startPeriod !== undefined && session.endPeriod !== undefined ? `${dayLabel(session.day)}, ${formatPeriods(session.startPeriod, session.endPeriod)}${times ? ` (${times.start}–${times.end})` : ""}` : "Không có giờ cố định"}</dd></div>
            <div><dt>Tuần</dt><dd>{formatWeeks(session.weeks)}</dd></div>
            <div><dt>Phòng</dt><dd>{session.room ?? "chưa có phòng"}{session.campus ? ` · ${session.campus}` : ""}</dd></div>
            <div><dt>Giảng viên</dt><dd>{session.lecturers.length > 0 ? session.lecturers.join(", ") : "chưa có"}</dd></div>
            <div><dt>Lớp</dt><dd>{session.sectionId}{session.group && session.group !== "CL" ? ` · nhóm ${session.group}` : ""}{kindText(session.kind) ? ` · ${kindText(session.kind)}` : ""}</dd></div>
            {extras ? <div><dt>Ghi chú</dt><dd>{extras}</dd></div> : null}
          </dl>
          {session.overrides && session.overrides.length > 0 ? (
            <div className="session-overrides">
              <h3>Thay đổi theo kết quả ĐKMH</h3>
              {overrideBadges(session).map((badge) => <span key={badge} className="badge badge-override">{badge}</span>)}
              <ul className="override-list">
                {session.overrides.map((item) => <li key={item.detail} className="override-detail">{item.detail}</li>)}
              </ul>
            </div>
          ) : null}
          <fieldset className="color-picker">
            <legend>Màu môn {session.courseCode}</legend>
            <div className="swatches">
              <button type="button" className="swatch swatch-auto course-color" style={courseColorStyle(props.color)} aria-pressed={props.chosen === undefined} aria-label="Tự động" onClick={() => props.onColor(undefined)}>
                {props.chosen === undefined ? <IconCheck size={18} /> : <span aria-hidden="true">A</span>}
              </button>
              {COURSE_PALETTE.map((color) => (
                <button key={color.id} type="button" className="swatch course-color" style={courseColorStyle(color)} aria-pressed={props.chosen === color.id} aria-label={COURSE_COLOR_LABELS[color.id]} onClick={() => props.onColor(color.id)}>
                  {props.chosen === color.id ? <IconCheck size={18} /> : null}
                </button>
              ))}
            </div>
            <p className="muted">Màu chỉ lưu trên máy này.</p>
          </fieldset>
          {props.onUnpick ? (
            <Button variant="danger" icon={<IconTrash size={18} />} onClick={() => { props.onUnpick!(); props.onClose(); }}>Bỏ lớp này</Button>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
