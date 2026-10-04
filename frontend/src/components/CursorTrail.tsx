import React, { useEffect, useRef } from 'react';

interface TrailParticle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  age: number;
  lifetime: number;
  size: number;
  hue: number;
  rotation: number;
  rotationSpeed: number;
  kind: 'spark' | 'glow';
}

const PARTICLE_LIMIT = 180;

export const CursorTrail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (!canvas || !context || !supportsHover.matches || prefersReducedMotion.matches) return;

    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let previousPoint: { x: number; y: number } | null = null;
    let particles: TrailParticle[] = [];
    let animationFrame = 0;
    let previousFrameTime = 0;

    const resizeCanvas = () => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(viewportWidth * pixelRatio);
      canvas.height = Math.round(viewportHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const drawSpark = (particle: TrailParticle, opacity: number, hue: number) => {
      const radius = particle.size * (0.35 + opacity * 0.65);
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.globalAlpha = opacity;
      context.shadowColor = `hsl(${hue} 100% 68%)`;
      context.shadowBlur = radius * 4;
      context.fillStyle = `hsl(${hue} 100% 82%)`;
      context.beginPath();

      for (let pointIndex = 0; pointIndex < 8; pointIndex += 1) {
        const angle = (Math.PI / 4) * pointIndex - Math.PI / 2;
        const pointRadius = pointIndex % 2 === 0 ? radius : radius * 0.22;
        const pointX = Math.cos(angle) * pointRadius;
        const pointY = Math.sin(angle) * pointRadius;
        if (pointIndex === 0) context.moveTo(pointX, pointY);
        else context.lineTo(pointX, pointY);
      }

      context.closePath();
      context.fill();
      context.restore();
    };

    const drawGlow = (particle: TrailParticle, opacity: number, hue: number) => {
      const radius = particle.size * 3.2;
      const glow = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
      glow.addColorStop(0, `hsla(${hue} 100% 82% / ${opacity})`);
      glow.addColorStop(0.24, `hsla(${hue} 100% 66% / ${opacity * 0.72})`);
      glow.addColorStop(1, `hsla(${hue} 100% 55% / 0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      context.fill();
    };

    const drawFrame = (frameTime: number) => {
      animationFrame = 0;
      const elapsed = Math.min(34, previousFrameTime ? frameTime - previousFrameTime : 16);
      previousFrameTime = frameTime;
      context.clearRect(0, 0, viewportWidth, viewportHeight);

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.age += elapsed;
        if (particle.age >= particle.lifetime) {
          particles.splice(index, 1);
          continue;
        }

        const progress = particle.age / particle.lifetime;
        const opacity = Math.sin(Math.PI * progress) * (1 - progress * 0.28);
        const hue = (particle.hue + particle.age * 0.045) % 360;
        particle.x += particle.velocityX * (elapsed / 16);
        particle.y += particle.velocityY * (elapsed / 16);
        particle.velocityX *= 0.985;
        particle.velocityY = particle.velocityY * 0.985 + 0.006 * (elapsed / 16);
        particle.rotation += particle.rotationSpeed * (elapsed / 16);

        if (particle.kind === 'spark') drawSpark(particle, opacity, hue);
        else drawGlow(particle, opacity, hue);
      }

      if (particles.length > 0) animationFrame = window.requestAnimationFrame(drawFrame);
      else previousFrameTime = 0;
    };

    const requestDraw = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(drawFrame);
    };

    const spawnParticle = (x: number, y: number, kind: TrailParticle['kind']) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.25 + Math.random() * 1.1;
      particles.push({
        x: x + (Math.random() - 0.5) * 5,
        y: y + (Math.random() - 0.5) * 5,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - 0.25,
        age: 0,
        lifetime: 380 + Math.random() * 520,
        size: kind === 'spark' ? 1.8 + Math.random() * 3.2 : 2 + Math.random() * 3.8,
        hue: (performance.now() * 0.055 + Math.random() * 110) % 360,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.08,
        kind
      });

      if (particles.length > PARTICLE_LIMIT) particles.splice(0, particles.length - PARTICLE_LIMIT);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const point = { x: event.clientX, y: event.clientY };

      if (!previousPoint) {
        previousPoint = point;
        return;
      }

      const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
      const steps = Math.min(18, Math.max(1, Math.ceil(distance / 6)));

      for (let step = 1; step <= steps; step += 1) {
        const fraction = step / steps;
        const x = previousPoint.x + (point.x - previousPoint.x) * fraction;
        const y = previousPoint.y + (point.y - previousPoint.y) * fraction;
        spawnParticle(x, y, 'spark');
        if (step % 2 === 0 || Math.random() > 0.76) spawnParticle(x, y, 'glow');
        if (Math.random() > 0.9) spawnParticle(x, y, 'spark');
      }

      previousPoint = point;
      requestDraw();
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) previousPoint = null;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      particles = [];
      previousPoint = null;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      context.clearRect(0, 0, viewportWidth, viewportHeight);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerout', handlePointerOut, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="cursor-trail-canvas" aria-hidden="true" />;
};