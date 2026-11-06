/**
 * Browser-local registration import preview and merge (M4, ADR-0013, AC-04, AC-05).
 * Only `@ky-nay/parser/registration` is imported here; raw bytes, filenames and student PII are discarded immediately.
 */
import {
  canonicalSectionId,
  isFixedSession,
  mergeRegistration,
  normalizeGroup,
  type DomainIssue,
  type ParseIssue,
  type Plan,
  type PlanPick,
  type Section,
  type Session,
} from "@ky-nay/domain";
import { dayLabel, describeOverride, formatPeriods, formatWeeks, kindText, overrideBadge, periodTimes, type SessionOverride } from "@ky-nay/export";
import { MAX_REGISTRATION_BYTES, vnuRegistrationHtmlAdapter } from "@ky-nay/parser/registration";
import { courseOf, type AppCatalog } from "./catalog.js";
import { groupOptions } from "./picker.js";

export type UnmatchedRegistrationItem = {
  sectionId: string;
  courseCode: string;
  sessionsSummary: string[];
  reason: "unmatched" | "ambiguous";
};

export type MatchedRegistrationItem = {
  sectionId: string;
  courseCode: string;
  courseName: string;
  credits?: number;
  group?: string;
  needsGroup: boolean;
  groupOptions: string[];
  sessionsSummary: string[];
  overrides: SessionOverride[];
  unmatchedSessionCount: number;
  defaultedWeeks: boolean;
};

export type PreviewOverrideItem = SessionOverride & {
  sectionId: string;
  courseCode: string;
  courseName: string;
  sessionId: string;
};

export type RegistrationImportPreview = {
  ok: boolean;
  fatalError?: string;
  plan?: Plan;
  isUpdate: boolean;
  matched: MatchedRegistrationItem[];
  overrides: PreviewOverrideItem[];
  unmatched: UnmatchedRegistrationItem[];
  warnings: string[];
};

const PARSER_ISSUE_TEXT: Record<string, string> = {
  INPUT_TOO_LARGE: "File vượt quá giới hạn 2 MB.",
  MALFORMED_INPUT: "Không đọc được nội dung UTF-8/HTML của file.",
  UNSUPPORTED_INPUT: "File không chứa bảng dữ liệu hợp lệ. Hãy chọn file Kết quả đăng ký môn học (.doc hoặc .html) tải từ cổng đào tạo.",
  MISSING_REQUIRED_COLUMN: "Không tìm thấy bảng Kết quả đăng ký môn học (thiếu các cột Mã môn học, Lớp môn học, Thứ, Tiết, Giảng đường).",
  NO_VALID_SECTION_ROWS: "Không tìm thấy lớp học phần nào hợp lệ trong bảng đăng ký.",
  REGISTRATION_OVERRIDE_UNMATCHED: "Có dòng trong bảng đăng ký thiếu thông tin hoặc không tách được thứ/tiết/phòng.",
};

function matchesPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.byteLength < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

