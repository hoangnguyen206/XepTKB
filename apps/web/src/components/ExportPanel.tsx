import { useState, type ReactNode } from "react";
import type { Plan } from "@ky-nay/domain";
import { buildGridLayout, conflictKeys, formatDate, nonFixedSessions } from "@ky-nay/export";
import { loadExporters, resetExporters } from "../export/exporters-lazy.js";
import { downloadBlob, creditsLine } from "../export/files.js";
import type { AppCatalog } from "../model/catalog.js";
import { exportDisclaimer, fileStem, provenanceLine, VERIFY_NOTE } from "../model/labels.js";
import type { PlanView } from "../model/plan-view.js";
import { weekLabel } from "../model/week.js";
import { Notice, type WeekChoice } from "./common.js";
import { IconFile, IconImage, IconPrinter, IconSmartphone } from "./icons.js";

const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Zalo|Line\//i;

export function isInAppBrowser(userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return IN_APP_BROWSER.test(userAgent);
}

/** One export tile: icon, a short title and the format; the accessible name holds both ("Điện thoại Tải lịch (.ics)"). */
function ExportTile(props: { icon: ReactNode; title: string; format: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="export-tile" disabled={props.disabled} onClick={props.onClick}>
      {props.icon}
      <span className="export-tile-title">{props.title}</span> <span className="export-tile-format">{props.format}</span>
    </button>
  );
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
      // A failed chunk load (offline before it was cached) can be retried by pressing the button again.
      resetExporters();
      setMessage({ tone: "error", text: "Không tạo được file. Hãy thử lại hoặc dùng trình duyệt khác." });
    }
  };
  const exportIcs = () => run(async () => {
    const { icsFile } = await loadExporters();
    const file = icsFile(plan, view, catalog);
    downloadBlob(file.blob, file.fileName);
    return `Đã tạo ${file.fileName} gồm ${file.events} buổi học. Mở file để thêm vào ứng dụng lịch.`;
  });
  const exportWord = () => run(async () => {
    const { wordFile } = await loadExporters();
    const file = wordFile(plan, view, catalog);
    downloadBlob(file.blob, file.fileName);
    return `Đã tạo ${file.fileName}.`;
  });
  const exportPng = () => run(async () => {
    const { renderPng } = await loadExporters();
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
      {!view.week1 ? <Notice tone="warning">Chưa xác định được tuần 1 nên chưa xuất được file lịch (.ics). Hãy sửa ở mục Tuần 1 phía trên.</Notice> : null}
      {view.unresolved.length > 0 ? (
        <Notice tone="warning" title="File xuất sẽ thiếu buổi học">
          {view.unresolved.length} lớp chưa xác định đủ buổi học ({view.unresolved.map((entry) => entry.sectionId).join(", ")}): file chỉ gồm các buổi đã xác định. Hãy xử lý các lớp này ở mục Phương án trước khi xuất.
        </Notice>
      ) : null}
      {/* DESIGN-M6-001 §10 (AC-M6-13): 4 tiles; file names and contents are unchanged. F7 turns "Ảnh" into the PNG/poster choice. */}
      <div className="export-tiles">
        <ExportTile icon={<IconSmartphone />} title="Điện thoại" format="Tải lịch (.ics)" disabled={empty || !view.week1} onClick={() => void exportIcs()} />
        <ExportTile icon={<IconImage />} title="Ảnh" format="Tải ảnh (.png)" disabled={empty} onClick={() => void exportPng()} />
        <ExportTile icon={<IconFile />} title="Word" format="Tải Word (.doc)" disabled={empty} onClick={() => void exportWord()} />
        <ExportTile icon={<IconPrinter />} title="In" format="In / Lưu PDF" disabled={empty} onClick={() => window.print()} />
      </div>
      <p className="muted">
        Ảnh và bản in theo tuần đang xem ({props.week === "all" ? "tất cả các tuần" : `tuần ${props.week}`}); file .ics có mọi tuần. {VERIFY_NOTE}
      </p>
      {empty ? <p className="muted">Hãy chọn ít nhất một lớp để xuất lịch.</p> : null}
      <div role="status" aria-live="polite">{message ? <Notice tone={message.tone}>{message.text}</Notice> : null}</div>
    </section>
  );
}
