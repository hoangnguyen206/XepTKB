import { useId, type CSSProperties } from "react";
import {
  addDays,
  dayLabel,
  formatDate,
  formatPeriods,
  formatSessionExtras,
  formatWeeks,
  kindText,
  occurrencesForWeek,
  periodTimes,
  weekRange,
  type GridLayout,
  type ScheduledSession,
} from "@ky-nay/export";
import type { DayNo, TimeFrame } from "@ky-nay/domain";
import type { WeekChoice } from "./common.js";

/** ` · Lý thuyết`, or nothing when the source has no kind column. */
function kindPart(kind: ScheduledSession["kind"]): string {
  const text = kindText(kind);
  return text ? ` · ${text}` : "";
}

/** Note and extra columns of the timetable, as information after the session text (Q-012, ADR-0011 §8). */
function extrasText(session: Pick<ScheduledSession, "note" | "info">): string {
  const text = formatSessionExtras(session.note, session.info);
  return text ? ` · ${text}` : "";
}

function uniqueOverrideBadges(session: Pick<ScheduledSession, "overrides">): string[] {
  if (!session.overrides || session.overrides.length === 0) return [];
  return [...new Set(session.overrides.map((item) => item.badge))];
}

function overrideDetailsText(session: Pick<ScheduledSession, "overrides">): string {
  if (!session.overrides || session.overrides.length === 0) return "";
  return session.overrides.map((item) => item.detail).join("; ");
}

function blockDescription(session: ScheduledSession, frame: TimeFrame, conflict: boolean): string {
  const times = session.startPeriod !== undefined && session.endPeriod !== undefined ? periodTimes(frame, session.startPeriod, session.endPeriod) : undefined;
  const period = session.startPeriod !== undefined && session.endPeriod !== undefined ? formatPeriods(session.startPeriod, session.endPeriod) : "";
  const overrideText = overrideDetailsText(session);
  return [
    `${session.courseCode} ${session.courseName}`,
    `lớp ${session.sectionId}${session.group && session.group !== "CL" ? ` nhóm ${session.group}` : ""}`,
    kindText(session.kind),
    `${period}${times ? ` (${times.start}–${times.end})` : ""}`,
    session.room ? `phòng ${session.room}` : "",
    `tuần ${formatWeeks(session.weeks)}`,
    overrideText,
    conflict ? "đang trùng lịch" : "",
  ].filter(Boolean).join(", ");
}

