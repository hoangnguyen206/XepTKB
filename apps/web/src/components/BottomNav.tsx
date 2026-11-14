/**
 * Main navigation (D-M6-3, DESIGN-M6-001 §6, AC-M6-03): Lịch · Thêm lớp · Phương án. A fixed bar at the bottom below
 * 1200 px; inside the app bar from 1200 px (`placement="bar"`). Buttons with aria-current mark the view on screen;
 * every target is ≥ 44 px.
 */
import { IconCalendar, IconLayers, IconPlus } from "./icons.js";

export type AppView = "week" | "add" | "plan";

const ITEMS: { view: AppView; label: string }[] = [
  { view: "week", label: "Lịch" },
  { view: "add", label: "Thêm lớp" },
  { view: "plan", label: "Phương án" },
];

export function BottomNav(props: { view: AppView; onChange: (view: AppView) => void; placement: "bottom" | "bar"; planCount?: number }) {
  return (
    <nav className={props.placement === "bar" ? "main-nav in-bar" : "main-nav bottom-nav"} aria-label="Điều hướng chính">
      {ITEMS.map((item) => {
        const current = item.view === props.view;
        return (
          <button
            key={item.view}
            type="button"
            className={item.view === "add" ? "nav-item nav-add" : "nav-item"}
            aria-current={current ? "page" : undefined}
            onClick={() => props.onChange(item.view)}
          >
            {item.view === "week" ? <IconCalendar size={22} /> : item.view === "add" ? <IconPlus size={22} /> : <IconLayers size={22} />}
            <span className="nav-label">{item.label}</span>
            {item.view === "plan" && props.planCount ? <span className="nav-count" aria-hidden="true">{props.planCount}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
