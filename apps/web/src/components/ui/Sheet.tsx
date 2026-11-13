/**
 * DESIGN-M6-001 §6: native <dialog> opened with showModal(), so focus is trapped and the page behind is inert.
 * Esc arrives as the `cancel` event; a click on the backdrop closes; focus returns to the element that was focused
 * when the sheet opened. Page scroll is locked by `html:has(dialog[open])` in base.css. Bottom sheet below 768 px,
 * centred box from 768 px (sheet.css). Only one sheet is meant to be open at a time.
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconClose } from "../icons.js";
import { Button } from "./Button.js";

export type SheetProps = { open: boolean; onClose: () => void; title: string; size?: "auto" | "full"; children: ReactNode; closeLabel?: string };

export function Sheet(props: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) {
      openerRef.current = dialog.ownerDocument.activeElement;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!props.open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
    if (!props.open) {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    }
  }, [props.open]);

  // Closing on unmount too, so the page never stays inert behind a dialog that React removed.
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open && typeof dialog.close === "function") dialog.close();
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={props.size === "full" ? "sheet size-full" : "sheet"}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      {props.open ? (
        <>
          <div className="sheet-head">
            <h2 id={titleId}>{props.title}</h2>
            <Button variant="ghost" label={props.closeLabel ?? "Đóng"} icon={<IconClose />} onClick={props.onClose} />
          </div>
          <div className="sheet-body">{props.children}</div>
        </>
      ) : null}
    </dialog>
  );
}
