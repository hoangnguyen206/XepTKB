import { useEffect, useState, type ReactNode } from "react";

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export type WeekChoice = number | "all";

export function Notice(props: { tone: "info" | "warning" | "error" | "success"; title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`notice notice-${props.tone}`} role={props.tone === "error" ? "alert" : undefined}>
      <div>
        {props.title ? <strong className="notice-title">{props.title}</strong> : null}
        <div>{props.children}</div>
      </div>
      {props.action ? <div className="notice-action">{props.action}</div> : null}
    </div>
  );
}
