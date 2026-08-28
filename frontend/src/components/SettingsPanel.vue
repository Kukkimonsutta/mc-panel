<template>
  <div class="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-4 scrollbar-custom">

    <!-- ═══ 1. EDIT MOTD ═══ -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
      <button @click="motdOpen = !motdOpen" class="w-full bg-gray-900/40 px-4 sm:px-5 py-3 border-b border-indigo-950/40 flex items-center gap-2 hover:bg-gray-900/60 transition-colors" :class="{ 'border-b-0': !motdOpen }">
        <svg class="w-4 h-4 text-fuchsia-400 transition-transform shrink-0" :class="{ 'rotate-90': motdOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        <svg class="w-4 h-4 text-fuchsia-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7"/></svg>
        <span class="text-xs font-mono uppercase tracking-widest text-fuchsia-400">Edit MOTD</span>
        <span v-if="motdDirty" class="text-[9px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded ml-auto">Unsaved</span>
        <button @click.stop="saveMotd" :disabled="saving || !motdDirty" class="ml-auto px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-fuchsia-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded border border-fuchsia-500 transition-colors shrink-0">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </button>
      <div v-if="motdOpen && !loading" class="p-4 sm:p-5">
        <MotdEditor
          :model-value="motdLocal"
          :icon-url="iconData"
          @update:model-value="motdLocal = $event; motdDirty = true; motdError = ''"
        />
        <div v-if="motdError" class="mt-3 text-[10px] font-mono px-3 py-2 rounded-lg border text-rose-400 border-rose-900/40 bg-rose-950/20">{{ motdError }}</div>
      </div>
    </div>

    <!-- ═══ 2. SERVER SETTINGS ═══ -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
      <button @click="propsOpen = !propsOpen" class="w-full bg-gray-900/40 px-4 sm:px-5 py-3 border-b border-indigo-950/40 flex items-center gap-2 hover:bg-gray-900/60 transition-colors" :class="{ 'border-b-0': !propsOpen }">
        <svg class="w-4 h-4 text-indigo-400 transition-transform shrink-0" :class="{ 'rotate-90': propsOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        <svg class="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="text-xs font-mono uppercase tracking-widest text-indigo-400">Server Settings</span>
        <span class="text-[10px] font-mono text-gray-600 ml-auto hidden sm:inline">{{ propCount }} props</span>
        <span v-if="propsDirty" class="text-[9px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded">Unsaved</span>
        <button v-if="propsDirty" @click.stop="saveProps" :disabled="saving" class="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded border border-indigo-500 transition-colors shrink-0">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </button>
      <div v-if="propsOpen" class="p-4 sm:p-5">
        <div v-if="loading" class="text-xs font-mono text-gray-500 py-4 text-center">Loading…</div>
        <div v-else-if="error" class="text-xs font-mono text-rose-400 py-4 text-center">{{ error }}</div>
        <div v-else class="space-y-5">
          <fieldset :disabled="!editing" class="space-y-5">
            <div>
              <h3 class="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-3">Gameplay</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div v-for="f in gameplayFields" :key="f.key" class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
                  <label class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1.5">{{ f.label }}</label>
                  <select v-if="f.options" :value="propsLocal[f.key]" @change="propsLocal[f.key]=($event.target).value; propsDirty=true" class="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-600 transition-colors appearance-none cursor-pointer">
                    <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
                  </select>
                  <input v-else :value="propsLocal[f.key]" @input="propsLocal[f.key]=($event.target).value; propsDirty=true" type="text" class="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-600 transition-colors" />
                </div>
              </div>
            </div>
            <div>
              <h3 class="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-3">World</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div v-for="f in worldFields" :key="f.key" class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
                  <label class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1.5">{{ f.label }}</label>
                  <select v-if="f.options" :value="propsLocal[f.key]" @change="propsLocal[f.key]=($event.target).value; propsDirty=true" class="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-600 transition-colors appearance-none cursor-pointer">
                    <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
                  </select>
                  <input v-else :value="propsLocal[f.key]" @input="propsLocal[f.key]=($event.target).value; propsDirty=true" type="text" class="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-600 transition-colors" />
                </div>
              </div>
            </div>
            <div>
              <h3 class="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-3">Network &amp; Security</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div v-for="f in netFields" :key="f.key" class="bg-gray-950/80 p-3 rounded-lg border border-gray-900">
                  <label class="text-[10px] text-indigo-400/70 block font-mono uppercase tracking-widest mb-1.5">{{ f.label }}</label>
                  <select v-if="f.options" :value="propsLocal[f.key]" @change="propsLocal[f.key]=($event.target).value; propsDirty=true" class="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-600 transition-colors appearance-none cursor-pointer">
                    <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
                  </select>
                  <input v-else :value="propsLocal[f.key]" @input="propsLocal[f.key]=($event.target).value; propsDirty=true" type="text" class="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-600 transition-colors" />
                </div>
              </div>
            </div>
          </fieldset>
          <div v-if="!editing" class="pt-1">
            <button @click="startEditing" class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg border border-indigo-500 transition-colors">Edit Settings</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ POWER SCHEDULE ═══ -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
      <button @click="powerOpen = !powerOpen" class="w-full bg-gray-900/40 px-4 sm:px-5 py-3 border-b border-indigo-950/40 flex items-center gap-2 hover:bg-gray-900/60 transition-colors" :class="{ 'border-b-0': !powerOpen }">
        <svg class="w-4 h-4 text-violet-400 transition-transform shrink-0" :class="{ 'rotate-90': powerOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        <svg class="w-4 h-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span class="text-xs font-mono uppercase tracking-widest text-violet-400">Power Schedule</span>
      </button>
      <div v-if="powerOpen" class="p-4 sm:p-5">
        <PowerSchedule />
      </div>
    </div>

    <!-- ═══ 3. BACKUPS ═══ -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
      <button @click="backupsOpen = !backupsOpen" class="w-full bg-gray-900/40 px-4 sm:px-5 py-3 border-b border-indigo-950/40 flex items-center gap-2 hover:bg-gray-900/60 transition-colors" :class="{ 'border-b-0': !backupsOpen }">
        <svg class="w-4 h-4 text-emerald-400 transition-transform shrink-0" :class="{ 'rotate-90': backupsOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        <span class="text-xs font-mono uppercase tracking-widest text-emerald-400">Backups</span>
      </button>
      <div v-if="backupsOpen" class="p-4 sm:p-5">
        <BackupManager />
      </div>
    </div>

    <!-- ═══ 4. SERVER ICON ═══ -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
      <button @click="iconOpen = !iconOpen" class="w-full bg-gray-900/40 px-4 sm:px-5 py-3 border-b border-indigo-950/40 flex items-center gap-2 hover:bg-gray-900/60 transition-colors" :class="{ 'border-b-0': !iconOpen }">
        <svg class="w-4 h-4 text-cyan-400 transition-transform shrink-0" :class="{ 'rotate-90': iconOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        <svg class="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span class="text-xs font-mono uppercase tracking-widest text-cyan-400">Server Icon</span>
      </button>
      <div v-if="iconOpen" class="p-4 sm:p-5">
        <IconEditor @saved="onIconSaved" />
      </div>
    </div>

    <!-- ═══ CONFIRMATION POPUP ═══ -->
    <Transition name="popup">
      <div v-if="confirm.show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="confirm.show = false">
        <div class="bg-gray-900 border border-indigo-800/50 rounded-xl p-6 max-w-sm w-full shadow-2xl">
          <h3 class="text-sm font-mono font-bold text-white mb-2">{{ confirm.title }}</h3>
          <p class="text-xs font-mono text-gray-400 mb-5">{{ confirm.message }}</p>
          <div class="flex gap-2 justify-end">
            <button @click="confirm.show = false" class="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-200 rounded border border-gray-700 hover:border-gray-600 transition-colors">Cancel</button>
            <button @click="confirm.onConfirm(); confirm.show = false" class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white rounded border border-indigo-500 transition-colors">{{ confirm.action }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ═══ RESTART PROMPT ═══ -->
    <Transition name="popup">
      <div v-if="restartPrompt.show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="restartPrompt.show = false">
        <div class="bg-gray-900 border border-emerald-800/50 rounded-xl p-6 max-w-sm w-full shadow-2xl">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            <h3 class="text-sm font-mono font-bold text-emerald-400">{{ restartPrompt.title }}</h3>
          </div>
          <p class="text-xs font-mono text-gray-400 mb-5">{{ restartPrompt.message }}</p>
          <div class="flex gap-2 justify-end">
            <button @click="restartPrompt.show = false" class="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-200 rounded border border-gray-700 hover:border-gray-600 transition-colors">Later</button>
            <button @click="doRestart" class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white rounded border border-emerald-500 transition-colors">Restart Now</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../lib/api.js';
