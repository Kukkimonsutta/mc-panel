<template>
  <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
    <!-- Server Info Bar (shown when query data is available) -->
    <div v-if="running && version" class="bg-gray-950/60 px-4 py-2 border-b border-indigo-950/30 flex flex-wrap items-center gap-x-4 gap-y-1">
      <span class="text-[10px] font-mono text-indigo-400/80 uppercase tracking-wider flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        {{ software || '?' }} {{ version }}
      </span>
      <span v-if="map" class="text-[10px] font-mono text-emerald-400/70 uppercase tracking-wider flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
        {{ map }}
      </span>
      <span v-if="plugins && plugins.length > 0" class="text-[10px] font-mono text-fuchsia-400/70 uppercase tracking-wider flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        {{ plugins.length }} plugin{{ plugins.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Header -->
    <div class="bg-gray-900/40 px-4 py-3 border-b border-indigo-950/40 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full" :class="running ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'"></span>
        <span class="text-xs font-mono uppercase tracking-widest text-indigo-400">Active Players //</span>
      </div>
      <span class="text-xs font-mono font-bold text-gray-300">
        {{ onlinePlayers }}<span class="text-gray-600">/{{ maxPlayers }}</span>
      </span>
    </div>

    <!-- Player Grid -->
    <div class="p-4">
      <div v-if="!running" class="text-center py-6">
        <span class="text-xs font-mono text-gray-600 uppercase tracking-wider">Server offline</span>
      </div>
      <div v-else-if="players.length === 0" class="text-center py-6">
        <span class="text-xs font-mono text-gray-600 uppercase tracking-wider">No players online</span>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div
          v-for="player in players"
          :key="player"
          class="flex flex-col items-center gap-2 bg-gray-950/80 p-3 rounded-lg border border-gray-900 hover:border-indigo-800/50 transition-colors group"
        >
          <!-- Player Head -->
          <div class="relative">
            <img
              :src="`https://mc-heads.net/avatar/${player}/48`"
              :alt="player"
              class="w-12 h-12 rounded-sm pixelated"
              loading="lazy"
            />
            <div class="absolute inset-0 rounded-sm ring-1 ring-inset ring-white/5 group-hover:ring-indigo-400/30 transition-all"></div>
          </div>
          <!-- Player Name -->
          <span class="text-[11px] font-mono font-bold text-gray-300 truncate max-w-[80px] text-center group-hover:text-indigo-300 transition-colors">
            {{ player }}
          </span>
          <!-- Player Actions -->
          <div class="flex items-center gap-0.5" @click.stop>
            <button @click="askAction('kick', player)" title="Kick player" class="p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-amber-950/30 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
            </button>
            <button @click="askAction('ban', player)" title="Ban player" class="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            </button>
            <button @click="doAction('op', player)" title="Make operator" class="p-1 rounded text-gray-500 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Player action confirmation modal -->
    <Transition name="fade">
      <div v-if="pending" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="pending = null">
        <div class="bg-gray-900 border border-rose-800/50 rounded-xl p-6 max-w-sm w-full shadow-2xl">
          <h3 class="text-sm font-mono font-bold text-white mb-2 capitalize">{{ pending.action }} player</h3>
          <p class="text-xs font-mono text-gray-400 mb-3 break-all">{{ pending.player }}</p>
          <label class="block mb-4">
            <span class="text-[10px] font-mono uppercase tracking-wider text-gray-500 block mb-1">Reason (optional)</span>
            <input v-model="reason" type="text" maxlength="256" class="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-rose-700/50 transition-colors" spellcheck="false" />
          </label>
          <label v-if="pending && pending.action === 'ban'" class="block mb-4">
            <span class="text-[10px] font-mono uppercase tracking-wider text-gray-500 block mb-1">Duration in hours (optional, empty = permanent)</span>
            <input v-model="banHours" type="number" min="0.1" max="8760" step="0.5" class="w-full bg-gray-950 border border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-rose-700/50 transition-colors" />
          </label>
          <p v-if="actionError" class="text-[10px] font-mono text-rose-400 mb-3">✗ {{ actionError }}</p>
          <div class="flex gap-2 justify-end">
            <button @click="pending = null" class="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-200 rounded border border-gray-700 hover:border-gray-600 transition-colors">Cancel</button>
            <button @click="confirmPending" :disabled="acting" class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white rounded border border-rose-500 transition-colors">{{ acting ? 'Working…' : 'Confirm' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../lib/api.js';

defineProps({
  players: {
    type: Array,
    default: () => []
  },
  onlinePlayers: {
    type: Number,
    default: 0
  },
  maxPlayers: {
    type: Number,
    default: 10
  },
  running: {
    type: Boolean,
    default: false
  },
  version: {
    type: String,
    default: ''
  },
  software: {
    type: String,
    default: ''
  },
  map: {
    type: String,
    default: ''
  },
  plugins: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['players-changed']);

const pending = ref(null); // { action, player }
const reason = ref('');
const banHours = ref('');
const acting = ref(false);
const actionError = ref('');

function askAction(action, player) {
  reason.value = '';
  banHours.value = '';
  actionError.value = '';
  pending.value = { action, player };
}

function confirmPending() {
  if (!pending.value || acting.value) return;
  const { action, player } = pending.value;
  if (action === 'ban' && banHours.value !== '') {
    const hours = parseFloat(banHours.value);
    if (!Number.isFinite(hours) || hours < 0.1 || hours > 8760) {
      actionError.value = 'Duration must be between 0.1 and 8760 hours';
      return;
    }
    doTempBan(player, hours);
    return;
  }
  doAction(action, player);
}

async function doTempBan(player, hours) {
  acting.value = true;
  actionError.value = '';
  try {
    const res = await api.tempBan({ player, reason: reason.value.trim() || undefined, hours });
    if (!res.success) throw new Error(res.error || 'Temp ban failed');
    pending.value = null;
    emit('players-changed');
  } catch (e) {
    actionError.value = e.message || 'Temp ban failed';
  } finally {
    acting.value = false;
  }
}

async function doAction(action, player) {
  acting.value = true;
  actionError.value = '';
  try {
    const res = await api.playerAction({ action, player, reason: reason.value.trim() || undefined });
    if (!res.success) throw new Error(res.error || 'Action failed');
    pending.value = null;
    emit('players-changed');
  } catch (e) {
    actionError.value = e.message || 'Action failed';
  } finally {
    acting.value = false;
  }
}
</script>

<style scoped>
.pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
