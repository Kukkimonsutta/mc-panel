<template>
  <div class="min-h-dvh p-3 sm:p-6 max-w-6xl mx-auto flex flex-col gap-4 sm:gap-6">
    
    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b-2 border-indigo-900/50 pb-3 sm:pb-4">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg sm:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-indigo-400 font-mono">
              MC SERVER - CONTROL PANEL
            </h1>
          </div>
          <p class="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest font-mono mt-0.5 sm:mt-1">Minecraft admin console</p>
        </div>
        <!-- Tab Navigation -->
        <div class="flex items-center gap-1 bg-gray-950 rounded-lg border border-gray-800 p-0.5">
          <button
            @click="currentView = 'dashboard'"
            class="flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-2.5 sm:py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-all"
            :class="currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'"
          >Dashboard</button>
          <button
            @click="currentView = 'settings'"
            class="flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-2.5 sm:py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-all"
            :class="currentView === 'settings' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'"
          >Settings</button>
          <button
            @click="currentView = 'players'"
            class="flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-2.5 sm:py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-all"
            :class="currentView === 'players' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'"
          >Players</button>
        </div>
      </div>
      
      <!-- Status and power control -->
      <button
        @click="togglePower"
        :disabled="isToggling"
        :aria-label="serverInfo.running ? 'Stop Minecraft server' : 'Start Minecraft server'"
        class="flex items-center justify-center sm:justify-start gap-3 bg-gray-950 px-3 py-2.5 rounded-lg border transition-all duration-300 w-full sm:w-auto disabled:opacity-50 disabled:cursor-wait"
        :class="serverInfo.running ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]'"
      >
        <span 
          class="h-2.5 w-2.5 rounded-full"
          :class="serverInfo.running ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'"
        ></span>
        <span
          class="text-[11px] font-mono font-bold tracking-widest uppercase"
          :class="serverInfo.running ? 'text-emerald-400' : 'text-rose-500'"
        >
          {{ serverInfo.running ? 'ONLINE' : 'OFFLINE' }}
        </span>
        <span
          class="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-300"
          :class="serverInfo.running ? 'bg-emerald-500' : 'bg-gray-700'"
          aria-hidden="true"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 translate-y-0.5 transform rounded-full bg-white shadow transition duration-300"
            :class="serverInfo.running ? 'translate-x-4' : 'translate-x-0.5'"
          />
        </span>
      </button>
    </header>

    <!-- ===== DASHBOARD VIEW ===== -->
    <template v-if="currentView === 'dashboard'">

    <!-- Server Data -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 p-4 sm:p-6 rounded-xl border border-indigo-950/50">
        <h2 class="text-xs font-bold text-indigo-400 tracking-wider uppercase font-mono mb-4">Server Data //</h2>
        
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <!-- CPU Gauge -->
          <div class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
            <span class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1">CPU</span>
            <div class="flex items-end gap-1.5">
              <span class="text-sm font-mono font-bold" :class="stats.cpu > 80 ? 'text-rose-400' : stats.cpu > 50 ? 'text-amber-400' : 'text-emerald-400'">{{ stats.cpu }}<span class="text-[10px] text-gray-600">%</span></span>
            </div>
            <div class="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700" :class="stats.cpu > 80 ? 'bg-rose-500' : stats.cpu > 50 ? 'bg-amber-500' : 'bg-emerald-500'" :style="{ width: Math.min(stats.cpu, 100) + '%' }"></div>
            </div>
          </div>
          <!-- RAM Gauge -->
          <div class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
            <span class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1">RAM</span>
            <div class="flex items-end gap-1.5 min-w-0">
              <span class="text-xs sm:text-sm font-mono font-bold truncate" :class="stats.ramPercent > 80 ? 'text-rose-400' : stats.ramPercent > 50 ? 'text-amber-400' : 'text-emerald-400'">{{ stats.ramUsed }}<span class="text-[10px] text-gray-600">/{{ stats.ramTotal }}MB</span></span>
            </div>
            <div class="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700" :class="stats.ramPercent > 80 ? 'bg-rose-500' : stats.ramPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'" :style="{ width: Math.min(stats.ramPercent, 100) + '%' }"></div>
            </div>
          </div>
          <!-- Real server version -->
          <div class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
            <span class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1">Version</span>
            <span class="text-sm font-mono font-bold text-gray-100 truncate block" :title="serverInfo.version || 'Unknown'">
              {{ serverInfo.version || 'Unknown' }}
            </span>
          </div>
          <!-- World name -->
          <div class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
            <span class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1">World</span>
            <span class="text-xs font-mono font-bold text-emerald-400 truncate block" :title="serverInfo.worldName || serverInfo.map || 'world'">
              {{ serverInfo.worldName || serverInfo.map || '—' }}
            </span>
          </div>
          <!-- Server uptime -->
          <div class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
            <span class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1">Time Online</span>
            <span class="text-sm font-mono font-bold text-cyan-400 truncate block">
              {{ onlineDuration }}
            </span>
          </div>
        </div>
    </div>

    <!-- Player Management Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <div class="lg:col-span-2">
        <PlayerList 
          :players="serverInfo.players || []" 
          :online-players="serverInfo.onlinePlayers || 0"
          :max-players="serverInfo.maxPlayers || 10"
          :running="serverInfo.running"
          :version="serverInfo.version || ''"
          :software="serverInfo.software || ''"
          :map="serverInfo.map || ''"
          :plugins="serverInfo.plugins || []"
          @players-changed="refreshPlayers"
        />
      </div>
      <div class="lg:col-span-1">
        <FastCommands 
          :running="serverInfo.running"
          :players="serverInfo.players || []"
          @command-sent="onCommandSent"
        />
      </div>
    </div>

    <!-- Consola de Logs Estilo Hacker -->
    <div class="bg-gray-950 rounded-xl border border-indigo-950/40 overflow-hidden flex flex-col flex-1 min-h-[250px] sm:min-h-[400px]">
      <div class="bg-gray-900/40 px-4 py-3 border-b border-indigo-950/40 flex justify-between items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
          <span class="text-xs font-mono uppercase tracking-widest text-indigo-400">stdout::terminal_bridge</span>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="logFilter"
            type="text"
            placeholder="Filter logs..."
            class="w-28 sm:w-36 bg-gray-950 border border-gray-800 rounded px-2.5 py-1 text-[10px] font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-700/50 transition-colors"
            spellcheck="false"
          />
          <button 
            @click="clearConsole" 
            class="text-[10px] font-mono uppercase tracking-wider text-indigo-500 hover:text-indigo-300 transition-colors bg-indigo-950/30 hover:bg-indigo-900/30 px-2 py-1 rounded border border-indigo-900/50"
          >
            Clear
          </button>
        </div>
      </div>
      
      <!-- Terminal -->
      <div ref="terminal" class="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 scrollbar-custom">
        <template v-for="(log, idx) in filteredLogs" :key="idx">
          <div class="text-slate-300 leading-relaxed whitespace-pre-wrap">
            <span class="text-indigo-500/50 select-none mr-2 font-bold">»</span>{{ log }}
          </div>
        </template>
        <div v-if="filteredLogs.length === 0 && logs.length > 0" class="text-slate-600 italic font-mono p-2">No matching logs...</div>
        <div v-if="logs.length === 0" class="text-slate-600 italic font-mono p-2">No terminal stdout streams captured...</div>
      </div>

      <!-- Command Input Bar -->
      <div class="border-t border-indigo-950/40 px-4 py-2 flex items-center gap-2 bg-gray-900/40">
        <span class="text-indigo-500 font-mono text-xs select-none font-bold">❯</span>
        <input
          ref="commandInput"
          v-model="commandText"
          @keydown="handleCommandKeydown"
          type="text"
          :placeholder="serverInfo.running ? 'Type /help for commands...' : 'Server offline...'"
          :disabled="!serverInfo.running || isSendingCommand"
          class="flex-1 bg-transparent border-none outline-none text-xs font-mono text-gray-200 placeholder-gray-600 disabled:opacity-40"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
    </div>

    </template>
    <!-- ===== END DASHBOARD VIEW ===== -->

    <!-- ===== SETTINGS VIEW ===== -->
    <SettingsPanel
      v-if="currentView === 'settings'"
    />
    <!-- ===== END SETTINGS VIEW ===== -->

    <!-- ===== PLAYERS VIEW ===== -->
    <PlayerManager
      v-if="currentView === 'players'"
    />
    <!-- ===== END PLAYERS VIEW ===== -->

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { api, createSocketConnection } from './lib/api.js';
import PlayerList from './components/PlayerList.vue';
import FastCommands from './components/FastCommands.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import PlayerManager from './components/PlayerManager.vue';

