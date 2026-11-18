/**
 * Day strip above the week grid (DESIGN-M6-001 §7): one button per column, aligned with the grid. Tapping a day opens
 * the day view. "Hôm nay" is marked visually and in the name; a dot shows days that have sessions.
 */
import type { CSSProperties } from "react";
import type { DayNo } from "@ky-nay/domain";
import { addDays, dayLabel, formatDate } from "@ky-nay/export";

export function DayStrip(props: {
  days: readonly DayNo[];
  monday?: string;
  todayDay?: DayNo;
  counts: ReadonlyMap<DayNo, number>;
  selected?: DayNo;
  onOpenDay: (day: DayNo) => void;
}) {
  const style = { "--days": props.days.length } as CSSProperties;
  return (
    <div className="day-strip" style={style}>
      <span aria-hidden="true" />
      {props.days.map((day) => {
        const date = props.monday ? addDays(props.monday, day - 2) : undefined;
        const count = props.counts.get(day) ?? 0;
        const today = props.todayDay === day;
        const name = `Xem ${dayLabel(day)}${date ? ` ${formatDate(date)}` : ""}${today ? ", hôm nay" : ""}, ${count === 0 ? "không có buổi học" : `${count} buổi học`}`;
        return (
          <button
            key={day}
            type="button"
            className={`day-cell${today ? " is-today" : ""}`}
            aria-label={name}
            {...(props.selected !== undefined ? { "aria-pressed": props.selected === day } : {})}
            onClick={() => props.onOpenDay(day)}
          >
            <span aria-hidden="true" className="day-name">{dayLabel(day, "short")}</span>
            {date ? <span aria-hidden="true" className="day-date">{Number(date.slice(8, 10))}</span> : null}
            <span aria-hidden="true" className={count > 0 ? "day-dot has-sessions" : "day-dot"} />
          </button>
        );
      })}
    </div>
  );
}
