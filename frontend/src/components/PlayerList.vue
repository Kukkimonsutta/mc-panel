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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
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
</script>

<style scoped>
.pixelated {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
