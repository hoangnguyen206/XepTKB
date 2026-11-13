/** DESIGN-M6-001 §6: a large number with its label (credits, conflicts) on the Phương án view. */
import type { ReactNode } from "react";

export function StatCard(props: { label: string; value: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{props.label}</span>
      <span className="stat-value">{props.value}</span>
      {props.meta !== undefined ? <span className="stat-meta">{props.meta}</span> : null}
      {props.children}
    </div>
  );
}
