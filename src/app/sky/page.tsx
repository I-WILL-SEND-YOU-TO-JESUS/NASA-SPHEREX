"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SkyMap() {
  const router = useRouter();
  const params = useSearchParams();
  const ra = params.get("ra") || "83.8221";
  const dec = params.get("dec") || "-5.3911";
  const mapUrl = `https://irsa.ipac.caltech.edu/applications/spherex/?api=spectral-images&ra=${encodeURIComponent(ra)}&dec=${encodeURIComponent(dec)}&sr=30m&spatialRegionOperation=intersects`;

  return (
    <main className="fixed inset-0 z-[100] flex flex-col bg-[#050810]" aria-label="Full-screen SPHEREx sky map">
      <iframe
        title="Interactive SPHEREx sky map"
        src={mapUrl}
        className="min-h-0 w-full flex-1 border-0 bg-[#050810]"
        allow="fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <button
        type="button"
        onClick={() => router.push(`/explore?ra=${encodeURIComponent(ra)}&dec=${encodeURIComponent(dec)}`)}
        className="fixed right-3 top-3 z-[101] rounded-md border border-slate-600 bg-slate-950/90 px-3 py-2 text-xs font-medium text-white shadow-lg"
      >
        ← Back to app
      </button>
    </main>
  );
}

export default function SkyPage() {
  return <Suspense fallback={<main className="fixed inset-0 bg-[#050810]" />}><SkyMap /></Suspense>;
}
