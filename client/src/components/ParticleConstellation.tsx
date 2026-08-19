/**
 * Dala's signature mark: a brain-like field of outlined triangles. The renderer intentionally
 * runs at a capped 30 FPS, low device-pixel density, and pauses off-screen to protect interaction.
 */
import { useEffect, useRef } from "react";

type Particle = {
  baseX: number;
  baseY: number;
  phase: number;
  drift: number;
  size: number;
  alpha: number;
  color: string;
  ambient: boolean;
};

const colors = ["#8052ff", "#8052ff", "#ffb829", "#15846e", "#ea4fff", "#4285ff", "#ffffff"];
const TARGET_FRAME_MS = 1000 / 30;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function inBrainShape(x: number, y: number) {
  const leftLobe = ((x + 0.16) ** 2) / 0.068 + ((y + 0.015) ** 2) / 0.095 < 1;
  const rightLobe = ((x - 0.15) ** 2) / 0.073 + ((y + 0.005) ** 2) / 0.1 < 1;
  const lowerBridge = (x ** 2) / 0.092 + ((y - 0.19) ** 2) / 0.04 < 1;
  const upperRidge = (x ** 2) / 0.12 + ((y + 0.16) ** 2) / 0.038 < 1;
  const rearStem = ((x - 0.29) ** 2) / 0.018 + ((y - 0.19) ** 2) / 0.028 < 1;
  return leftLobe || rightLobe || lowerBridge || upperRidge || rearStem;
}

function makeBrainParticle(): Particle {
  let x = 0;
  let y = 0;
  do {
    x = randomBetween(-0.36, 0.36);
    y = randomBetween(-0.33, 0.31);
  } while (!inBrainShape(x, y));

  return {
    baseX: 0.62 + x,
    baseY: 0.49 + y,
    phase: Math.random() * Math.PI * 2,
    drift: randomBetween(0.55, 1.25),
    size: randomBetween(1.2, 3.65),
    alpha: randomBetween(0.48, 0.96),
    color: colors[Math.floor(Math.random() * colors.length)],
    ambient: false,
  };
}

function makeAmbientParticle(): Particle {
  return {
    baseX: Math.random(),
    baseY: Math.random(),
    phase: Math.random() * Math.PI * 2,
    drift: randomBetween(0.3, 0.75),
    size: randomBetween(0.95, 2.25),
    alpha: randomBetween(0.12, 0.42),
    color: colors[Math.floor(Math.random() * colors.length)],
    ambient: true,
  };
}

function drawTriangle(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const height = size * 1.18;
  context.beginPath();
  context.moveTo(x, y - height);
  context.lineTo(x - size, y + height * 0.72);
  context.lineTo(x + size, y + height * 0.72);
  context.closePath();
  context.stroke();
}

export default function ParticleConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = window.matchMedia("(max-width: 700px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    const particles = [
      ...Array.from({ length: lowPower ? 360 : 700 }, makeBrainParticle),
      ...Array.from({ length: lowPower ? 30 : 58 }, makeAmbientParticle),
    ];
    const pointer = { x: 0.62, y: 0.5 };
    let frameId = 0;
    let width = 1;
    let height = 1;
    let active = true;
    let lastFrame = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.25);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const paint = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 0.86;

      particles.forEach((particle) => {
        const breath = Math.sin(time * 0.00042 * particle.drift + particle.phase);
        const wave = Math.cos(time * 0.00031 * particle.drift + particle.phase * 0.7);
        const parallax = particle.ambient ? 0.006 : 0.012;
        const drift = particle.ambient ? 0.004 : 0.009;
        const x = (particle.baseX + breath * drift + (pointer.x - 0.5) * parallax) * width;
        const y = (particle.baseY + wave * drift + (pointer.y - 0.5) * parallax) * height;
        context.globalAlpha = particle.alpha;
        context.strokeStyle = particle.color;
        drawTriangle(context, x, y, particle.size);
      });
      context.globalAlpha = 1;
    };

    const render = (time: number) => {
      if (!active) return;
      if (!reducedMotion && time - lastFrame >= TARGET_FRAME_MS) {
        paint(time);
        lastFrame = time;
      }
      frameId = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
      pointer.y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
    };
    const onVisibilityChange = () => {
      active = !document.hidden;
      if (active && !reducedMotion) {
        lastFrame = performance.now();
        frameId = window.requestAnimationFrame(render);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      active = entry?.isIntersecting ?? false;
      if (active && !reducedMotion) {
        lastFrame = performance.now();
        frameId = window.requestAnimationFrame(render);
      }
    }, { threshold: 0.05 });

    resize();
    paint(0);
    observer.observe(canvas);
    window.addEventListener("resize", resize, { passive: true });
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!reducedMotion) frameId = window.requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation-canvas" aria-hidden="true" />;
}
