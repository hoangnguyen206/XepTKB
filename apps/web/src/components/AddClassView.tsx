/**
 * Thêm lớp (DESIGN-M6-001 §8, AC-M6-09/10): the search box (diacritic-insensitive, unchanged `searchCourses`), the
 * "Không trùng lịch" filter, one row per course, and the class sheet. On desktop (`onPreview` given) hovering — only on
 * a device with hover — or focusing a course row or a class chip previews that class on the week grid after 80 ms;
 * leaving, blur or Esc clears it.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Plan, PlanPick } from "@ky-nay/domain";
import { searchCourses, type AppCatalog, type CourseResult } from "../model/catalog.js";
import { courseColorStyle, type CourseColor } from "../model/palette.js";
import { isPicked, previewTargetFor, sectionFits } from "../model/picker.js";
import { ClassSheet, type PreviewHandlers, type PreviewProps } from "./ClassSheet.js";
import { IconSearch } from "./icons.js";
import { Button } from "./ui/Button.js";
import { Chip } from "./ui/Chip.js";
import { EmptyState } from "./ui/EmptyState.js";
import { SearchField } from "./ui/SearchField.js";
import { useToast } from "./ui/Toast.js";

export const PREVIEW_DELAY_MS = 80;

function hasHover(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia("(hover: hover)").matches;
}

/** One timer for the whole view: a new target replaces the pending one. */
function usePreviewHandlers(onPreview?: (pick: PlanPick | undefined) => void): PreviewProps | undefined {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useMemo(() => {
    if (!onPreview) return undefined;
    return (pick: () => PlanPick): PreviewHandlers => {
      const start = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => onPreview(pick()), PREVIEW_DELAY_MS);
      };
      const stop = () => {
        clearTimeout(timer.current);
        onPreview(undefined);
      };
      return {
        onPointerEnter: (event) => {
          if (event.pointerType === "mouse" && hasHover()) start();
        },
        onPointerLeave: stop,
        onFocus: start,
        onBlur: stop,
        onKeyDown: (event) => {
          if (event.key === "Escape") stop();
        },
      };
    };
  }, [onPreview]);
}

export function AddClassView(props: {
  catalog: AppCatalog;
  plan: Plan;
  colorOf: (courseCode: string) => CourseColor;
  /** Returns the error text when the pick is rejected. */
  onPick: (sectionId: string, group?: string) => string | undefined;
  onUnpick: (sectionId: string) => void;
  headingLevel?: "h2" | "h3";
  searchRef?: RefObject<HTMLInputElement | null>;
  /** F5 §9: the one-time hint beside the filter, and a callback when the filter is used (marks it seen). */
  hint?: ReactNode;
  onFilterUsed?: () => void;
  /** Desktop only: the class to preview on the week grid (undefined clears it). */
  onPreview?: (pick: PlanPick | undefined) => void;
}) {
  const id = useId();
  const { catalog, plan } = props;
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(false);
  const [openCode, setOpenCode] = useState<string | undefined>(undefined);
  // Synchronous on purpose: a deferred list can swap results under a keyboard user's focus.
  const results = useMemo(() => searchCourses(catalog, query), [catalog, query]);
  // Only computed while the filter is on, on at most the 30 results of searchCourses (DESIGN-M6-001 §8).
  const fitting = useMemo(
    () => (filter ? results.filter((result) => result.sections.some((section) => sectionFits(plan, catalog, section))) : results),
    [filter, results, plan, catalog],
  );
  const hiddenCourses = results.length - fitting.length;
  const preview = usePreviewHandlers(props.onPreview);
  const Heading = props.headingLevel ?? "h2";
  const open: CourseResult | undefined = openCode ? results.find((result) => result.course.code === openCode) : undefined;

  const close = useCallback(() => {
    setOpenCode(undefined);
    props.onPreview?.(undefined);
  }, [props.onPreview]);

  const status = !query.trim() ? "Nhập mã hoặc tên môn (có dấu hay không dấu đều được)."
    : results.length === 0 ? "Không tìm thấy môn nào."
      : `Tìm thấy ${fitting.length} môn.${hiddenCourses > 0 ? ` Ẩn ${hiddenCourses} môn trùng lịch.` : ""}`;

  const onPick = (sectionId: string, group?: string) => {
    const before = open ? open.sections.find((section) => isPicked(plan, section)) : undefined;
    const error = props.onPick(sectionId, group);
    if (error) return error;
    toast.show(before === undefined ? `Đã thêm lớp ${sectionId} vào lịch.` : before.id === sectionId ? `Đã đổi nhóm lớp ${sectionId}.` : `Đã đổi sang lớp ${sectionId}.`);
    close();
    return undefined;
  };
  const onUnpick = (sectionId: string) => {
    props.onUnpick(sectionId);
    toast.show(`Đã bỏ lớp ${sectionId}.`);
    close();
  };

  return (
    <section className="add-class" aria-labelledby={`${id}-heading`}>
      <Heading id={`${id}-heading`}>Tìm môn</Heading>
      <SearchField id={`${id}-input`} value={query} onChange={setQuery} placeholder="VD: SYN1001 hoặc giai tich" {...(props.searchRef ? { ref: props.searchRef } : {})} />
      <div className="add-class-tools">
        <Chip pressed={filter} onPressedChange={(pressed) => { setFilter(pressed); props.onFilterUsed?.(); }}>Không trùng lịch</Chip>
      </div>
      {props.hint}
      <p className="muted" role="status" aria-live="polite">{status}</p>
      {query.trim() && results.length === 0 ? (
        <EmptyState icon={<IconSearch />} title="Không có môn nào khớp" action={<Button variant="secondary" onClick={() => { setQuery(""); props.searchRef?.current?.focus(); }}>Xóa từ khóa</Button>} />
      ) : null}
      {filter && results.length > 0 && fitting.length === 0 ? (
        <EmptyState icon={<IconSearch />} title="Các môn tìm thấy đều trùng lịch" action={<Button variant="secondary" onClick={() => setFilter(false)}>Tắt lọc</Button>} />
      ) : null}
      <ul className="list course-results">
        {fitting.map((result) => {
          const { course, sections } = result;
          const picked = sections.find((section) => isPicked(plan, section));
          const target = () => (picked ?? sections.find((section) => !filter || sectionFits(plan, catalog, section)) ?? sections[0]!);
          return (
            <li key={course.code}>
              <button
                type="button"
                className="list-row course-row"
                onClick={() => setOpenCode(course.code)}
                {...(preview?.(() => previewTargetFor(plan, catalog, target())) ?? {})}
              >
                <span className="list-row-dot course-color" style={courseColorStyle(props.colorOf(course.code))} aria-hidden="true" />
                <span className="list-row-text">
                  <span className="list-row-title">{course.code} {course.name}</span>
                  <span className="list-row-meta">
                    {course.credits === undefined ? "chưa rõ tín chỉ" : `${course.credits} tín chỉ`} · {sections.length} lớp{picked ? ` · ✓ đã chọn lớp ${picked.id}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ClassSheet
        {...(open ? { result: open } : {})}
        plan={plan}
        catalog={catalog}
        filter={filter}
        colorOf={props.colorOf}
        onPick={onPick}
        onUnpick={onUnpick}
        onClose={close}
        {...(preview ? { preview } : {})}
      />
    </section>
  );
}
