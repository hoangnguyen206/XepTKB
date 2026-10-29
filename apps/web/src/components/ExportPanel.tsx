import { useState } from "react";
import type { Plan } from "@ky-nay/domain";
import { buildGridLayout, conflictKeys, formatDate, nonFixedSessions } from "@ky-nay/export";
import { downloadBlob, icsFile, wordFile, creditsLine } from "../export/files.js";
import { renderPng } from "../export/png.js";
import type { AppCatalog } from "../model/catalog.js";
import { exportDisclaimer, fileStem, provenanceLine, VERIFY_NOTE } from "../model/labels.js";
import type { PlanView } from "../model/plan-view.js";
import { weekLabel } from "../model/week.js";
import { Notice, type WeekChoice } from "./common.js";

const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Zalo|Line\//i;

export function isInAppBrowser(userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return IN_APP_BROWSER.test(userAgent);
}

export function ExportPanel(props: { plan: Plan; view: PlanView; catalog: AppCatalog; week: WeekChoice }) {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | undefined>(undefined);
  const { plan, view, catalog } = props;
  const empty = view.sessions.length === 0;
  const week1 = view.week1?.date;
  const run = async (task: () => Promise<string> | string) => {
    try {
      setMessage({ tone: "success", text: await task() });
    } catch {
      setMessage({ tone: "error", text: "Không tạo được file. Hãy thử lại hoặc dùng trình duyệt khác." });
    }
  };
  const exportIcs = () => run(() => {
    const file = icsFile(plan, view, catalog);
    downloadBlob(file.blob, file.fileName);
    return `Đã tạo ${file.fileName} gồm ${file.events} buổi học. Mở file để thêm vào ứng dụng lịch.`;
  });
  const exportWord = () => run(() => {
    const file = wordFile(plan, view, catalog);
    downloadBlob(file.blob, file.fileName);
    return `Đã tạo ${file.fileName}.`;
  });
  const exportPng = () => run(async () => {
    const week = props.week === "all" ? undefined : props.week;
    const layout = buildGridLayout(view.sessions, { ...(week !== undefined ? { week } : {}), maxPeriod: catalog.maxPeriod, conflictKeys: conflictKeys(view.conflicts, week) });
    const blob = await renderPng({
      title: `${plan.name} — ${catalog.term.name}`,
      subtitle: `${week !== undefined && week1 ? weekLabel(week1, week) : "Tất cả các tuần"}${week1 ? ` · Tuần 1 bắt đầu ${formatDate(week1)}` : ""} · ${creditsLine(view)}`,
      layout,
      frame: catalog.frame,
      nonFixed: nonFixedSessions(view.sessions),
      footerLines: [provenanceLine(catalog.entry), exportDisclaimer(catalog.entry)],
    });
    const fileName = `${fileStem(catalog.term.id)}${week !== undefined ? `-tuan-${week}` : ""}.png`;
    downloadBlob(blob, fileName);
    return `Đã tạo ${fileName}.`;
  });
  return (
    <section className="export-panel" aria-labelledby="export-heading">
      <h3 id="export-heading">Xuất lịch</h3>
      {isInAppBrowser() ? (
        <Notice tone="warning" title="Bạn đang mở trong ứng dụng (Facebook/Messenger/Zalo…)">
          Trình duyệt trong ứng dụng thường không tải được file. Hãy chọn “Mở bằng trình duyệt” trong menu rồi xuất lại.
        </Notice>
      ) : null}
      {!view.week1 ? <Notice tone="warning">Chưa xác định được tuần 1 nên chưa xuất được file lịch (.ics). Hãy sửa tuần 1 ở mục Thiết lập.</Notice> : null}
      <div className="export-buttons">
        <button type="button" className="button primary" disabled={empty || !view.week1} onClick={() => void exportIcs()}>Tải lịch (.ics)</button>
        <button type="button" className="button secondary" disabled={empty} onClick={() => void exportPng()}>Tải ảnh (.png)</button>
        <button type="button" className="button secondary" disabled={empty} onClick={() => void exportWord()}>Tải Word (.doc)</button>
        <button type="button" className="button secondary" disabled={empty} onClick={() => window.print()}>In / Lưu PDF</button>
      </div>
      <p className="muted">
        Ảnh và bản in dùng tuần đang chọn ở Lịch tuần ({props.week === "all" ? "tất cả các tuần" : `tuần ${props.week}`}). File .ics chứa mọi tuần học. {VERIFY_NOTE}
      </p>
      {empty ? <p className="muted">Hãy chọn ít nhất một lớp để xuất lịch.</p> : null}
      <div role="status" aria-live="polite">{message ? <Notice tone={message.tone}>{message.text}</Notice> : null}</div>
    </section>
  );
}
