/**
 * DESIGN-M6-001 §6: short messages above the bottom navigation. Both live regions exist before any message, so screen
 * readers announce what is added: role=status for information, role=alert for errors. Each toast closes by itself
 * after a few seconds or with its "Đóng" button.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconClose } from "../icons.js";
import { Button } from "./Button.js";

export type ToastTone = "info" | "error";
type ToastItem = { id: number; text: string; tone: ToastTone };
export type ToastApi = { show: (text: string, options?: { tone?: ToastTone }) => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });
export const TOAST_MS = 6000;

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastRegion(props: { children?: ReactNode }) {
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
  const render = (tone: ToastTone) =>
    items
      .filter((item) => item.tone === tone)
      .map((item) => (
        <div key={item.id} className={`toast tone-${item.tone}`}>
          <span>{item.text}</span>
          <Button variant="ghost" size="sm" label="Đóng thông báo" icon={<IconClose size={18} />} onClick={() => dismiss(item.id)} />
        </div>
      ));

  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <div className="toast-region">
        <div role="status">{render("info")}</div>
        <div role="alert">{render("error")}</div>
      </div>
    </ToastContext.Provider>
  );
}