/** Week grid. The day columns scroll horizontally inside their own focusable region on small screens. */
export function WeekGrid(props: { layout: GridLayout; frame: TimeFrame; week1: string; week: WeekChoice; caption: string; print?: boolean }) {
  const id = useId();
  const periods = props.layout.periods;
  const style = { "--periods": periods.length } as CSSProperties;
  const monday = props.week === "all" ? undefined : weekRange(props.week1, props.week).start;
  const region = props.print ? {} : { role: "region", "aria-label": `${props.caption} (cuộn ngang nếu màn hình hẹp)`, tabIndex: 0 };
  return (
    <div className="grid-scroll" {...region}>
      <div className="week-grid" style={style}>
        <div className="time-col" aria-hidden="true">
          <div className="col-head" />
          {periods.map((period) => {
            const time = props.frame.periods.find((item) => item.no === period);
            return (
              <div key={period} className="time-cell">
                <span className="period-no">Tiết {period}</span>
                {time ? <span className="period-time">{time.start}</span> : null}
              </div>
            );
          })}
        </div>
        {props.layout.days.map((day: DayNo) => {
          const blocks = props.layout.blocks.filter((block) => block.day === day);
          const date = monday ? addDays(monday, day - 2) : undefined;
          return (
            <section key={day} className="day-col" aria-labelledby={`${id}-d${day}`}>
              <h3 id={`${id}-d${day}`} className="col-head">
                {dayLabel(day, "short")}
                {date ? <span className="col-date">{formatDate(date, false)}</span> : null}
                <span className="visually-hidden">{` ${dayLabel(day)}${date ? ` ${formatDate(date)}` : ""}, ${blocks.length === 0 ? "không có buổi học" : `${blocks.length} buổi học`}`}</span>
              </h3>
              <ul className="day-body">
                {blocks.map((block) => {
                  const position = {
                    top: `${((block.startPeriod - 1) / periods.length) * 100}%`,
                    height: `${((block.endPeriod - block.startPeriod + 1) / periods.length) * 100}%`,
                    left: `${(block.lane / block.lanes) * 100}%`,
                    width: `${100 / block.lanes}%`,
                  };
                  const description = blockDescription(block.session, props.frame, block.conflict);
                  const badges = uniqueOverrideBadges(block.session);
                  return (
                    <li
                      key={block.session.key}
                      className={`block kind-${block.session.kind}${block.conflict ? " is-conflict" : ""}${badges.length > 0 ? " is-overridden" : ""}${block.lanes > 1 ? " is-split" : ""}`}
                      style={position}
                      title={description}
                    >
                      <span className="visually-hidden">{description}</span>
                      <span aria-hidden="true" className="block-code">{block.session.courseCode}</span>
                      <span aria-hidden="true" className="block-meta">{[kindText(block.session.kind), block.session.group && block.session.group !== "CL" ? `N${block.session.group}` : ""].filter(Boolean).join(" ")}</span>
                      {block.session.room ? <span aria-hidden="true" className="block-meta">{block.session.room}</span> : null}
                      {badges.length > 0 ? <span aria-hidden="true" className="block-override">{badges.join(" · ")}</span> : null}
                      {block.conflict ? <span aria-hidden="true" className="block-flag">⚠ Trùng</span> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function NonFixedList(props: { sessions: readonly ScheduledSession[] }) {
  if (props.sessions.length === 0) return null;
  return (
    <div className="non-fixed">
      <h3>Không có giờ cố định (không xếp vào lưới)</h3>
      <ul>
        {props.sessions.map((session) => {
          const badges = uniqueOverrideBadges(session);
          const detail = overrideDetailsText(session);
          return (
            <li key={session.key}>
              <strong>{session.courseCode}</strong> {session.courseName} — lớp {session.sectionId}{kindPart(session.kind)} · tuần {formatWeeks(session.weeks)}{extrasText(session)}
              {badges.map((badge) => <span key={badge} className="badge badge-override">{badge}</span>)}
              {detail ? <span className="override-detail"> ({detail})</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Day-by-day list for one week (with dates) or, for "all", by weekday with week ranges. */
export function DayList(props: { sessions: readonly ScheduledSession[]; frame: TimeFrame; week1: string; week: WeekChoice; today: string; conflictKeys: ReadonlySet<string> }) {
  const days: DayNo[] = [2, 3, 4, 5, 6, 7, 8];
  if (props.week === "all") {
    const fixed = props.sessions.filter((session) => session.fixed);
    return (
      <ol className="day-list">
        {days.map((day) => {
          const items = fixed.filter((session) => session.day === day);
          if (items.length === 0 && day === 8) return null;
          return (
            <li key={day} className="day-entry">
              <h3>{dayLabel(day)}</h3>
              {items.length === 0 ? <p className="muted">Không có buổi học.</p> : (
                <ul>
                  {items.map((session) => {
                    const times = periodTimes(props.frame, session.startPeriod!, session.endPeriod!);
                    const badges = uniqueOverrideBadges(session);
                    const detail = overrideDetailsText(session);
                    return (
                      <li key={session.key} className={props.conflictKeys.has(session.key) ? "is-conflict" : undefined}>
                        <span className="time">{times ? `${times.start}–${times.end}` : formatPeriods(session.startPeriod!, session.endPeriod!)}</span>
                        <span>
                          <strong>{session.courseCode}</strong> {session.courseName}{kindPart(session.kind)} · {session.room ?? "chưa có phòng"} · tuần {formatWeeks(session.weeks)}{extrasText(session)}
                          {badges.map((badge) => <span key={badge} className="badge badge-override">{badge}</span>)}
                          {detail ? <span className="override-detail"> ({detail})</span> : null}
                        </span>
                        {props.conflictKeys.has(session.key) ? <span className="flag">⚠ Trùng lịch</span> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    );
  }
  const occurrences = occurrencesForWeek(props.sessions, props.week, props.week1, props.frame);
  const monday = weekRange(props.week1, props.week).start;
  return (
    <ol className="day-list">
      {days.map((day) => {
        const date = addDays(monday, day - 2);
        const items = occurrences.filter((item) => item.date === date);
        if (items.length === 0 && day === 8) return null;
        const isToday = date === props.today;
        return (
          <li key={day} className={`day-entry${isToday ? " is-today" : ""}`}>
            <h3>{dayLabel(day)}, {formatDate(date)}{isToday ? <span className="badge badge-today">Hôm nay</span> : null}</h3>
            {items.length === 0 ? <p className="muted">Không có buổi học.</p> : (
              <ul>
                {items.map((item) => {
                  const badges = uniqueOverrideBadges(item);
                  const detail = overrideDetailsText(item);
                  return (
                    <li key={item.key} className={props.conflictKeys.has(item.key) ? "is-conflict" : undefined}>
                      <span className="time">{item.startTime}–{item.endTime}</span>
                      <span>
                        <strong>{item.courseCode}</strong> {item.courseName}{kindPart(item.kind)}{item.group && item.group !== "CL" ? ` nhóm ${item.group}` : ""} · {item.room ?? "chưa có phòng"}{extrasText(item)}
                        {badges.map((badge) => <span key={badge} className="badge badge-override">{badge}</span>)}
                        {detail ? <span className="override-detail"> ({detail})</span> : null}
                      </span>
                      {props.conflictKeys.has(item.key) ? <span className="flag">⚠ Trùng lịch</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
