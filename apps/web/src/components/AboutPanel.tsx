/**
 * "Giới thiệu, quyền riêng tư & báo lỗi" (M5-C). Part of the app shell, so it also opens offline. Contents come from
 * `model/about-content.ts`; the general report form is the same PII-free one as on section cards.
 */
import { useEffect, useRef } from "react";
import { buildLabel, type BuildInfo } from "../app/build-info.js";
import type { DatasetEntry } from "../data/contract.js";
import { ABOUT_SECTIONS, ABOUT_TITLE, REPORT_HELP, type AboutBlock } from "../model/about-content.js";
import { sourceLabel, statusLabel } from "../model/labels.js";
import { ReportIssueForm } from "./ReportIssue.js";

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

export function AboutPanel(props: { build: BuildInfo; entry?: DatasetEntry; onClose: () => void }) {
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
