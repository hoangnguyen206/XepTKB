/**
 * Service-worker registration (production builds only). A new version waits until the user
 * chooses to reload, so the page never mixes assets from two builds (SECURITY_PRIVACY §5).
 */
import { useSyncExternalStore } from "react";

type Listener = () => void;
let applyUpdate: (() => void) | undefined;
const listeners = new Set<Listener>();

function publish(apply: (() => void) | undefined): void {
  applyUpdate = apply;
  for (const listener of listeners) listener();
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  let updateRequested = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateRequested) window.location.reload();
  });
  void navigator.serviceWorker.register("./sw.js").then((registration) => {
    const offer = () => {
      const waiting = registration.waiting;
      if (!waiting || !navigator.serviceWorker.controller) return;
      publish(() => {
        updateRequested = true;
        waiting.postMessage("SKIP_WAITING");
      });
    };
    const watch = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") offer();
      });
    };
    offer();
    // An update may already be installing by the time registration resolves.
    watch(registration.installing);
    registration.addEventListener("updatefound", () => watch(registration.installing));
  }).catch(() => undefined);
}

/** The pending "reload into the new version" action, if a new service worker is waiting. */
export function usePendingUpdate(): (() => void) | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => applyUpdate,
    () => undefined,
  );
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener("online", listener);
      window.addEventListener("offline", listener);
      return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
