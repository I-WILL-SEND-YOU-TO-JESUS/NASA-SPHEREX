"use client";

type Props = {
  ra: string;
  dec: string;
  size: string;
  onSearch: (ra: string, dec: string, size: string) => void;
  searching: boolean;
};

/** In-app recorded-sky search. Archive access stays behind the app's own UI. */
export default function SkyRoam({ ra, dec, size, onSearch, searching }: Props) {
  const radiusArcmin = Math.max(1, Number(size) * 30 || 30);
  const skyMapUrl = `https://irsa.ipac.caltech.edu/applications/spherex/?api=spectral-images&ra=${encodeURIComponent(ra)}&dec=${encodeURIComponent(dec)}&sr=${encodeURIComponent(`${radiusArcmin}m`)}&spatialRegionOperation=intersects`;

  function openFullExplorer() {
    const params = new URLSearchParams({ ra, dec });
    window.location.assign(`/sky?${params.toString()}`);
  }

  return (
    <section
      className="rounded-xl border p-4 space-y-3"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
      aria-label="Recorded SPHEREx sky search"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Recorded SPHEREx sky</p>
          <h2 className="text-lg font-semibold text-white">Spectral image search</h2>
          <p className="text-xs text-slate-400">Search a sky position to load real archive images and their wavelength details.</p>
        </div>
        <button type="button" onClick={openFullExplorer} className="rounded-lg bg-sky-300 px-3 py-2 text-xs font-semibold text-slate-950">Open full explorer</button>
      </div>

      <iframe
        title="Interactive recorded SPHEREx sky map"
        src={skyMapUrl}
        className="w-full rounded-lg border-0 bg-[#050810]"
        style={{ height: "min(72vh, 760px)", minHeight: 480 }}
        allow="fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </section>
  );
}
