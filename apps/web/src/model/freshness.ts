/**
 * Dataset freshness (M5-D, DESIGN-M5-001 §2): has the dataset in use passed its `expiresAt`, and how old is it?
 * Pure, computed from the manifest entry already in memory — no network call.
 */
import type { DatasetEntry } from "../data/contract.js";

export type AgeBasis = "publishedAt" | "reviewedAt" | "importedAt" | "cachedAt";

export type DatasetFreshness = {
  expired: boolean;
  expiresAt?: string;
  /** Whole calendar days (Vietnam time) between the basis instant and `now`; never negative. */
  ageDays: number;
  ageBasis: AgeBasis;
  /** The instant the age is counted from. */
  basisAt: string;
};

const DAY_MS = 86_400_000;
/** Vietnam has no daylight saving time: UTC+7 all year. */
const VN_OFFSET_MS = 7 * 3_600_000;

function validTime(iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : time;
}

/** Day number of an instant on the Vietnam calendar. */
function vnDay(time: number): number {
  return Math.floor((time + VN_OFFSET_MS) / DAY_MS);
}

export function datasetFreshness(
  entry: Pick<DatasetEntry, "publishedAt" | "reviewedAt" | "importedAt" | "expiresAt">,
  cachedAt: string | undefined,
  now: Date,
): DatasetFreshness {
  const nowTime = now.getTime();
  const expiresTime = validTime(entry.expiresAt);
  const candidates: [AgeBasis, string | undefined][] = [
    ["publishedAt", entry.publishedAt],
    ["reviewedAt", entry.reviewedAt],
    ["importedAt", entry.importedAt],
    ["cachedAt", cachedAt],
  ];
  const found = candidates.find(([, iso]) => validTime(iso) !== undefined);
  const [ageBasis, basisAt] = found ? [found[0], found[1]!] : (["cachedAt", new Date(nowTime).toISOString()] as const);
  const ageDays = Math.max(0, vnDay(nowTime) - vnDay(validTime(basisAt)!));
  return {
    expired: expiresTime !== undefined && expiresTime < nowTime,
    ...(entry.expiresAt !== undefined && expiresTime !== undefined ? { expiresAt: entry.expiresAt } : {}),
    ageDays,
    ageBasis,
    basisAt,
  };
}

const BASIS_VERB: Record<AgeBasis, string> = {
  publishedAt: "công bố",
  reviewedAt: "duyệt",
  importedAt: "nhập",
  cachedAt: "lưu trên máy",
};

/** `Dữ liệu công bố 3 ngày trước` / `Dữ liệu công bố hôm nay`. */
export function ageText(freshness: Pick<DatasetFreshness, "ageDays" | "ageBasis">): string {
  const when = freshness.ageDays === 0 ? "hôm nay" : `${freshness.ageDays} ngày trước`;
  return `Dữ liệu ${BASIS_VERB[freshness.ageBasis]} ${when}`;
}
