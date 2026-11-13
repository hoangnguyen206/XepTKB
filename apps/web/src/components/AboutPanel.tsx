/**
 * "Giới thiệu, quyền riêng tư & báo lỗi" (M5-C). Part of the app shell, so it also opens offline. Contents come from
 * `model/about-content.ts`; the general report form is the same PII-free one as on section cards.
 */
import { useEffect, useRef, type ReactElement } from "react";
import { buildLabel, type BuildInfo } from "../app/build-info.js";
import { THEME_LABELS, THEME_PREFERENCES, type ThemePreference } from "../app/theme.js";
import type { DatasetEntry } from "../data/contract.js";
import { ABOUT_SECTIONS, ABOUT_TITLE, REPORT_HELP, type AboutBlock } from "../model/about-content.js";
import { sourceLabel, statusLabel } from "../model/labels.js";
import { IconMonitor, IconMoon, IconSun } from "./icons.js";
import { ReportIssueForm } from "./ReportIssue.js";
import { SegmentedControl } from "./ui/SegmentedControl.js";

export const ABOUT_PANEL_ID = "about-panel";
export const LOCAL_DATA_ID = "local-data";

function Block(props: { block: AboutBlock }) {
  if (props.block.kind === "p") return <p>{props.block.text}</p>;
  return (
    <ul className="about-list">
      {props.block.items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

/** Opens the footer's "Dữ liệu trên máy" disclosure and moves focus to it. */
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

export function AboutPanel(props: { build: BuildInfo; entry?: DatasetEntry; onClose: () => void; theme?: ThemePreference; onThemeChange?: (theme: ThemePreference) => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const heading = headingRef.current;
    heading?.focus();
    heading?.scrollIntoView?.({ block: "start" });
  }, []);
  return (
    <section id={ABOUT_PANEL_ID} className="card about" aria-labelledby="about-heading">
      <div className="about-head">
        <h2 id="about-heading" ref={headingRef} tabIndex={-1}>{ABOUT_TITLE}</h2>
        <button type="button" className="button secondary small" onClick={props.onClose}>Đóng giới thiệu</button>
      </div>
      {props.onThemeChange ? (
        <section className="about-section" aria-labelledby="about-theme">
          <h3 id="about-theme">Giao diện</h3>
          <ThemePicker theme={props.theme ?? "system"} onChange={props.onThemeChange} />
          <p className="muted">“Hệ thống” theo cài đặt sáng/tối của thiết bị. Lựa chọn chỉ lưu trên máy này.</p>
        </section>
      ) : null}
      {ABOUT_SECTIONS.map((section) => (
        <section key={section.id} className="about-section" aria-labelledby={`about-${section.id}`}>
          <h3 id={`about-${section.id}`}>{section.heading}</h3>
          {section.blocks.map((block, index) => <Block key={index} block={block} />)}
          {section.id === "privacy" ? (
            <button type="button" className="button secondary" onClick={goToLocalData}>Đến mục “Dữ liệu trên máy”</button>
          ) : null}
        </section>
      ))}
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
    </section>
  );
}