import MotdEditor from './MotdEditor.vue';
import BackupManager from './BackupManager.vue';
import IconEditor from './IconEditor.vue';
import PowerSchedule from './PowerSchedule.vue';

// Collapsible sections
const motdOpen = ref(true);
const propsOpen = ref(false);
const backupsOpen = ref(false);
const iconOpen = ref(false);
const powerOpen = ref(false);

// MOTD
const motdLocal = ref('');
const motdDirty = ref(false);
const motdError = ref('');

// Server icon (data URL used in the MOTD preview)
const iconData = ref('');

// Properties
const propsData = ref({});
const propsLocal = ref({});
const loading = ref(false);
const error = ref('');
const editing = ref(false);
const propsDirty = ref(false);
const saving = ref(false);

// Popups
const confirm = ref({ show: false, title: '', message: '', action: '', onConfirm: () => {} });
const restartPrompt = ref({ show: false, title: '', message: '' });

const propCount = computed(() => Object.keys(propsData.value).length);

// Field definitions
const gameplayFields = [
  { key: 'gamemode', label: 'Default Gamemode', options: ['survival', 'creative', 'adventure', 'spectator'] },
  { key: 'difficulty', label: 'Difficulty', options: ['peaceful', 'easy', 'normal', 'hard'] },
  { key: 'pvp', label: 'PvP', options: ['true', 'false'] },
  { key: 'hardcore', label: 'Hardcore', options: ['true', 'false'] },
  { key: 'max-players', label: 'Max Players' },
  { key: 'spawn-protection', label: 'Spawn Protection' },
  { key: 'enable-command-block', label: 'Command Blocks', options: ['true', 'false'] },
  { key: 'allow-flight', label: 'Allow Flight', options: ['true', 'false'] },
  { key: 'force-gamemode', label: 'Force Gamemode', options: ['true', 'false'] },
];

