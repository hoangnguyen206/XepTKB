/**
 * Artifact loader — the only module in the app that performs network requests (enforced by
 * scripts/lint.mjs). It fetches same-origin static files under `data/`, verifies size and SHA-256,
 * validates schema/domain invariants and caches the result. Invalid data never replaces the cache.
 */
import {
  ArtifactError,
  parseManifest,
  parseMetadata,
  parseTimetable,
  type DatasetEntry,
  type DatasetManifest,
  type DatasetStatus,
  type LoadedDataset,
  type SourceType,
} from "./contract.js";

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_ARTIFACT_BYTES = 20 * 1024 * 1024;

export type DatasetCacheLike = {
  get(term: string): Promise<LoadedDataset | undefined>;
  put(dataset: LoadedDataset): Promise<void>;
  /** Drops a cached dataset that the manifest has since retracted (SEC-M3-001). */
  delete(term: string): Promise<void>;
  /** Every cached dataset, so offline use can switch between the terms already on the device (QA-M3-006). */
  all(): Promise<LoadedDataset[]>;
};

export type LoaderOptions = {
  /** Base URL of the data directory, resolved against the document (default `data/`). */
  baseUrl?: string;
  /** Dev/preview builds may load `candidate`/`validated` datasets (ADR-0010 §2 rule 4). */
  allowUnpublished: boolean;
  cache: DatasetCacheLike;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export type TermOption = { term: string; termName: string; datasetVersion: string; status: DatasetStatus; sourceType: SourceType };

export type LoadResult =
  /** `notCached`: the verified dataset is used but could not be stored for offline use (storage full/blocked). */
  | { kind: "fresh"; dataset: LoadedDataset; terms: TermOption[]; notCached?: true }
  | { kind: "cached"; reason: "offline" | "invalid"; error: ArtifactError; dataset: LoadedDataset; terms: TermOption[] }
  | { kind: "unavailable"; error: ArtifactError; terms: TermOption[] };

export function isStatusAllowed(status: DatasetStatus, allowUnpublished: boolean): boolean {
  if (status === "published") return true;
  if (status === "retracted") return false;
  return allowUnpublished;
}

/** Current dataset per term: the last allowed entry in manifest order (manifests are append-only). */
export function currentEntries(manifest: DatasetManifest, allowUnpublished: boolean): DatasetEntry[] {
  const byTerm = new Map<string, DatasetEntry>();
  for (const entry of manifest.datasets) {
    if (isStatusAllowed(entry.status, allowUnpublished)) byTerm.set(entry.term, entry);
  }
  return [...byTerm.values()];
}

function termOption(entry: DatasetEntry): TermOption {
  return { term: entry.term, termName: entry.termName, datasetVersion: entry.datasetVersion, status: entry.status, sourceType: entry.source.type };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  // crypto.subtle exists only in secure contexts; over plain HTTP say so instead of reporting corrupt data (REV-M3-004).
  if (typeof crypto === "undefined" || !crypto.subtle) throw new ArtifactError("INSECURE_CONTEXT", "WebCrypto is unavailable outside a secure context");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeJson(bytes: ArrayBuffer, what: string): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ArtifactError("INVALID_ARTIFACT", `${what} is not valid UTF-8 JSON`);
  }
}

class NetworkUnavailable extends Error {}

