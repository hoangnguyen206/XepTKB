/**
 * DESIGN-M6-001 §6: short messages above the bottom navigation. Both live regions exist before any message, so screen
 * readers announce what is added: role=status for information, role=alert for errors.
 * - `useToast().show()` adds a transient toast that closes by itself after a few seconds (or with "Đóng thông báo").
 * - `pinned` toasts are controlled by the caller (F2: "Có phiên bản mới" and the controller's storage warnings): they
 *   stay until the user acts, and may carry one action button.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconClose } from "../icons.js";
import { Button } from "./Button.js";

export type ToastTone = "info" | "warning" | "error";
type ToastItem = { id: number; text: string; tone: ToastTone };
export type ToastApi = { show: (text: string, options?: { tone?: ToastTone }) => void };
export type PinnedToast = { id: string; title?: string; text: string; tone: ToastTone; action?: { label: string; onClick: () => void }; onClose?: () => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });
export const TOAST_MS = 6000;

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

function ToastView(props: { tone: ToastTone; title?: string; text: string; action?: PinnedToast["action"]; onClose?: () => void }) {
  return (
    <div className={`toast tone-${props.tone}`}>
      <span className="toast-text">
        {props.title ? <strong>{props.title}. </strong> : null}
        {props.text}
      </span>
      {props.action ? (
        <Button variant="secondary" size="sm" onClick={props.action.onClick}>{props.action.label}</Button>
      ) : null}
      {props.onClose ? <Button variant="ghost" size="sm" label="Đóng thông báo" icon={<IconClose size={18} />} onClick={props.onClose} /> : null}
    </div>
  );
}

export function ToastRegion(props: { children?: ReactNode; pinned?: readonly PinnedToast[] }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (text: string, options?: { tone?: ToastTone }) => {
      const id = nextId.current++;
      setItems((current) => [...current.filter((item) => item.text !== text), { id, text, tone: options?.tone ?? "info" }]);
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const api = useMemo(() => ({ show }), [show]);
  const pinned = props.pinned ?? [];
  const render = (alert: boolean) => (
    <>
      {pinned.filter((item) => (item.tone === "error") === alert).map((item) => (
        <ToastView key={`p-${item.id}`} tone={item.tone} {...(item.title ? { title: item.title } : {})} text={item.text} {...(item.action ? { action: item.action } : {})} {...(item.onClose ? { onClose: item.onClose } : {})} />
      ))}
      {items.filter((item) => (item.tone === "error") === alert).map((item) => (
        <ToastView key={item.id} tone={item.tone} text={item.text} onClose={() => dismiss(item.id)} />
      ))}
    </>
  );

  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <div className="toast-region">
        <div role="status">{render(false)}</div>
        <div role="alert">{render(true)}</div>
      </div>
    </ToastContext.Provider>
  );
}
