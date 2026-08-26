<template>
  <div class="bg-gray-950/80 rounded-lg border border-gray-800 p-4 space-y-3">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <span class="text-[10px] font-mono uppercase tracking-widest text-cyan-400">Server Icon Editor</span>
      <span v-if="dirty" class="text-[9px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded">Unsaved</span>
      <span class="text-[9px] font-mono text-gray-600">64 × 64 px</span>
    </div>

    <div class="flex flex-col md:flex-row gap-4">
      <!-- Canvas -->
      <div class="flex flex-col items-center gap-2 shrink-0">
        <div
          class="relative rounded border border-gray-700 bg-checkerboard overflow-hidden w-56 h-56 sm:w-64 sm:h-64"
          style="max-width: 100%;"
        >
          <canvas
            ref="canvas"
            width="64"
            height="64"
            class="absolute inset-0 w-full h-full cursor-crosshair touch-none"
            style="image-rendering: pixelated;"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointerleave="onPointerUp"
          ></canvas>
        </div>
        <span class="text-[9px] font-mono text-gray-600">Drag to paint · tap on mobile</span>
      </div>

      <!-- Controls -->
      <div class="flex-1 space-y-3 min-w-0">
        <!-- Palette -->
        <div>
          <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Palette</span>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="c in palette"
              :key="c"
              @click="pickColor(c)"
              :style="{ background: c }"
              :title="c"
              class="w-7 h-7 sm:w-6 sm:h-6 rounded border transition-all hover:scale-110 active:scale-95"
              :class="current === c ? 'ring-2 ring-white border-white' : 'border-gray-700'"
            ></button>
            <button
              @click="pickColor('')"
              title="Eraser (transparent)"
              class="w-7 h-7 sm:w-6 sm:h-6 rounded border border-gray-600 flex items-center justify-center transition-all hover:scale-110 active:scale-95 bg-checkerboard"
              :class="current === '' ? 'ring-2 ring-white' : ''"
            >
              <svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 4h3a1 1 0 011 1v2m-1 13a2 2 0 01-4 0V8m-5 5l5-5L7.6 3.6a2 2 0 00-2.83 0l-1.17 1.17a2 2 0 000 2.83L13 17"/></svg>
            </button>
            <label
              title="Custom color"
              class="w-7 h-7 sm:w-6 sm:h-6 rounded border border-gray-700 cursor-pointer relative inline-block overflow-hidden"
              :style="{ background: customColor }"
            >
              <input v-model="customColor" type="color" class="absolute inset-0 opacity-0 cursor-pointer" @change="pickColor(customColor)" />
            </label>
          </div>
        </div>

        <!-- Tools -->
        <div>
          <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Tools</span>
          <div class="flex flex-wrap gap-1">
            <button @click="tool = 'brush'" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border transition-colors" :class="tool === 'brush' ? 'bg-cyan-600 border-cyan-500 text-white' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-white'">Brush</button>
            <button @click="tool = 'fill'" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border transition-colors" :class="tool === 'fill' ? 'bg-cyan-600 border-cyan-500 text-white' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-white'">Fill</button>
          </div>
        </div>

        <!-- Generators -->
        <div>
          <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Generate</span>
          <div class="flex flex-wrap gap-1">
            <button @click="genSolid" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">Solid</button>
            <button @click="genGradient" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">Gradient</button>
            <button @click="genChecker" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">Checker</button>
            <button @click="genNoise" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">Noise</button>
            <button @click="clearAll" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 transition-colors">Clear</button>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-[9px] font-mono text-gray-600">Second color:</span>
            <label class="w-6 h-6 rounded border border-gray-700 cursor-pointer relative inline-block" :style="{ background: color2 }">
              <input v-model="color2" type="color" class="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
        </div>

        <!-- Upload / Download / Save -->
        <div class="flex flex-wrap gap-1 items-center">
          <label class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 cursor-pointer transition-colors">
            Upload Image
            <input type="file" accept="image/*" class="hidden" @change="onUpload" />
          </label>
          <button @click="downloadPng" class="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors">Download PNG</button>
          <button @click="save" :disabled="saving || !dirty" class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:opacity-50 text-white rounded border border-cyan-500 transition-colors">
            {{ saving ? 'Saving…' : 'Save Icon' }}
          </button>
        </div>
        <p class="text-[9px] font-mono text-gray-600">Saved as server-icon.png — appears in the server list after a restart.</p>
        <p v-if="saveError" class="text-[10px] font-mono text-rose-400">✗ {{ saveError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../lib/api.js';

const emit = defineEmits(['saved']);

const SIZE = 64;
const canvas = ref(null);
const pixels = ref(new Uint8ClampedArray(SIZE * SIZE * 4));
const current = ref('#55ff55');
const customColor = ref('#ff55ff');
const color2 = ref('#3b82f6');
const tool = ref('brush');
const dirty = ref(false);
const saving = ref(false);
const saveError = ref('');
const painting = ref(false);

const palette = [
  '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa',
  '#ffaa00', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff',
  '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
];

function hexToRgba(hex) {
  if (!hex) return [0, 0, 0, 0];
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255,
  ];
}

function idx(x, y) {
  return (y * SIZE + x) * 4;
}

function setPixel(x, y, rgba) {
  const i = idx(x, y);
  pixels.value[i] = rgba[0];
  pixels.value[i + 1] = rgba[1];
  pixels.value[i + 2] = rgba[2];
  pixels.value[i + 3] = rgba[3];
  dirty.value = true;
}

function drawCanvas() {
  if (!canvas.value) return;
  const ctx = canvas.value.getContext('2d');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.value), SIZE, SIZE), 0, 0);
}