// View switching
const currentView = ref('dashboard');

const serverInfo = ref({ status: 'offline', running: false, startedAt: null, worldName: '', players: [] });
const logs = ref([]);
const terminal = ref(null);
const commandInput = ref(null);
const isToggling = ref(false);
const isSendingCommand = ref(false);
const currentTime = ref(Date.now());
let uptimeInterval = null;

const onlineDuration = computed(() => {
  if (!serverInfo.value.running || !serverInfo.value.startedAt) return '—';

  const elapsedSeconds = Math.max(0, Math.floor((currentTime.value - Date.parse(serverInfo.value.startedAt)) / 1000));
  const days = Math.floor(elapsedSeconds / 86400);
  const hours = Math.floor((elapsedSeconds % 86400) / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
});

// Resource stats
const stats = ref({ cpu: 0, ramUsed: 0, ramTotal: 0, ramPercent: 0 });

// Log filtering
const logFilter = ref('');
const filteredLogs = computed(() => {
  if (!logFilter.value) return logs.value;
  const q = logFilter.value.toLowerCase();
  return logs.value.filter(l => l.toLowerCase().includes(q));
});

// Stats polling
let statsInterval = null;
const fetchStats = async () => {
  try {
    stats.value = await api.getStats();
  } catch (err) {
    console.error('Error fetching stats:', err.message);
  }
};

// Command history for up/down arrow navigation
const commandText = ref('');
const commandHistory = ref([]);
const historyIndex = ref(-1);

let socket = null;
let playerPollInterval = null;

// Helper: push log line and cap to last 30 entries
const pushLog = (line) => {
  logs.value.push(line);
  if (logs.value.length > 30) {
    logs.value = logs.value.slice(-30);
  }
};

// Obtener estado del servidor vía REST
const fetchStatus = async () => {
  try {
    const res = await api.getStatus();
    // Solo actualizamos el estado de Docker — NUNCA pisamos jugadores/datos de query
    serverInfo.value.running = res.running;
    serverInfo.value.status = res.status;
    serverInfo.value.startedAt = res.startedAt || null;
    serverInfo.value.worldName = res.worldName || '';
    // Solo establecemos jugadores si aún no hay datos de query
    if (!serverInfo.value.players || serverInfo.value.players.length === 0) {
      serverInfo.value.players = res.players || [];
      serverInfo.value.onlinePlayers = res.onlinePlayers || 0;
      serverInfo.value.maxPlayers = res.maxPlayers || 10;
    }
  } catch (err) {
    console.error('Error al conectar con la API:', err.message);
  }
};

// Obtener datos enriquecidos vía Query (jugadores completos, versión, software, mapa)
const fetchQuery = async () => {
  if (!serverInfo.value.running) return;
  try {
    const res = await api.getQuery();
    if (res.running) {
      // Merge con los datos actuales — query siempre tiene prioridad
      serverInfo.value = { ...serverInfo.value, ...res };
    }
  } catch (err) {
    // Silenciamos errores de query — puede fallar mientras el servidor arranca
    console.debug('Query failed (server may be starting):', err.message);
  }
};

// Refrescar jugadores después de acciones de gestión (kick/ban/op)
const refreshPlayers = async () => {
  try {
    const [statusRes, queryRes] = await Promise.allSettled([api.getStatus(), api.getQuery()]);
    if (statusRes.status === 'fulfilled') {
      serverInfo.value.running = statusRes.value.running;
      serverInfo.value.status = statusRes.value.status;
      serverInfo.value.startedAt = statusRes.value.startedAt || null;
      if (!serverInfo.value.players || serverInfo.value.players.length === 0) {
        serverInfo.value.players = statusRes.value.players || [];
        serverInfo.value.onlinePlayers = statusRes.value.onlinePlayers || 0;
        serverInfo.value.maxPlayers = statusRes.value.maxPlayers || 10;
      }
    }
    if (queryRes.status === 'fulfilled' && queryRes.value?.running) {
      serverInfo.value = { ...serverInfo.value, ...queryRes.value };
    }
  } catch (err) {
    console.debug('[refreshPlayers] error:', err.message);
  }
};

// Toggle Inteligente de Energía
const togglePower = async () => {
  if (isToggling.value) return;
  isToggling.value = true;
  
  const targetAction = serverInfo.value.running ? 'stop' : 'start';
  try {
    pushLog(`⚡ Iniciando secuencia de: ${targetAction.toUpperCase()}...`);
    scrollToBottom();
    
    const result = targetAction === 'start' ? await api.startServer() : await api.stopServer();
    if (!result.success) {
      throw new Error(result.error || `Failed to ${targetAction} server`);
    }
    await fetchStatus();
    if (targetAction === 'start') fetchQuery();
  } catch (err) {
    console.error(`Error al ejecutar ${targetAction}:`, err.message);
    pushLog(`❌ Fallo en secuencia ${targetAction.toUpperCase()}: ${err.message}`);
    scrollToBottom();
  } finally {
    // Retraso para evitar pulsaciones repetitivas rápidas en el hardware
    setTimeout(() => {
      isToggling.value = false;
    }, 1500);
  }
};

const clearConsole = () => {
  logs.value = [];
};

const scrollToBottom = async () => {
  await nextTick();
  if (terminal.value) {
    terminal.value.scrollTop = terminal.value.scrollHeight;
  }
};

// --- Console Command Input ---

const sendConsoleCommand = async () => {
  const cmd = commandText.value.trim();
  if (!cmd || isSendingCommand.value || !serverInfo.value.running) return;

  // Add to history
  commandHistory.value.unshift(cmd);
  if (commandHistory.value.length > 50) commandHistory.value.pop();
  historyIndex.value = -1;

  isSendingCommand.value = true;
  pushLog(`❯ ${cmd}`);
  scrollToBottom();

  try {
    const result = await api.sendCommand(cmd);
    if (!result.success) {
      pushLog(`✗ Error: ${result.error || 'Command failed'}`);
    }
    // Output will appear in the log stream via WebSocket
  } catch (err) {
    pushLog(`✗ Error: ${err.message || 'Failed to send command'}`);
    scrollToBottom();
  } finally {
    isSendingCommand.value = false;
    commandText.value = '';
    commandInput.value?.focus();
  }
};

const handleCommandKeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendConsoleCommand();
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (commandHistory.value.length === 0) return;
    if (historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++;
    }
    commandText.value = commandHistory.value[historyIndex.value];
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex.value > 0) {
      historyIndex.value--;
      commandText.value = commandHistory.value[historyIndex.value];
    } else if (historyIndex.value === 0) {
      historyIndex.value = -1;
      commandText.value = '';
    }
    return;
  }
};

