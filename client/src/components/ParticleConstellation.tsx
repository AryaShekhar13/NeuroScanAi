/**
 * Dala design reminder: the constellation is a living field of outlined, chromatic triangles
 * suspended over a pure-black editorial stage; motion must remain slow, quiet, and optional.
 */
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  size: number;
  alpha: number;
  color: string;
  cluster: boolean;
};

const colors = ["#8052ff", "#ffb829", "#15846e", "#ea4fff", "#4285ff", "#ffffff"];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeParticle(cluster: boolean): Particle {
  if (!cluster) {
    return {
      x: Math.random(),
      y: Math.random(),
      driftX: randomBetween(-0.000024, 0.000024),
      driftY: randomBetween(-0.000018, 0.000018),
      size: randomBetween(1.2, 2.8),
      alpha: randomBetween(0.14, 0.52),
      color: colors[Math.floor(Math.random() * colors.length)],
      cluster: false,
    };
  }

  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random());
  const lobeShift = Math.sin(t) > 0 ? -0.02 : 0.04;
  const x = 0.625 + lobeShift + Math.cos(t) * 0.29 * r;
  const y = 0.49 + Math.sin(t) * 0.31 * r + Math.sin(t * 3) * 0.022 * r;

  return {
    x,
    y,
    driftX: randomBetween(-0.000045, 0.000045),
    driftY: randomBetween(-0.000038, 0.000038),
    size: randomBetween(1.1, 3.8),
    alpha: randomBetween(0.24, 0.88),
    color: colors[Math.floor(Math.random() * colors.length)],
    cluster: true,
  };
}

function drawTriangle(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const h = size * 1.2;
  context.beginPath();
  context.moveTo(x, y - h);
  context.lineTo(x - size, y + h * 0.72);
  context.lineTo(x + size, y + h * 0.72);
  context.closePath();
  context.stroke();
}

export default function ParticleConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles = [
      ...Array.from({ length: 540 }, () => makeParticle(true)),
      ...Array.from({ length: 84 }, () => makeParticle(false)),
    ];
    const pointer = { x: 0.65, y: 0.5 };
    let frame = 0;
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const render = () => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 0.7;

      particles.forEach((particle, index) => {
        if (!reduceMotion) {
          particle.x += particle.driftX;
          particle.y += particle.driftY;
          if (particle.cluster) {
            particle.x += Math.sin(frame * 0.00052 + index) * 0.000018;
            particle.y += Math.cos(frame * 0.00044 + index * 0.7) * 0.000012;
          }
        }

        if (!particle.cluster) {
          if (particle.x < -0.02) particle.x = 1.02;
          if (particle.x > 1.02) particle.x = -0.02;
          if (particle.y < -0.02) particle.y = 1.02;
          if (particle.y > 1.02) particle.y = -0.02;
        }

        const parallax = particle.cluster ? 0.016 : 0.006;
        const x = (particle.x + (pointer.x - 0.5) * parallax) * width;
        const y = (particle.y + (pointer.y - 0.5) * parallax) * height;
        context.globalAlpha = particle.alpha * (particle.cluster ? 1 : 0.75);
        context.strokeStyle = particle.color;
        drawTriangle(context, x, y, particle.size);
      });

      context.globalAlpha = 1;
      frame += 1;
      if (!reduceMotion) animationFrame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - bounds.left) / bounds.width;
      pointer.y = (event.clientY - bounds.top) / bounds.height;
    };

    resize();
    render();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointerMove);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation-canvas" aria-hidden="true" />;
}
