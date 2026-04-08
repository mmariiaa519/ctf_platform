/**
 * @module ParticleBackground
 * @description Full-screen animated particle canvas that creates a constellation /
 * network-mesh visual effect behind all page content.
 *
 * This component renders a fixed-position <canvas> element at z-index 0 with
 * `pointer-events: none`, so it sits behind all interactive UI without blocking
 * clicks or scroll events.
 *
 * Visual effect:
 * - 55 small dots ("particles") drift slowly across the viewport.
 * - Particles within 160px of each other are connected by faint TRUST BLUE lines,
 *   creating a constellation / network-topology look that fits the cybersecurity theme.
 * - Each particle pulses with a sinusoidal glow for organic movement.
 *
 * Performance considerations:
 * - PARTICLE_COUNT is kept low (55) to avoid GPU/CPU pressure.
 * - Lines use a simple O(n^2/2) pairwise distance check — acceptable at n=55
 *   (only ~1,485 comparisons per frame).
 * - Respects `prefers-reduced-motion: reduce` — if the user's OS accessibility
 *   setting is enabled, the entire animation is skipped (canvas stays blank).
 * - On window resize, particles are re-initialized to fill the new viewport.
 *
 * Used on: Login, Register, Dashboard, and Admin pages (rendered in App.jsx).
 */

import { useRef, useEffect } from 'react';

/**
 * @constant {number} PARTICLE_COUNT
 * Total number of particles rendered on the canvas.
 * 55 balances visual density with performance on mid-range devices.
 */
const PARTICLE_COUNT = 55;

/**
 * @constant {number} MAX_DIST
 * Maximum pixel distance between two particles for a connecting line to be drawn.
 * At 160px, the constellation effect is visible without cluttering the screen.
 */
const MAX_DIST = 160;

/**
 * @constant {number} SPEED
 * Maximum velocity component (per axis) for each particle.
 * 0.25 px/frame produces very slow, ambient drift — suitable for a background
 * that should not distract from foreground content.
 */
const SPEED = 0.25;

/**
 * ParticleBackground
 * @description Renders a full-viewport animated canvas with drifting, glowing
 * particles connected by proximity lines (constellation effect).
 *
 * Uses a single `useEffect` to:
 * 1. Check the `prefers-reduced-motion` media query (bail out if reduce).
 * 2. Set up the canvas dimensions and 2D rendering context.
 * 3. Initialize the particle array with random positions, velocities, radii, and phases.
 * 4. Start the `requestAnimationFrame` loop.
 * 5. Attach a resize listener to reinitialize on viewport changes.
 * 6. Return a cleanup function that cancels the animation frame and removes the listener.
 *
 * @returns {JSX.Element} A fixed-position <canvas> element covering the entire viewport.
 */