function pickColor(c) {
  current.value = c;
  tool.value = 'brush';
}

// --- Painting (pointer events work for mouse + touch) ---
function canvasPos(e) {
  const rect = canvas.value.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
  return {
    x: Math.max(0, Math.min(SIZE - 1, x)),
    y: Math.max(0, Math.min(SIZE - 1, y)),
  };
}

function onPointerDown(e) {
  e.preventDefault();
  canvas.value.setPointerCapture?.(e.pointerId);
  painting.value = true;
  const { x, y } = canvasPos(e);
  if (tool.value === 'fill') {
    floodFill(x, y);
  } else {
    setPixel(x, y, hexToRgba(current.value));
  }
  drawCanvas();
}

function onPointerMove(e) {
  if (!painting.value || tool.value !== 'brush') return;
  const { x, y } = canvasPos(e);
  setPixel(x, y, hexToRgba(current.value));
  drawCanvas();
}

function onPointerUp() {
  painting.value = false;
}

// --- Flood fill ---
function floodFill(sx, sy) {
  const data = pixels.value;
  const start = idx(sx, sy);
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  const fill = hexToRgba(current.value);
  if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3]) return;

  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    const i = idx(x, y);
    if (data[i] !== target[0] || data[i + 1] !== target[1] || data[i + 2] !== target[2] || data[i + 3] !== target[3]) continue;
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
    if (x > 0) stack.push([x - 1, y]);
    if (x < SIZE - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < SIZE - 1) stack.push([x, y + 1]);
  }
  dirty.value = true;
}

// --- Generators ---
function genSolid() {
  const c = hexToRgba(current.value || '#55ff55');
  for (let i = 0; i < SIZE * SIZE * 4; i += 4) {
    pixels.value[i] = c[0];
    pixels.value[i + 1] = c[1];
    pixels.value[i + 2] = c[2];
    pixels.value[i + 3] = c[3];
  }
  dirty.value = true;
  drawCanvas();
}

function genGradient() {
  const a = hexToRgba(current.value || '#55ff55');
  const b = hexToRgba(color2.value || '#3b82f6');
  for (let y = 0; y < SIZE; y++) {
    const t = y / (SIZE - 1);
    const c = [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
      255,
    ];
    for (let x = 0; x < SIZE; x++) {
      const i = idx(x, y);
      pixels.value[i] = c[0];
      pixels.value[i + 1] = c[1];
      pixels.value[i + 2] = c[2];
      pixels.value[i + 3] = c[3];
    }
  }
  dirty.value = true;
  drawCanvas();
}

function genChecker() {
  const a = hexToRgba(current.value || '#55ff55');
  const b = hexToRgba(color2.value || '#3b82f6');
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const c = on ? a : b;
      const i = idx(x, y);
      pixels.value[i] = c[0];
      pixels.value[i + 1] = c[1];
      pixels.value[i + 2] = c[2];
      pixels.value[i + 3] = c[3];
    }
  }
  dirty.value = true;
  drawCanvas();
}

function genNoise() {
  for (let i = 0; i < SIZE * SIZE * 4; i += 4) {
    const c = hexToRgba(palette[Math.floor(Math.random() * palette.length)]);
    pixels.value[i] = c[0];
    pixels.value[i + 1] = c[1];
    pixels.value[i + 2] = c[2];
    pixels.value[i + 3] = c[3];
  }
  dirty.value = true;
  drawCanvas();
}

function clearAll() {
  pixels.value.fill(0);
  dirty.value = true;
  drawCanvas();
}

// --- Upload: cover-crop any image to 64x64 ---
function onUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.value.getContext('2d');
      ctx.clearRect(0, 0, SIZE, SIZE);
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      pixels.value = ctx.getImageData(0, 0, SIZE, SIZE).data;
      dirty.value = true;
      drawCanvas();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// --- Save / Download ---
async function save() {
  saveError.value = '';
  if (!canvas.value || saving.value) return;
  saving.value = true;
  try {
    const dataUrl = canvas.value.toDataURL('image/png');
    const res = await api.saveIcon(dataUrl);
    if (!res.success) throw new Error(res.error || 'Failed to save icon');
    dirty.value = false;
    emit('saved');
  } catch (e) {
    saveError.value = e.message || 'Failed to save icon';
  } finally {
    saving.value = false;
  }
}

function downloadPng() {
  if (!canvas.value) return;
  const a = document.createElement('a');
  a.href = canvas.value.toDataURL('image/png');
  a.download = 'server-icon.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --- Load current icon ---
onMounted(async () => {
  drawCanvas();
  try {
    const res = await api.getIcon();
    if (res.icon) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.value.getContext('2d');
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        pixels.value = ctx.getImageData(0, 0, SIZE, SIZE).data;
        dirty.value = false;
        drawCanvas();
      };
      img.src = res.icon;
    }
  } catch (e) {
    // No icon yet — start blank
  }
});
</script>
