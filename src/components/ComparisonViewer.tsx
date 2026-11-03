"use client";

/**
 * ComparisonViewer — side-by-side, reveal slider, blink, and difference views
 * for two SPHEREx observations.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import type { FitsImageData, ObservationRecord } from "@/lib/types";

type ViewMode = "sidebyside" | "slider" | "blink" | "difference";

interface ComparisonViewerProps {
  imageA: FitsImageData | null;
  imageB: FitsImageData | null;
  obsA?: ObservationRecord | null;
  obsB?: ObservationRecord | null;
  className?: string;
}

function toImageData(ctx: CanvasRenderingContext2D, img: FitsImageData): ImageData {
  const d = ctx.createImageData(img.width, img.height);
  for (let i = 0; i < img.pixels.length; i++) d.data[i] = img.pixels[i];
  return d;
}

function drawImageFit(ctx: CanvasRenderingContext2D, img: FitsImageData, x: number, y: number, w: number, h: number, zoom: number, pan: { x: number; y: number }) {
  const fit = Math.min(w / img.width, h / img.height) * zoom;
  const drawW = img.width * fit;
  const drawH = img.height * fit;
  drawImageToCanvas(ctx, img, x + (w - drawW) / 2 + pan.x, y + (h - drawH) / 2 + pan.y, drawW, drawH);
}

function drawImageToCanvas(
  ctx: CanvasRenderingContext2D,
  img: FitsImageData,
  destX: number,
  destY: number,
  destW: number,
  destH: number
) {
  const offscreen = document.createElement("canvas");
  offscreen.width = img.width;
  offscreen.height = img.height;
  const offCtx = offscreen.getContext("2d")!;
  offCtx.putImageData(toImageData(offCtx, img), 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, destX, destY, destW, destH);
}

function canCompare(a: FitsImageData, b: FitsImageData): { ok: boolean; reason?: string } {
  // Refuse difference view if sizes differ too much
  const ratioW = a.width / b.width;
  const ratioH = a.height / b.height;
  if (ratioW < 0.5 || ratioW > 2 || ratioH < 0.5 || ratioH > 2) {
    return {
      ok: false,
      reason: `Image dimensions differ too much (A: ${a.width}×${a.height}, B: ${b.width}×${b.height}). Difference mode requires similar pixel scales.`,
    };
  }
  return { ok: true };
}

export default function ComparisonViewer({
  imageA,
  imageB,
  obsA,
  obsB,
  className = "",
}: ComparisonViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>("sidebyside");
  const [sliderX, setSliderX] = useState(0.5); // 0–1
  const [zoomA, setZoomA] = useState(1);
  const [zoomB, setZoomB] = useState(1);
  const [panA, setPanA] = useState({ x: 0, y: 0 });
  const [panB, setPanB] = useState({ x: 0, y: 0 });
  const [syncViews, setSyncViews] = useState(true);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const blinkFrame = useRef(0); // 0 = A, 1 = B
  const blinkTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const comparisonCheck = imageA && imageB ? canCompare(imageA, imageB) : null;
  const diffWarning =
    mode === "difference" && comparisonCheck && !comparisonCheck.ok
      ? comparisonCheck.reason ?? null
      : null;
  const blinkActive = mode === "blink" && !!imageA && !!imageB;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, W, H);

    if (!imageA && !imageB) return;

    if (mode === "sidebyside") {
      if (imageA) drawImageFit(ctx, imageA, 0, 0, W / 2, H, zoomA, panA);
      if (imageB) drawImageFit(ctx, imageB, W / 2, 0, W / 2, H, zoomB, panB);
      // Divider
      ctx.strokeStyle = "rgba(130,205,247,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      // Labels
      labelCanvas(ctx, "A", 8, 20);
      labelCanvas(ctx, "B", W / 2 + 8, 20);
    } else if (mode === "slider") {
      const splitX = sliderX * W;
      if (imageA) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, H);
        ctx.clip();
        drawImageFit(ctx, imageA, 0, 0, W, H, zoomA, panA);
        ctx.restore();
      }
      if (imageB) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, W - splitX, H);
        ctx.clip();
        drawImageFit(ctx, imageB, 0, 0, W, H, zoomB, panB);
        ctx.restore();
      }
      // Slider line
      ctx.strokeStyle = "rgba(130,205,247,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, H);
      ctx.stroke();
      // Slider handle
      ctx.fillStyle = "rgba(130,205,247,0.9)";
      ctx.beginPath();
      ctx.arc(splitX, H / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      labelCanvas(ctx, "A", 8, 20);
      labelCanvas(ctx, "B", splitX + 8, 20);
    } else if (mode === "blink") {
      const img = blinkFrame.current === 0 ? imageA : imageB;
      if (img) drawImageFit(ctx, img, 0, 0, W, H, blinkFrame.current === 0 ? zoomA : zoomB, blinkFrame.current === 0 ? panA : panB);
      labelCanvas(ctx, blinkFrame.current === 0 ? "A" : "B", 8, 20);
    } else if (mode === "difference") {
      if (imageA && imageB) {
        if (comparisonCheck && !comparisonCheck.ok) {
          // Fall back to side-by-side
          drawImageFit(ctx, imageA, 0, 0, W / 2, H, zoomA, panA);
          drawImageFit(ctx, imageB, W / 2, 0, W / 2, H, zoomB, panB);
        } else {
          drawDifference(ctx, imageA, imageB, W, H);
        }
      } else if (imageA) {
        drawImageToCanvas(ctx, imageA, 0, 0, W, H);
      }
      labelCanvas(ctx, "DIFFERENCE (A−B)", 8, 20);
    }
  }, [imageA, imageB, mode, sliderX, comparisonCheck, zoomA, zoomB, panA, panB]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });
    ro.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  // Blink timer
  useEffect(() => {
    if (mode === "blink" && imageA && imageB) {
      blinkTimer.current = setInterval(() => {
        blinkFrame.current = blinkFrame.current === 0 ? 1 : 0;
        draw();
      }, 700);
    } else {
      if (blinkTimer.current) {
        clearInterval(blinkTimer.current);
        blinkTimer.current = null;
      }
    }
    return () => {
      if (blinkTimer.current) clearInterval(blinkTimer.current);
    };
  }, [mode, imageA, imageB, draw]);

  // Slider drag
  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (mode === "slider" && e.buttons === 1) {
      setSliderX(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
      return;
    }
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    if (mode === "sidebyside" && !syncViews) {
      if (e.clientX < rect.left + rect.width / 2) setPanA((p) => ({ x: p.x + dx, y: p.y + dy }));
      else setPanB((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setPanA((p) => ({ x: p.x + dx, y: p.y + dy }));
      setPanB((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.002);
    const rect = e.currentTarget.getBoundingClientRect();
    const overB = mode === "sidebyside" && !syncViews && e.clientX >= rect.left + rect.width / 2;
    if (overB) setZoomB((z) => Math.max(0.25, Math.min(12, z * factor)));
    else setZoomA((z) => Math.max(0.25, Math.min(12, z * factor)));
    if (syncViews) setZoomB((z) => Math.max(0.25, Math.min(12, z * factor)));
  }

  function resetZoom() {
    setZoomA(1); setZoomB(1); setPanA({ x: 0, y: 0 }); setPanB({ x: 0, y: 0 });
  }

  const MODES: { id: ViewMode; label: string }[] = [
    { id: "sidebyside", label: "Side-by-side" },
    { id: "slider", label: "Reveal slider" },
    { id: "blink", label: "Blink" },
    { id: "difference", label: "Difference" },
  ];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Mode selector */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Comparison mode">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              mode === id
                ? "bg-[var(--accent)] text-[var(--bg-primary)] border-transparent"
                : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent)]"
            }`}
          >
            {label}
            {id === "blink" && blinkActive && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={() => { setZoomA((z) => Math.min(12, z * 1.25)); if (syncViews) setZoomB((z) => Math.min(12, z * 1.25)); }} className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-white">＋ Zoom</button>
        <button onClick={() => { setZoomA((z) => Math.max(0.25, z / 1.25)); if (syncViews) setZoomB((z) => Math.max(0.25, z / 1.25)); }} className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-white">− Zoom</button>
        <button onClick={resetZoom} className="px-3 py-1.5 rounded border border-[var(--border-subtle)] text-white">Reset view</button>
        <label className="flex items-center gap-2 text-[var(--text-muted)]"><input type="checkbox" checked={syncViews} onChange={(e) => setSyncViews(e.target.checked)} /> Sync A/B zoom</label>
        <span className="text-[var(--text-dim)]">Scroll to zoom · drag to pan</span>
      </div>

      {/* Warning */}
      {diffWarning && (
        <div
          className="p-2 rounded text-xs border"
          style={{
            background: "rgba(234,179,8,0.08)",
            borderColor: "rgba(234,179,8,0.3)",
            color: "#fbbf24",
          }}
          role="alert"
        >
          Difference mode unavailable: {diffWarning}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border"
        style={{
          background: "#050810",
          borderColor: "var(--border-subtle)",
          minHeight: 300,
          cursor: mode === "slider" ? "col-resize" : "grab",
          touchAction: "none",
          overscrollBehavior: "contain",
        }}
        onMouseDown={(e) => { if (mode !== "slider") { dragging.current = true; lastPointer.current = { x: e.clientX, y: e.clientY }; } }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
        onWheelCapture={(e) => e.preventDefault()}
        role="img"
        aria-label="Comparison visualization"
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {!imageA && !imageB && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Select two observations to compare
            </p>
          </div>
        )}
      </div>

      {/* Obs labels */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "A", obs: obsA, img: imageA },
          { label: "B", obs: obsB, img: imageB },
        ].map(({ label, obs, img }) => (
          <div
            key={label}
            className="p-2 rounded-lg border text-xs"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
          >
            <p className="tech-label mb-1" style={{ color: "var(--accent)" }}>
              IMAGE {label}
            </p>
            {obs ? (
              <>
                <p style={{ color: "var(--text-primary)" }}>{obs.dateObs.slice(0, 10)}</p>
                <p style={{ color: "var(--text-muted)" }}>{obs.collection}</p>
              </>
            ) : img?.isDemo ? (
              <p style={{ color: "#fbbf24" }}>Demo data</p>
            ) : (
              <p style={{ color: "var(--text-dim)" }}>Not loaded</p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: "var(--text-dim)" }}>
        Difference view is an exploratory visualization only — not a validated
        scientific source-detection system. Apparent differences may be
        candidate changes requiring follow-up.
      </p>
    </div>
  );
}

function labelCanvas(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = "rgba(11,16,28,0.7)";
  const metrics = ctx.measureText(text);
  ctx.fillRect(x - 4, y - 14, metrics.width + 8, 18);
  ctx.fillStyle = "rgba(130,205,247,0.9)";
  ctx.font = "bold 11px monospace";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDifference(
  ctx: CanvasRenderingContext2D,
  imgA: FitsImageData,
  imgB: FitsImageData,
  W: number,
  H: number
) {
  // Use the smaller image dimensions to avoid out-of-bounds
  const w = Math.min(imgA.width, imgB.width);
  const h = Math.min(imgA.height, imgB.height);

  const diffData = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idxA = (y * imgA.width + x) * 4;
      const idxB = (y * imgB.width + x) * 4;
      const idxD = (y * w + x) * 4;

      const grayA = (imgA.pixels[idxA] + imgA.pixels[idxA + 1] + imgA.pixels[idxA + 2]) / 3;
      const grayB = (imgB.pixels[idxB] + imgB.pixels[idxB + 1] + imgB.pixels[idxB + 2]) / 3;
      const diff = grayA - grayB; // −255 to +255

      // Positive diff → red, negative diff → blue
      if (diff > 0) {
        diffData.data[idxD + 0] = Math.min(255, diff * 2);
        diffData.data[idxD + 1] = 0;
        diffData.data[idxD + 2] = 0;
      } else {
        diffData.data[idxD + 0] = 0;
        diffData.data[idxD + 1] = 0;
        diffData.data[idxD + 2] = Math.min(255, -diff * 2);
      }
      diffData.data[idxD + 3] = 255;
    }
  }

  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  offscreen.getContext("2d")!.putImageData(diffData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0, W, H);
}
