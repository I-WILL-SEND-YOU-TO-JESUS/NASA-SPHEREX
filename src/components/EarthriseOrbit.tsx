"use client";

import { useEffect, useRef } from "react";

export default function EarthriseOrbit() {
  const satelliteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const satellite = satelliteRef.current;
    if (!satellite) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const updatePosition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (reducedMotion.matches) {
          satellite.style.setProperty("--satellite-travel", "0px");
          return;
        }

        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
        satellite.style.setProperty(
          "--satellite-travel",
          `${Math.round(progress * window.innerHeight * 0.48)}px`
        );
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);
    reducedMotion.addEventListener("change", updatePosition);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
      reducedMotion.removeEventListener("change", updatePosition);
    };
  }, []);

  return (
    <>
      <div className="earthrise-stage" aria-hidden="true">
        <div className="earthrise-globe">
          <svg viewBox="0 0 700 700" role="presentation">
            <defs>
              <radialGradient id="earth-ocean" cx="36%" cy="28%" r="72%">
                <stop offset="0" stopColor="#247db6" />
                <stop offset="0.46" stopColor="#10517f" />
                <stop offset="0.78" stopColor="#092c50" />
                <stop offset="1" stopColor="#020914" />
              </radialGradient>
              <linearGradient id="earth-night" x1="0" y1="0.2" x2="1" y2="0.5">
                <stop offset="0" stopColor="#020711" stopOpacity="0.88" />
                <stop offset="0.5" stopColor="#071b30" stopOpacity="0.5" />
                <stop offset="1" stopColor="#102e49" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="earth-land" x1="0" y1="0" x2="0.8" y2="1">
                <stop offset="0" stopColor="#7f9c88" />
                <stop offset="1" stopColor="#315c56" />
              </linearGradient>
              <radialGradient id="earth-atmosphere">
                <stop offset="0.91" stopColor="#7dd7ff" stopOpacity="0" />
                <stop offset="0.97" stopColor="#69caff" stopOpacity="0.24" />
                <stop offset="1" stopColor="#d4f4ff" stopOpacity="0.94" />
              </radialGradient>
              <linearGradient id="earth-horizon-light" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#55bbff" stopOpacity="0" />
                <stop offset="0.48" stopColor="#b9ebff" stopOpacity="0.9" />
                <stop offset="1" stopColor="#55bbff" stopOpacity="0" />
              </linearGradient>
              <clipPath id="earth-disc">
                <circle cx="350" cy="350" r="320" />
              </clipPath>
              <filter id="earth-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="18" />
              </filter>
            </defs>

            <circle cx="350" cy="350" r="344" fill="#4ebcff" opacity="0.2" filter="url(#earth-glow)" />
            <circle cx="350" cy="350" r="320" fill="url(#earth-ocean)" />
            <g clipPath="url(#earth-disc)">
              <path
                d="M92 244 120 211l31-10 18-26 37 5 16 20 31-8 27 18-7 22 23 21-12 25-34 3-10 24-30 7-15 26-27-5-18-25-34-3-15-28-35-4-8-25-24-4Zm96 91 23 4 15 19-13 13-23-7-12-16Zm107-195 17-18 28 4 12 17-22 12-25-4Zm35 87 21-26 42 1 19-15 39 12 27-4 29 29-14 23-33 3-13 25-31 4-15 24-29 4-17-23-22-8-9-25-25-2Zm47 110 30-14 38 9 19 19-9 41-20 34-22 17-23-14-3-34-21-19Zm94-45 28-15 24 12-4 22-31 12-18-13Zm-18-179 23-20 34 8 22 20-17 14-36-5Z"
                fill="url(#earth-land)"
                opacity="0.9"
              />
              <g fill="none" stroke="#d9f3ff" strokeLinecap="round">
                <path d="M58 257c62-43 119-50 171-19 45 27 83 24 123-2 48-31 101-37 158-16 38 14 79 10 123-10" strokeWidth="13" opacity="0.11" />
                <path d="M47 278c64-34 117-36 160-9 49 31 91 34 138 8 52-29 102-32 149-13 47 19 89 17 133-3" strokeWidth="6" opacity="0.18" />
                <path d="M77 374c52-25 104-29 155-8 48 19 92 16 132-10 52-34 107-40 164-17 35 14 70 14 107 1" strokeWidth="11" opacity="0.1" />
                <path d="M112 398c51-19 94-16 131 4 48 26 92 23 140-8 48-31 94-33 139-13 40 18 76 20 111 6" strokeWidth="5" opacity="0.17" />
                <path d="M146 175c40 27 58 60 53 100-4 36 11 67 44 91" strokeWidth="8" opacity="0.12" />
                <path d="M464 124c-30 33-40 66-28 98 12 31 11 60-3 88" strokeWidth="9" opacity="0.12" />
              </g>
              <g fill="#ffd88a" opacity="0.84">
                <circle cx="226" cy="275" r="3" /><circle cx="247" cy="282" r="2.4" /><circle cx="219" cy="293" r="2" />
                <circle cx="236" cy="265" r="1.7" /><circle cx="258" cy="274" r="1.6" /><circle cx="251" cy="296" r="1.8" />
                <circle cx="287" cy="349" r="2.5" /><circle cx="296" cy="359" r="2" /><circle cx="275" cy="366" r="2.2" />
                <circle cx="281" cy="339" r="1.5" /><circle cx="305" cy="353" r="1.7" /><circle cx="285" cy="376" r="1.4" />
                <circle cx="353" cy="259" r="2.4" /><circle cx="365" cy="266" r="2" /><circle cx="343" cy="273" r="1.8" />
                <circle cx="381" cy="251" r="1.8" /><circle cx="392" cy="260" r="1.5" /><circle cx="370" cy="280" r="1.4" />
                <circle cx="425" cy="285" r="2" /><circle cx="439" cy="293" r="1.5" /><circle cx="414" cy="300" r="1.4" />
                <circle cx="328" cy="237" r="1.6" /><circle cx="335" cy="247" r="1.3" /><circle cx="349" cy="243" r="1.4" />
              </g>
              <g fill="#fff0bd" opacity="0.72">
                <circle cx="229" cy="276" r="1.2" /><circle cx="289" cy="351" r="1.1" /><circle cx="355" cy="261" r="1.1" />
                <circle cx="384" cy="253" r="1" /><circle cx="428" cy="286" r="1" /><circle cx="337" cy="239" r="0.9" />
              </g>
              <rect x="25" y="25" width="650" height="650" fill="url(#earth-night)" />
            </g>
            <circle cx="350" cy="350" r="320" fill="url(#earth-atmosphere)" />
            <path d="M31 350a319 319 0 0 1 638 0" fill="none" stroke="url(#earth-horizon-light)" strokeWidth="3" opacity="0.55" />
          </svg>
        </div>
        <div className="earthrise-stars earthrise-stars-one" />
        <div className="earthrise-stars earthrise-stars-two" />
        <div className="earthrise-horizon" />
      </div>

      <div ref={satelliteRef} className="home-satellite" aria-hidden="true">
        <svg viewBox="0 0 240 390" role="presentation">
          <defs>
            <linearGradient id="scan-beam" x1="0" y1="0" x2="0.28" y2="1">
              <stop offset="0" stopColor="#b8edff" stopOpacity="0.28" />
              <stop offset="0.42" stopColor="#80cfff" stopOpacity="0.1" />
              <stop offset="1" stopColor="#77caff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="solar-panel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#306e9d" />
              <stop offset="1" stopColor="#102b4b" />
            </linearGradient>
            <linearGradient id="satellite-body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f0f5ec" />
              <stop offset="0.5" stopColor="#9da9aa" />
              <stop offset="1" stopColor="#4d6372" />
            </linearGradient>
            <filter id="beam-soften"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          <path d="M119 93 19 380h210L121 93Z" fill="url(#scan-beam)" />
          <path d="M120 96 42 350M122 96l69 254" fill="none" stroke="#a9e6ff" strokeWidth="1.5" opacity="0.23" filter="url(#beam-soften)" />
          <ellipse cx="135" cy="321" rx="44" ry="9" fill="#8edaff" opacity="0.13" filter="url(#beam-soften)" />
          <g className="satellite-drift" strokeLinejoin="round">
            <path d="M69 56h-51v46h51m102-46h51v46h-51" fill="url(#solar-panel)" stroke="#78b8e3" strokeWidth="2" />
            <path d="M31 57v44m18-44v44m18-44v44m111-44v44m18-44v44m18-44v44" stroke="#9dd5f6" strokeWidth="1" opacity="0.62" />
            <path d="M18 70h51m102 0h51M18 85h51m102 0h51" stroke="#75b7e2" strokeWidth="1" opacity="0.6" />
            <path d="m103 44 17-19 17 19v60h-34Z" fill="url(#satellite-body)" stroke="#dbe9e9" strokeWidth="2" />
            <path d="m99 52 21-8 21 8v33h-42Z" fill="#243a4e" stroke="#9cb7c5" strokeWidth="2" />
            <circle cx="120" cy="69" r="10" fill="#071523" stroke="#a4ecff" strokeWidth="3" />
            <circle cx="120" cy="69" r="4" fill="#b9f2ff" />
            <path d="M108 104h24l8 14-20 13-20-13Z" fill="url(#satellite-body)" stroke="#dce7e2" strokeWidth="2" />
            <path d="M120 131v10m-12-2h24" fill="none" stroke="#d9e7e6" strokeWidth="2" />
            <path d="M107 42 91 31m42 11 17-12" stroke="#d5e4e4" strokeWidth="2" />
            <circle cx="91" cy="31" r="3" fill="#a8e5ff" />
            <circle cx="150" cy="29" r="3" fill="#a8e5ff" />
          </g>
        </svg>
      </div>
    </>
  );
}
