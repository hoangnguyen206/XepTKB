/**
 * Build-time constants injected by `apps/web/vite.config.ts` (`define`, DESIGN-M5-001 §4, frozen WP1↔WP2 interface).
 * Only `app/build-info.ts` reads them, behind a `typeof` guard, so the app still runs where they are not defined.
 */
declare const __KY_NAY_BUILD__: {
  version: string;
  commit: string;
  builtAt: string;
  channel: "production" | "preview" | "local";
};

/** Owner-configured report page (`VITE_REPORT_ISSUE_URL`, validated at build); `null` when unset. */
declare const __KY_NAY_REPORT_URL__: string | null;
