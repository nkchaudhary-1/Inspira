// Theme backdrop behind every mode, built from light rather than texture:
//   light — a soft accent glow: halo (top), horizon (bottom), mesh (drifting
//           colour fields) or spotlight (follows the pointer)
//   grid  — hairline lines or dots that fade out towards the edges
//   noise — a whisper of grain that keeps gradients from banding
//   shader — optional WebGL aurora / flow, half resolution, 30fps, paused when
//            hidden and still under reduced motion
// Everything but the shader is CSS: data attributes + custom properties on <html>.

import * as store from '../core/store.js';

export const DEFAULT_BACKDROP = {
  light: 'halo', // none | halo | horizon | mesh | spotlight | sky
  lightIntensity: 0.6,
  sky: 'auto', // auto (follows the time of day) | dawn | day | evening | night | late | deep
  texture: 'none', // none | grain  (noise)
  textureAmount: 0.3,
  grid: 'none', // none | lines | dots
  gridSize: 32,
  gridOpacity: 0.5,
  shader: 'none', // none | aurora | mesh (flow)
  shaderIntensity: 0.6,
  shaderSpeed: 0.4,
};

export const PRESETS = [
  { id: 'clean', label: 'Clean', value: { light: 'none', texture: 'none', grid: 'none', shader: 'none' } },
  { id: 'halo', label: 'Halo', value: { light: 'halo', lightIntensity: 0.6, texture: 'none', grid: 'none', shader: 'none' } },
  { id: 'horizon', label: 'Horizon', value: { light: 'horizon', lightIntensity: 0.6, texture: 'none', grid: 'none', shader: 'none' } },
  { id: 'sky', label: 'Sky', value: { light: 'sky', texture: 'grain', textureAmount: 0.3, grid: 'none', shader: 'none' } },
  { id: 'mesh', label: 'Mesh', value: { light: 'mesh', lightIntensity: 0.6, texture: 'grain', textureAmount: 0.3, grid: 'none', shader: 'none' } },
  { id: 'grid', label: 'Grid', value: { light: 'halo', lightIntensity: 0.5, texture: 'none', grid: 'lines', gridSize: 48, gridOpacity: 0.5, shader: 'none' } },
  { id: 'dots', label: 'Dots', value: { light: 'none', texture: 'none', grid: 'dots', gridSize: 24, gridOpacity: 0.6, shader: 'none' } },
  {
    id: 'spotlight',
    label: 'Spotlight',
    value: { light: 'spotlight', lightIntensity: 0.6, texture: 'none', grid: 'dots', gridSize: 24, gridOpacity: 0.7, shader: 'none' },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    value: { light: 'none', texture: 'grain', textureAmount: 0.3, grid: 'none', shader: 'aurora', shaderIntensity: 0.7, shaderSpeed: 0.4 },
  },
];

/**
 * Sky: time-of-day gradients (dark sky melting into a warm or cool glow).
 * Slots follow the reference: Evening 4–7 PM, Night 7–10 PM, Late night
 * 10 PM–1 AM, Deep night 1–4 AM; Dawn and Day complete the 24 hours.
 */
export const SKY_PHASES = [
  { id: 'dawn', label: 'Dawn', from: 4, to: 8, range: '4AM – 8AM', icon: 'sunrise' },
  { id: 'day', label: 'Day', from: 8, to: 16, range: '8AM – 4PM', icon: 'sun' },
  { id: 'evening', label: 'Evening', from: 16, to: 19, range: '4PM – 7PM', icon: 'sunset' },
  { id: 'night', label: 'Night', from: 19, to: 22, range: '7PM – 10PM', icon: 'moon' },
  { id: 'late', label: 'Late night', from: 22, to: 25, range: '10PM – 1AM', icon: 'moonStar' },
  { id: 'deep', label: 'Deep night', from: 1, to: 4, range: '1AM – 4AM', icon: 'stars' },
];

export function skyPhaseAt(hour) {
  const h = hour < 1 ? hour + 24 : hour; // 00:xx belongs to Late night (22–25)
  return SKY_PHASES.find((p) => h >= p.from && h < p.to)?.id ?? 'deep';
}

/** Set the sky phase on <html>: the pinned one, or the current time's. */
export function applySkyPhase(now = new Date()) {
  const pick = backdrop().sky;
  const phase = pick === 'auto' ? skyPhaseAt(now.getHours()) : pick;
  if (root.dataset.skyphase !== phase) root.dataset.skyphase = phase;
}

// Older styles map onto their closest modern equivalent.
const LEGACY = { texture: { paper: 'grain', static: 'grain' }, grid: { blueprint: 'lines' }, shader: { waves: 'aurora' } };

export const backdrop = () => {
  const stored = store.prefs().backdrop || {};
  const b = { ...DEFAULT_BACKDROP, ...stored };
  for (const [key, map] of Object.entries(LEGACY)) b[key] = map[b[key]] ?? b[key];
  // Saved before "light" existed: keep those looks as they were (no glow).
  if (store.prefs().backdrop && !('light' in stored)) b.light = 'none';
  return b;
};

export function setBackdrop(patch) {
  store.setPrefs({ backdrop: { ...backdrop(), ...patch } });
}

/** Which preset (if any) the current settings match. */
export function activePreset() {
  const b = backdrop();
  return PRESETS.find((p) => Object.entries(p.value).every(([k, v]) => b[k] === v))?.id ?? null;
}

// ---------- CSS layers ----------

const root = document.documentElement;

