<template>
  <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
    <!-- Header -->
    <div class="bg-gray-900/40 px-4 py-3 border-b border-indigo-950/40 flex items-center gap-2">
      <span class="text-xs font-mono uppercase tracking-widest text-indigo-400">Quick Ops //</span>
      <span v-if="!running" class="text-[10px] font-mono text-gray-600 ml-auto">offline</span>
    </div>

    <!-- Command Grid -->
    <div class="p-4">
      <!-- Command Buttons -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
        <button
          v-for="btn in quickButtons"
          :key="btn.label"
          @click="openForm(btn)"
          :disabled="!running || sending"
          class="py-2 px-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded border transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          :class="getButtonClass(btn.label)"
        >
          {{ btn.label }}
        </button>
      </div>

      <!-- Inline Command Form -->
      <Transition name="form-slide">
        <div
          v-if="activeForm"
          class="bg-gray-950/90 rounded-lg border border-indigo-900/40 p-3 space-y-2"
        >
          <!-- Form Header -->
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-mono uppercase tracking-wider text-fuchsia-400">
              {{ activeForm.label }} //
            </span>
            <button
              @click="closeForm"
              class="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Player Selector — clickable grid of online players -->
          <div v-if="activeForm.needsPlayer">
            <!-- Clickable player chips -->
            <div v-if="props.players.length > 0" class="mb-2">
              <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Online players — click to select</span>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="p in props.players"
                  :key="p"
                  @click="playerName = p"
                  type="button"
                  class="px-2 py-1 text-[10px] font-mono rounded border transition-all"
                  :class="playerName === p
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-indigo-700/40 hover:text-gray-200'"
                >
                  {{ p }}
                </button>
              </div>
            </div>
            <div v-else class="text-[10px] font-mono text-gray-600 mb-1">No players online — type manually</div>
            <!-- Manual input fallback -->
            <input
              ref="playerInput"
              v-model="playerName"
              @keyup.enter="executeCommand"
              type="text"
              placeholder="Or type player name..."
              class="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-600 transition-colors"
            />
          </div>

          <!-- Target Selector (for TP) — same clickable grid + manual input -->
          <div v-if="activeForm.needsTarget">
            <div v-if="props.players.length > 0" class="mb-2">
              <span class="text-[9px] font-mono uppercase text-gray-500 block mb-1.5">Target player — click to select</span>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="p in props.players"
                  :key="'tgt-'+p"
                  @click="targetName = p"
                  type="button"
                  class="px-2 py-1 text-[10px] font-mono rounded border transition-all"
                  :class="targetName === p
                    ? 'bg-violet-600/30 text-violet-300 border-violet-500/50'
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-violet-700/40 hover:text-gray-200'"
                >
                  {{ p }}
                </button>
              </div>
            </div>
            <div v-else class="text-[10px] font-mono text-gray-600 mb-1">No players online — type manually</div>
            <input
              v-model="targetName"
              @keyup.enter="executeCommand"
              type="text"
              placeholder="Or type target name..."
              class="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-600 transition-colors"
            />
          </div>

          <!-- Gamemode Selector -->
          <div v-if="activeForm.label === 'Gamemode'">
            <select
              v-model="gamemode"
              class="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs font-mono text-gray-200 focus:outline-none focus:border-indigo-600 transition-colors appearance-none cursor-pointer"
            >
              <option value="survival">Survival</option>
              <option value="creative">Creative</option>
              <option value="adventure">Adventure</option>
              <option value="spectator">Spectator</option>
            </select>
          </div>

          <!-- Message Input (for Say) -->
          <div v-if="activeForm.label === 'Say'">
            <input
              v-model="sayMessage"
              @keyup.enter="executeCommand"
              type="text"
              placeholder="Broadcast message..."
              class="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-600 transition-colors"
            />
          </div>

          <!-- Action buttons -->
          <div class="flex gap-2 pt-1">
            <button
              @click="executeCommand"
              :disabled="sending"
              class="flex-1 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded border border-indigo-500 transition-colors"
            >
              {{ sending ? 'Sending...' : 'Execute' }}
            </button>
            <button
              @click="closeForm"
              class="py-1.5 px-3 text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-gray-300 rounded border border-gray-800 hover:border-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          <!-- Result feedback -->
          <div
            v-if="lastResult"
            class="text-[10px] font-mono px-2 py-1 rounded border"
            :class="lastResult.success ? 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20' : 'text-rose-400 border-rose-900/40 bg-rose-950/20'"
          >
            {{ lastResult.success ? '✓ Command sent' : '✗ ' + lastResult.error }}
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue';
import { api } from '../lib/api.js';

