"use client";

import React, { useState } from "react";
import Link from "next/link";
import AnimatedWireframe from "@/components/AnimatedWireframe";

const STEPS = [
  {
    step: "01",
    tab: "Infrared light",
    tag: "LIGHT WE CANNOT SEE",
    title: "Infrared helps reveal hidden objects",
    summary: "Space gives off many kinds of light. Infrared is one kind that our eyes cannot see, so telescopes use special detectors to record it.",
    details: [
      "Clouds of dust can hide stars from ordinary visible-light cameras. Some infrared light can pass through the dust more easily, helping astronomers study what is behind it.",
      "Infrared observations can also reveal cool stars, dust, and galaxies far away.",
    ],
    highlight: "Infrared gives astronomers another way to study objects hidden by dust.",
  },
  {
    step: "02",
    tab: "102 colors",
    tag: "A SKY MAP IN MANY WAVELENGTHS",
    title: "What SPHEREx means by 102 colors",
    summary: "SPHEREx observes infrared light in 102 wavelength bands. Each band is a small slice of the infrared range.",
    details: [
      "These are not 102 colors that people can see. They are measurements of infrared light at different wavelengths.",
      "Together, the measurements help scientists learn about stars, galaxies, dust, and some of the materials found in space.",
    ],
    highlight: "More wavelength bands give scientists more information than one ordinary picture can.",
  },
  {
    step: "03",
    tab: "Repeat scans",
    tag: "LOOKING AGAIN OVER TIME",
    title: "Comparing the sky at different times",
    summary: "SPHEREx scans the sky again and again. Comparing observations can help scientists spot objects that moved or changed in brightness.",
    details: [
      "A nearby object can appear in a slightly different position on a later scan.",
      "Some stars naturally brighten and dim over time. Comparing observations can help find possible changes, but it does not explain them by itself.",
    ],
    highlight: "Repeat observations let scientists compare how the sky looks at different times.",
  },
  {
    step: "04",
    tab: "Check results",
    tag: "CHECK BEFORE YOU CONCLUDE",
    title: "A difference is a clue, not a discovery",
    summary: "Two images can look different for reasons besides a changing space object. Scientists check carefully before deciding what happened.",
    details: [
      "Image noise, a detector glitch, or a small change in how the telescope was pointed can make images look different.",
      "Scientists compare the data with other observations and known object records before calling something a real change.",
    ],
    highlight: "Treat a surprising difference as something to investigate, not a confirmed discovery.",
  },
];

export default function TourPage() {
  const [activeStep, setActiveStep] = useState(0);

  const cur = STEPS[activeStep];

  return (
    <div className="relative flex-1 wireframe-page">
      <AnimatedWireframe />
      <div className="relative z-10 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-8">
      {/* Eyebrow and Title */}
      <div className="text-center space-y-2">
        <p className="tech-label" style={{ color: "var(--accent)" }}>
          QUICK BEGINNER TOUR · 4 IDEAS
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          A simple guide to SPHEREx
        </h1>
        <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>
          Four short ideas to help you understand what you are seeing in the Explorer.
        </p>
      </div>

      {/* Step Selector Pills */}
      <div className="flex justify-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, idx) => (
          <button
            key={s.step}
            onClick={() => setActiveStep(idx)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 shrink-0 ${
              activeStep === idx
                ? "bg-[var(--accent)] text-[var(--bg-primary)] border-transparent"
                : "border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-card)] hover:border-[var(--accent)] hover:text-white"
            }`}
          >
            <span>{s.step}</span>
            <span className="hidden sm:inline">{s.tab}</span>
          </button>
        ))}
      </div>

      {/* Active Step Card */}
      <div
        className="p-6 sm:p-8 rounded-2xl border space-y-6"
        style={{ background: "rgba(20, 27, 45, 0.78)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
          <span className="tech-label" style={{ color: "var(--accent)" }}>
            IDEA {cur.step} / 04 · {cur.tag}
          </span>
          <span className="text-xs text-[var(--text-dim)] font-mono">
            Topic {activeStep + 1} of 4
          </span>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight">{cur.title}</h2>

        <p className="text-base font-medium leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {cur.summary}
        </p>

        <div className="space-y-3">
          {cur.details.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {paragraph}
            </p>
          ))}
        </div>

        <div
          className="p-4 rounded-xl border text-sm font-medium"
          style={{
            background: "rgba(130, 205, 247, 0.05)",
            borderColor: "rgba(130, 205, 247, 0.2)",
            color: "var(--accent)",
          }}
        >
          💡 Key Takeaway: {cur.highlight}
        </div>

        {/* Stepper Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
            disabled={activeStep === 0}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          >
            ← Previous
          </button>

          {activeStep < STEPS.length - 1 ? (
            <button
              onClick={() => setActiveStep((p) => Math.min(STEPS.length - 1, p + 1))}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--bg-primary)] hover:opacity-90"
            >
              Next idea →
            </button>
          ) : (
            <Link
              href="/explore"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent)] text-[var(--bg-primary)] hover:opacity-90"
            >
              Launch Interactive Explorer →
            </Link>
          )}
        </div>
      </div>

      {/* Final Callout to Explore */}
      <div
        className="p-6 rounded-xl border text-center space-y-3"
        style={{ background: "rgba(20, 27, 45, 0.78)", borderColor: "var(--border-subtle)" }}
      >
        <h3 className="text-lg font-semibold text-white">Ready to explore?</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">
          Search for a space object or enter sky coordinates to see available SPHEREx observations.
        </p>
        <div className="pt-2">
          <Link
            href="/explore"
            className="inline-block px-8 py-3 rounded-xl text-sm font-semibold bg-[var(--accent)] text-[var(--bg-primary)] hover:opacity-90 transition-all"
          >
            Open the Explorer
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