// Called when FastCommands emits a command
const onCommandSent = (cmd) => {
  pushLog(`❯ ${cmd}`);
  scrollToBottom();
  // Also add to console history for consistency
  if (!commandHistory.value.includes(cmd)) {
    commandHistory.value.unshift(cmd);
    if (commandHistory.value.length > 50) commandHistory.value.pop();
  }
};

// Focus console input on '/' key press — only when on dashboard
const handleGlobalKeydown = (e) => {
  if (currentView.value !== 'dashboard') return; // Don't capture on other views
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // Don't capture if already focused on an input
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    commandInput.value?.focus();
  }
};

// Start/stop player polling based on server state
const startPlayerPolling = () => {
  if (playerPollInterval) return;
  playerPollInterval = setInterval(async () => {
    if (!serverInfo.value.running) return;

    try {
      const [statusRes, queryRes] = await Promise.allSettled([
        api.getStatus(),
        api.getQuery(),
      ]);

      // Status: SOLO actualizar el flag running
      if (statusRes.status === 'fulfilled') {
        serverInfo.value.running = statusRes.value.running;
        serverInfo.value.status = statusRes.value.status;
        serverInfo.value.startedAt = statusRes.value.startedAt || null;
        serverInfo.value.worldName = statusRes.value.worldName || '';
      }

      // Query: datos completos (jugadores, versión, software, mapa)
      if (queryRes.status === 'fulfilled' && queryRes.value?.running) {
        // Siempre mergeamos query data — tiene prioridad total
        const merged = { ...serverInfo.value, ...queryRes.value };

        // Si query devolvió fallback TCP (sin players), intentar usar status data
        if ((!queryRes.value.players || queryRes.value.players.length === 0) &&
            statusRes.status === 'fulfilled' &&
            statusRes.value.players?.length > 0) {
          merged.players = statusRes.value.players;
          merged.onlinePlayers = statusRes.value.onlinePlayers;
          merged.maxPlayers = statusRes.value.maxPlayers;
        }

        serverInfo.value = merged;
      } else if (statusRes.status === 'fulfilled') {
        // Query falló del todo — usar status como respaldo, pero sin pisar datos previos
        if (!serverInfo.value.players || serverInfo.value.players.length === 0) {
          serverInfo.value.players = statusRes.value.players || [];
          serverInfo.value.onlinePlayers = statusRes.value.onlinePlayers || 0;
          serverInfo.value.maxPlayers = statusRes.value.maxPlayers || 10;
        }
      }
    } catch (err) {
      console.error('[poll] error:', err.message || err);
    }
  }, 8000);
};

