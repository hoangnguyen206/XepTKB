/**
 * One session on the week grid (DESIGN-M6-001 §7, AC-M6-05). Course colour via custom properties; a conflict never
 * relies on colour alone: red 3 px border, diagonal stripes, an icon, the label "Trùng" and "đang trùng lịch với …" in
 * the accessible name. The visible text is the course code (+ room); the full description is the accessible name.
 * Keeps the `is-conflict` / `is-overridden` classes the e2e suites use. A button when it opens details, else a box.
 */
import type { CSSProperties } from "react";
import { kindText, type ScheduledSession } from "@ky-nay/export";
import { courseColorStyle, type CourseColor } from "../model/palette.js";
import { IconWarning } from "./icons.js";

export function overrideBadges(session: Pick<ScheduledSession, "overrides">): string[] {
  return [...new Set((session.overrides ?? []).map((item) => item.badge))];
}

export function CourseBlock(props: {
  session: ScheduledSession;
  color: CourseColor;
  name: string;
  conflict: boolean;
  rows: number;
  split: boolean;
  style?: CSSProperties;
  onOpen?: () => void;
  ghost?: boolean;
}) {
  const { session } = props;
  const badges = overrideBadges(session);
  const className = [
    "block",
    "course-color",
    props.conflict ? "is-conflict" : "",
    badges.length > 0 ? "is-overridden" : "",
    props.split ? "is-split" : "",
    props.rows < 2 ? "is-short" : "",
    props.ghost ? "is-ghost" : "",
  ].filter(Boolean).join(" ");
  const style = { ...courseColorStyle(props.color), ...props.style };
  const meta = [kindText(session.kind), session.group && session.group !== "CL" ? `N${session.group}` : "", ...badges].filter(Boolean).join(" · ");
  const content = (
    <>
      <span className="visually-hidden">{props.name}</span>
      <span aria-hidden="true" className="block-code">{session.courseCode}</span>
      {session.room ? <span aria-hidden="true" className="block-room">{session.room}</span> : null}
      {meta ? <span aria-hidden="true" className="block-meta">{meta}</span> : null}
      {props.conflict ? (
        <span aria-hidden="true" className="block-flag"><IconWarning size={12} /><span className="block-flag-text">Trùng</span></span>
      ) : null}
    </>
  );
  if (props.onOpen) {
    return <button type="button" className={className} style={style} onClick={props.onOpen}>{content}</button>;
  }
  return <div className={className} style={style}>{content}</div>;
}
