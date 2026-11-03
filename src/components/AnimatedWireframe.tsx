"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number; z: number; phase: number; speed: number; group: number };
type ScreenPoint = { x: number; y: number; alpha: number; radius: number };

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makePoints(): Point[] {
  const points: Point[] = [];
  const clusterCount = 34;
  for (let group = 0; group < clusterCount; group++) {
    const cx = random(-1.12, 1.12);
    const cy = random(-1.12, 1.12);
    const cz = random(-0.95, 0.95);
    const count = Math.floor(random(4, 9));
    for (let i = 0; i < count; i++) {
      points.push({
        x: Math.max(-1.22, Math.min(1.22, cx + random(-0.14, 0.14))),
        y: Math.max(-1.22, Math.min(1.22, cy + random(-0.13, 0.13))),
        z: Math.max(-0.98, Math.min(0.98, cz + random(-0.42, 0.42))),
        phase: random(0, Math.PI * 2),
        speed: random(0.18, 0.65),
        group,
      });
    }
  }
  // A few isolated points keep the field from reading as a single connected web.
  for (let i = 0; i < 72; i++) {
    points.push({
      x: random(-1.18, 1.18), y: random(-1.18, 1.18), z: random(-0.98, 0.98),
      phase: random(0, Math.PI * 2), speed: random(0.12, 0.5), group: -1,
    });
  }
  return points;
}

export default function AnimatedWireframe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const pageLayer = canvas.parentElement;
    if (!pageLayer) return;

    const points = makePoints();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      const rect = pageLayer.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(pageLayer.scrollHeight, pageLayer.clientHeight, window.innerHeight);
      canvas.style.height = `${height}px`;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
    };

    const render = (timestamp: number) => {
      const time = reducedMotion.matches ? 0 : timestamp / 1000;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      const yaw = time * 0.07;
      const pitch = Math.sin(time * 0.12) * 0.14;
      const sinYaw = Math.sin(yaw);
      const cosYaw = Math.cos(yaw);
      const sinPitch = Math.sin(pitch);
      const cosPitch = Math.cos(pitch);
      const camera = 2.8;

      const projected: ScreenPoint[] = points.map((point) => {
        const drift = reducedMotion.matches ? 0 : Math.sin(time * point.speed + point.phase) * 0.018;
        const x = point.x + drift;
        const y = point.y + Math.cos(time * point.speed * 0.8 + point.phase) * (reducedMotion.matches ? 0 : 0.018);
        const rotatedX = x * cosYaw - point.z * sinYaw;
        const rotatedZ = x * sinYaw + point.z * cosYaw;
        const rotatedY = y * cosPitch - rotatedZ * sinPitch;
        const depth = y * sinPitch + rotatedZ * cosPitch;
        const perspective = camera / (camera - depth);
        return {
          x: width / 2 + rotatedX * width * 0.56 * perspective,
          y: height / 2 + rotatedY * height * 0.56 * perspective,
          alpha: Math.max(0.1, Math.min(0.64, 0.32 + depth * 0.18)),
          radius: Math.max(0.45, Math.min(1.35, perspective * 0.7)),
        };
      });

      // Link only a few nearby points within each small cluster. Gaps between
      // clusters leave the scattered, fragment-like look from the reference.
      const linkLimit = Math.max(36, Math.min(88, Math.min(width, height) * 0.09));
      for (let i = 0; i < points.length; i++) {
        if (points[i].group < 0) continue;
        const from = projected[i];
        const neighbors: { index: number; distance: number }[] = [];
        for (let j = 0; j < points.length; j++) {
          if (j === i || points[j].group !== points[i].group) continue;
          const distance = Math.hypot(from.x - projected[j].x, from.y - projected[j].y);
          if (distance < linkLimit) neighbors.push({ index: j, distance });
        }
        neighbors.sort((a, b) => a.distance - b.distance);
        for (const neighbor of neighbors.slice(0, 2)) {
          if (neighbor.index < i) continue;
          const to = projected[neighbor.index];
          const fade = 1 - neighbor.distance / linkLimit;
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          context.strokeStyle = `rgba(240, 247, 255, ${Math.min(from.alpha, to.alpha) * (0.15 + fade * 0.36)})`;
          context.lineWidth = 0.45 + fade * 0.35;
          context.stroke();
        }
      }

      for (const point of projected) {
        if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue;
        context.beginPath();
        context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 255, 255, ${point.alpha * 0.8})`;
        context.fill();
      }
    };

    const animate = (timestamp: number) => {
      render(timestamp);
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
    };

    resize();
    if (reducedMotion.matches) render(0);
    else frame = window.requestAnimationFrame(animate);
    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion.matches) render(0);
    });
    observer.observe(pageLayer);
    window.addEventListener("resize", resize);
    const onMotionChange = () => {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches) render(0);
      else frame = window.requestAnimationFrame(animate);
    };
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-sky-art" aria-hidden="true" />;
}