const worldFields = [
  { key: 'level-name', label: 'World Name' },
  { key: 'level-seed', label: 'Seed' },
  { key: 'level-type', label: 'World Type', options: ['default', 'flat', 'largebiomes', 'amplified'] },
  { key: 'generate-structures', label: 'Structures', options: ['true', 'false'] },
  { key: 'view-distance', label: 'View Distance' },
  { key: 'simulation-distance', label: 'Sim Distance' },
  { key: 'max-world-size', label: 'Max World Size' },
  { key: 'allow-nether', label: 'Allow Nether', options: ['true', 'false'] },
  { key: 'spawn-animals', label: 'Spawn Animals', options: ['true', 'false'] },
  { key: 'spawn-monsters', label: 'Spawn Monsters', options: ['true', 'false'] },
  { key: 'spawn-npcs', label: 'Spawn NPCs', options: ['true', 'false'] },
];

const netFields = [
  { key: 'server-port', label: 'Server Port' },
  { key: 'online-mode', label: 'Online Mode', options: ['true', 'false'] },
  { key: 'white-list', label: 'Whitelist', options: ['true', 'false'] },
  { key: 'enforce-secure-profile', label: 'Secure Profile', options: ['true', 'false'] },
  { key: 'broadcast-console-to-ops', label: 'BC Console to Ops', options: ['true', 'false'] },
  { key: 'broadcast-rcon-to-ops', label: 'BC RCON to Ops', options: ['true', 'false'] },
  { key: 'enable-rcon', label: 'Enable RCON', options: ['true', 'false'] },
  { key: 'prevent-proxy-connections', label: 'Prevent Proxies', options: ['true', 'false'] },
];