/** Fast size and magic-byte guard before invoking the HTML parser. */
export function checkRegistrationBytes(bytes: Uint8Array): string | undefined {
  if (bytes.byteLength === 0) {
    return "File rỗng. Hãy chọn file Kết quả đăng ký môn học (.doc hoặc .html) tải từ cổng đào tạo.";
  }
  if (bytes.byteLength > MAX_REGISTRATION_BYTES) {
    return "File vượt quá giới hạn 2 MB. File Kết quả đăng ký môn học từ cổng đào tạo thường chỉ vài chục KB.";
  }
  // PK\x03\x04: .docx / .xlsx / .zip container
  if (matchesPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return "Đây là file Word (.docx) hoặc file nén ZIP, không phải file .doc (HTML) xuất từ cổng đào tạo. Hãy tải nguyên bản file Kết quả đăng ký môn học từ cổng đào tạo.";
  }
  // \xD0\xCF\x11\xE0: legacy binary OLE2 .doc / .xls
  if (matchesPrefix(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
    return "Đây là file Word nhị phân (.doc cũ), không phải file Kết quả đăng ký môn học (HTML) xuất từ cổng đào tạo.";
  }
  // %PDF-
  if (matchesPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "Đây là file PDF. Hãy chọn file Kết quả đăng ký môn học (.doc hoặc .html) tải từ cổng đào tạo.";
  }
  return undefined;
}

function summarizeSession(session: Session, catalog: AppCatalog): string {
  const kind = kindText(session.kind);
  const group = normalizeGroup(session.group);
  const groupPart = group && group !== "CL" ? ` · nhóm ${group}` : "";
  const roomPart = [session.room, session.campus].filter(Boolean).join(" · ");
  if (!isFixedSession(session)) {
    return `Không có giờ cố định${kind ? ` (${kind})` : ""}${groupPart}${roomPart ? ` · ${roomPart}` : ""} · tuần ${formatWeeks(session.weeks)}`;
  }
  const times = periodTimes(catalog.frame, session.startPeriod, session.endPeriod);
  return `${dayLabel(session.day)}, ${formatPeriods(session.startPeriod, session.endPeriod)}${times ? ` (${times.start}–${times.end})` : ""}${kind ? ` · ${kind}` : ""}${groupPart}${roomPart ? ` · ${roomPart}` : ""} · tuần ${formatWeeks(session.weeks)}`;
}

function formatParserIssues(issues: readonly ParseIssue[], severity: ParseIssue["severity"]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of issues) {
    if (item.severity !== severity) continue;
    const base = PARSER_ISSUE_TEXT[item.code] ?? "Một số chi tiết trong file không đọc được đầy đủ.";
    const text = item.sourceRow !== undefined ? `${base} (dòng ${item.sourceRow})` : base;
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

function formatMergeWarnings(issues: readonly DomainIssue[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    let text: string | undefined;
    if (issue.code === "REGISTRATION_DEFAULT_WEEKS" && issue.sectionId) {
      text = `Lớp ${issue.sectionId}: buổi thực hành không ghi tuần rõ trong file ĐKMH nên áp dụng tuần 2–hết kỳ theo quy ước (ADR-0006).`;
    } else if (issue.code === "REGISTRATION_OVERRIDE_UNMATCHED" && issue.sectionId && issue.sessionId) {
      text = `Lớp ${issue.sectionId}: có 1 buổi trong file ĐKMH không khớp buổi nào trên thời khóa biểu nên giữ lịch gốc của TKB.`;
    } else if (issue.code === "REGISTRATION_OVERRIDE_AMBIGUOUS" && issue.sectionId && issue.sessionId) {
      text = `Lớp ${issue.sectionId}: có buổi trong file ĐKMH khớp nhiều buổi trên TKB (chưa phân biệt được nhóm) nên chưa áp dụng tự động.`;
    } else if (issue.code === "INVALID_OVERRIDE_VALUE" && issue.sectionId) {
      text = `Lớp ${issue.sectionId}: giá trị thay đổi trong file ĐKMH nằm ngoài khung tiết/tuần hợp lệ nên đã bị từ chối.`;
    }
    if (text && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

function resolveInheritedPicks(
  picks: readonly PlanPick[],
  catalog: AppCatalog,
  draftPlan: Plan,
  existingFinalPlan?: Plan,
): PlanPick[] {
  return picks.map((pick) => {
    if (pick.group !== undefined) return pick;
    const key = canonicalSectionId(pick.sectionId);
    const section = catalog.sectionById.get(key);
    if (!section) return pick;
    const options = groupOptions(section);
    if (options.length <= 1) return pick;
    const priorFinal = existingFinalPlan?.picks.find((candidate) => canonicalSectionId(candidate.sectionId) === key)?.group;
    const priorDraft = draftPlan.picks.find((candidate) => canonicalSectionId(candidate.sectionId) === key)?.group;
    const inherited = normalizeGroup(priorFinal ?? priorDraft);
    if (inherited && options.includes(inherited)) {
      return { sectionId: pick.sectionId, group: inherited };
    }
    return pick;
  });
}

export function buildRegistrationPreview(input: {
  bytes: Uint8Array;
  catalog: AppCatalog;
  draftPlan: Plan;
  existingFinalPlan?: Plan;
  now?: string;
}): RegistrationImportPreview {
  const { bytes, catalog, draftPlan, existingFinalPlan } = input;
  const now = input.now ?? new Date().toISOString();
  const isUpdate = existingFinalPlan !== undefined;

  const byteError = checkRegistrationBytes(bytes);
  if (byteError) {
    return { ok: false, fatalError: byteError, isUpdate, matched: [], overrides: [], unmatched: [], warnings: [] };
  }

  const parsed = vnuRegistrationHtmlAdapter.parse({
    bytes,
    localOnly: true,
    context: {
      term: catalog.term.id,
      teachingWeeks: catalog.term.teachingWeeks,
    },
  });

  if (parsed.sections.length === 0) {
    const reason = formatParserIssues(parsed.issues, "error")[0] ?? "Không tìm thấy lớp học phần nào trong file này.";
    return { ok: false, fatalError: reason, isUpdate, matched: [], overrides: [], unmatched: [], warnings: formatParserIssues(parsed.issues, "warning") };
  }

  const basePlan = existingFinalPlan ?? draftPlan;
  const merged = mergeRegistration({
    plan: basePlan,
    catalog: catalog.domain,
    registrationSections: parsed.sections,
    term: catalog.term,
  });

  const picks = resolveInheritedPicks(merged.plan.picks, catalog, draftPlan, existingFinalPlan);
  const cohort = existingFinalPlan?.cohort ?? draftPlan.cohort;
  const week1 = existingFinalPlan?.week1 ?? draftPlan.week1;
  const finalPlan: Plan = {
    ...merged.plan,
    id: existingFinalPlan?.id ?? `${draftPlan.id}:final`,
    term: catalog.term.id,
    datasetVersion: catalog.entry.datasetVersion,
    name: "Phương án chính thức",
    planKind: "final",
    final: true,
    picks,
    ...(cohort ? { cohort } : {}),
    ...(week1 ? { week1 } : {}),
    createdAt: existingFinalPlan?.createdAt ?? now,
    updatedAt: now,
  };

  const previewOverrides: PreviewOverrideItem[] = merged.overrides.map((override) => {
    const section = catalog.sectionById.get(canonicalSectionId(override.target.sectionId));
    const course = section ? courseOf(catalog, section.courseCode) : undefined;
    const courseCode = section?.courseCode ?? override.target.sectionId;
    const courseName = course?.name ?? courseCode;
    return {
      sectionId: override.target.sectionId,
      courseCode,
      courseName,
      sessionId: override.target.sessionId,
      field: override.field,
      source: override.source,
      ...(override.from !== undefined ? { from: override.from } : {}),
      to: override.to,
      badge: overrideBadge(override.field),
      detail: describeOverride(override),
    };
  });

  const effectiveById = new Map<string, Section>();
  for (const section of merged.sections) effectiveById.set(canonicalSectionId(section.id), section);

  const matched: MatchedRegistrationItem[] = merged.matched.map((item) => {
    const key = canonicalSectionId(item.timetableSection.id);
    const effectiveSection = effectiveById.get(key) ?? item.timetableSection;
    const course = courseOf(catalog, effectiveSection.courseCode);
    const pick = picks.find((candidate) => canonicalSectionId(candidate.sectionId) === key);
    const options = groupOptions(effectiveSection);
    const group = normalizeGroup(pick?.group);
    const needsGroup = options.length > 1 && !group;
    const sectionOverrides = previewOverrides.filter((ov) => canonicalSectionId(ov.sectionId) === key);
    const unmatchedSessionCount = merged.issues.filter(
      (issue) => (issue.code === "REGISTRATION_OVERRIDE_UNMATCHED" || issue.code === "REGISTRATION_OVERRIDE_AMBIGUOUS")
        && issue.sectionId !== undefined
        && canonicalSectionId(issue.sectionId) === key
        && issue.sessionId !== undefined,
    ).length;
    const defaultedWeeks = merged.issues.some(
      (issue) => issue.code === "REGISTRATION_DEFAULT_WEEKS" && issue.sectionId !== undefined && canonicalSectionId(issue.sectionId) === key,
    );
    const visibleSessions = effectiveSection.sessions.filter((session) => {
      const sessionGroup = normalizeGroup(session.group);
      if (!group || group === "CL") return true;
      return sessionGroup === undefined || sessionGroup === "CL" || sessionGroup === group;
    });
    return {
      sectionId: effectiveSection.id,
      courseCode: effectiveSection.courseCode,
      courseName: course?.name ?? effectiveSection.courseCode,
      ...(course?.credits !== undefined ? { credits: course.credits } : {}),
      ...(group ? { group } : {}),
      needsGroup,
      groupOptions: options,
      sessionsSummary: visibleSessions.map((session) => summarizeSession(session, catalog)),
      overrides: sectionOverrides,
      unmatchedSessionCount,
      defaultedWeeks,
    };
  });

  const ambiguousIds = new Set(
    merged.issues
      .filter((issue) => issue.code === "REGISTRATION_OVERRIDE_AMBIGUOUS" && issue.sectionId !== undefined && issue.sessionId === undefined)
      .map((issue) => canonicalSectionId(issue.sectionId!)),
  );

  const unmatched: UnmatchedRegistrationItem[] = merged.unmatched.map((section) => ({
    sectionId: section.id,
    courseCode: section.courseCode,
    sessionsSummary: section.sessions.map((session) => summarizeSession(session, catalog)),
    reason: ambiguousIds.has(canonicalSectionId(section.id)) ? "ambiguous" : "unmatched",
  }));

  const warnings = [
    ...formatParserIssues(parsed.issues, "warning"),
    ...formatMergeWarnings(merged.issues),
  ];

  return {
    ok: true,
    plan: finalPlan,
    isUpdate,
    matched,
    overrides: previewOverrides,
    unmatched,
    warnings,
  };
}
