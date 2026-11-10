/**
 * "Báo sai dữ liệu" without telemetry (M5-B, ADR-0014 §4). The report is plain text the user copies; nothing is sent.
 * The optional link opens the Owner-configured page exactly as configured — no report text, identifier or note is
 * ever appended to it. The draft note lives in React state only (never persisted).
 */
import { createContext, useContext, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { readBuildInfo, readReportUrl, validateReportUrl, type BuildInfo } from "../app/build-info.js";
import {
  REPORT_FIELDS,
  REPORT_NOTE_MAX,
  buildIssueReport,
  clampReportNote,
  isReportFieldId,
  looksLikePersonalInfo,
  type ReportDataset,
  type ReportFieldId,
  type ReportSection,
} from "../model/report-issue.js";
import { Notice } from "./common.js";

type ReportIssueValue = { build: BuildInfo; dataset?: ReportDataset; reportUrl?: string };

const ReportIssueContext = createContext<ReportIssueValue | undefined>(undefined);

export function ReportIssueProvider(props: {
  dataset?: ReportDataset;
  /** Test/override hook; re-validated like the build constant. Defaults to the build-time URL. */
  reportUrl?: string | null;
  build?: BuildInfo;
  children: ReactNode;
}) {
  const { datasetVersion, term, termName, status } = props.dataset ?? {};
  const urlOverride = props.reportUrl;
  const build = props.build;
  const value = useMemo<ReportIssueValue>(() => {
    // Copy only the public identifiers, so a wider object passed as `dataset` cannot leak into the report.
    const dataset = datasetVersion !== undefined && term !== undefined && termName !== undefined && status !== undefined ? { datasetVersion, term, termName, status } : undefined;
    const reportUrl = urlOverride === undefined ? readReportUrl() : validateReportUrl(urlOverride);
    return { build: build ?? readBuildInfo(), ...(dataset ? { dataset } : {}), ...(reportUrl ? { reportUrl } : {}) };
  }, [datasetVersion, term, termName, status, urlOverride, build]);
  return <ReportIssueContext.Provider value={value}>{props.children}</ReportIssueContext.Provider>;
}

/** The report context, or `undefined` outside a provider (the per-section action is then hidden). */
export function useReportIssue(): ReportIssueValue | undefined {
  return useContext(ReportIssueContext);
}

type CopyState = "idle" | "copied" | "manual";

export function ReportIssueForm(props: { section?: ReportSection; onClose?: () => void; idPrefix?: string }) {
  const context = useReportIssue();
  const generated = useId();
  const id = props.idPrefix ?? generated;
  const [field, setField] = useState<ReportFieldId | "">("");
  const [note, setNote] = useState("");
  const [copy, setCopy] = useState<CopyState>("idle");
  const outputRef = useRef<HTMLTextAreaElement>(null);
  if (!context) return null;

  const text = buildIssueReport({
    build: context.build,
    ...(context.dataset ? { dataset: context.dataset } : {}),
    ...(props.section ? { section: props.section } : {}),
    ...(field ? { field } : {}),
    note,
  });
  const personal = looksLikePersonalInfo(note);

  const selectOutput = () => {
    const output = outputRef.current;
    if (!output) return;
    output.focus();
    output.select();
  };

  const onCopy = async () => {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      setCopy("manual");
      selectOutput();
      return;
    }
    try {
      await clipboard.writeText(text);
      setCopy("copied");
    } catch {
      setCopy("manual");
      selectOutput();
    }
  };

  return (
    <div className="report-form" role="group" aria-labelledby={`${id}-report-title`}>
      <p className="report-title" id={`${id}-report-title`}>
        <strong>Báo sai dữ liệu{props.section ? ` · lớp ${props.section.sectionId}` : ""}</strong>
      </p>
      <p className="muted">Ứng dụng không gửi gì đi. Hãy sao chép nội dung dưới đây rồi tự gửi cho người duy trì công cụ.</p>
      <div className="field">
        <label htmlFor={`${id}-field`}>Thông tin bị sai</label>
        <select
          id={`${id}-field`}
          value={field}
          onChange={(event) => {
            setField(isReportFieldId(event.target.value) ? event.target.value : "");
            setCopy("idle");
          }}
        >
          <option value="">— Chọn —</option>
          {REPORT_FIELDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-note`}>Mô tả (không bắt buộc)</label>
        <textarea
          id={`${id}-note`}
          rows={3}
          maxLength={REPORT_NOTE_MAX}
          value={note}
          aria-describedby={`${id}-note-hint`}
          onChange={(event) => {
            setNote(clampReportNote(event.target.value));
            setCopy("idle");
          }}
        />
        <p className="field-hint" id={`${id}-note-hint`}>
          Không ghi họ tên, mã sinh viên, ngày sinh, email hay số điện thoại. {note.length}/{REPORT_NOTE_MAX} ký tự.
        </p>
      </div>
      {personal ? (
        <Notice tone="warning" title="Mô tả có thể chứa thông tin cá nhân">
          Có vẻ bạn đã ghi mã số, ngày tháng, email hoặc số điện thoại. Hãy xóa thông tin cá nhân trước khi sao chép.
        </Notice>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-output`}>Nội dung báo cáo</label>
        <textarea id={`${id}-output`} ref={outputRef} className="report-output" readOnly rows={6} value={text} />
      </div>
      <div className="actions">
        <button type="button" className="button primary" onClick={() => void onCopy()}>Sao chép</button>
        {context.reportUrl ? (
          <a className="button secondary" href={context.reportUrl} target="_blank" rel="noopener noreferrer">
            Mở trang báo lỗi<span className="visually-hidden"> (mở thẻ mới)</span>
          </a>
        ) : null}
        {props.onClose ? <button type="button" className="button secondary" onClick={props.onClose}>Đóng</button> : null}
      </div>
      <div role="status" className="report-status">
        {copy === "copied" ? <p>Đã sao chép nội dung báo cáo.{context.reportUrl ? " Hãy dán vào trang báo lỗi." : ""}</p> : null}
        {copy === "manual" ? <p>Không sao chép tự động được. Nội dung trong ô “Nội dung báo cáo” đã được chọn — hãy sao chép thủ công (giữ để chọn hoặc Ctrl+C).</p> : null}
      </div>
      {context.reportUrl ? null : (
        <p className="muted">Chưa có trang báo lỗi được cấu hình. Hãy gửi nội dung đã sao chép cho người duy trì công cụ qua kênh liên hệ bạn biết.</p>
      )}
    </div>
  );
}
