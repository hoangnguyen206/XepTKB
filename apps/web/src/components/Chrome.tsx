import { useEffect, useState } from "react";
import { formatDate } from "@ky-nay/export";
import type { DatasetEntry } from "../data/contract.js";
import { listBackups, deleteBackup, type BackupRecord } from "../storage/plan-store.js";
import { downloadBlob } from "../export/files.js";
import { APP_NAME, INDEPENDENCE_NOTE, PRIVACY_NOTE, VERIFY_NOTE, formatInstant, sourceLabel, statusLabel } from "../model/labels.js";

export function Header(props: { entry?: DatasetEntry; provenanceOpen: boolean; onToggleProvenance: () => void }) {
  return (
    <header className="app-header">
      <div className="brand">
        <h1 className="app-name">{APP_NAME}</h1>
        <p className="tagline">Xếp thời khóa biểu · {INDEPENDENCE_NOTE}</p>
      </div>
      {props.entry ? (
        <button type="button" className="dataset-badge" aria-expanded={props.provenanceOpen} aria-controls={props.provenanceOpen ? "provenance-panel" : undefined} onClick={props.onToggleProvenance}>
          <span className="visually-hidden">Nguồn dữ liệu: </span>
          {sourceLabel(props.entry.source.type)} · {props.entry.datasetVersion}
        </button>
      ) : null}
    </header>
  );
}

export function ProvenancePanel(props: { entry: DatasetEntry; cachedAt?: string; offline: boolean }) {
  const { entry } = props;
  const timetable = entry.artifacts.find((artifact) => artifact.kind === "timetable");
  return (
    <section id="provenance-panel" className="card provenance" aria-labelledby="provenance-heading">
      <h2 id="provenance-heading">Nguồn và phiên bản dữ liệu</h2>
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
        {props.cachedAt ? <div><dt>Lưu trên máy lúc</dt><dd>{formatInstant(props.cachedAt)}{props.offline ? " (đang dùng bản đã lưu)" : ""}</dd></div> : null}
      </dl>
      <p>{VERIFY_NOTE}</p>
    </section>
  );
}

function BackupList(props: { db: IDBDatabase }) {
  const [backups, setBackups] = useState<{ key: IDBValidKey; value: BackupRecord }[]>([]);
  useEffect(() => {
    void listBackups(props.db).then(setBackups).catch(() => setBackups([]));
  }, [props.db]);
  if (backups.length === 0) return null;
  return (
    <div>
      <p>Bản sao lưu phương án không đọc được ({backups.length}):</p>
      <ul>
        {backups.map((backup, index) => (
          <li key={String(backup.key)}>
            {backup.value.reason} — {formatInstant(backup.value.movedAt)}{" "}
            <button type="button" className="button secondary small" onClick={() => downloadBlob(new Blob([JSON.stringify(backup.value.record, null, 2)], { type: "application/json" }), `ky-nay-sao-luu-${index + 1}.json`)}>Tải về</button>{" "}
            <button type="button" className="button secondary small" onClick={() => void deleteBackup(props.db, backup.key).then(() => setBackups((current) => current.filter((item) => item.key !== backup.key)))}>Xóa</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer(props: { db?: IDBDatabase; onWipe: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Remounting the list after a wipe reloads it, so deleted backups are no longer offered (SEC-M3-006a).
  const [generation, setGeneration] = useState(0);
  return (
    <footer className="app-footer">
      <p><strong>{INDEPENDENCE_NOTE}</strong> {VERIFY_NOTE}</p>
      <p>{PRIVACY_NOTE}</p>
      <details className="local-data">
        <summary>Dữ liệu trên máy</summary>
        {props.db ? <BackupList key={generation} db={props.db} /> : null}
        {confirming ? (
          <div className="actions">
            <p>Xóa phương án, dữ liệu thời khóa biểu đã lưu và bộ nhớ đệm của ứng dụng trên thiết bị này? Không thể hoàn tác.</p>
            <button type="button" className="button danger" disabled={busy} onClick={() => { setBusy(true); void props.onWipe().finally(() => { setBusy(false); setConfirming(false); setGeneration((value) => value + 1); }); }}>Xác nhận xóa</button>
            <button type="button" className="button secondary" onClick={() => setConfirming(false)}>Hủy</button>
          </div>
        ) : (
          <button type="button" className="button secondary" onClick={() => setConfirming(true)}>Xóa dữ liệu trên máy</button>
        )}
      </details>
    </footer>
  );
}
