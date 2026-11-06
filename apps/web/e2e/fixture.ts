/**
 * Shared Playwright fixture for all E2E suites (SEC-M3-005):
 * Captures every request at the BrowserContext level (including Service Worker requests)
 * across every E2E test and enforces same-origin GET-only network access with zero WebSockets.
 */
import { test as base, expect, type Page } from "@playwright/test";

export const test = base.extend<{ networkGuard: void }>({
  networkGuard: [
    async ({ context, baseURL }, use) => {
      const httpRequests: { url: string; method: string }[] = [];
      const webSockets: string[] = [];
      context.on("request", (request) => {
        const url = request.url();
        if (url.startsWith("http://") || url.startsWith("https://")) {
          httpRequests.push({ url, method: request.method() });
        }
      });
      context.on("page", (page) => {
        page.on("websocket", (ws) => webSockets.push(ws.url()));
      });
      for (const page of context.pages()) {
        page.on("websocket", (ws) => webSockets.push(ws.url()));
      }
      await use();
      expect(httpRequests.filter((req) => !req.url.startsWith(baseURL!)), "unexpected cross-origin requests").toEqual([]);
      expect(httpRequests.filter((req) => req.method !== "GET"), "unexpected non-GET requests").toEqual([]);
      expect(webSockets, "unexpected WebSocket connections").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect, type Page };
