"use client";

import { useEffect, useRef } from "react";

const DURATION = 3200;

/** Tiny curved clippings: decorative only, with no interaction or layout cost. */
export default function HairCelebration({ sequence }: { sequence: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!sequence || !canvas || motion.matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    const particles = Array.from({ length: width < 640 ? 240 : 360 }, (_, index) => {
      const left = index % 2 === 0;
      return {
        x: (left ? width * 0.12 : width * 0.88) + (Math.random() - 0.5) * 35,
        y: height * (0.65 + Math.random() * 0.1),
        vx: (left ? 1 : -1) * (45 + Math.random() * Math.min(width * 0.5, 250)),
        vy: -(height * 0.4 + Math.random() * height * 0.35),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 6,
        length: 8 + Math.random() * 24,
        curl: (Math.random() - 0.5) * 12,
        bend: (Math.random() - 0.5) * 6,
        thickness: 0.45 + Math.random() * 0.5,
        drift: 3 + Math.random() * 10,
      };
    });
    let frame = 0;
    let start: number | undefined;
    let stopped = false;
    const clear = () => ctx.clearRect(0, 0, width, height);
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      clear();
    };
    const onVisibility = () => { if (document.hidden) stop(); };
    const onMotionChange = () => { if (motion.matches) stop(); };
    const draw = (now: number) => {
      if (stopped) return;
      start ??= now;
      const elapsed = now - start;
      clear();
      if (elapsed >= DURATION) return;
      const t = elapsed / 1000;
      ctx.globalAlpha = Math.min(1, (DURATION - elapsed) / 700);
      ctx.lineCap = "round";
      for (const hair of particles) {
        ctx.save();
        ctx.translate(hair.x + hair.vx * t + Math.sin(t * 3 + hair.angle) * hair.drift, hair.y + hair.vy * t + height * 0.25 * t * t);
        ctx.rotate(hair.angle + hair.spin * t);
        ctx.fillStyle = "#050505";
        // An individual strand with an irregular curve and fine, tapered ends.
        ctx.beginPath();
        ctx.moveTo(-hair.length / 2, 0);
        ctx.bezierCurveTo(-hair.length / 6, hair.curl, hair.length / 6, hair.bend, hair.length / 2, 0);
        ctx.bezierCurveTo(hair.length / 6, hair.bend + hair.thickness, -hair.length / 6, hair.curl + hair.thickness, -hair.length / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotionChange);
    window.addEventListener("resize", stop);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", stop);
    };
  }, [sequence]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[130] h-full w-full motion-reduce:hidden" />;
}