async function fetchBytes(fetchImpl: typeof fetch, url: string, limit: number, init: RequestInit): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, credentials: "same-origin", redirect: "error" });
  } catch {
    throw new NetworkUnavailable(url);
  }
  if (!response.ok) throw new ArtifactError("MANIFEST_UNAVAILABLE", `${url} returned HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > limit) throw new ArtifactError("TOO_LARGE", `${url} exceeds the size limit`);
  if (!response.body) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > limit) throw new ArtifactError("TOO_LARGE", `${url} exceeds the size limit`);
    return bytes;
  }
  // Count while streaming so a response without Content-Length is cut at the limit, not read whole (SEC-M3-004).
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ArtifactError("TOO_LARGE", `${url} exceeds the size limit`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function sameArtifacts(left: DatasetEntry, right: DatasetEntry): boolean {
  return left.datasetVersion === right.datasetVersion
    && left.artifacts.length === right.artifacts.length
    && left.artifacts.every((artifact) => right.artifacts.some((other) => other.kind === artifact.kind && other.sha256 === artifact.sha256));
}

export async function fetchManifest(options: LoaderOptions): Promise<DatasetManifest> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const bytes = await fetchBytes(fetchImpl, `${options.baseUrl ?? "data/"}manifest.json`, MAX_MANIFEST_BYTES, { cache: "no-cache" });
  return parseManifest(decodeJson(bytes, "manifest"));
}

export async function fetchDataset(entry: DatasetEntry, options: LoaderOptions): Promise<LoadedDataset> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl ?? "data/";
  const payloads = new Map<string, unknown>();
  for (const artifact of entry.artifacts) {
    const bytes = await fetchBytes(fetchImpl, `${base}${artifact.url}`, MAX_ARTIFACT_BYTES, {});
    if (bytes.byteLength !== artifact.bytes) throw new ArtifactError("HASH_MISMATCH", `${artifact.kind} size does not match the manifest`);
    if ((await sha256Hex(bytes)) !== artifact.sha256) throw new ArtifactError("HASH_MISMATCH", `${artifact.kind} sha256 does not match the manifest`);
    payloads.set(artifact.kind, decodeJson(bytes, artifact.kind));
  }
  const metadata = parseMetadata(payloads.get("metadata"), entry);
  const timetable = parseTimetable(payloads.get("timetable"), entry, metadata);
  return { entry, timetable, metadata, cachedAt: (options.now?.() ?? new Date()).toISOString() };
}

function asArtifactError(error: unknown): ArtifactError {
  if (error instanceof ArtifactError) return error;
  if (error instanceof NetworkUnavailable) return new ArtifactError("MANIFEST_UNAVAILABLE", "không kết nối được tới máy chủ dữ liệu");
  return new ArtifactError("INVALID_ARTIFACT", "dữ liệu tải về không đọc được");
}

/**
 * Loads the current dataset for `term` (or the first available term). Falls back to the cached
 * dataset only when the network is unreachable or the fresh data failed validation — never when a
 * reachable manifest no longer offers the term (e.g. the version was retracted).
 */
export async function loadDataset(term: string | undefined, options: LoaderOptions): Promise<LoadResult> {
  let manifest: DatasetManifest;
  try {
    manifest = await fetchManifest(options);
  } catch (error) {
    const reason = error instanceof NetworkUnavailable ? "offline" : "invalid";
    const failure = asArtifactError(error);
    const available = (await options.cache.all().catch(() => [])).filter((dataset) => isStatusAllowed(dataset.entry.status, options.allowUnpublished));
    const cached = available.find((dataset) => dataset.entry.term === term) ?? (term === undefined ? available[0] : undefined);
    return cached
      ? { kind: "cached", reason, error: failure, dataset: cached, terms: available.map((dataset) => termOption(dataset.entry)) }
      : { kind: "unavailable", error: failure, terms: [] };
  }
  const entries = currentEntries(manifest, options.allowUnpublished);
  const terms = entries.map(termOption);
  const entry = entries.find((candidate) => candidate.term === term) ?? (term === undefined ? entries[0] : undefined);
  if (!entry) {
    // A reachable manifest that retracts the cached version also removes it from the device, so it cannot reappear offline.
    const stale = term ? await options.cache.get(term) : undefined;
    if (stale && isRetracted(manifest, stale)) await options.cache.delete(stale.entry.term).catch(() => undefined);
    return { kind: "unavailable", error: new ArtifactError("NO_DATASET", term ? `không có dữ liệu được phép dùng cho kỳ ${term}` : "chưa có dữ liệu nào được công bố"), terms };
  }
  const cached = await options.cache.get(entry.term);
  // Same version and hashes: reuse the cached payload but take status/review dates from the manifest.
  if (cached && sameArtifacts(cached.entry, entry)) return { kind: "fresh", dataset: { ...cached, entry }, terms };
  let dataset: LoadedDataset;
  try {
    dataset = await fetchDataset(entry, options);
  } catch (error) {
    const failure = asArtifactError(error);
    const retracted = cached ? isRetracted(manifest, cached) : false;
    if (cached && retracted) await options.cache.delete(cached.entry.term).catch(() => undefined);
    if (cached && !retracted && isStatusAllowed(cached.entry.status, options.allowUnpublished)) {
      return { kind: "cached", reason: error instanceof NetworkUnavailable ? "offline" : "invalid", error: failure, dataset: cached, terms };
    }
    return { kind: "unavailable", error: failure, terms };
  }
  // A failed write (quota, private mode) must not discard data that has just been verified (REV-M3-004).
  try {
    await options.cache.put(dataset);
  } catch {
    return { kind: "fresh", dataset, terms, notCached: true };
  }
  return { kind: "fresh", dataset, terms };
}

function isRetracted(manifest: DatasetManifest, cached: LoadedDataset): boolean {
  return manifest.datasets.some((item) => item.datasetVersion === cached.entry.datasetVersion && item.status === "retracted");
}