async function fetchProps() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.getProperties();
    propsData.value = res;
    propsLocal.value = { ...res };
    motdLocal.value = res.motd || '';
  } catch (err) {
    error.value = err.message || 'Failed to load';
  } finally {
    loading.value = false;
  }
  // Cargar el icono actual para la vista previa del MOTD (no bloqueante)
  try {
    const iconRes = await api.getIcon();
    if (iconRes.success) iconData.value = iconRes.icon || '';
  } catch (_) {
    // Sin icono todavía
  }
}

function startEditing() {
  propsLocal.value = { ...propsData.value };
  editing.value = true;
}

// --- Save MOTD ---
function saveMotd() {
  doSaveMotd();
}
async function doSaveMotd() {
  saving.value = true;
  motdError.value = '';
  try {
    const res = await api.updateProperties({ motd: motdLocal.value });
    if (!res.success) throw new Error(res.error || 'Failed to save MOTD');
    propsData.value.motd = motdLocal.value;
    motdDirty.value = false;
    restartPrompt.value = {
      show: true,
      title: 'MOTD Saved',
      message: 'The MOTD was saved to server.properties. It will not be applied until the server restarts.'
    };
  } catch (err) {
    motdError.value = `Save failed: ${err.message}`;
  } finally {
    saving.value = false;
  }
}

// --- Server icon saved ---
function onIconSaved() {
  // Actualizar la vista previa del MOTD con el nuevo icono
  api.getIcon().then((res) => {
    if (res.success) iconData.value = res.icon || '';
  }).catch(() => {});
  restartPrompt.value = {
    show: true,
    title: 'Icon Saved',
    message: 'The icon was saved to server-icon.png. It will appear in the server list after the server restarts.'
  };
}

// --- Save Properties ---
function saveProps() {
  confirm.value = {
    show: true,
    title: 'Save Server Settings?',
    message: 'This writes all changes to server.properties. Most settings need a server restart to take effect.',
    action: 'Save Settings',
    onConfirm: doSaveProps
  };
}
async function doSaveProps() {
  saving.value = true;
  try {
    const updates = {};
    for (const key of Object.keys(propsLocal.value)) {
      if (propsLocal.value[key] !== propsData.value[key]) {
        updates[key] = propsLocal.value[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      propsDirty.value = false;
      editing.value = false;
      return;
    }
    const res = await api.updateProperties(updates);
    if (!res.success) throw new Error(res.error || 'Failed to save properties');
    propsData.value = { ...propsLocal.value };
    propsDirty.value = false;
    editing.value = false;
    restartPrompt.value = {
      show: true,
      title: 'Settings Saved',
      message: 'Server settings saved to server.properties. They will be applied on the next restart.'
    };
  } catch (err) {
    error.value = `Save failed: ${err.message}`;
  } finally {
    saving.value = false;
  }
}

// --- Restart with polling ---
async function doRestart() {
  restartPrompt.value.show = false;
  try {
    // Stop the server
    await api.stopServer();
    
    // Poll until running === false (max 30s)
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const status = await api.getStatus();
        if (!status.running) break;
      } catch (_) {
        // Server may be down, continue
      }
      attempts++;
    }
    
    // Start the server
    await api.startServer();
  } catch (err) {
    error.value = `Restart failed: ${err.message}`;
  }
}

onMounted(fetchProps);
</script>

<style scoped>
fieldset:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.popup-enter-active,
.popup-leave-active { transition: all 0.2s ease; }
.popup-enter-from,
.popup-leave-to { opacity: 0; transform: scale(0.95); }

.scrollbar-custom::-webkit-scrollbar { width: 6px; }
.scrollbar-custom::-webkit-scrollbar-track { background: #020617; }
.scrollbar-custom::-webkit-scrollbar-thumb { background: #1e1b4b; border-radius: 4px; }
</style>
