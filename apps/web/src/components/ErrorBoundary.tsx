/**
 * Local recovery after a render error (M5-E, DESIGN-M5-001 §2, ADR-0014 §5). The fallback shows the build id and the
 * error *name* only — never the message or stack, which may echo user data — and offers a reload or a confirmed wipe
 * of this device's data. Nothing is logged or reported anywhere.
 */
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { RootOptions } from "react-dom/client";
import { buildLabel, readBuildInfo } from "../app/build-info.js";
import { APP_NAME, INDEPENDENCE_NOTE } from "../model/labels.js";
import { openDb } from "../storage/db.js";
import { wipeLocalData } from "../storage/local-data.js";

/**
 * Root options for `createRoot`: React 19 prints every error caught by a boundary to the console by default; the
 * error may carry user data, so caught errors are handled by the boundaries' UI alone.
 */
export const ROOT_OPTIONS: RootOptions = {
  onCaughtError: () => undefined,
};

const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_$]{0,39}$/;

/** `TypeError`, `RangeError`… — anything unusual collapses to `Error`. */
export function safeErrorName(error: unknown): string {
  const name = error instanceof Error ? error.name : undefined;
  return typeof name === "string" && SAFE_NAME.test(name) ? name : "Error";
}

export type RecoveryActions = {
  reload?: () => void;
  openDatabase?: () => Promise<IDBDatabase>;
};

function defaultReload(): void {
  window.location.reload();
}

/** Clears IndexedDB, the app caches and the service worker (same as the footer action), then tells other tabs. */
async function wipeDevice(openDatabase: () => Promise<IDBDatabase>): Promise<void> {
  const db = await openDatabase();
  try {
    await wipeLocalData(db);
  } finally {
    db.close();
  }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("ky-nay");
    channel.postMessage({ type: "wiped" });
    channel.close();
  }
}

export function AppErrorFallback(props: { errorName: string } & RecoveryActions) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wipeFailed, setWipeFailed] = useState(false);
  const reload = props.reload ?? defaultReload;
  const build = readBuildInfo();
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const wipe = () => {
    setBusy(true);
    setWipeFailed(false);
    void wipeDevice(props.openDatabase ?? (() => openDb()))
      .then(() => reload())
      .catch(() => {
        setWipeFailed(true);
        setBusy(false);
      });
  };

  return (
    <>
      <header className="app-bar">
        <div className="app-bar-row">
          <p className="app-name">{APP_NAME}</p>
        </div>
        <p className="independence-note">{INDEPENDENCE_NOTE}</p>
      </header>
      <main id="main" className="error-screen">
        <div className="card">
          <h1 ref={headingRef} tabIndex={-1}>Ứng dụng gặp lỗi</h1>
          <p>Đã có lỗi khi hiển thị giao diện. Phương án của bạn vẫn được lưu trên thiết bị này — thường chỉ cần tải lại trang.</p>
          <div className="actions">
            <button type="button" className="button primary" onClick={reload}>Tải lại trang</button>
            {confirming ? null : (
              <button type="button" className="button secondary" onClick={() => setConfirming(true)}>Xóa dữ liệu trên máy rồi tải lại</button>
            )}
          </div>
          {confirming ? (
            <div className="confirm-box">
              <p>Xóa phương án, dữ liệu thời khóa biểu đã lưu và bộ nhớ đệm của ứng dụng trên thiết bị này? Không thể hoàn tác. Hãy xuất phương án trước nếu còn cần.</p>
              <div className="actions">
                <button type="button" className="button danger" disabled={busy} onClick={wipe}>Xác nhận xóa và tải lại</button>
                <button type="button" className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>Hủy</button>
              </div>
            </div>
          ) : null}
          <div role="status">
            {wipeFailed ? <p className="field-error">Không xóa được dữ liệu. Hãy đóng các thẻ khác của ứng dụng rồi thử lại, hoặc xóa dữ liệu trang web trong cài đặt trình duyệt.</p> : null}
          </div>
          <p className="muted">Ứng dụng không gửi báo cáo lỗi đi đâu. Nếu lỗi lặp lại, hãy ghi lại dòng dưới đây khi báo lỗi.</p>
          <p className="muted"><code>Lỗi: {props.errorName} · {buildLabel(build)}</code></p>
        </div>
      </main>
    </>
  );
}

type BoundaryState = { errorName?: string };

/** Wraps the whole app (main.tsx). */
export class AppErrorBoundary extends Component<{ children: ReactNode } & RecoveryActions, BoundaryState> {
  override state: BoundaryState = {};

  static getDerivedStateFromError(error: unknown): BoundaryState {
    // Only the name is kept; the error object (message, stack) is dropped here.
    return { errorName: safeErrorName(error) };
  }

  override componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // Intentionally empty: no logging, no reporting (ADR-0014 §5).
  }

  override render() {
    if (this.state.errorName === undefined) return this.props.children;
    return (
      <AppErrorFallback
        errorName={this.state.errorName}
        {...(this.props.reload ? { reload: this.props.reload } : {})}
        {...(this.props.openDatabase ? { openDatabase: this.props.openDatabase } : {})}
      />
    );
  }
}

/** Local boundary for one lazily loaded part (M5-F): the rest of the app keeps working, and the user can retry. */
export class LocalErrorBoundary extends Component<{ children: ReactNode; fallback: (retry: () => void) => ReactNode; onRetry?: () => void }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // Intentionally empty: no logging, no reporting.
  }

  private readonly retry = () => {
    this.props.onRetry?.();
    this.setState({ failed: false });
  };

  override render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}
