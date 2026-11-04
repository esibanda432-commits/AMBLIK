import { useEffect, useRef } from 'react';

// A fine, technical spider web drawn in graphite on bone. Small dots (leads) drift in,
// are caught on the strands, then travel along a thread to the cyan hub (the dot from
// the Ämblik logo). Strands ripple gently where the cursor or a finger touches them.

const SPOKES = 14;
const RINGS = 8;
const LEADS = 14;

type Lead = { x: number; y: number; vx: number; vy: number; state: 'fly' | 'caught' | 'travel'; t: number; hue: string; r: number };

const INK = ['rgba(10, 12, 15, .7)', 'rgba(10, 12, 15, .5)', 'rgba(74, 80, 88, .6)'];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function WebCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now();
    let hub = { x: 0, y: 0 }, R = 100;
    let pointer = { x: -9999, y: -9999, active: false };
    let flash = 0;

    // Fixed web geometry (relative units), with natural irregularity.
    const angles = Array.from({ length: SPOKES }, (_, i) => (i / SPOKES) * Math.PI * 2 + rand(-0.08, 0.08));
    const jitter = Array.from({ length: RINGS }, () => Array.from({ length: SPOKES }, () => rand(0.94, 1.05)));
    const leads: Lead[] = [];

    const layout = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      W = rect.width; H = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      const mobile = W < 820;
      hub = { x: W * (mobile ? 0.86 : 0.74), y: H * 0.58 };
      R = Math.max(90, Math.min(H * 1.05, W * (mobile ? 0.55 : 0.36)));
    };

    const spawn = (l?: Lead): Lead => {
      const fromLeft = Math.random() < 0.7;
      const x = fromLeft ? rand(-40, W * 0.35) : rand(W * 0.4, W + 40);
      const y = fromLeft ? rand(-30, H + 30) : (Math.random() < 0.5 ? -20 : H + 20);
      const ang = Math.atan2(hub.y - y, hub.x - x) + rand(-0.5, 0.5);
      const sp = rand(12, 26);
      const o = l ?? ({} as Lead);
      Object.assign(o, { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, state: 'fly', t: 0,
        hue: INK[Math.floor(Math.random() * 3)], r: rand(1.3, 2.2) });
      return o;
    };

    // Point on the web, including a ripple near the pointer.
    const point = (ring: number, s: number, time: number) => {
      const a = angles[s];
      const d = (R * (ring + 1)) / RINGS * jitter[ring][s] * (1 + Math.sin(time * 0.6 + s) * 0.006);
      let x = hub.x + Math.cos(a) * d, y = hub.y + Math.sin(a) * d;
      if (pointer.active) {
        const dx = x - pointer.x, dy = y - pointer.y, dist = Math.hypot(dx, dy);
        if (dist < 110) {
          const k = (1 - dist / 110) * 5 * Math.sin(time * 10 + ring);
          x += (dx / (dist || 1)) * k; y += (dy / (dist || 1)) * k;
        }
      }
      return { x, y };
    };

    const draw = (time: number, dt: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Spokes
      ctx.lineWidth = 1;
      for (let s = 0; s < SPOKES; s++) {
        ctx.beginPath(); ctx.moveTo(hub.x, hub.y);
        for (let r = 0; r < RINGS; r++) { const p = point(r, s, time); ctx.lineTo(p.x, p.y); }
        const o = point(RINGS - 1, s, time);
        ctx.lineTo(hub.x + (o.x - hub.x) * 1.6, hub.y + (o.y - hub.y) * 1.6); // anchor threads run off-screen
        ctx.strokeStyle = 'rgba(10, 12, 15, .13)'; ctx.stroke();
      }
      // Capture spiral: rings sag slightly between spokes, like a real web
      for (let r = 0; r < RINGS; r++) {
        ctx.beginPath();
        for (let s = 0; s <= SPOKES; s++) {
          const a = point(r, s % SPOKES, time), b = point(r, (s + 1) % SPOKES, time);
          if (s === 0) ctx.moveTo(a.x, a.y);
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          const cx = mx + (hub.x - mx) * 0.08, cy = my + (hub.y - my) * 0.08;
          ctx.quadraticCurveTo(cx, cy, b.x, b.y);
        }
        ctx.strokeStyle = r === 2 ? 'rgba(1, 182, 196, .45)' : `rgba(10, 12, 15, ${0.07 + r * 0.008})`;
        ctx.lineWidth = r === 2 ? 1 : 0.8;
        ctx.stroke();
      }

      // Leads
      for (const l of leads) {
        if (l.state === 'fly') {
          l.x += l.vx * dt; l.y += l.vy * dt;
          const d = Math.hypot(l.x - hub.x, l.y - hub.y);
          if (d < R * 0.98) { l.state = 'caught'; l.t = 0; }
          if (l.x < -80 || l.x > W + 80 || l.y < -80 || l.y > H + 80) spawn(l);
        } else if (l.state === 'caught') {
          l.t += dt;
          if (l.t > 0.7) { l.state = 'travel'; l.t = 0; }
        } else {
          const dx = hub.x - l.x, dy = hub.y - l.y, d = Math.hypot(dx, dy);
          const sp = 60 + (R - d) * 0.6;
          if (d < 6) { flash = 1; spawn(l); continue; }
          l.x += (dx / d) * sp * dt; l.y += (dy / d) * sp * dt;
          // thread behind the travelling lead
          ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x - (dx / d) * 16, l.y - (dy / d) * 16);
          ctx.strokeStyle = 'rgba(1, 182, 196, .7)'; ctx.lineWidth = 1.2; ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        ctx.fillStyle = l.state === 'travel' ? '#01b6c4' : l.hue;
        ctx.fill();
        if (l.state === 'caught') { // a quiet ring marks a captured lead
          ctx.beginPath(); ctx.arc(l.x, l.y, l.r + 3 + l.t * 6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(1, 182, 196, ${0.6 - l.t * 0.8})`; ctx.lineWidth = 1; ctx.stroke();
        }
      }

      // Hub: the cyan dot from the logo, with its fine dark outline
      flash = Math.max(0, flash - dt * 1.6);
      const hr = Math.max(3.5, R * 0.026);
      ctx.beginPath(); ctx.arc(hub.x, hub.y, hr * (2.4 + flash * 1.2), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(1, 182, 196, ${0.18 + flash * 0.35})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(hub.x, hub.y, hr, 0, Math.PI * 2);
      ctx.fillStyle = '#01d6e5'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#0a0c0f'; ctx.stroke();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      draw(now / 1000, dt);
      raf = requestAnimationFrame(tick);
    };

    layout();
    for (let i = 0; i < LEADS; i++) {
      const l = spawn(); l.x = rand(0, W); l.y = rand(0, H);
      if (Math.hypot(l.x - hub.x, l.y - hub.y) < R) { l.x = rand(0, W * 0.4); }
      leads.push(l);
    }

    const ro = new ResizeObserver(() => { layout(); if (reduced) draw(0, 0); });
    ro.observe(canvas.parentElement!);
    const host = canvas.parentElement!;
    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top, active: true }; };
    const onLeave = () => { pointer.active = false; };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduced) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    document.addEventListener('visibilitychange', onVis);

    if (reduced) draw(0, 0); else raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className="webcanvas" aria-hidden="true" />;
}
