/** DESIGN-M6-001 §6, AC-M6-12: an empty state always offers exactly one action (the type allows one element). */
import type { ReactElement, ReactNode } from "react";

export function EmptyState(props: { icon: ReactNode; title: string; action: ReactElement; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">{props.icon}</span>
      <p className="empty-title">{props.title}</p>
      {props.children}
      {props.action}
    </div>
  );
}
