/**
 * App bar (D-M6-3, DESIGN-M6-001 §6/§7): name, term chip (opens the data-source sheet: source in one tap, A-M6-2),
 * dataset status chips, the (i) button for "Giới thiệu, quyền riêng tư & báo lỗi", and from 1200 px the main nav.
 * The independence sentence is not repeated here (A-M6-1): it lives on the start screen, the (i) sheet and exports.
 */
import type { ReactNode } from "react";
import type { DatasetEntry } from "../data/contract.js";
import { ABOUT_TITLE } from "../model/about-content.js";
import { shortTermLabel } from "../model/dataset-status.js";
import { APP_NAME } from "../model/labels.js";
import { IconInfo } from "./icons.js";
import { Button } from "./ui/Button.js";

export function AppBar(props: { entry?: DatasetEntry; onOpenSource: () => void; onOpenAbout: () => void; chips?: ReactNode; nav?: ReactNode }) {
  const term = props.entry ? shortTermLabel(props.entry.termName) : undefined;
  return (
    <header className="app-bar">
      <div className="app-bar-row">
        <h1 className="app-name">
          <span className="app-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          {APP_NAME}
        </h1>
        {props.nav}
        <div className="app-bar-actions">
          {props.entry && term ? (
            <button type="button" className="chip term-chip" aria-label={`Nguồn dữ liệu: ${term}`} aria-haspopup="dialog" onClick={props.onOpenSource}>
              {term}
            </button>
          ) : null}
          <Button variant="ghost" className="about-button" label={ABOUT_TITLE} icon={<IconInfo size={22} />} aria-haspopup="dialog" onClick={props.onOpenAbout} />
        </div>
      </div>
      {props.chips}
    </header>
  );
}