export default function ParticleBackground() {
  /** Ref to the <canvas> DOM element for direct 2D context access. */
  const canvasRef = useRef(null);

  useEffect(() => {
    /*
     * Accessibility: check if the user prefers reduced motion.
     * If so, skip the entire animation to respect their OS setting.
     * The canvas will still render but remain blank (transparent).
     */
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    /** @type {CanvasRenderingContext2D} 2D drawing context */
    const ctx = canvas.getContext('2d');

    /**
     * Local mutable state (not React state — updated every frame):
     * - w, h: current canvas/viewport dimensions
     * - particles: array of particle objects
     * - animId: requestAnimationFrame handle for cleanup
     * - time: monotonically increasing float for sinusoidal pulse effects
     */
    let w, h, particles, animId, time = 0;

    /**
     * resize
     * Syncs the canvas width/height attributes with the current window dimensions.
     * Must be called before drawing to avoid stretched/blurry output.
     */
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    /**
     * initParticles
     * Creates the particle array with random initial properties.
     * Each particle is a plain object with:
     * - x, y: position (random within canvas bounds)
     * - vx, vy: velocity components (random between -SPEED/2 and +SPEED/2)
     * - r: radius of the core dot (0.8 to 2.6 px)
     * - phase: random offset for the sinusoidal pulse, so particles
     *   don't all glow in sync (creates organic variation)
     */
    function initParticles() {
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
        r: Math.random() * 1.8 + 0.8,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    /**
     * draw
     * Main animation loop called via requestAnimationFrame.
     * Each frame:
     * 1. Increments the global `time` counter (used for pulsing).
     * 2. Clears the entire canvas.
     * 3. Draws connecting lines between nearby particles (constellation effect).
     * 4. Draws each particle with a pulsing radial-gradient glow + solid core.
     * 5. Updates particle positions and wraps them around edges.
     * 6. Schedules the next frame.
     */
    function draw() {
      /* Advance global time — controls the speed of the sinusoidal pulse.
         0.008 per frame at ~60fps = ~0.48 per second. */
      time += 0.008;
      ctx.clearRect(0, 0, w, h);

      /*
       * --- Phase 1: Draw connecting lines (constellation mesh) ---
       * Pairwise O(n^2/2) comparison: for each unique pair (i, j) where j > i,
       * compute Euclidean distance. If within MAX_DIST, draw a line with
       * alpha proportional to proximity (closer = more opaque).
       * Color: TRUST BLUE (rgb 2, 238, 240) at very low opacity.
       */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            /* Alpha fades linearly from 0.10 (touching) to 0 (at MAX_DIST) */
            const alpha = 0.10 * (1 - dist / MAX_DIST);
            ctx.strokeStyle = `rgba(2, 238, 240, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      /*
       * --- Phase 2: Draw particles with pulsing glow ---
       * Each particle has two visual layers:
       * 1. Outer glow: a radial gradient that expands/contracts with the pulse
       * 2. Core dot: a small solid circle at the particle's base radius
       */
      for (const p of particles) {
        /*
         * Sinusoidal pulse: oscillates between 0 and 1.
         * `time * 2` controls pulse frequency; `p.phase` offsets each particle
         * so they don't all pulse in unison.
         */
        const pulse = 0.5 + 0.5 * Math.sin(time * 2 + p.phase);
        /** Glow radius expands by up to 3px at peak pulse */
        const glowR = p.r + pulse * 3;
        /** Base alpha oscillates between 0.15 and 0.27 */
        const baseAlpha = 0.15 + pulse * 0.12;

        /*
         * Outer glow: radial gradient from center (bright) to edge (transparent).
         * The gradient radius is 2.5x the glow radius for a soft falloff.
         * Uses three color stops for a smooth fadeout.
         */
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR * 2.5);
        grad.addColorStop(0, `rgba(2, 238, 240, ${baseAlpha * 0.5})`);
        grad.addColorStop(0.4, `rgba(2, 238, 240, ${baseAlpha * 0.15})`);
        grad.addColorStop(1, 'rgba(2, 238, 240, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR * 2.5, 0, Math.PI * 2);
        ctx.fill();

        /* Core dot: solid circle at the particle's base radius */
        ctx.fillStyle = `rgba(2, 238, 240, ${baseAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        /* Move particle by its velocity */
        p.x += p.vx;
        p.y += p.vy;

        /*
         * Wrap around edges with a 20px buffer zone.
         * Particles that exit one side re-enter from the opposite side,
         * so the constellation never "empties out" on any edge.
         * The 20px margin prevents visible pop-in at the viewport border.
         */
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }

      /* Schedule the next frame */
      animId = requestAnimationFrame(draw);
    }

    /* --- Initialization sequence --- */
    resize();          // Set canvas to current viewport size
    initParticles();   // Populate particle array
    draw();            // Start the animation loop

    /*
     * Resize handler: on viewport change, update canvas dimensions AND
     * reinitialize particles so they fill the new area evenly.
     * Without reinit, particles would cluster in the old viewport rectangle.
     */
    const onResize = () => { resize(); initParticles(); };
    window.addEventListener('resize', onResize);

    /*
     * Cleanup function (runs on unmount or re-render):
     * - Cancel the pending animation frame to stop the draw loop
     * - Remove the resize listener to prevent memory leaks
     */
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []); // Empty dependency array: effect runs once on mount, cleans up on unmount

  return (
    <canvas
      ref={canvasRef}
      style={{
        /* Fixed positioning covers the entire viewport regardless of scroll */
        position: 'fixed',
        inset: 0,
        /* z-index 0: sits behind all page content (Navbar is z:100, modals higher) */
        zIndex: 0,
        /* pointer-events: none ensures clicks/scrolls pass through to the page */
        pointerEvents: 'none',
      }}
    />
  );
}
