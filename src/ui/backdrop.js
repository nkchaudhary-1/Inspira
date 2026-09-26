// Theme backdrop: texture, grid and an optional WebGL shader behind every mode.
// Texture + grid are pure CSS (data attributes + custom properties on <html>);
// the shader is a small fragment shader drawn at reduced resolution, capped at
// 30fps, paused when the tab is hidden and frozen for reduced motion.

import * as store from '../core/store.js';

export const DEFAULT_BACKDROP = {
  texture: 'grain', // none | grain | paper | static
  textureAmount: 0.4,
  grid: 'none', // none | dots | lines | blueprint
  gridSize: 32,
  gridOpacity: 0.5,
  shader: 'none', // none | aurora | mesh | waves
  shaderIntensity: 0.6,
  shaderSpeed: 0.4,
};

export const PRESETS = [
  { id: 'minimal', label: 'Minimal', value: { texture: 'none', grid: 'none', shader: 'none' } },
  { id: 'grain', label: 'Grain', value: { texture: 'grain', textureAmount: 0.4, grid: 'none', shader: 'none' } },
  { id: 'paper', label: 'Paper', value: { texture: 'paper', textureAmount: 0.6, grid: 'none', shader: 'none' } },
  { id: 'dots', label: 'Dot grid', value: { texture: 'grain', textureAmount: 0.3, grid: 'dots', gridSize: 24, gridOpacity: 0.6, shader: 'none' } },
  { id: 'blueprint', label: 'Blueprint', value: { texture: 'none', grid: 'blueprint', gridSize: 32, gridOpacity: 0.5, shader: 'none' } },
  { id: 'aurora', label: 'Aurora', value: { texture: 'grain', textureAmount: 0.3, grid: 'none', shader: 'aurora', shaderIntensity: 0.7, shaderSpeed: 0.4 } },
  { id: 'mesh', label: 'Mesh', value: { texture: 'grain', textureAmount: 0.3, grid: 'none', shader: 'mesh', shaderIntensity: 0.6, shaderSpeed: 0.3 } },
  { id: 'waves', label: 'Waves', value: { texture: 'none', grid: 'none', shader: 'waves', shaderIntensity: 0.5, shaderSpeed: 0.4 } },
];

export const backdrop = () => ({ ...DEFAULT_BACKDROP, ...store.prefs().backdrop });

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
  if (root.dataset.texture !== b.texture) root.dataset.texture = b.texture;
  if (root.dataset.grid !== b.grid) root.dataset.grid = b.grid;
  root.style.setProperty('--texture-amount', String(b.textureAmount));
  root.style.setProperty('--grid-size', `${b.gridSize}px`);
  root.style.setProperty('--grid-alpha', `${Math.round(b.gridOpacity * 18)}%`);
  shader.configure(b);
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
  return root.dataset.theme === 'dark'
    ? [get('--black-100'), get('--black-80'), get('--black-60')]
    : [get('--white-90'), get('--white-60'), get('--white-100')];
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
