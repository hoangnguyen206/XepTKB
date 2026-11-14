/**
 * Week grid (DESIGN-M6-001 §7, AC-M6-05). A CSS grid of a 24 px period column plus N equal day columns
 * (`minmax(0, 1fr)`, N = `--days`): every day of T2–T7 (or T2–CN) fits at 360 px with no horizontal scroll. Lanes come
 * from `buildGridLayout` unchanged. Variants: `screen` (region + buttons), `print` (A4 sheet, day labels), `compact`
 * (mini-calendar in the class sheet, F4: decorative, aria-hidden).
 */
import type { CSSProperties, ReactNode } from "react";
import type { DayNo, TimeFrame } from "@ky-nay/domain";
import { addDays, dayLabel, formatDate, weekRange, type GridLayout, type ScheduledSession } from "@ky-nay/export";
import { sessionAccessibleName } from "../model/grid-view.js";
import type { CourseColor } from "../model/palette.js";
import type { WeekChoice } from "./common.js";
import { CourseBlock } from "./CourseBlock.js";

export type WeekGridProps = {
  layout: GridLayout;
  frame: TimeFrame;
  week1: string;
  week: WeekChoice;
  caption: string;
  colorOf: (courseCode: string) => CourseColor;
  variant?: "screen" | "print" | "compact";
  /** Day headers rendered inside the region, above the grid (the DayStrip on screen). */
  header?: ReactNode;
  partners?: ReadonlyMap<string, readonly string[]>;
  todayDay?: DayNo;
  /** Current-time line, 0…1 of the grid height. */
  nowOffset?: number;
  onOpenSession?: (session: ScheduledSession) => void;
  /** Sessions drawn as dashed previews (F4); never interactive. */
  ghostKeys?: ReadonlySet<string>;
};

export function WeekGrid(props: WeekGridProps) {
  const variant = props.variant ?? "screen";
  const periods = props.layout.periods.length;
  const days = props.layout.days;
  const monday = props.week === "all" ? undefined : weekRange(props.week1, props.week).start;
  const gridStyle = { "--days": days.length, "--periods": periods } as CSSProperties;
  const region = variant === "screen" ? { role: "region", "aria-label": props.caption } : { "aria-hidden": true as const };

  return (
    <div className={`week-grid-wrap variant-${variant}`} {...region}>
      {variant === "print" ? (
        <div className="grid-head" style={gridStyle}>
          <span />
          {days.map((day) => <span key={day}>{dayLabel(day, "short")}{monday ? ` ${formatDate(addDays(monday, day - 2), false)}` : ""}</span>)}
        </div>
      ) : props.header}
      <div className="week-grid" style={gridStyle}>
        <ol className="wg-times" aria-hidden="true">
          {props.layout.periods.map((period) => <li key={period}>{period}</li>)}
        </ol>
        {days.map((day) => {
          const blocks = props.layout.blocks.filter((block) => block.day === day);
          const date = monday ? addDays(monday, day - 2) : undefined;
          return (
            <ul
              key={day}
              className={`day-body${props.todayDay === day ? " is-today" : ""}`}
              aria-label={`${dayLabel(day)}${date ? ` ${formatDate(date)}` : ""}, ${blocks.length === 0 ? "không có buổi học" : `${blocks.length} buổi học`}`}
            >
              {blocks.map((block) => {
                const rows = block.endPeriod - block.startPeriod + 1;
                const position = {
                  top: `${((block.startPeriod - 1) / periods) * 100}%`,
                  height: `${(rows / periods) * 100}%`,
                  left: `${(block.lane / block.lanes) * 100}%`,
                  width: `${100 / block.lanes}%`,
                };
                const partners = props.partners?.get(block.session.key) ?? [];
                return (
                  <li key={block.session.key} className="block-slot" style={position}>
                    <CourseBlock
                      session={block.session}
                      color={props.colorOf(block.session.courseCode)}
                      name={sessionAccessibleName(block.session, props.frame, block.conflict ? partners : [])}
                      conflict={block.conflict}
                      rows={rows}
                      split={block.lanes > 1}
                      ghost={props.ghostKeys?.has(block.session.key) ?? false}
                      {...(variant === "screen" && props.onOpenSession && !props.ghostKeys?.has(block.session.key) ? { onOpen: () => props.onOpenSession!(block.session) } : {})}
                    />
                  </li>
                );
              })}
            </ul>
          );
        })}
        {props.nowOffset !== undefined ? <div className="now-line" aria-hidden="true" style={{ top: `${props.nowOffset * 100}%` }} /> : null}
      </div>
    </div>
  );
}
