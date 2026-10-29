import { useId, useState } from "react";
import { isFixedSession, normalizeGroup, sessionsForPick, type Plan, type Section, type Session } from "@ky-nay/domain";
import { dayLabel, formatPeriods, formatWeeks, kindLabel, periodTimes } from "@ky-nay/export";
import type { AppCatalog } from "../model/catalog.js";
import { groupOptions, isPicked, pickForCourse, previewPick } from "../model/picker.js";

function sessionText(session: Session, catalog: AppCatalog): string {
  const group = normalizeGroup(session.group);
  const groupText = group && group !== "CL" ? ` · nhóm ${group}` : "";
  const place = session.campus && !(session.room ?? "").includes(session.campus) ? [session.room, session.campus].filter(Boolean).join(" · ") : session.room ?? "";
  const lecturers = session.lecturers.length > 0 ? ` · GV ${session.lecturers.join(", ")}` : "";
  const note = session.rawNote ? ` · Ghi chú: ${session.rawNote}` : "";
  if (!isFixedSession(session)) {
    return `Không có giờ cố định (${kindLabel(session.kind)})${groupText} · tuần ${formatWeeks(session.weeks)}${place ? ` · ${place}` : ""}${lecturers}${note}`;
  }
  const times = periodTimes(catalog.frame, session.startPeriod, session.endPeriod);
  return `${dayLabel(session.day)}, ${formatPeriods(session.startPeriod, session.endPeriod)}${times ? ` (${times.start}–${times.end})` : ""} · ${kindLabel(session.kind)}${groupText} · tuần ${formatWeeks(session.weeks)}${place ? ` · ${place}` : ""}${lecturers}${note}`;
}

export function SectionCard(props: { section: Section; plan: Plan; catalog: AppCatalog; onPick: (sectionId: string, group?: string) => void; onUnpick: (sectionId: string) => void; headingLevel: "h3" | "h4" }) {
  const id = useId();
  const Heading = props.headingLevel;
  const { section, plan, catalog } = props;
  const groups = groupOptions(section);
  const picked = isPicked(plan, section);
  // A picked group can stop existing after a dataset revision (REV-M3-001).
  const pickedNeedsGroup = picked !== undefined && sessionsForPick(section, picked).issues.length > 0;
  const sameCourse = pickForCourse(plan, catalog, section);
  const [group, setGroup] = useState<string | undefined>(() => normalizeGroup(picked?.group));
  const needsGroup = groups.length > 0 && group === undefined;
  const pickedSameGroup = picked !== undefined && normalizeGroup(picked.group) === group;
  // A picked card keeps showing its conflicts (QA-M3-007): previewing the current pick resolves to the Plan itself.
  const preview = !needsGroup ? previewPick(plan, catalog, group ? { sectionId: section.id, group } : { sectionId: section.id }) : undefined;
  const conflicting = (preview?.conflictTexts.length ?? 0) > 0;
  const untimed = section.sessions.every((session) => !isFixedSession(session));
  const action = pickedSameGroup ? "Bỏ chọn lớp này"
    : picked ? (conflicting ? "Vẫn đổi nhóm (đang trùng lịch)" : "Đổi nhóm")
      : sameCourse ? (conflicting ? "Vẫn đổi sang lớp này (đang trùng lịch)" : `Đổi từ ${sameCourse.sectionId} sang lớp này`)
        : conflicting ? "Vẫn chọn lớp này (đang trùng lịch)" : "Chọn lớp này";
  return (
    <article className={`section-card${picked ? " is-picked" : ""}${conflicting ? " is-conflict" : ""}`} aria-labelledby={`${id}-title`}>
      <header className="section-head">
        <Heading id={`${id}-title`}>Lớp {section.id}</Heading>
        <div className="badges">
          {picked ? <span className="badge badge-picked">✓ Đã chọn{picked.group ? ` · nhóm ${picked.group}` : ""}</span> : null}
          {pickedNeedsGroup ? <span className="badge badge-conflict">⚠ Cần chọn lại nhóm</span> : null}
          {section.online ? <span className="badge badge-online">Trực tuyến · không xếp lịch tuần</span>
            : untimed ? <span className="badge badge-online">Không có lịch cố định</span> : null}
          {conflicting ? <span className="badge badge-conflict">⚠ Trùng lịch</span> : null}
        </div>
      </header>
      {section.homeClasses.length > 0 ? <p className="muted">Lớp khóa: {section.homeClasses.join(", ")}</p> : null}
      <ul className="session-list">
        {section.sessions.map((session) => <li key={session.id}>{sessionText(session, catalog)}</li>)}
      </ul>
      {groups.length > 0 ? (
        <fieldset className="fieldset compact">
          <legend>Chọn nhóm (bắt buộc)</legend>
          <div className="group-options">
            {groups.map((option) => (
              <div className="radio-row" key={option}>
                <input type="radio" id={`${id}-g-${option}`} name={`${id}-group`} checked={group === option} onChange={() => setGroup(option)} />
                <label htmlFor={`${id}-g-${option}`}>Nhóm {option}</label>
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}
      {preview && (preview.conflictTexts.length > 0 || preview.campusTexts.length > 0) ? (
        <ul className="preview-list" aria-label={`Kiểm tra lịch cho lớp ${section.id}`}>
          {preview.conflictTexts.map((text) => <li key={text} className="conflict-text">⚠ {text}</li>)}
          {preview.campusTexts.map((text) => <li key={text} className="campus-text">ⓘ {text}</li>)}
        </ul>
      ) : null}
      {needsGroup ? <p className="field-hint">Chọn nhóm để kiểm tra trùng lịch.</p> : null}
      <div className="actions">
        <button
          type="button"
          className={`button ${pickedSameGroup ? "secondary" : conflicting ? "danger" : "primary"}`}
          disabled={!pickedSameGroup && needsGroup}
          onClick={() => (pickedSameGroup ? props.onUnpick(section.id) : props.onPick(section.id, group))}
        >
          {action}
        </button>
        {picked && !pickedSameGroup ? (
          <button type="button" className="button secondary" onClick={() => props.onUnpick(section.id)}>Bỏ chọn lớp này</button>
        ) : null}
      </div>
    </article>
  );
}
