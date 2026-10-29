import { useId, useMemo, useState } from "react";
import type { Plan } from "@ky-nay/domain";
import { searchCourses, type AppCatalog } from "../model/catalog.js";
import { isPicked } from "../model/picker.js";
import { SectionCard } from "./SectionCard.js";

export function SearchPanel(props: { catalog: AppCatalog; plan: Plan; onPick: (sectionId: string, group?: string) => void; onUnpick: (sectionId: string) => void; headingLevel?: "h2" | "h3" }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | undefined>(undefined);
  // Synchronous on purpose: a deferred list can swap results under a keyboard user's focus.
  const results = useMemo(() => searchCourses(props.catalog, query), [props.catalog, query]);
  const Heading = props.headingLevel ?? "h2";
  const status = !query.trim() ? "Nhập mã hoặc tên môn (có dấu hay không dấu đều được)." : results.length === 0 ? "Không tìm thấy môn nào." : `Tìm thấy ${results.length} môn.`;
  return (
    <section className="search-panel" aria-labelledby={`${id}-heading`}>
      <Heading id={`${id}-heading`}>Tìm môn</Heading>
      <div className="field">
        <label htmlFor={`${id}-input`}>Mã hoặc tên môn</label>
        <input
          id={`${id}-input`}
          type="search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder="VD: SYN1001 hoặc giai tich"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="muted" role="status" aria-live="polite">{status}</p>
      <ul className="course-list">
        {results.map(({ course, sections }) => {
          const open = expanded === course.code;
          const pickedCount = sections.filter((section) => isPicked(props.plan, section)).length;
          return (
            <li key={course.code} className="course-item">
              <button type="button" className="course-toggle" aria-expanded={open} aria-controls={open ? `${id}-${course.code}` : undefined} onClick={() => setExpanded(open ? undefined : course.code)}>
                <span className="course-code">{course.code}</span>
                <span className="course-name">{course.name}</span>
                <span className="course-meta">
                  {course.credits === undefined ? "chưa rõ tín chỉ" : `${course.credits} tín chỉ`} · {sections.length} lớp{pickedCount > 0 ? " · ✓ đã chọn" : ""}
                </span>
              </button>
              {open ? (
                <div id={`${id}-${course.code}`} className="section-list">
                  {sections.map((section) => (
                    <SectionCard key={section.id} section={section} plan={props.plan} catalog={props.catalog} onPick={props.onPick} onUnpick={props.onUnpick} headingLevel={Heading === "h2" ? "h3" : "h4"} />
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
