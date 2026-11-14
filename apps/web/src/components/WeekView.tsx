/**
 * The Lịch view (DESIGN-M6-001 §7, AC-M6-05…08): week header ("Chọn tuần" select as the title, previous / next /
 * "Tuần này"), the day strip and week grid — or one day's list after tapping a day — the sessions without fixed times,
 * and the session sheet. Weeks change with the buttons, a touch swipe on the grid, or ←/→ and T while focus is inside
 * the calendar (not in a form field). Today's column and the current-time line appear only in the current week.
 */
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { DayNo, HardConflict, TimeFrame } from "@ky-nay/domain";
import { buildGridLayout, conflictKeys, formatWeeks, kindText, nonFixedSessions, weekOfDate, weekRange, type ScheduledSession } from "@ky-nay/export";
import { conflictPartners, nowLineOffset, visiblePeriods } from "../model/grid-view.js";
import { courseColorStyle, type CourseColorId } from "../model/palette.js";
import { nowInVietnam, weekLabel } from "../model/week.js";
import type { WeekChoice } from "./common.js";
import { overrideBadges } from "./CourseBlock.js";
import { DayStrip } from "./DayStrip.js";
import { DayView } from "./DayView.js";
import { IconChevronLeft, IconChevronRight } from "./icons.js";
import { SessionSheet } from "./SessionSheet.js";
import { Button } from "./ui/Button.js";
import type { CourseColorLookup } from "./useCourseColors.js";
import { useSwipe } from "./useSwipe.js";
import { WeekGrid } from "./WeekGrid.js";

