"use client";
import { useEffect, useRef } from "react";

/* WebGL hero backdrop: an endless corridor of glossy dark-green glass towers
   with a glowing runway to the vanishing point and floating price tags.
   three.js is loaded lazily so it never blocks first paint; if WebGL is
   unavailable the CSS glow behind it stays as the fallback. */

const TAGS = [
  ["UP TO", "100%", "REWARD SHARE"],
  ["$200K", "SIMULATED", "CAPITAL"],
  ["1-STEP", "& 2-STEP", "EVALUATIONS"],
  ["NO TIME", "LIMITS", "TRADE YOUR WAY"],
  ["14-DAY", "REWARD", "CYCLES"],
];

const PALETTE = [0x065f2c, 0x0b6b32, 0x064e26, 0x0f7f3c, 0x053d1f, 0x047857, 0x0a5a2a];

function tagTexture(THREE, lines) {
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 420;
  const g = c.getContext("2d");
  const r = 34;
  g.beginPath();
  g.roundRect(10, 10, 340, 400, r);
  const bg = g.createLinearGradient(0, 0, 0, 420);
  bg.addColorStop(0, "#0f2a1c");
  bg.addColorStop(1, "#06120b");
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = "rgba(74, 222, 128, 0.7)";
  g.stroke();
  g.textAlign = "center";
  g.fillStyle = "#dcfce7";
  g.font = "800 46px 'Hanken Grotesk', system-ui, sans-serif";
  g.fillText(lines[0], 180, 120);
  g.fillStyle = "#ffffff";
  g.font = "900 82px 'Hanken Grotesk', system-ui, sans-serif";
  g.fillText(lines[1], 180, 215);
  g.fillStyle = "#4ade80";
  g.font = "700 34px 'Hanken Grotesk', system-ui, sans-serif";
  g.fillText(lines[2], 180, 285);
  // little chevron mark
  g.strokeStyle = "#4ade80";
  g.lineWidth = 10;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(150, 360);
  g.lineTo(180, 332);
  g.lineTo(210, 360);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(180,255,205,0.95)");
  grd.addColorStop(0.25, "rgba(74,222,128,0.55)");
  grd.addColorStop(1, "rgba(22,163,74,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const RUNWAY_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RUNWAY_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  void main() {
    float x = abs(vUv.x - 0.5) * 2.0;
    float z = vUv.y;
    float rows = smoothstep(0.86, 1.0, fract(z * 70.0 - uTime * 0.9));
    float cols = smoothstep(0.9, 1.0, fract(vUv.x * 6.0));
    float edge = smoothstep(0.93, 1.0, x);
    float glow = pow(1.0 - x, 2.0) * 0.55;
    float fade = smoothstep(0.0, 0.08, z) * (1.0 - smoothstep(0.55, 1.0, z));
    float a = (glow + rows * 0.55 * (1.0 - x * 0.6) + cols * 0.12 + edge * 0.9) * fade;
    vec3 col = mix(vec3(0.09, 0.64, 0.29), vec3(0.75, 1.0, 0.85), glow * 0.6);
    gl_FragColor = vec4(col * a, a);
  }
`;

export default function HeroScene() {
  const ref = useRef(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        return;
      }

      const mobile = window.innerWidth < 768;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.style.opacity = "0";
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x040a06, 12, 56);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 90);
      camera.position.set(0, 2.2, 7);
      const look = new THREE.Vector3(0, 2.4, -30);

      // lights — green key at the vanishing point, cool rim near the camera
      scene.add(new THREE.AmbientLight(0x1c4a30, 0.45));
      const far = new THREE.PointLight(0x4ade80, 300, 80, 1.1);
      far.position.set(0, 4, -30);
      scene.add(far);
      const near = new THREE.PointLight(0xbbf7d0, 45, 40, 1.4);
      near.position.set(0, 7, 3);
      scene.add(near);
      const key = new THREE.DirectionalLight(0x86efac, 0.9);
      key.position.set(-6, 10, 6);
      scene.add(key);
      const key2 = new THREE.DirectionalLight(0xecfdf5, 0.55);
      key2.position.set(8, 6, -4);
      scene.add(key2);

      // towers
      const LEN = 64;
      const Z0 = 8;
      const COUNT = mobile ? 44 : 96;
      const geo = new RoundedBoxGeometry(1, 1, 1, 4, 0.09);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.5,
        roughness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 0.75,
        emissive: 0x0a4f27,
        emissiveIntensity: 0.55
      });
      // glass look: dark at the base, bright towards the top, glowing edges (fresnel)
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying float vObjY;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjY = position.y;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vObjY;")
          .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.16, 1.15, smoothstep(-0.5, 0.5, vObjY));")
          .replace(
            "#include <emissivemap_fragment>",
            [
              "#include <emissivemap_fragment>",
              "float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);",
              "totalEmissiveRadiance *= mix(0.25, 1.0, smoothstep(-0.5, 0.5, vObjY));",
              "totalEmissiveRadiance += vec3(0.29, 0.87, 0.5) * fres * 1.1;",
            ].join("\n")
          );
      };
      const towers = new THREE.InstancedMesh(geo, mat, COUNT);
      towers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(towers);

      const T = [];
      const rnd = (a, b) => a + Math.random() * (b - a);
      const roll = (t, z) => {
        const lane = Math.random();
        const dist = lane < 0.55 ? rnd(3.8, 5.6) : lane < 0.85 ? rnd(5.6, 8.6) : rnd(8.6, 12.5);
        t.x = t.side * dist;
        t.z = z;
        t.w = rnd(0.9, 2.3);
        t.d = rnd(0.9, 2.3);
        t.h = rnd(1.2, 3.2) + (dist > 5.6 ? rnd(2, 8) : rnd(0, 3));
        t.ry = rnd(-0.12, 0.12);
      };
      const color = new THREE.Color();
      for (let i = 0; i < COUNT; i++) {
        const t = { side: i % 2 ? 1 : -1 };
        roll(t, Z0 - (i / COUNT) * LEN - rnd(0, 1));
        T.push(t);
        color.setHex(PALETTE[i % PALETTE.length]);
        towers.setColorAt(i, color);
      }
      towers.instanceColor.needsUpdate = true;
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const writeTowers = () => {
        for (let i = 0; i < COUNT; i++) {
          const t = T[i];
          pos.set(t.x, t.h / 2, t.z);
          q.setFromEuler(e.set(0, t.ry, 0));
          scl.set(t.w, t.h, t.d);
          towers.setMatrixAt(i, m4.compose(pos, q, scl));
        }
        towers.instanceMatrix.needsUpdate = true;
      };
      writeTowers();

      // floor: dark mirror-ish plane + faint grid + glowing runway
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 140),
        new THREE.MeshStandardMaterial({ color: 0x030805, metalness: 0.85, roughness: 0.38, envMapIntensity: 0.6 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.z = -50;
      scene.add(floor);

      const grid = new THREE.GridHelper(60, 60, 0x14532d, 0x0b2a18);
      grid.material.transparent = true;
      grid.material.opacity = 0.35;
      grid.position.y = 0.01;
      scene.add(grid);

      const runwayMat = new THREE.ShaderMaterial({
        vertexShader: RUNWAY_VERT,
        fragmentShader: RUNWAY_FRAG,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const runway = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 110), runwayMat);
      runway.rotation.x = -Math.PI / 2;
      runway.position.set(0, 0.02, Z0 - 55);
      scene.add(runway);

      // glow at the vanishing point
      const glowTex = glowTexture(THREE);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 1, fog: false }));
      glow.position.set(0, 3.2, -44);
      glow.scale.set(26, 18, 1);
      scene.add(glow);

      // floating tags
      if (document.fonts?.ready) await document.fonts.ready;
      if (disposed) {
        renderer.dispose();
        return;
      }
      const tagGeo = new THREE.PlaneGeometry(1.3, 1.52);
      const tags = TAGS.map((lines, i) => {
        const tex = tagTexture(THREE, lines);
        const m = new THREE.Mesh(tagGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
        const side = i % 2 ? 1 : -1;
        m.userData = { side, z: Z0 - 6 - i * (LEN / TAGS.length), y: rnd(2.8, 4.6), x: side * rnd(3.6, 4.4), phase: Math.random() * 6 };
        scene.add(m);
        return m;
      });

      // sizing
      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        camera.aspect = w / h;
        camera.fov = w / h < 0.9 ? 68 : 55;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(() => {
        resize();
        if (reduce) renderer.render(scene, camera);
      });
      ro.observe(host);

      // pointer parallax
      const ptr = { x: 0, y: 0 };
      const onMove = (ev) => {
        ptr.x = (ev.clientX / window.innerWidth) * 2 - 1;
        ptr.y = (ev.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // only animate while visible
      let visible = true;
      const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting), { threshold: 0 });
      io.observe(host);

      const SPEED = 1.5;
      let raf = 0;
      let last = performance.now();
      let time = 0;
      let shown = false;

      const step = (dt) => {
        const dz = SPEED * dt;
        time += dt;
        for (const t of T) {
          t.z += dz;
          if (t.z > Z0) roll(t, t.z - LEN);
        }
        writeTowers();
        grid.position.z = (grid.position.z + dz) % 1;
        runwayMat.uniforms.uTime.value = time;
        for (const m of tags) {
          const u = m.userData;
          u.z += dz;
          if (u.z > -3) {
            u.z -= LEN;
            u.y = rnd(2.8, 4.6);
            u.x = u.side * rnd(3.6, 4.4);
          }
          m.position.set(u.x, u.y + Math.sin(time * 0.9 + u.phase) * 0.12, u.z);
          m.rotation.set(0, -u.side * 0.55 + Math.sin(time * 0.6 + u.phase) * 0.06, u.side * 0.04);
        }
        camera.position.x += (ptr.x * 0.9 - camera.position.x) * 0.035;
        camera.position.y += (2.2 - ptr.y * 0.35 + Math.sin(time * 0.5) * 0.05 - camera.position.y) * 0.035;
        camera.lookAt(look);
        far.intensity = 300 + Math.sin(time * 1.3) * 40;
      };

      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!visible) return; // browsers already pause rAF in background tabs
        step(dt);
        renderer.render(scene, camera);
        if (!shown) {
          shown = true;
          canvas.style.opacity = "1";
        }
      };

      if (reduce) {
        step(0);
        camera.position.set(0, 2.2, 7);
        camera.lookAt(look);
        renderer.render(scene, camera);
        canvas.style.opacity = "1";
      } else {
        raf = requestAnimationFrame(frame);
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        scene.traverse((o) => {
          o.geometry?.dispose?.();
          const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
          ms.forEach((mm) => {
            mm.map?.dispose?.();
            mm.dispose?.();
          });
        });
        glowTex.dispose();
        envRT.dispose();
        pmrem.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={ref} className="uc-scene" aria-hidden="true" />;
}
