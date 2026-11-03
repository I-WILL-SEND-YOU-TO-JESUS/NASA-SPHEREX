/**
 * IRSA / SPHEREx data access layer.
 *
 * All external requests to IRSA are made from this module — only server-side code
 * should import this. The browser never directly calls IRSA.
 *
 * Official reference:
 *   SIA v2: https://irsa.ipac.caltech.edu/ibe/sia.html
 *   SPHEREx cutout: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html
 *   Example cutout URL (from official docs):
 *     https://irsa.ipac.caltech.edu/ibe/data/spherex/qr/level2/...fits?center=RA,Dec&size=degrees
 */

import type { ObservationRecord } from "./types";

/** Base URL for IRSA SIA v2 service */
const IRSA_SIA_URL = "https://irsa.ipac.caltech.edu/SIA";

/**
 * SPHEREx collection names available via SIA v2.
 * "spherex_qr2" = SPHEREx Quick Release 2 — confirmed in IRSA UPLOAD example docs.
 * We also try "spherex_qr1" as a fallback.
 */
export const SPHEREX_COLLECTIONS = ["spherex_qr3", "spherex_qr3_deep", "spherex_qr2", "spherex_qr2_deep"] as const;

/** Server-side request timeout in milliseconds */
// Archive searches can take around 20 seconds even for a small SPHEREx cone.
const SEARCH_TIMEOUT_MS = 45_000;
const CUTOUT_TIMEOUT_MS = 60_000;

/** In-memory cache: key → { data, expiry } */
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * IRSA SIA v2 returns JSON (when RESPONSEFORMAT=JSON) as a structure whose exact
 * shape we parse defensively here, based on the ObsCore columns described in the
 * official SIA v2 specification and IRSA docs.
 *
 * The JSON format from IRSA is a custom IPAC JSON table structure.
 * We parse it into a record array regardless of the exact key names.
 */
function mjdToIso(mjd: number): string {
  // MJD = JD - 2400000.5
  // Unix epoch (1970-01-01) = JD 2440587.5 = MJD 40587
  const unixMs = (mjd - 40587) * 86400 * 1000;
  return new Date(unixMs).toISOString();
}

function safeNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function safeString(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

/**
 * Parse an IRSA JSON response (as text) into ObservationRecord array.
 * IRSA JSON format (from SIA v2 with RESPONSEFORMAT=JSON) is a nested structure
 * with a "resultset" containing "metadata" (column descriptors) and "row" arrays.
 */
function parseIrsaJson(text: string, requestKey: string): ObservationRecord[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("IRSA returned non-JSON response");
  }

  const records: ObservationRecord[] = [];

  // IRSA SIA JSON can come in several shapes; try each:
  // Shape 1: { resultset: { metadata: [...], row: [[...], ...] } }
  // Shape 2: { data: [...], metadata: [...] }
  // Shape 3: flat { columns: [...], rows: [...] }

  let columnNames: string[] = [];
  let rows: unknown[][] = [];

  const j = json as Record<string, unknown>;

  // IRSA SIA RESPONSEFORMAT=JSON serializes its VOTable result as JSON:
  // { VOTABLE: { RESOURCE_ARRAY: [{...meta}, { TABLE: { FIELD_ARRAY, DATA: { TABLEDATA }}}] } }
  const votable = j.VOTABLE as Record<string, unknown> | undefined;
  const resources = votable?.RESOURCE_ARRAY as Array<Record<string, unknown>> | undefined;
  const resultResource = resources?.find((resource) => resource.TABLE != null);
  const table = resultResource?.TABLE as Record<string, unknown> | undefined;
  if (table) {
    const fields = table.FIELD_ARRAY as Array<Record<string, unknown>> | undefined;
    const data = table.DATA as Record<string, unknown> | undefined;
    const tableData = (data?.TABLEDATA ?? data?.BINARY2) as unknown;
    if (Array.isArray(fields)) {
      columnNames = fields.map((field) => {
        const attributes = field["<xmlattr>"] as Record<string, unknown> | undefined;
        return String(attributes?.name ?? attributes?.ID ?? "");
      });
    }
    if (Array.isArray(tableData)) {
      rows = tableData as unknown[][];
    }
  } else if (j.resultset) {
    const rs = j.resultset as Record<string, unknown>;
    const metadata = rs.metadata as Array<{ name?: string; ID?: string }> | undefined;
    const row = rs.row as unknown[][] | undefined;
    if (Array.isArray(metadata) && Array.isArray(row)) {
      columnNames = metadata.map((m) => m.name ?? m.ID ?? "");
      rows = row;
    }
  } else if (j.metadata && j.data) {
    const metadata = j.metadata as Array<{ name?: string; ID?: string }>;
    const data = j.data as Array<Record<string, unknown>>;
    if (Array.isArray(metadata) && Array.isArray(data)) {
      // data is array of objects
      columnNames = metadata.map((m) => m.name ?? m.ID ?? "");
      rows = data.map((row) => columnNames.map((col) => row[col]));
    }
  } else if (j.data && Array.isArray(j.data) && j.fields && Array.isArray(j.fields)) {
    const fields = j.fields as Array<{ name?: string; ID?: string }>;
    columnNames = fields.map((field) => field.name ?? field.ID ?? "");
    rows = j.data as unknown[][];
  } else if (Array.isArray(j)) {
    // Array of objects
    const arr = j as Array<Record<string, unknown>>;
    if (arr.length > 0) {
      columnNames = Object.keys(arr[0]);
      rows = arr.map((r) => columnNames.map((c) => r[c]));
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const get = (col: string): unknown => {
      const idx = columnNames.findIndex((name) => name.toLowerCase() === col.toLowerCase());
      return idx >= 0 ? row[idx] : undefined;
    };

    // Skip rows without a usable access URL
    // (Some SIA result rows are metadata-only artifacts like mask files)
    const url =
      safeString(get("access_url")) ?? safeString(get("accessURL")) ?? null;
    if (!url) continue;

    const tMin = safeNumber(get("t_min"));
    const dateObs = tMin != null ? mjdToIso(tMin) : "Unknown";

    // Keep the public archive file reference available to the separate cutout
    // route even when Next.js runs route handlers in different processes.
    const recordId = Buffer.from(url, "utf8").toString("base64url");
    const obs: ObservationRecord = {
      id: recordId, // Opaque index; resolved server-side when fetching cutout
      collection:
        safeString(get("obs_collection")) ??
        safeString(get("collection")) ??
        "spherex",
      obsId:
        safeString(get("obs_id")) ??
        safeString(get("obs_publisher_did")) ??
        `obs-${i}`,
      dateObs,
      mjd: tMin,
      emMin: safeNumber(get("em_min")),
      emMax: safeNumber(get("em_max")),
      bandpassName:
        safeString(get("energy_bandpassname")) ??
        safeString(get("bandpassName")),
      fov: safeNumber(get("s_fov")),
      ra: safeNumber(get("s_ra")) ?? 0,
      dec: safeNumber(get("s_dec")) ?? 0,
      instrument: safeString(get("instrument_name")) ?? safeString(get("instrument")),
      facility: safeString(get("facility_name")) ?? safeString(get("facility")),
      calibLevel: safeNumber(get("calib_level")) as number | null,
      description:
        safeString(get("obs_title")) ?? safeString(get("description")),
    };

    // Store the real access_url in the server-side URL registry so the cutout
    // route can look it up by opaque ID without accepting raw URLs from the browser.
    if (url) {
      pendingUrls.set(recordId, url);
    }

    records.push(obs);
  }

  return records;
}

/**
 * Best-effort in-process lookup for archive URLs. The cutout route also decodes
 * the URL from the record ID because Next.js may isolate route handlers.
 */
export const pendingUrls = new Map<string, string>();

export async function resolveFitsUrl(id: string): Promise<string | null> {
  const registered = pendingUrls.get(id);
  if (registered) return registered;

  const decodeAllowedFitsUrl = (encodedId: string): string | null => {
    try {
      const decoded = Buffer.from(encodedId, "base64url").toString("utf8");
      const url = new URL(decoded);
      if (
        url.protocol === "https:" &&
        url.hostname === "irsa.ipac.caltech.edu" &&
        url.port === "" &&
        url.pathname.startsWith("/ibe/data/spherex/") &&
        url.pathname.toLowerCase().endsWith(".fits")
      ) {
        return url.toString();
      }
    } catch {
      return null;
    }
    return null;
  };

  const decodedUrl = decodeAllowedFitsUrl(id);
  if (decodedUrl) return decodedUrl;

  // Support search result IDs created before the encoded URL handoff was added.
  const legacy = id.match(/^search:([\d.]+):(-?[\d.]+):([\d.]+):(\d+):([a-z\d_]+):(\d+)$/i);
  if (legacy) {
    const [, rawRa, rawDec, rawSize, rawMax, collection, rawIndex] = legacy;
    try {
      const records = await fetchSia(
        buildSiaUrl(collection, Number(rawRa), Number(rawDec), Number(rawSize), Number(rawMax)),
        `legacy:${id}`
      );
      const urlId = records[Number(rawIndex)]?.id;
      return urlId ? decodeAllowedFitsUrl(urlId) : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Query IRSA SIA v2 for SPHEREx observations covering a sky position.
 * Returns up to MAX_RECORDS results across the current QR3 and QR2 collections.
 *
 * SIA v2 query format (from IRSA docs):
 *   https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_qr3&POS=circle+RA+Dec+RADIUS&RESPONSEFORMAT=JSON&MAXREC=N
 */
export async function searchIrsa(
  ra: number,
  dec: number,
  sizeDegs: number,
  maxRec: number = 20
): Promise<ObservationRecord[]> {
  const cacheKey = `search:${ra}:${dec}:${sizeDegs}:${maxRec}`;
  const cached = cacheGet<ObservationRecord[]>(cacheKey);
  if (cached) return cached;

  const queryCollection = async (collection: string, signal?: AbortSignal) => {
    const records = await fetchSia(
      buildSiaUrl(collection, ra, dec, sizeDegs, maxRec),
      `${cacheKey}:${collection}`,
      signal
    );
    records.forEach((record) => { record.collection = collection; });
    return records;
  };

  // QR3 is the current primary collection. Avoid sending several expensive
  // catalog requests at once; older/deep collections are checked only when it
  // answers successfully with no matching files.
  try {
    const primaryRecords = await queryCollection(SPHEREX_COLLECTIONS[0]);
    if (primaryRecords.length > 0) {
      cacheSet(cacheKey, primaryRecords);
      return primaryRecords;
    }
  } catch (err) {
    console.warn(`[irsa] SIA query for ${SPHEREX_COLLECTIONS[0]} failed:`, err);
    throw err;
  }

  const fallbackCollections = SPHEREX_COLLECTIONS.slice(1);
  if (fallbackCollections.length === 0) {
    cacheSet(cacheKey, []);
    return [];
  }

  const controllers = fallbackCollections.map(() => new AbortController());
  let hadSuccessfulResponse = false;
  let lastError: unknown;
  const fallbackAttempts = fallbackCollections.map(async (collection, index) => {
    try {
      const records = await queryCollection(collection, controllers[index].signal);
      hadSuccessfulResponse = true;
      if (records.length === 0) throw new Error("No images in this collection.");
      controllers.forEach((controller, otherIndex) => {
        if (otherIndex !== index) controller.abort();
      });
      return records;
    } catch (err) {
      if (!controllers[index].signal.aborted) lastError = err;
      throw err;
    }
  });

  try {
    const records = await Promise.any(fallbackAttempts);
    cacheSet(cacheKey, records);
    return records;
  } catch {
    if (!hadSuccessfulResponse) throw lastError ?? new Error("IRSA archive search failed. Please retry.");
    cacheSet(cacheKey, []);
    return [];
  }
}

function buildSiaUrl(
  collection: string,
  ra: number,
  dec: number,
  sizeDegs: number,
  maxRec: number
): string {
  const params = new URLSearchParams();
  params.append("COLLECTION", collection);
  params.append("POS", `CIRCLE ${ra} ${dec} ${sizeDegs}`);
  params.append("RESPONSEFORMAT", "JSON");
  params.append("MAXREC", String(maxRec));
  return `${IRSA_SIA_URL}?${params.toString()}`;
}

async function fetchSia(
  url: string,
  ck: string,
  signal?: AbortSignal
): Promise<ObservationRecord[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // No caching header — Next.js server-side fetch; we use our own in-memory cache
    });
    if (!res.ok) {
      throw new Error(`IRSA SIA responded ${res.status}: ${res.statusText}`);
    }
    const text = await res.text();
    return parseIrsaJson(text, ck);
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/**
 * Fetch a FITS cutout from the IRSA SPHEREx image service.
 *
 * The cutout URL format is documented at:
 *   https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html
 *
 * Format: <fits_base_url>?center=RA,Dec&size=degrees
 *
 * @param firsUrl - The IRSA FITS file URL obtained from a prior SIA search result
 * @param ra - Center RA in decimal degrees
 * @param dec - Center Dec in decimal degrees
 * @param sizeDegs - Cutout size in degrees
 */
export async function fetchFitsCutout(
  fitsUrl: string,
  ra: number,
  dec: number,
  sizeDegs: number
): Promise<ArrayBuffer> {
  // Append cutout parameters to the FITS file URL as documented
  const cutoutUrl = `${fitsUrl}?center=${ra},${dec}&size=${sizeDegs}`;

  const cacheKey = `cutout:${fitsUrl}:${ra}:${dec}:${sizeDegs}`;
  const cached = cacheGet<ArrayBuffer>(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CUTOUT_TIMEOUT_MS);

  try {
    const res = await fetch(cutoutUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(
        `IRSA cutout responded ${res.status}: ${res.statusText}`
      );
    }
    const buf = await res.arrayBuffer();
    cacheSet(cacheKey, buf);
    return buf;
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
