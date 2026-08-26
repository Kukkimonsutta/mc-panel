<template>
  <div class="bg-gray-950/80 rounded-lg border border-gray-800 p-4 space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-[10px] font-mono uppercase tracking-widest text-fuchsia-400">MOTD Editor</span>
      <span class="text-[9px] font-mono text-gray-600">§-code formatting</span>
    </div>

    <!-- Live Preview -->
    <div class="bg-[#1a1a2e] border-2 border-[#2a2a4a] rounded-md p-3 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
      <div class="relative flex items-center gap-3">
        <!-- Server icon (real icon when available) -->
        <img v-if="iconUrl" :src="iconUrl" alt="server icon" class="w-10 h-10 rounded-sm ring-1 ring-white/10 shrink-0" style="image-rendering: pixelated;" />
        <div v-else class="w-10 h-10 rounded-sm bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center shrink-0 ring-1 ring-white/10">
          <svg class="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/></svg>
        </div>
        <!-- MOTD text -->
        <div class="min-w-0">
          <div class="text-xs font-mono leading-snug" v-html="renderedMotd || '<span class=\'text-gray-600 italic\'>Server MOTD preview…</span>'"></div>
          <div class="text-[10px] font-mono text-gray-600 mt-0.5">Minecraft Server • {{ playerCount }}</div>
        </div>
        <!-- Signal bars -->
        <div class="ml-auto flex items-end gap-0.5 h-8">
          <div class="w-1 bg-emerald-500/60 rounded-sm" style="height:30%"></div>
          <div class="w-1 bg-emerald-500/60 rounded-sm" style="height:45%"></div>
          <div class="w-1 bg-emerald-500/60 rounded-sm" style="height:60%"></div>
          <div class="w-1 bg-emerald-500/60 rounded-sm" style="height:80%"></div>
          <div class="w-1 bg-emerald-500 rounded-sm" style="height:100%"></div>
        </div>
      </div>
    </div>

    <!-- Color Buttons -->
    <div>
      <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Colors</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="c in colors"
          :key="c.code"
          @click="insertCode('§' + c.code)"
          :title="c.name"
          class="w-8 h-8 sm:w-6 sm:h-6 rounded text-xs sm:text-[10px] font-bold font-mono border transition-all hover:scale-110 active:scale-95"
          :style="{ background: c.hex, color: c.textColor }"
          :class="c.code === 'r' ? 'border-gray-600' : 'border-transparent'"
        >
          {{ c.label }}
        </button>
      </div>
    </div>

    <!-- Format Buttons -->
    <div>
      <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Format</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="f in formats"
          :key="f.code"
          @click="insertCode('§' + f.code)"
          :title="f.name"
          class="px-3 py-2 sm:px-2 sm:py-1 text-xs sm:text-[10px] font-mono font-bold uppercase rounded border border-gray-700 bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-600 transition-all"
        >
          {{ f.label }}
        </button>
        <button
          @click="insertCode('§r')"
          title="Reset formatting"
          class="px-3 py-2 sm:px-2 sm:py-1 text-xs sm:text-[10px] font-mono font-bold uppercase rounded border border-rose-900/50 bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 transition-all"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Text Input -->
    <div>
      <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Raw text</span>
      <textarea
        ref="textInput"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target).value)"
        @keydown.enter.prevent="insertCode('\\n')"
        rows="2"
        spellcheck="false"
        class="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-fuchsia-700/50 transition-colors resize-none"
        placeholder="§6Welcome to §l§eMy Server§r\n§7Build • Survive • Explore"
      ></textarea>
      <p class="text-[9px] font-mono text-gray-600 mt-1">
        Tip: Use <kbd class="px-1 py-0.5 bg-gray-800 rounded text-[8px]">\n</kbd> for line 2
      </p>
    </div>

    <!-- Raw code display -->
    <div class="bg-gray-900 rounded border border-gray-800 px-3 py-1.5">
      <span class="text-[9px] font-mono text-gray-600 block mb-0.5">Raw §-code</span>
      <code class="text-[10px] font-mono text-amber-400/80 break-all">{{ modelValue || '(empty)' }}</code>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  playerCount: { type: String, default: '1/10' },
  iconUrl: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);

const textInput = ref(null);