const props = defineProps({
  running: { type: Boolean, default: false },
  players: { type: Array, default: () => [] }
});

const emit = defineEmits(['command-sent']);

// Command definitions
const quickButtons = [
  { label: 'OP', commandPrefix: 'op', needsPlayer: true, needsTarget: false },
  { label: 'DEOP', commandPrefix: 'deop', needsPlayer: true, needsTarget: false },
  { label: 'TP', commandPrefix: 'tp', needsPlayer: true, needsTarget: true },
  { label: 'Kick', commandPrefix: 'kick', needsPlayer: true, needsTarget: false },
  { label: 'Ban', commandPrefix: 'ban', needsPlayer: true, needsTarget: false },
  { label: 'Gamemode', commandPrefix: 'gamemode', needsPlayer: true, needsTarget: false },
  { label: 'Whitelist', commandPrefix: 'whitelist', needsPlayer: true, needsTarget: false },
  { label: 'Say', commandPrefix: 'say', needsPlayer: false, needsTarget: false },
];

// Form state
const activeForm = ref(null);
const playerName = ref('');
const targetName = ref('');
const gamemode = ref('survival');
const sayMessage = ref('');
const sending = ref(false);
const lastResult = ref(null);
const playerInput = ref(null);

// Button style per command type
function getButtonClass(label) {
  const classes = {
    'OP': 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40 hover:bg-emerald-900/30 hover:border-emerald-700/50',
    'DEOP': 'bg-rose-950/40 text-rose-400 border-rose-900/40 hover:bg-rose-900/30 hover:border-rose-700/50',
    'TP': 'bg-violet-950/40 text-violet-400 border-violet-900/40 hover:bg-violet-900/30 hover:border-violet-700/50',
    'Kick': 'bg-amber-950/40 text-amber-400 border-amber-900/40 hover:bg-amber-900/30 hover:border-amber-700/50',
    'Ban': 'bg-red-950/40 text-red-400 border-red-900/40 hover:bg-red-900/30 hover:border-red-700/50',
    'Gamemode': 'bg-cyan-950/40 text-cyan-400 border-cyan-900/40 hover:bg-cyan-900/30 hover:border-cyan-700/50',
    'Whitelist': 'bg-sky-950/40 text-sky-400 border-sky-900/40 hover:bg-sky-900/30 hover:border-sky-700/50',
    'Say': 'bg-fuchsia-950/40 text-fuchsia-400 border-fuchsia-900/40 hover:bg-fuchsia-900/30 hover:border-fuchsia-700/50',
  };
  return classes[label] || 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700';
}

function openForm(btn) {
  if (!props.running || sending.value) return;
  activeForm.value = btn;
  playerName.value = '';
  targetName.value = '';
  gamemode.value = 'survival';
  sayMessage.value = '';
  lastResult.value = null;

  nextTick(() => {
    if (playerInput.value) playerInput.value.focus();
  });
}

function closeForm() {
  activeForm.value = null;
  lastResult.value = null;
}

async function executeCommand() {
  if (sending.value || !activeForm.value) return;

  const form = activeForm.value;
  let cmd = form.commandPrefix;

  // Build command string
  if (form.label === 'Gamemode') {
    cmd += ` ${gamemode.value}`;
  }

  if (form.needsPlayer) {
    const name = playerName.value.trim();
    if (!name) return;
    cmd += ` ${name}`;
  }

  if (form.needsTarget) {
    const target = targetName.value.trim();
    if (!target) return;
    cmd += ` ${target}`;
  }

  if (form.label === 'Say') {
    const msg = sayMessage.value.trim();
    if (!msg) return;
    cmd += ` ${msg}`;
  }

  if (form.label === 'Whitelist') {
    // Default to 'whitelist add' — the user can manually type 'remove' if needed
    // But for the form submission, just send 'whitelist add <player>'
    const name = playerName.value.trim();
    cmd = `whitelist add ${name}`;
  }

  sending.value = true;
  lastResult.value = null;

  try {
    const res = await api.sendCommand(cmd);
    lastResult.value = res;
    emit('command-sent', cmd);
    // Auto-close on success after a brief moment so the user sees the ✓ feedback
    if (res.success) {
      setTimeout(() => closeForm(), 600);
    }
  } catch (err) {
    lastResult.value = { success: false, error: err.message || 'Connection error' };
  } finally {
    sending.value = false;
  }
}

// Close form when server goes offline
watch(() => props.running, (val) => {
  if (!val) closeForm();
});
</script>

<style scoped>
.form-slide-enter-active,
.form-slide-leave-active {
  transition: all 0.2s ease;
}
.form-slide-enter-from,
.form-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
