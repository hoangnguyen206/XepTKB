/**
 * "Nguồn và phiên bản dữ liệu" (DESIGN-M6-001 §6/§9, A-M6-2, AC-M6-04): one tap from the term chip or any status chip.
 * Full status sentences (formerly the banners), every provenance field of the former ProvenancePanel, and the term
 * switch.
 */
import { formatDate } from "@ky-nay/export";
import type { DatasetEntry } from "../data/contract.js";
import type { TermOption } from "../data/loader.js";
import type { DatasetStatus } from "../model/dataset-status.js";
import { VERIFY_NOTE, formatInstant, sourceLabel, statusLabel } from "../model/labels.js";
import { Notice } from "./common.js";
import { Sheet } from "./ui/Sheet.js";

export const DATA_SOURCE_TITLE = "Nguồn và phiên bản dữ liệu";

export function DataSourceSheet(props: {
  open: boolean;
  onClose: () => void;
  entry: DatasetEntry;
  cachedAt: string;
  offline: boolean;
  statuses: readonly DatasetStatus[];
  terms: readonly TermOption[];
  onSwitchTerm: (term: string) => void;
}) {
  const { entry } = props;
  const timetable = entry.artifacts.find((artifact) => artifact.kind === "timetable");
  return (
    <Sheet open={props.open} onClose={props.onClose} title={DATA_SOURCE_TITLE}>
      {props.statuses.map((status) => (
        <Notice key={status.id} tone={status.tone === "danger" ? "error" : status.tone} title={status.title}>{status.text}</Notice>
      ))}
      <dl className="facts">
        <div><dt>Loại nguồn</dt><dd>{sourceLabel(entry.source.type)}</dd></div>
        <div><dt>Học kỳ</dt><dd>{entry.termName}</dd></div>
        <div><dt>Phiên bản dữ liệu</dt><dd>{entry.datasetVersion}</dd></div>
        <div><dt>Trạng thái</dt><dd>{statusLabel(entry.status)}</dd></div>
        <div><dt>Văn bản nguồn</dt><dd>{entry.source.documentRef}</dd></div>
        <div><dt>Người phát hành</dt><dd>{entry.source.publishedBy}</dd></div>
        <div><dt>Bộ đọc dữ liệu</dt><dd>{entry.parserVersion}</dd></div>
        <div><dt>Nhập lúc</dt><dd>{formatInstant(entry.importedAt)}</dd></div>
        <div><dt>Duyệt lúc</dt><dd>{entry.reviewedAt ? formatInstant(entry.reviewedAt) : "chưa duyệt"}</dd></div>
        {entry.publishedAt ? <div><dt>Công bố lúc</dt><dd>{formatInstant(entry.publishedAt)}</dd></div> : null}
        {entry.expiresAt ? <div><dt>Hết hiệu lực</dt><dd>{formatDate(entry.expiresAt.slice(0, 10))}</dd></div> : null}
        <div><dt>Mã kiểm tra (SHA-256)</dt><dd><code>{timetable ? `${timetable.sha256.slice(0, 16)}…` : "—"}</code></dd></div>
        <div><dt>Lưu trên máy lúc</dt><dd>{formatInstant(props.cachedAt)}{props.offline ? " (đang dùng bản đã lưu)" : ""}</dd></div>
      </dl>
      <p>{VERIFY_NOTE}</p>
      {props.terms.length > 1 ? (
        <div className="field">
          <label htmlFor="term-switch">Đổi học kỳ</label>
          <select id="term-switch" value={entry.term} onChange={(event) => { props.onClose(); props.onSwitchTerm(event.target.value); }}>
            {props.terms.map((term) => <option key={term.term} value={term.term}>{term.termName}</option>)}
          </select>
        </div>
      ) : null}
    </Sheet>
  );
}
