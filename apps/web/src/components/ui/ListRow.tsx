/**
 * DESIGN-M6-001 §6: one row of a `<ul className="list">`; a coloured dot when the row is a course (colour from
 * model/palette.ts). The row is a button only when it does something.
 */
import type { ReactNode } from "react";
import { courseColorStyle, type CourseColor } from "../../model/palette.js";

export function ListRow(props: { title: ReactNode; meta?: ReactNode; color?: CourseColor; trailing?: ReactNode; onClick?: () => void; label?: string }) {
  const body = (
    <>
      {props.color ? <span className="list-row-dot course-color" style={courseColorStyle(props.color)} aria-hidden="true" /> : null}
      <span className="list-row-text">
        <span className="list-row-title">{props.title}</span>
        {props.meta !== undefined ? <span className="list-row-meta">{props.meta}</span> : null}
      </span>
      {props.trailing !== undefined ? <span className="list-row-trailing">{props.trailing}</span> : null}
    </>
  );
  return (
    <li>
      {props.onClick ? (
        <button type="button" className="list-row" onClick={props.onClick} {...(props.label ? { "aria-label": props.label } : {})}>{body}</button>
      ) : (
        <div className="list-row">{body}</div>
      )}
    </li>
  );
}
