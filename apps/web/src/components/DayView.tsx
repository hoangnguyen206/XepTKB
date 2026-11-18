/**
 * Day view (DESIGN-M6-001 §7, AC-M6-08): one day's sessions in time order, in their course colours, with the same
 * details as the M3 day list (time, room, kind/group, notes, registration overrides, conflicts). In "all weeks" mode it
 * lists the weekday's sessions with their week ranges. Each row opens the session sheet.
 */
import type { DayNo, TimeFrame } from "@ky-nay/domain";
import { addDays, dayLabel, formatDate, formatPeriods, formatSessionExtras, formatWeeks, kindText, occurrencesForWeek, periodTimes, weekRange, type ScheduledSession } from "@ky-nay/export";
import { courseColorStyle, type CourseColor } from "../model/palette.js";
import type { WeekChoice } from "./common.js";
import { overrideBadges } from "./CourseBlock.js";
import { IconWarning } from "./icons.js";

type Row = { session: ScheduledSession; time: string };

export function DayView(props: {
  day: DayNo;
  week: WeekChoice;
  week1: string;
  frame: TimeFrame;
  sessions: readonly ScheduledSession[];
  today: string;
  conflictKeys: ReadonlySet<string>;
  colorOf: (courseCode: string) => CourseColor;
  onOpenSession: (session: ScheduledSession) => void;
}) {
  const date = props.week === "all" ? undefined : addDays(weekRange(props.week1, props.week).start, props.day - 2);
  const rows: Row[] = props.week === "all"
    ? props.sessions
      .filter((session) => session.fixed && session.day === props.day)
      .sort((a, b) => a.startPeriod! - b.startPeriod!)
      .map((session) => {
        const times = periodTimes(props.frame, session.startPeriod!, session.endPeriod!);
        return { session, time: times ? `${times.start}–${times.end}` : formatPeriods(session.startPeriod!, session.endPeriod!) };
      })
    : occurrencesForWeek(props.sessions, props.week, props.week1, props.frame)
      .filter((item) => item.date === date)
      .map((item) => ({ session: item, time: `${item.startTime}–${item.endTime}` }));
  const isToday = date === props.today;
  return (
    <section className="day-view" aria-labelledby="day-view-heading">
      <h3 id="day-view-heading">
        {dayLabel(props.day)}{date ? `, ${formatDate(date)}` : " (mọi tuần)"}
        {isToday ? <span className="badge badge-today">Hôm nay</span> : null}
      </h3>
      {rows.length === 0 ? <p className="muted">Không có buổi học.</p> : (
        <ul className="list day-rows">
          {rows.map(({ session, time }) => {
            const conflict = props.conflictKeys.has(session.key);
            const badges = overrideBadges(session);
            const detail = (session.overrides ?? []).map((item) => item.detail).join("; ");
            const extras = formatSessionExtras(session.note, session.info);
            return (
              <li key={`${session.key}-${time}`}>
                <button type="button" className={`day-row course-color${conflict ? " is-conflict" : ""}`} style={courseColorStyle(props.colorOf(session.courseCode))} onClick={() => props.onOpenSession(session)}>
                  <span className="day-row-time">{time}</span>
                  <span className="day-row-text">
                    <strong>{session.courseCode}</strong> {session.courseName}
                    <span className="day-row-meta">
                      {[kindText(session.kind), session.group && session.group !== "CL" ? `nhóm ${session.group}` : "", session.room ?? "chưa có phòng", props.week === "all" ? `tuần ${formatWeeks(session.weeks)}` : "", extras].filter(Boolean).join(" · ")}
                    </span>
                    {badges.map((badge) => <span key={badge} className="badge badge-override">{badge}</span>)}
                    {detail ? <span className="override-detail"> ({detail})</span> : null}
                  </span>
                  {conflict ? <span className="flag"><IconWarning size={16} /> Trùng lịch</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
