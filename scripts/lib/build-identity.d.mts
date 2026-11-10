// Types for scripts/lib/build-identity.mjs (imported by apps/web/vite.config.ts).

export type BuildChannel = "production" | "preview" | "local";

/** Frozen WP1↔WP2 interface (DESIGN-M5-001 §10): the shape of `__KY_NAY_BUILD__`. */
export interface BuildIdentity {
  version: string;
  commit: string;
  builtAt: string;
  channel: BuildChannel;
}

export type BuildEnv = Record<string, string | undefined>;

export interface BuildIdentityOptions {
  version?: string;
  root?: string;
  now?: Date;
  gitCommit?: () => string | undefined;
  gitDirty?: () => boolean;
}

export const MAX_REPORT_URL_LENGTH: number;
export function readRootVersion(root?: string): string;
export function gitShortCommit(cwd?: string): string | undefined;
export function gitIsDirty(cwd?: string): boolean;
export function isCiBuild(env: BuildEnv): boolean;
export function resolveChannel(env: BuildEnv): BuildChannel;
export function resolveBuiltAt(env: BuildEnv, now?: Date): string;
export function resolveCommit(env: BuildEnv, options?: Pick<BuildIdentityOptions, "gitCommit" | "gitDirty">): string;
export function resolveBuildIdentity(env?: BuildEnv, options?: BuildIdentityOptions): BuildIdentity;
export function buildMetaContent(identity: BuildIdentity): string;
export function validateReportUrl(value: string | null | undefined): string | null;
