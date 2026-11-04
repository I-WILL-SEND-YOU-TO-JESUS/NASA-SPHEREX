"use client";

import React, { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import SkyViewer from "@/components/SkyViewer";
import SkyRoam from "@/components/SkyRoam";
import AnimatedWireframe from "@/components/AnimatedWireframe";
import { FEATURED_TARGETS } from "@/lib/featured-targets";
import { CUTOUT_SIZE_DEFAULT, parseCoordinateInput, validateRA, validateDec, validateSize } from "@/lib/validation";
import { generateDemoImage } from "@/lib/fits-display";
import type {
  ObservationRecord,
  FitsImageData,
  ApiSearchResponse,
  SearchResponse,
  ApiCutoutResponse,
} from "@/lib/types";

type CatalogStar = { sourceId: string; ra: number; dec: number; magnitude: number | null; parallax: number | null };
type NameSuggestions = {
  objects: { name: string }[];
  articles: { title: string; description: string; url: string; image?: string }[];
};

function ExploreContent() {
  const searchParams = useSearchParams();

  // Coordinates & controls
  // Keep the server and first client render identical; URL state is applied in the effect below.
  const [ra, setRa] = useState("83.8221");
  const [dec, setDec] = useState("-5.3911");
  const [size, setSize] = useState(String(CUTOUT_SIZE_DEFAULT));
  const [coordinatePair, setCoordinatePair] = useState("");
  const [targetName, setTargetName] = useState("");
  const [queryMode, setQueryMode] = useState<"object" | "coordinates">("coordinates");

  // Search state
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [searchError, setSearchError] = useState("");
  const [records, setRecords] = useState<ObservationRecord[]>([]);

  // Selection state
  const [selectedObsA, setSelectedObsA] = useState<ObservationRecord | null>(null);
  const [imageA, setImageA] = useState<FitsImageData | null>(null);

  const [loadingCutouts, setLoadingCutouts] = useState<Set<string>>(new Set());
  const [cutoutError, setCutoutError] = useState<string | null>(null);
  const [catalogStars, setCatalogStars] = useState<CatalogStar[]>([]);
  const [selectedStar, setSelectedStar] = useState<CatalogStar | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<NameSuggestions>({ objects: [], articles: [] });
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const shortNameQuery = targetName.trim().length < 2;
  const objectOptions = shortNameQuery
    ? FEATURED_TARGETS.slice(0, 3).map((target) => ({ name: target.name }))
    : nameSuggestions.objects;

  useEffect(() => {
    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !suggestionsRef.current?.contains(event.target)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, []);

  useEffect(() => {
    if (searchStatus !== "done" || !imageA || imageA.isDemo) {
      setCatalogStars([]);
      return;
    }
    const centerRa = Number(ra);
    const centerDec = Number(dec);
    const fieldSize = Number(size);
    if (!Number.isFinite(centerRa) || !Number.isFinite(centerDec) || !Number.isFinite(fieldSize)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ ra: String(centerRa), dec: String(centerDec), size: String(fieldSize) });
        const response = await fetch(`/api/catalog/stars?${query}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Gaia star catalog unavailable.");
        setCatalogStars(result.stars as CatalogStar[]);
      } catch {
        if (controller.signal.aborted) return;
        setCatalogStars([]);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ra, dec, size, searchStatus, imageA]);

  useEffect(() => {
    const query = targetName.trim();
    if (query.length < 2) {
      setNameSuggestions({ objects: [], articles: [] });
      setSuggestionsLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const params = new URLSearchParams({ q: query });
        const objectsResponse = await fetch(`/api/resolver/suggest?${params}`, { signal: controller.signal });
        const objectsData = await objectsResponse.json();
        setNameSuggestions((current) => ({ ...current, objects: objectsData.objects ?? [] }));
        const articleParams = new URLSearchParams({ q: query, kind: "articles" });
        const articleResponse = await fetch(`/api/resolver/suggest?${articleParams}`, { signal: controller.signal });
        const articleData = await articleResponse.json();
        setNameSuggestions((current) => ({ ...current, articles: articleData.articles ?? [] }));
      } catch {
        if (!controller.signal.aborted) setNameSuggestions({ objects: [], articles: [] });
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [targetName]);

  const fetchCutout = useCallback(
    async (
      obs: ObservationRecord,
      customRa?: number,
      customDec?: number,
      customSize?: number
    ) => {
      setLoadingCutouts((current) => new Set(current).add(obs.id));
      setCutoutError(null);

      const cRa = customRa ?? parseFloat(ra);
      const cDec = customDec ?? parseFloat(dec);
      const cSize = customSize ?? parseFloat(size);

      try {
        const q = new URLSearchParams({
          id: obs.id,
          ra: String(cRa),
          dec: String(cDec),
          size: String(cSize),
        });

        const res = await fetch(`/api/spherex/cutout?${q.toString()}`);
        const data: ApiCutoutResponse = await res.json();

        if (!data.success) {
          setCutoutError(`${data.error} (${data.code})`);
        } else {
          const pixels = new Uint8ClampedArray(data.imageData.pixels as unknown as number[]);
          const fitsData: FitsImageData = {
            ...data.imageData,
            pixels,
          };
          setSelectedObsA(obs);
          setImageA(fitsData);
        }
      } catch {
        setCutoutError("Failed to download or decode FITS cutout from server.");
      } finally {
        setLoadingCutouts((current) => {
          const next = new Set(current);
          next.delete(obs.id);
          return next;
        });
      }
    },
    [ra, dec, size]
  );

  const handleSearch = useCallback(
    async (searchRa: string, searchDec: string, searchSize: string) => {
      const valRa = validateRA(searchRa);
      if (!valRa.valid) {
        setSearchStatus("error");
        setSearchError(valRa.error || "Invalid RA");
        return;
      }
      const valDec = validateDec(searchDec);
      if (!valDec.valid) {
        setSearchStatus("error");
        setSearchError(valDec.error || "Invalid Dec");
        return;
      }
      const valSize = validateSize(searchSize);
      if (!valSize.valid) {
        setSearchStatus("error");
        setSearchError(valSize.error || "Invalid size");
        return;
      }

      setSearchStatus("searching");
      setSearchError("");
      setCutoutError(null);
      setRecords([]);
      setSelectedObsA(null);
      setImageA(null);

      try {
        const q = new URLSearchParams({
          ra: searchRa,
          dec: searchDec,
          size: searchSize,
        });
        const res = await fetch(`/api/spherex/search?${q.toString()}`);
        const data: ApiSearchResponse = await res.json();

        if (!data.success) {
          setSearchStatus("error");
          setSearchError(data.error);
          setRecords([]);
        } else {
          const sr = data as SearchResponse;
          setSearchStatus("done");
          setRecords(sr.records);
          if (sr.records.length > 0) {
            fetchCutout(sr.records[0], parseFloat(searchRa), parseFloat(searchDec), parseFloat(searchSize));
          }
        }
      } catch {
        setSearchStatus("error");
        setSearchError("Network failure connecting to archive API service.");
      }
    },
    [fetchCutout]
  );

  async function searchByName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSearchStatus("searching");
    setSearchError("");
    try {
      let res = await fetch(`/api/resolver?name=${encodeURIComponent(trimmed)}`);
      let result = await res.json();
      if (!res.ok || !result.success) {
        const suggestionResponse = await fetch(`/api/resolver/suggest?q=${encodeURIComponent(trimmed)}`);
        const suggestionResult = await suggestionResponse.json();
        const closest = suggestionResult.objects?.[0]?.name;
        if (!closest || closest.toLowerCase() === trimmed.toLowerCase()) {
          throw new Error(result.error || "No close object-name match. Choose a suggestion or try a shorter name.");
        }
        setTargetName(closest);
        res = await fetch(`/api/resolver?name=${encodeURIComponent(closest)}`);
        result = await res.json();
        if (!res.ok || !result.success) throw new Error(`Closest match: ${closest}. ${result.error || "Could not resolve its coordinates."}`);
      }
      const resolvedRa = String(result.ra);
      const resolvedDec = String(result.dec);
      setTargetName(result.name || trimmed);
      setRa(resolvedRa);
      setDec(resolvedDec);
      await handleSearch(resolvedRa, resolvedDec, size);
    } catch (err) {
      setSearchStatus("error");
      setSearchError(err instanceof Error ? err.message : "Name lookup failed. Try an astronomical object name or coordinates.");
    }
  }

  // Read URL query parameters on initial mount
  const hasSearchedRef = React.useRef(false);
  useEffect(() => {
    if (hasSearchedRef.current) return;
    const qRa = searchParams.get("ra");
    const qDec = searchParams.get("dec");
    const qSize = searchParams.get("size");
    const qTarget = searchParams.get("target");

    if (qRa && qDec) {
      hasSearchedRef.current = true;
      setRa(qRa);
      setDec(qDec);
      if (qSize) setSize(qSize);
      if (qTarget) setTargetName(qTarget);
      if (qTarget) setQueryMode("object");
      const timer = setTimeout(() => {
        handleSearch(qRa, qDec, qSize || String(CUTOUT_SIZE_DEFAULT));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, handleSearch]);

  function loadDemoData() {
    setCutoutError(null);
    setSearchError("");

    const demoObsA: ObservationRecord = {
      id: "demo-1",
      collection: "spherex_qr2_demo",
      obsId: "DEMO_EPOCH_1",
      dateObs: "2024-03-15T12:00:00Z",
      mjd: 60384.5,
      emMin: 0.75e-6,
      emMax: 1.1e-6,
      bandpassName: "Band 1 (0.75-1.1 μm)",
      fov: 0.05,
      ra: parseFloat(ra) || 83.8221,
      dec: parseFloat(dec) || -5.3911,
      instrument: "SPHEREx Imager",
      facility: "SPHEREx",
      calibLevel: 2,
      description: "Synthetic test cutout mimicking Orion candidate epoch 1",
    };

    setRecords([demoObsA]);
    setSelectedObsA(demoObsA);
    setImageA(generateDemoImage(256, 256));
    setSearchStatus("done");
    setSearchError("Showing synthetic demo imagery only. It is not real SPHEREx data.");
  }

  function applyPreset(target: (typeof FEATURED_TARGETS)[0]) {
    setRa(String(target.ra));
    setDec(String(target.dec));
    setTargetName(target.name);
    setQueryMode("object");
    handleSearch(String(target.ra), String(target.dec), size);
  }

  return (
    <div id="spectral-search" className="wireframe-content flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="tech-label" style={{ color: "var(--accent)" }}>
              OBSERVATION WORKSPACE
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--border-subtle)] text-[var(--text-muted)]">
              IRSA SIA v2 Connected
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            {targetName ? `${targetName} — SPHEREx observations` : "SPHEREx Interactive Sky Explorer"}
          </h1>
        </div>

      </div>

      <SkyRoam
        ra={ra}
        dec={dec}
        size={size}
        onSearch={handleSearch}
        searching={searchStatus === "searching"}
      />

      {/* Main Grid: Left Controls (320px) + Right Viewer */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Controls Column */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-5">
          <div
            className="p-4 rounded-xl border space-y-4"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (queryMode === "object" && targetName.trim()) {
                  setSuggestionsOpen(false);
                  void searchByName(targetName);
                } else {
                  handleSearch(ra, dec, size);
                }
              }}
              className="space-y-3"
            >
      <div className="space-y-2 border-b border-[var(--border-subtle)] pb-4">
                <label htmlFor="target-name" className="tech-label block" style={{ color: "var(--accent)" }}>SEARCH BY OBJECT NAME</label>
                <div className="relative" ref={suggestionsRef}>
                  <div className="flex gap-2">
                    <input id="target-name" type="search" value={targetName} onFocus={() => setSuggestionsOpen(true)} onChange={(e) => { setTargetName(e.target.value); setQueryMode("object"); setSuggestionsOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSuggestionsOpen(false); }} placeholder="Try Andromeda, a star, nebula, planet…" className="min-w-0 flex-1 px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} aria-autocomplete="list" aria-controls="object-suggestions" />
                  </div>
                  {suggestionsOpen && (shortNameQuery || nameSuggestions.objects.length > 0 || nameSuggestions.articles.length > 0 || suggestionsLoading) && (
                    <div id="object-suggestions" role="listbox" className="absolute z-30 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto overscroll-contain rounded-lg border shadow-xl" style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}>
                      {objectOptions.length > 0 && <p className="px-3 pt-2 tech-label" style={{ color: "var(--accent)" }}>{shortNameQuery ? "RECOMMENDED SEARCHES" : "OBJECT MATCHES"}</p>}
                      {objectOptions.map((item) => (
                        <button key={item.name} type="button" role="option" aria-selected="false" onClick={() => { setTargetName(item.name); setQueryMode("object"); setSuggestionsOpen(false); }} className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5">{item.name}<span className="ml-2 text-xs text-slate-500">Select object</span></button>
                      ))}
                      {suggestionsLoading && <p className="px-3 py-2 text-xs text-slate-400">Finding related NASA results…</p>}
                      {nameSuggestions.articles.map((item) => (
                        <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block border-t px-3 py-2 hover:bg-white/5" style={{ borderColor: "var(--border-subtle)" }}>
                          <span className="block text-xs font-medium text-slate-100">{item.title}</span>
                          <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{item.description.slice(0, 150)}{item.description.length > 150 ? "…" : ""}</span>
                          <span className="mt-1 block text-[10px] text-sky-300">NASA image library ↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-dim)]">Type a rough name and choose an object match. Then click Search Archives.</p>
              </div>
              <p className="tech-label" style={{ color: "var(--accent)" }}>COORDINATE SEARCH</p>
              <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">Right ascension (RA) is like longitude in the sky; declination (Dec) is like latitude. Together they pinpoint a place among the stars.</p>

              <div>
                <label htmlFor="coordinate-pair" className="tech-label block mb-1">PASTE BOTH COORDINATES</label>
                <div className="flex gap-2">
                  <input
                    id="coordinate-pair"
                    type="text"
                    inputMode="decimal"
                    placeholder="RA, Dec  e.g. 83.8221, -5.3911"
                    value={coordinatePair}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCoordinatePair(value);
                      setQueryMode("coordinates");
                      const pair = parseCoordinateInput(value);
                      if (pair) {
                        setRa(String(pair.ra));
                        setDec(String(pair.dec));
                      }
                    }}
                    className="min-w-0 flex-1 px-3 py-2 rounded-lg text-sm border font-mono"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">Enter RA and Dec separated by a comma or space, then click Search Archives.</p>
              </div>

              <div>
                <label htmlFor="exp-ra" className="tech-label block mb-1">
                  RIGHT ASCENSION · SKY LONGITUDE (0–360°)
                </label>
                <input
                  id="exp-ra"
                  type="number"
                  step="any"
                  min="0"
                  max="360"
                  value={ra}
                  onChange={(e) => { setRa(e.target.value); setQueryMode("coordinates"); }}
                  className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                  style={{
                    background: "var(--bg-primary)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                  required
                />
              </div>

              <div>
                <label htmlFor="exp-dec" className="tech-label block mb-1">
                  DECLINATION · SKY LATITUDE (−90–90°)
                </label>
                <input
                  id="exp-dec"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={dec}
                  onChange={(e) => { setDec(e.target.value); setQueryMode("coordinates"); }}
                  className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                  style={{
                    background: "var(--bg-primary)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                  required
                />
              </div>

              <div>
                <label htmlFor="exp-size" className="tech-label block mb-1">
                  IMAGE AREA — FOR OBJECT AND COORDINATE SEARCHES
                </label>
                <input
                  id="exp-size"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="2"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
                />
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {[
                    { label: "Close", value: "0.05" },
                    { label: "Small", value: "0.1" },
                    { label: "Wide", value: "0.5" },
                    { label: "Extra wide", value: "2" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSize(option.value)}
                      className={`rounded-md border px-1 py-1.5 text-[10px] ${size === option.value ? "border-[var(--accent)] text-white" : "border-[var(--border-subtle)] text-[var(--text-muted)]"}`}
                      title={`${option.value} degrees`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-dim)]">Smaller is closer; larger shows more sky. The same size is used whichever search method you choose.</p>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="submit"
                  disabled={searchStatus === "searching"}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
                >
                  {searchStatus === "searching" ? "Querying IRSA…" : "Search Archives"}
                </button>
              </div>
            </form>

            {/* Quick Target Chips */}
            <div>
              <p className="tech-label mb-2" style={{ color: "var(--text-dim)" }}>
                FEATURED TARGETS
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FEATURED_TARGETS.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => applyPreset(t)}
                    className="px-2 py-1 rounded text-xs border transition-all hover:border-[var(--accent)] hover:text-white"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Errors & Fallback */}
            {searchStatus === "error" && (
              <div
                className="p-3 rounded-lg border text-xs space-y-2"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                }}
              >
                <p className="font-semibold">{searchError.startsWith("No matching SPHEREx images") ? "No observations found at this position" : "Could not complete the archive search"}</p>
                <p className="leading-relaxed">{searchError}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSearch(ra, dec, size)}
                    className="underline text-white font-medium hover:text-[var(--accent)]"
                  >
                    Retry search
                  </button>
                  <span>·</span>
                  <button
                    onClick={loadDemoData}
                    className="underline text-[#fbbf24] font-medium"
                  >
                    View sample image
                  </button>
                </div>
              </div>
            )}

            {cutoutError && (
              <div
                className="p-3 rounded-lg border text-xs space-y-2"
                style={{
                  background: "rgba(234, 179, 8, 0.08)",
                  borderColor: "rgba(234, 179, 8, 0.3)",
                  color: "#fbbf24",
                }}
              >
                <p className="font-semibold">Cutout Service Alert:</p>
                <p className="leading-relaxed">{cutoutError}</p>
                <button
                  onClick={loadDemoData}
                  className="underline text-white font-medium"
                >
                  Load synthetic demo data
                </button>
              </div>
            )}
          </div>

          {/* Observations List */}
          <div
            className="p-4 rounded-xl border space-y-3"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center justify-between">
              <p className="tech-label" style={{ color: "var(--accent)" }}>
                AVAILABLE OBSERVATIONS
              </p>
              <span className="text-xs text-[var(--text-dim)] font-mono">
                {records.length} found
              </span>
            </div>

            {records.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--text-dim)]">
                {searchStatus === "searching" ? (
                  <p>Searching NASA/Caltech IRSA...</p>
                ) : (
                  <p>No observations loaded. Run a coordinate search or click a featured target.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {records.map((r) => {
                  const isA = selectedObsA?.id === r.id;
                  const isLoading = loadingCutouts.has(r.id);

                  return (
                    <div
                      key={r.id}
                      className={`p-2.5 rounded-lg border text-xs transition-all ${
                        isA
                          ? "border-[var(--accent)] bg-[rgba(130,205,247,0.08)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--text-dim)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-semibold text-white">
                          {r.dateObs ? r.dateObs.slice(0, 10) : "Observation"}
                        </span>
                        {isA && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent)] text-[var(--bg-primary)] font-bold">
                            Loaded
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--text-muted)] truncate mb-2">
                        {r.collection} · {r.bandpassName || "Standard Band"}
                      </p>
                      <button
                        onClick={() => fetchCutout(r)}
                        disabled={isLoading}
                        className="w-full py-1 rounded border border-[var(--border-subtle)] text-[10px] uppercase font-mono hover:bg-[var(--border-subtle)] text-white"
                      >
                        {isLoading ? "Loading…" : "View observation"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Viewer & Analysis Column */}
        <div className="flex-1 w-full space-y-6 min-w-0">
          <div className="space-y-4">
            <div
              className="p-4 rounded-xl border flex flex-col"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">Primary Science Viewer</h2>
                  <p className="tech-label" style={{ color: "var(--text-dim)" }}>
                    FITS CUTOUT DISPLAY
                  </p>
                </div>
                {imageA?.isDemo && (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Demo Fallback
                  </span>
                )}
              </div>

              <SkyViewer
                imageData={imageA}
                observation={selectedObsA}
                label={selectedObsA?.obsId || (imageA ? "Observation" : undefined)}
                catalogStars={catalogStars}
                catalogCenter={selectedObsA ? { ra: Number(ra), dec: Number(dec) } : null}
                catalogFieldSize={Number(size)}
                onSelectStar={setSelectedStar}
                className="min-h-[460px]"
              />
              {selectedStar && (
                <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/5 p-3 text-xs text-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-amber-200">Gaia DR3 star · {selectedStar.sourceId}</p>
                      <p className="mt-1">RA {selectedStar.ra.toFixed(6)}° · Dec {selectedStar.dec.toFixed(6)}° · G magnitude {selectedStar.magnitude?.toFixed(2) ?? "unknown"}</p>
                      <p className="mt-1 text-slate-400">Parallax {selectedStar.parallax != null && selectedStar.parallax > 0 ? `${selectedStar.parallax.toFixed(3)} mas` : "not available"}. This is a catalog position, not a confirmed SPHEREx detection.</p>
                    </div>
                    <button type="button" onClick={() => setSelectedStar(null)} className="text-slate-400 hover:text-white" aria-label="Close star details">Close</button>
                  </div>
                </div>
              )}
            </div>

            {/* Provenance and Info Card */}
            <div
              className="p-4 rounded-xl border text-xs grid grid-cols-1 sm:grid-cols-3 gap-4"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
            >
              <div>
                <span className="tech-label block mb-1">ARCHIVE DATA PROVENANCE</span>
                <p className="text-white">NASA / IPAC Infrared Science Archive (IRSA)</p>
                <p className="text-[var(--text-muted)]">Mission: SPHEREx All-Sky Survey</p>
              </div>
              <div>
                <span className="tech-label block mb-1">PIXEL CALIBRATION NOTICE</span>
                <p className="text-white">Visual Stretch: ASINH (2%–98% percentile)</p>
                <p className="text-[var(--text-muted)]">
                  Raw values mapped to normalized brightness.
                </p>
              </div>
              <div>
                <span className="tech-label block mb-1">INTEGRITY & FOLLOW-UP</span>
                <p className="text-white">Requires scientific follow-up</p>
                <p className="text-[var(--text-muted)]">
                  Not natural color. Cutout generated server-side.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <div className="relative flex-1 wireframe-page">
      <AnimatedWireframe />
      <div className="relative z-10 flex flex-1 flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-12 text-sm text-[var(--text-dim)] font-mono">
              Initializing SPHEREx Explorer…
            </div>
          }
        >
          <ExploreContent />
        </Suspense>
      </div>
    </div>
  );
}