export function applyBackdrop() {
  const b = backdrop();
  for (const key of ['light', 'texture', 'grid']) if (root.dataset[key] !== b[key]) root.dataset[key] = b[key];
  root.style.setProperty('--light-k', String(b.lightIntensity));
  root.style.setProperty('--texture-amount', String(b.textureAmount));
  root.style.setProperty('--grid-size', `${b.gridSize}px`);
  root.style.setProperty('--grid-alpha', `${Math.round(b.gridOpacity * 18)}%`);
  spotlight(b.light === 'spotlight');
  applySkyPhase();
  shader.configure(b);
}

// Spotlight: the pointer position drives two custom properties, once per frame.
let spotOn = false;
let spotFrame = 0;
function onPointer(e) {
  if (spotFrame) return;
  spotFrame = requestAnimationFrame(() => {
    spotFrame = 0;
    root.style.setProperty('--mx', `${e.clientX}px`);
    root.style.setProperty('--my', `${e.clientY}px`);
  });
}
function spotlight(on) {
  if (on === spotOn) return;
  spotOn = on;
  if (on) window.addEventListener('pointermove', onPointer, { passive: true });
  else window.removeEventListener('pointermove', onPointer);
}

// ---------- WebGL shader ----------

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_int;
uniform int u_kind;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
  float t = u_time;
  float m;
  if (u_kind == 0) {
    // Aurora: soft bands drifting across the upper half.
    float n = fbm(vec2(p.x * 1.1 + t * 0.05, t * 0.03));
    float center = 0.62 + (n - 0.5) * 0.5;
    float band = smoothstep(0.0, 1.0, 1.0 - abs(uv.y - center) * 2.4);
    float detail = fbm(p * vec2(4.0, 1.2) + vec2(t * 0.1, -t * 0.04));
    m = band * (0.55 + 0.45 * detail);
  } else if (u_kind == 1) {
    // Mesh: domain-warped noise, like slow ink in water.
    vec2 q = vec2(fbm(p * 1.3 + t * 0.04), fbm(p * 1.3 + vec2(5.2, 1.3) - t * 0.03));
    m = smoothstep(0.25, 0.85, fbm(p * 1.2 + 2.0 * q));
  } else {
    // Waves: contour lines bent by noise.
    float n = fbm(p * 1.4 + vec2(t * 0.05, 0.0));
    float w = 0.5 + 0.5 * sin(uv.y * 9.0 + n * 7.0 - t * 0.5);
    m = smoothstep(0.55, 1.0, w) * 0.8;
  }
  m = clamp(m, 0.0, 1.0);
  vec3 col = mix(u_c1, u_c2, m);
  col = mix(col, u_c3, pow(m, 3.0) * 0.55);
  col = mix(u_c1, col, u_int);
  // Tiny dither so gradients don't band.
  col += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const KINDS = { aurora: 0, mesh: 1, waves: 2 };
const SCALE = 0.5; // render at half resolution — it's a soft background
const FRAME_MS = 1000 / 30;

function hexToRgb(hex) {
  const v = hex.trim().replace('#', '');
  const n = parseInt(v.length === 3 ? v.replace(/./g, (c) => c + c) : v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function themeColors() {
  const css = getComputedStyle(root);
  const get = (name) => css.getPropertyValue(name);
  // Per-theme shader colours live in tokens.css (--shader-a/b/c).
  return [get('--shader-a'), get('--shader-b'), get('--shader-c')];
}

const shader = {
  canvas: null,
  gl: null,
  prog: null,
  loc: {},
  cfg: null,
  raf: 0,
  last: 0,
  t: 0,
  failed: false,

  configure(b) {
    // applyTheme runs on every store change; only react when something changed.
    const sig = JSON.stringify(b) + root.dataset.theme;
    if (sig === this.sig) return;
    this.sig = sig;
    this.cfg = b;
    const on = b.shader !== 'none' && !this.failed;
    if (!on) return this.stop();
    this.colors = themeColors().map(hexToRgb);
    if (!this.gl && !this.init()) return this.stop();
    this.canvas.hidden = false;
    this.start();
  },

  init() {
    this.canvas = document.querySelector('.sky__shader');
    if (!this.canvas) return false;
    const gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) return (this.failed = true) && false;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['u_res', 'u_time', 'u_int', 'u_kind', 'u_c1', 'u_c2', 'u_c3']) this.loc[n] = gl.getUniformLocation(prog, n);
      this.gl = gl;
      this.prog = prog;
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => (document.hidden ? cancelAnimationFrame(this.raf) : this.cfg?.shader !== 'none' && this.start()));
      this.resize();
      return true;
    } catch (err) {
      console.warn('[inspira] shader unavailable', err);
      this.failed = true;
      return false;
    }
  },

  resize() {
    if (!this.canvas) return;
    const w = Math.max(1, Math.round(innerWidth * SCALE));
    const h = Math.max(1, Math.round(innerHeight * SCALE));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl?.viewport(0, 0, w, h);
      this.draw();
    }
  },

  draw() {
    const { gl, loc, cfg } = this;
    if (!gl || !cfg || !this.colors || cfg.shader === 'none') return;
    const [c1, c2, c3] = this.colors;
    gl.uniform2f(loc.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(loc.u_time, this.t);
    gl.uniform1f(loc.u_int, cfg.shaderIntensity);
    gl.uniform1i(loc.u_kind, KINDS[cfg.shader] ?? 0);
    gl.uniform3fv(loc.u_c1, c1);
    gl.uniform3fv(loc.u_c2, c2);
    gl.uniform3fv(loc.u_c3, c3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },

  start() {
    cancelAnimationFrame(this.raf);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || this.cfg.shaderSpeed === 0;
    if (still) return this.draw();
    this.last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = now - this.last;
      if (dt < FRAME_MS) return;
      this.last = now;
      this.t += (dt / 1000) * (0.15 + this.cfg.shaderSpeed * 1.6);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  },

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.canvas) this.canvas.hidden = true;
  },
};