const stopPlayerPolling = () => {
  if (playerPollInterval) {
    clearInterval(playerPollInterval);
    playerPollInterval = null;
  }
};

onMounted(() => {
  fetchStatus().then(() => fetchQuery());
  startPlayerPolling();
  fetchStats();
  statsInterval = setInterval(fetchStats, 5000);
  uptimeInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
  document.addEventListener('keydown', handleGlobalKeydown);
  
  socket = createSocketConnection();

  socket.on('connect', () => {
    pushLog('🔌 CORE_BRIDGE // Enlace establecido con el flujo de logs');
    scrollToBottom();
  });

  socket.on('log-line', (line) => {
    pushLog(line);
    scrollToBottom();
    
    // Auto-detección de estado desde logs
    if (line.includes('Starting Minecraft server') || line.includes('Done')) {
      fetchStatus();
      fetchQuery();
    }
  });

  socket.on('disconnect', () => {
    pushLog('❌ CORE_BRIDGE // Enlace interrumpido con el Host');
    scrollToBottom();
  });
});

onUnmounted(() => {
  stopPlayerPolling();
  if (statsInterval) clearInterval(statsInterval);
  if (uptimeInterval) clearInterval(uptimeInterval);
  document.removeEventListener('keydown', handleGlobalKeydown);
  if (socket) {
    socket.disconnect();
  }
});
</script>

<style scoped>
.scrollbar-custom::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-custom::-webkit-scrollbar-track {
  background: #020617;
}
.scrollbar-custom::-webkit-scrollbar-thumb {
  background: #1e1b4b;
  border-radius: 4px;
}
</style>