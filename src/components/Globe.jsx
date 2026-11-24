"use client";
import { useEffect, useRef } from "react";
import LAND from "./globe-land.json";

/* Rotating dotted globe with animated great-circle arcs, drawn on a 2D canvas.
   LAND is a flat [lat, lon, lat, lon, ...] list of land dots (generated offline
   from Natural Earth 110m land). No map library ships to the browser. */

const D2R = Math.PI / 180;

// Trader hubs (lat, lon). Arcs fly between these.
export const HUBS = {
  london: [51.5, -0.1],
  dubai: [25.2, 55.3],
  newyork: [40.7, -74.0],
  mumbai: [19.1, 72.9],
  saopaulo: [-23.5, -46.6],
  berlin: [52.5, 13.4],
  singapore: [1.35, 103.8],
  lagos: [6.5, 3.4],
  sydney: [-33.9, 151.2],
  toronto: [43.7, -79.4],
};

const ROUTES = [
  ["newyork", "london"],
  ["london", "dubai"],
  ["dubai", "mumbai"],
  ["saopaulo", "newyork"],
  ["berlin", "singapore"],
  ["lagos", "london"],
  ["mumbai", "singapore"],
  ["toronto", "berlin"],
  ["singapore", "sydney"],
  ["saopaulo", "lagos"],
];

const toVec = (lat, lon) => {
  const la = lat * D2R;
  const lo = lon * D2R;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
};

// Precompute unit vectors once (module scope, shared by every globe on the page).
const LAND_V = [];
for (let i = 0; i < LAND.length; i += 2) LAND_V.push(toVec(LAND[i], LAND[i + 1]));

function slerp(a, b, t) {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const w = Math.acos(d);
  if (w < 1e-6) return a;
  const s = Math.sin(w);
  const ka = Math.sin((1 - t) * w) / s;
  const kb = Math.sin(t * w) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}

const ARCS = ROUTES.map(([a, b], i) => {
  const va = toVec(...HUBS[a]);
  const vb = toVec(...HUBS[b]);
  const ang = Math.acos(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]);
  const lift = 0.06 + ang * 0.075;
  const pts = Array.from({ length: 64 }, (_, k) => {
    const t = k / 63;
    const p = slerp(va, vb, t);
    const h = 1 + lift * Math.sin(Math.PI * t);
    return [p[0] * h, p[1] * h, p[2] * h];
  });
  return { a: va, b: vb, pts, delay: i * 0.9 };
});

const THEMES = {
  green: { dot: "134, 239, 172", rim: "74, 222, 128", arc: "187, 247, 208", core: "#04120a", edge: "#0b2a18" },
  blue: { dot: "125, 211, 252", rim: "96, 165, 250", arc: "191, 219, 254", core: "#07142b", edge: "#0d2550" },
};

