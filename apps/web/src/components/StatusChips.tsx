/**
 * Dataset status chips in the app bar (DESIGN-M6-001 §9, AC-M6-04). Always visible, never dismissible; a tap opens the
 * data-source sheet with the full sentences. Below 400 px only the first chip shows, plus "+N". A status that appears
 * after the first render (for example going offline) is announced once through the toast live region.
 */
import { useEffect, useRef } from "react";
import type { DatasetStatus, DatasetStatusTone } from "../model/dataset-status.js";
import { IconInfo, IconOffline, IconWarning } from "./icons.js";
import { useMediaQuery } from "./common.js";
import { StatusChip, type StatusTone } from "./ui/Chip.js";
import { useToast } from "./ui/Toast.js";

const TONE: Record<DatasetStatusTone, StatusTone> = { danger: "danger", warning: "warning", info: "info" };

/** `baselineKey` (the dataset version): statuses present when it changes are the starting point, not news. */
export function StatusChips(props: { statuses: readonly DatasetStatus[]; onOpen: () => void; baselineKey?: string }) {
  const narrow = useMediaQuery("(max-width: 399.98px)");
  const toast = useToast();
  const seen = useRef<{ key: string; ids: Set<string> } | undefined>(undefined);
  useEffect(() => {
    if (props.baselineKey === undefined) return;
    const ids = new Set(props.statuses.map((status) => status.id));
    if (seen.current?.key === props.baselineKey) {
      for (const status of props.statuses) if (!seen.current.ids.has(status.id)) toast.show(`${status.title}. ${status.text}`, { tone: status.tone === "danger" ? "error" : "info" });
    }
    seen.current = { key: props.baselineKey, ids };
  }, [props.statuses, props.baselineKey, toast]);

  if (props.statuses.length === 0) return null;
  const shown = narrow ? props.statuses.slice(0, 1) : props.statuses;
  const hidden = props.statuses.length - shown.length;
  return (
    <div className="status-chips">
      {shown.map((status) => (
        <StatusChip
          key={status.id}
          tone={TONE[status.tone]}
          icon={status.id === "offline" ? <IconOffline size={16} /> : status.tone === "info" ? <IconInfo size={16} /> : <IconWarning size={16} />}
          onClick={props.onOpen}
        >
          {status.chip}
        </StatusChip>
      ))}
      {hidden > 0 ? (
        <StatusChip tone={TONE[props.statuses[1]!.tone]} onClick={props.onOpen} label={`${hidden} trạng thái dữ liệu khác: ${props.statuses.slice(1).map((status) => status.chip).join(", ")}`}>
          +{hidden}
        </StatusChip>
      ) : null}
    </div>
  );
}
