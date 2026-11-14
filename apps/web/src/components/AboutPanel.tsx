/**
 * The (i) sheet "Giới thiệu, quyền riêng tư & báo lỗi" (M5-C; DESIGN-M6-001 §6/§9, D-M6-11): Giao diện, the about and
 * privacy sections (`model/about-content.ts`, which holds the independence sentence), Dữ liệu trên máy (backups and
 * "Xóa dữ liệu trên máy", formerly in the footer), Phiên bản (formerly the footer build line), Báo sai dữ liệu and the
 * third-party licences. Part of the app shell, so it also opens offline.
 */
import { useEffect, useState, type ReactElement } from "react";
import { buildLabel, type BuildInfo } from "../app/build-info.js";
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from "../app/theme.js";
import type { DatasetEntry } from "../data/contract.js";
import { downloadBlob } from "../export/files.js";
import { ABOUT_SECTIONS, ABOUT_TITLE, REPORT_HELP, type AboutBlock } from "../model/about-content.js";
import { formatInstant, sourceLabel, statusLabel } from "../model/labels.js";
import { deleteBackup, listBackups, type BackupRecord } from "../storage/plan-store.js";
import { IconMonitor, IconMoon, IconSun } from "./icons.js";
import { ReportIssueForm } from "./ReportIssue.js";
import { SegmentedControl } from "./ui/SegmentedControl.js";
import { Sheet } from "./ui/Sheet.js";

export const LOCAL_DATA_ID = "local-data";

function Block(props: { block: AboutBlock }) {
  if (props.block.kind === "p") return <p>{props.block.text}</p>;
  return (
    <ul className="about-list">
      {props.block.items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

/** Opens the "Dữ liệu trên máy" disclosure further down the sheet and moves focus to it. */
function goToLocalData(): void {
  const details = document.getElementById(LOCAL_DATA_ID);
  if (!(details instanceof HTMLDetailsElement)) return;
  details.open = true;
  const summary = details.querySelector("summary");
  summary?.focus();
  summary?.scrollIntoView?.({ block: "center" });
}

const THEME_ICONS: Record<ThemePreference, ReactElement> = { system: <IconMonitor size={18} />, light: <IconSun size={18} />, dark: <IconMoon size={18} /> };

/** M6-A / AC-M6-01: Hệ thống (default, follows the OS) / Sáng / Tối, saved on this device. */
export function ThemePicker(props: { theme: ThemePreference; onChange: (theme: ThemePreference) => void }) {
  return (
    <SegmentedControl
      label="Giao diện"
      options={THEME_PREFERENCES.map((value) => ({ value, label: THEME_LABELS[value], icon: THEME_ICONS[value] }))}
      value={props.theme}
      onChange={props.onChange}
    />
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

function LocalData(props: { db?: IDBDatabase; wipeGeneration: number; onWipe: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Remounting the list after a wipe (same-tab or BroadcastChannel cross-tab) reloads it, so deleted backups are no longer offered (SEC-M3-006a).
  const [generation, setGeneration] = useState(0);
  return (
    <details className="local-data about-section" id={LOCAL_DATA_ID}>
      <summary>Dữ liệu trên máy</summary>
      {props.db ? <BackupList key={`${generation}-${props.wipeGeneration}`} db={props.db} /> : null}
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
  );
}

export type AboutSheetProps = {
  open: boolean;
  onClose: () => void;
  build: BuildInfo;
  entry?: DatasetEntry;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  db?: IDBDatabase;
  wipeGeneration: number;
  onWipe: () => Promise<void>;
};

export function AboutSheet(props: AboutSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={ABOUT_TITLE} size="full">
      <section className="about-section" aria-labelledby="about-theme">
        <h3 id="about-theme">Giao diện</h3>
        <ThemePicker theme={props.theme} onChange={props.onThemeChange} />
        <p className="muted">“Hệ thống” theo cài đặt sáng/tối của thiết bị. Lựa chọn chỉ lưu trên máy này.</p>
      </section>
      {ABOUT_SECTIONS.map((section) => (
        <section key={section.id} className="about-section" aria-labelledby={`about-${section.id}`}>
          <h3 id={`about-${section.id}`}>{section.heading}</h3>
          {section.blocks.map((block, index) => <Block key={index} block={block} />)}
          {section.id === "privacy" ? (
            <button type="button" className="button secondary" onClick={goToLocalData}>Đến mục “Dữ liệu trên máy”</button>
          ) : null}
        </section>
      ))}
      <LocalData {...(props.db ? { db: props.db } : {})} wipeGeneration={props.wipeGeneration} onWipe={props.onWipe} />
      <section className="about-section" aria-labelledby="about-version">
        <h3 id="about-version">Phiên bản</h3>
        <dl className="facts">
          <div><dt>Ứng dụng</dt><dd>{buildLabel(props.build)}</dd></div>
          {props.entry ? (
            <div><dt>Dữ liệu đang dùng</dt><dd>{props.entry.datasetVersion} · {props.entry.termName} · {sourceLabel(props.entry.source.type)} · {statusLabel(props.entry.status)}</dd></div>
          ) : null}
        </dl>
      </section>
      <section className="about-section" aria-labelledby="about-report">
        <h3 id="about-report">Báo sai dữ liệu</h3>
        <p>{REPORT_HELP}</p>
        <ReportIssueForm idPrefix="about" />
      </section>
      <section className="about-section" aria-labelledby="about-licenses">
        <h3 id="about-licenses">Giấy phép</h3>
        <p>Phông chữ Be Vietnam Pro (SIL OFL 1.1) và biểu tượng Lucide (ISC, một phần từ Feather theo MIT). <a href="./licenses.txt">Xem toàn văn giấy phép</a>.</p>
      </section>
    </Sheet>
  );
}