/** Minutes and date in Vietnam, refreshed every 60 s while the page is visible. */
function useNow(): { date: string; minutes: number } {
  const [now, setNow] = useState(() => nowInVietnam());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      setNow(nowInVietnam());
      timer ??= setInterval(() => setNow(nowInVietnam()), 60_000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return now;
}

/** Sessions without a fixed time slot (ONL…): listed apart, never on the grid, still counted in credits (Q-009). */
export function NonFixedList(props: { sessions: readonly ScheduledSession[]; colorOf?: CourseColorLookup["colorOf"] }) {
  if (props.sessions.length === 0) return null;
  return (
    <section className="non-fixed" aria-labelledby="non-fixed-heading">
      <h3 id="non-fixed-heading">Không có giờ cố định (không xếp vào lưới)</h3>
      <ul className="list">
        {props.sessions.map((session) => {
          const detail = (session.overrides ?? []).map((item) => item.detail).join("; ");
          return (
            <li key={session.key} className="list-row">
              {props.colorOf ? <span className="list-row-dot course-color" style={courseColorStyle(props.colorOf(session.courseCode))} aria-hidden="true" /> : null}
              <span className="list-row-text">
                <span className="list-row-title">{session.courseCode} {session.courseName}</span>
                <span className="list-row-meta">
                  lớp {session.sectionId}{kindText(session.kind) ? ` · ${kindText(session.kind)}` : ""} · tuần {formatWeeks(session.weeks)}
                  {overrideBadges(session).map((badge) => <span key={badge} className="badge badge-override">{badge}</span>)}
                  {detail ? <span className="override-detail"> ({detail})</span> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function WeekView(props: {
  sessions: readonly ScheduledSession[];
  conflicts: readonly HardConflict[];
  frame: TimeFrame;
  maxPeriod: number;
  week1: string;
  teachingWeeks: number;
  week: WeekChoice;
  onWeekChange: (week: WeekChoice) => void;
  colors: CourseColorLookup;
  onCourseColor: (courseCode: string, color: CourseColorId | undefined) => void;
  onUnpick: (sectionId: string) => void;
  /** Shown when the plan has no session at all (F5 turns it into the empty state). */
  empty?: ReactNode;
}) {
  const selectId = useId();
  const now = useNow();
  const [day, setDay] = useState<DayNo | undefined>(undefined);
  const [openKey, setOpenKey] = useState<string | undefined>(undefined);
  const weekNumber = props.week === "all" ? undefined : props.week;
  const currentWeek = weekOfDate(props.week1, now.date);
  const inTerm = currentWeek >= 1 && currentWeek <= props.teachingWeeks;
  const isCurrentWeek = weekNumber !== undefined && weekNumber === currentWeek;
  const periods = useMemo(() => visiblePeriods(props.sessions, props.maxPeriod), [props.sessions, props.maxPeriod]);
  const keys = useMemo(() => conflictKeys(props.conflicts, weekNumber), [props.conflicts, weekNumber]);
  const layout = useMemo(
    () => buildGridLayout(props.sessions, { ...(weekNumber !== undefined ? { week: weekNumber } : {}), maxPeriod: periods, conflictKeys: keys }),
    [props.sessions, weekNumber, periods, keys],
  );
  const partners = useMemo(() => conflictPartners(props.conflicts, props.sessions, weekNumber), [props.conflicts, props.sessions, weekNumber]);
  const monday = weekNumber !== undefined ? weekRange(props.week1, weekNumber).start : undefined;
  const todayDay = isCurrentWeek ? (((new Date(`${now.date}T00:00:00Z`).getUTCDay() + 6) % 7) + 2) as DayNo : undefined;
  const nowOffset = isCurrentWeek && todayDay !== undefined && layout.days.includes(todayDay) ? nowLineOffset(props.frame, now.minutes, periods) : undefined;
  const counts = useMemo(() => {
    const map = new Map<DayNo, number>();
    for (const block of layout.blocks) map.set(block.day, (map.get(block.day) ?? 0) + 1);
    return map;
  }, [layout]);

  const go = (week: number) => {
    if (week >= 1 && week <= props.teachingWeeks) props.onWeekChange(week);
  };
  const step = (delta: -1 | 1) => {
    if (weekNumber !== undefined) go(weekNumber + delta);
  };
  const swipe = useSwipe((direction) => step(direction));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
    if (target.closest("input, select, textarea, [contenteditable='true'], dialog")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      step(event.key === "ArrowLeft" ? -1 : 1);
    } else if ((event.key === "t" || event.key === "T") && inTerm) {
      event.preventDefault();
      go(currentWeek);
    }
  };

  const open = openKey ? props.sessions.find((session) => session.key === openKey) : undefined;
  const openCode = open ? props.colors.canonical(open.courseCode) : undefined;
  const allPartners = useMemo(() => conflictPartners(props.conflicts, props.sessions), [props.conflicts, props.sessions]);

  return (
    <div className="week-view" onKeyDown={onKeyDown}>
      <div className="week-head">
        <Button variant="ghost" label="Tuần trước" icon={<IconChevronLeft />} disabled={weekNumber === undefined || weekNumber <= 1} onClick={() => step(-1)} />
        <label htmlFor={selectId} className="visually-hidden">Chọn tuần</label>
        <select id={selectId} className="week-select" value={String(props.week)} onChange={(event) => props.onWeekChange(event.target.value === "all" ? "all" : Number(event.target.value))}>
          <option value="all">Tất cả các tuần</option>
          {Array.from({ length: props.teachingWeeks }, (_, index) => index + 1).map((week) => (
            <option key={week} value={week}>{weekLabel(props.week1, week)}</option>
          ))}
        </select>
        <Button variant="ghost" label="Tuần sau" icon={<IconChevronRight />} disabled={weekNumber === undefined || weekNumber >= props.teachingWeeks} onClick={() => step(1)} />
        <Button variant="secondary" size="sm" disabled={!inTerm || isCurrentWeek} onClick={() => go(currentWeek)}>Tuần này</Button>
      </div>
      {day !== undefined ? (
        <>
          <div className="day-head">
            <Button variant="ghost" size="sm" icon={<IconChevronLeft size={18} />} onClick={() => setDay(undefined)}>Cả tuần</Button>
          </div>
          <DayStrip days={layout.days} {...(monday ? { monday } : {})} {...(todayDay ? { todayDay } : {})} counts={counts} selected={day} onOpenDay={setDay} />
          <DayView day={day} week={props.week} week1={props.week1} frame={props.frame} sessions={props.sessions} today={now.date} conflictKeys={keys} colorOf={props.colors.colorOf} onOpenSession={(session) => setOpenKey(session.key)} />
        </>
      ) : (
        <div className="week-swipe" {...swipe}>
          <WeekGrid
            layout={layout}
            frame={props.frame}
            week1={props.week1}
            week={props.week}
            caption={props.week === "all" ? "Lưới thời khóa biểu tất cả các tuần" : `Lưới thời khóa biểu tuần ${props.week}`}
            colorOf={props.colors.colorOf}
            header={<DayStrip days={layout.days} {...(monday ? { monday } : {})} {...(todayDay ? { todayDay } : {})} counts={counts} onOpenDay={setDay} />}
            partners={partners}
            {...(todayDay ? { todayDay } : {})}
            {...(nowOffset !== undefined ? { nowOffset } : {})}
            onOpenSession={(session) => setOpenKey(session.key)}
          />
        </div>
      )}
      {props.empty}
      <NonFixedList sessions={nonFixedSessions(props.sessions)} colorOf={props.colors.colorOf} />
      <SessionSheet
        {...(open ? { session: open } : {})}
        onClose={() => setOpenKey(undefined)}
        frame={props.frame}
        partners={open ? allPartners.get(open.key) ?? [] : []}
        color={props.colors.colorOf(open?.courseCode ?? "")}
        {...(openCode && props.colors.overrides[openCode] ? { chosen: props.colors.overrides[openCode] } : {})}
        onColor={(color) => {
          if (openCode) props.onCourseColor(openCode, color);
        }}
        {...(open ? { onUnpick: () => props.onUnpick(open.sectionId) } : {})}
      />
    </div>
  );
}