export default function Globe({ className = "", speed = 0.06, tilt = 18, theme = "green", arcs = true }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const C = THEMES[theme] || THEMES.green;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let rot = -20 * D2R;
    let last = performance.now();
    let clock = 0;
    const ct = Math.cos(tilt * D2R);
    const st = Math.sin(tilt * D2R);

    let back = null; // cached halo + body
    let front = null; // cached glowing rim
    const BUCKETS = 6;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      // big canvases cost a lot per frame; cap the backing-store resolution
      dpr = Math.min(window.devicePixelRatio || 1, r.width > 700 ? 1.5 : 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      bake();
      draw();
    };

    // Static layers are painted once per resize, then blitted every frame.
    function bake() {
      if (!w) return;
      const mk = () => {
        const c = document.createElement("canvas");
        c.width = canvas.width;
        c.height = canvas.height;
        const g = c.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        return [c, g];
      };
      const R = Math.min(w, h) * 0.4;
      const cx = w / 2;
      const cy = h / 2;
      let g;
      [back, g] = mk();
      const halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
      halo.addColorStop(0, `rgba(${C.rim}, 0.28)`);
      halo.addColorStop(1, `rgba(${C.rim}, 0)`);
      g.fillStyle = halo;
      g.beginPath();
      g.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      g.fill();
      const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, C.edge);
      body.addColorStop(1, C.core);
      g.fillStyle = body;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.fill();
      [front, g] = mk();
      g.lineWidth = 1.5;
      g.strokeStyle = `rgba(${C.rim}, 0.85)`;
      g.shadowColor = `rgba(${C.rim}, 0.9)`;
      g.shadowBlur = 18;
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();
    }

    // rotate around Y (spin) then X (tilt)
    const proj = (v, cr, sr) => {
      const x = v[0] * cr + v[2] * sr;
      const z0 = -v[0] * sr + v[2] * cr;
      const y = v[1] * ct - z0 * st;
      const z = v[1] * st + z0 * ct;
      return [x, y, z];
    };

    function draw() {
      if (!w || !back) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(back, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = Math.min(w, h) * 0.4;
      const cx = w / 2;
      const cy = h / 2;
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);

      // land dots, batched into a few alpha buckets by depth (one fill per bucket)
      const ds = Math.max(0.9, R / 190);
      for (let bk = 0; bk < BUCKETS; bk++) {
        const zLo = bk / BUCKETS;
        const zHi = bk === BUCKETS - 1 ? 1.01 : (bk + 1) / BUCKETS;
        ctx.fillStyle = `rgba(${C.dot}, ${0.25 + ((zLo + zHi) / 2) * 0.75})`;
        ctx.beginPath();
        for (let i = 0; i < LAND_V.length; i++) {
          const v = LAND_V[i];
          const z0 = -v[0] * sr + v[2] * cr;
          const z = v[1] * st + z0 * ct;
          if (z <= 0.02 || z < zLo || z >= zHi) continue;
          const x = v[0] * cr + v[2] * sr;
          const y = v[1] * ct - z0 * st;
          ctx.rect(cx + x * R - ds / 2, cy - y * R - ds / 2, ds, ds);
        }
        ctx.fill();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(front, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!arcs) return;
      // arcs: each one draws in, holds, then fades; staggered
      const cycle = 9;
      const onSide = (p) => p[2] > 0 || p[0] * p[0] + p[1] * p[1] > 1;
      for (const arc of ARCS) {
        const t = ((clock - arc.delay) % cycle + cycle) % cycle;
        const grow = Math.min(1, t / 2.2);
        const fade = t > 6 ? Math.max(0, 1 - (t - 6) / 1.2) : 1;
        if (fade <= 0) continue;
        const n = Math.max(2, Math.floor(arc.pts.length * grow));
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = `rgba(${C.arc}, ${0.85 * fade})`;
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k < n; k++) {
          const p = proj(arc.pts[k], cr, sr);
          if (!onSide(p)) {
            pen = false;
            continue;
          }
          const X = cx + p[0] * R;
          const Y = cy - p[1] * R;
          if (pen) ctx.lineTo(X, Y);
          else ctx.moveTo(X, Y);
          pen = true;
        }
        ctx.stroke();

        // endpoints
        const ends = grow >= 1 ? [arc.a, arc.b] : [arc.a];
        for (const e of ends) {
          const p = proj(e, cr, sr);
          if (p[2] <= 0.05) continue;
          const X = cx + p[0] * R;
          const Y = cy - p[1] * R;
          ctx.fillStyle = `rgba(${C.rim}, ${0.3 * fade})`;
          ctx.beginPath();
          ctx.arc(X, Y, Math.min(9, R * 0.035), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
          ctx.beginPath();
          ctx.arc(X, Y, Math.min(4.5, Math.max(2.5, R * 0.018)), 0, Math.PI * 2);
          ctx.fill();
        }
        // travelling head
        if (grow < 1) {
          const p = proj(arc.pts[n - 1], cr, sr);
          if (onSide(p)) {
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(cx + p[0] * R, cy - p[1] * R, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rot += speed * dt;
      clock += dt;
      draw();
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(canvas);
    if (reduce) {
      clock = 3; // show arcs fully drawn, static
      draw();
    } else raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [speed, tilt, theme, arcs]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