// --- Minecraft color map ---
const colors = [
  { code: '0', name: 'Black',       hex: '#000000', label: '0', textColor: '#ffffff' },
  { code: '1', name: 'Dark Blue',   hex: '#0000AA', label: '1', textColor: '#ffffff' },
  { code: '2', name: 'Dark Green',  hex: '#00AA00', label: '2', textColor: '#ffffff' },
  { code: '3', name: 'Dark Aqua',   hex: '#00AAAA', label: '3', textColor: '#000000' },
  { code: '4', name: 'Dark Red',    hex: '#AA0000', label: '4', textColor: '#ffffff' },
  { code: '5', name: 'Dark Purple', hex: '#AA00AA', label: '5', textColor: '#ffffff' },
  { code: '6', name: 'Gold',        hex: '#FFAA00', label: '6', textColor: '#000000' },
  { code: '7', name: 'Gray',        hex: '#AAAAAA', label: '7', textColor: '#000000' },
  { code: '8', name: 'Dark Gray',   hex: '#555555', label: '8', textColor: '#ffffff' },
  { code: '9', name: 'Blue',        hex: '#5555FF', label: '9', textColor: '#ffffff' },
  { code: 'a', name: 'Green',       hex: '#55FF55', label: 'a', textColor: '#000000' },
  { code: 'b', name: 'Aqua',        hex: '#55FFFF', label: 'b', textColor: '#000000' },
  { code: 'c', name: 'Red',         hex: '#FF5555', label: 'c', textColor: '#000000' },
  { code: 'd', name: 'Light Purple',hex: '#FF55FF', label: 'd', textColor: '#000000' },
  { code: 'e', name: 'Yellow',      hex: '#FFFF55', label: 'e', textColor: '#000000' },
  { code: 'f', name: 'White',       hex: '#FFFFFF', label: 'f', textColor: '#000000' },
];

const formats = [
  { code: 'l', name: 'Bold',          label: 'B' },
  { code: 'o', name: 'Italic',        label: 'I' },
  { code: 'n', name: 'Underline',     label: 'U' },
  { code: 'm', name: 'Strikethrough', label: 'S' },
  { code: 'k', name: 'Obfuscated',    label: '??' },
];

// --- Parse § codes into HTML ---
const colorMap = Object.fromEntries(colors.map(c => [c.code, c.hex]));
const formatMap = {
  l: 'font-weight:bold',
  o: 'font-style:italic',
  n: 'text-decoration:underline',
  m: 'text-decoration:line-through',
  k: 'filter:blur(1px)',
};

const renderedMotd = computed(() => {
  const text = props.modelValue || '';
  if (!text) return '';

  // Split by \n for two-line MOTD
  const lines = text.split('\\n');
  return lines.map(line => renderLine(line)).join('<br>');
});

function renderLine(text) {
  if (!text) return '';
  let html = '';
  let currentColor = '#aaaaaa'; // default gray
  let currentFormats = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === '§' && i + 1 < text.length) {
      const code = text[i + 1];
      if (code === 'r') {
        currentColor = '#aaaaaa';
        currentFormats = [];
        i += 2;
      } else if (colorMap[code]) {
        currentColor = colorMap[code];
        currentFormats = [];
        i += 2;
      } else if (formatMap[code]) {
        currentFormats.push(formatMap[code]);
        i += 2;
      } else {
        // Unknown code — display the § and code literally
        const chunk = ('§' + code).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const style = `color:${currentColor};${currentFormats.join(';')}`;
        html += `<span style="${style}">${chunk}</span>`;
        i += 2;
      }
    } else {
      let j = i + 1;
      while (j < text.length && text[j] !== '§') j++;
      const chunk = text.slice(i, j).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const style = `color:${currentColor};${currentFormats.join(';')}`;
      html += `<span style="${style}">${chunk}</span>`;
      i = j;
    }
  }

  return html || '<span style="color:#aaaaaa"> </span>';
}

// --- Insert § code at cursor position ---
function insertCode(code) {
  if (!textInput.value) return;
  
  const start = textInput.value.selectionStart;
  const end = textInput.value.selectionEnd;
  const text = props.modelValue;
  const newText = text.slice(0, start) + code + text.slice(end);
  
  emit('update:modelValue', newText);
  
  // Restore focus and cursor position after code insertion
  setTimeout(() => {
    textInput.value.focus();
    textInput.value.setSelectionRange(start + code.length, start + code.length);
  }, 0);
}
</script>
