<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Whitelist -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
      <div class="bg-gray-900/40 px-4 py-3 border-b border-indigo-950/40 flex items-center justify-between gap-3 flex-wrap">
        <span class="text-xs font-mono uppercase tracking-widest text-indigo-400">Whitelist //</span>
        <button
          @click="toggleWhiteList"
          :disabled="actingWhitelist"
          class="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
          :class="whiteListOn ? 'text-emerald-400 border-emerald-800/60 bg-emerald-950/20 hover:bg-emerald-900/20' : 'text-gray-500 border-gray-800 hover:border-gray-700 hover:text-gray-300'"
        >
          {{ whiteListOn ? 'Whitelist: ON' : 'Whitelist: OFF' }}
        </button>
      </div>
      <div class="p-4 sm:p-5 space-y-3">
        <div class="flex gap-2">
          <input
            v-model="newPlayer"
            @keydown.enter="addWhitelistPlayer"
            type="text"
            placeholder="Player name"
            maxlength="16"
            class="flex-1 bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-700/50 transition-colors"
            spellcheck="false"
          />
          <button
            @click="addWhitelistPlayer"
            :disabled="actingWhitelist"
            class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg border border-indigo-500 transition-colors"
          >Add</button>
        </div>
        <div v-if="whitelist.length === 0" class="text-xs font-mono text-gray-600 italic py-2">No whitelisted players</div>
        <div v-else class="flex flex-wrap gap-2">
          <span v-for="p in whitelist" :key="p" class="flex items-center gap-1.5 bg-gray-950/80 border border-gray-900 rounded-full px-3 py-1">
            <span class="text-[11px] font-mono text-gray-200">{{ p }}</span>
            <button @click="removeWhitelistPlayer(p)" :disabled="actingWhitelist" class="text-gray-600 hover:text-rose-400 transition-colors disabled:opacity-30" title="Remove from whitelist">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </span>
        </div>
        <p class="text-[9px] font-mono text-gray-600">Whitelist changes apply immediately — no restart needed.</p>
      </div>
    </div>

    <!-- Bans -->
    <div class="bg-gradient-to-b from-gray-900/60 to-gray-950/40 rounded-xl border border-indigo-950/50 overflow-hidden">
      <div class="bg-gray-900/40 px-4 py-3 border-b border-indigo-950/40 flex items-center gap-2">
        <span class="text-xs font-mono uppercase tracking-widest text-indigo-400">Bans //</span>
      </div>
      <div class="p-4 sm:p-5 space-y-3">
        <div class="flex gap-2 flex-wrap">
          <input
            v-model="banName"
            @keydown.enter="banPlayer"
            type="text"
            placeholder="Player name"
            maxlength="16"
            class="w-36 bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-rose-700/50 transition-colors"
            spellcheck="false"
          />
          <input
            v-model="banReason"
            @keydown.enter="banPlayer"
            type="text"
            placeholder="Reason (optional)"
            maxlength="256"
            class="flex-1 min-w-40 bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-rose-700/50 transition-colors"
            spellcheck="false"
          />
          <input
            v-model="banHours"
            @keydown.enter="banPlayer"
            type="number"
            min="0.1"
            max="8760"
            step="0.5"
            placeholder="Hours (temp)"
            class="w-28 bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-rose-700/50 transition-colors"
          />
          <button
            @click="banPlayer"
            :disabled="actingBan"
            class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white rounded-lg border border-rose-500 transition-colors"
          >Ban</button>
        </div>
        <p class="text-[9px] font-mono text-gray-600">Leave "Hours" empty for a permanent ban — otherwise the player is unbanned automatically.</p>
        <div v-if="bans.length === 0" class="text-xs font-mono text-gray-600 italic py-2">No banned players</div>
        <div v-else class="space-y-1.5">
          <div v-for="b in bans" :key="b.name" class="flex items-center justify-between gap-2 bg-gray-950/80 px-3 py-2 rounded-lg border border-gray-900">
            <div class="min-w-0">
              <span class="text-[11px] font-mono text-rose-300 block truncate">{{ b.name }}</span>
              <span v-if="b.reason" class="text-[9px] font-mono text-gray-600 truncate block">{{ b.reason }}</span>
              <span v-if="b.expires" class="text-[9px] font-mono text-amber-400/80 truncate block">⏳ {{ remainingText(b.expires) }}</span>
            </div>
            <button
              @click="unbanPlayer(b.name)"
              :disabled="actingBan"
              class="shrink-0 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-500 hover:text-emerald-400 hover:bg-emerald-950/30 rounded border border-transparent hover:border-emerald-900/50 transition-colors disabled:opacity-30"
            >Unban</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback -->
    <Transition name="fade">
      <div v-if="msg" class="text-[10px] font-mono px-3 py-2 rounded-lg border inline-block" :class="msg.success ? 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20' : 'text-rose-400 border-rose-900/40 bg-rose-950/20'">
        {{ msg.success ? msg.text : '✗ ' + msg.error }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { api } from '../lib/api.js';

const whitelist = ref([]);
const bans = ref([]);
const whiteListOn = ref(false);
const newPlayer = ref('');
const banName = ref('');
const banReason = ref('');
const banHours = ref('');
const actingWhitelist = ref(false);
const actingBan = ref(false);
const msg = ref(null);
let refreshTimer = null;

function showMsg(success, text) {
  msg.value = { success, text };
  setTimeout(() => { msg.value = null; }, 5000);
}

async function loadAll() {
  try {
    const [wl, bl, props] = await Promise.allSettled([api.getWhitelist(), api.getBans(), api.getProperties()]);
    if (wl.status === 'fulfilled' && wl.value.success) whitelist.value = wl.value.players || [];
    if (bl.status === 'fulfilled' && bl.value.success) bans.value = bl.value.bans || [];
    if (props.status === 'fulfilled' && props.value && typeof props.value === 'object') {
      whiteListOn.value = props.value['white-list'] === 'true';
    }
  } catch (e) {
    console.debug('Failed to load player data:', e.message);
  }
}

async function toggleWhiteList() {
  actingWhitelist.value = true;
  try {
    const res = await api.whitelistAction({ action: whiteListOn.value ? 'off' : 'on' });
    if (!res.success) throw new Error(res.error || 'Whitelist toggle failed');
    whiteListOn.value = !whiteListOn.value;
    showMsg(true, whiteListOn.value ? '✓ Whitelist enabled' : '✓ Whitelist disabled');
  } catch (e) {
    showMsg(false, e.message || 'Whitelist toggle failed');
  } finally {
    actingWhitelist.value = false;
  }
}

async function addWhitelistPlayer() {
  const name = newPlayer.value.trim();
  if (!name || actingWhitelist.value) return;
  actingWhitelist.value = true;
  try {
    const res = await api.whitelistAction({ action: 'add', player: name });
    if (!res.success) throw new Error(res.error || 'Failed to add player');
    newPlayer.value = '';
    showMsg(true, `✓ Added ${name} to whitelist`);
    await loadAll();
  } catch (e) {
    showMsg(false, e.message || 'Failed to add player');
  } finally {
    actingWhitelist.value = false;
  }
}

async function removeWhitelistPlayer(name) {
  if (actingWhitelist.value) return;
  actingWhitelist.value = true;
  try {
    const res = await api.whitelistAction({ action: 'remove', player: name });
    if (!res.success) throw new Error(res.error || 'Failed to remove player');
    whitelist.value = whitelist.value.filter(p => p !== name);
    showMsg(true, `✓ Removed ${name} from whitelist`);
  } catch (e) {
    showMsg(false, e.message || 'Failed to remove player');
  } finally {
    actingWhitelist.value = false;
  }
}

async function banPlayer() {
  const name = banName.value.trim();
  if (!name || actingBan.value) return;
  const hours = parseFloat(banHours.value);
  if (banHours.value !== '' && (!Number.isFinite(hours) || hours < 0.1 || hours > 8760)) {
    showMsg(false, 'Duration must be between 0.1 and 8760 hours');
    return;
  }
  actingBan.value = true;
  try {
    let res;
    if (banHours.value !== '') {
      res = await api.tempBan({ player: name, reason: banReason.value.trim() || undefined, hours });
      if (!res.success) throw new Error(res.error || 'Temp ban failed');
      showMsg(true, `✓ Banned ${name} for ${hours}h`);
    } else {
      res = await api.playerAction({ action: 'ban', player: name, reason: banReason.value.trim() || undefined });
      if (!res.success) throw new Error(res.error || 'Ban failed');
      showMsg(true, `✓ Banned ${name}`);
    }
    banName.value = '';
    banReason.value = '';
    banHours.value = '';
    await loadAll();
  } catch (e) {
    showMsg(false, e.message || 'Ban failed');
  } finally {
    actingBan.value = false;
  }
}

async function unbanPlayer(name) {
  if (actingBan.value) return;
  actingBan.value = true;
  try {
    const res = await api.playerAction({ action: 'unban', player: name });
    if (!res.success) throw new Error(res.error || 'Unban failed');
    bans.value = bans.value.filter(b => b.name !== name);
    showMsg(true, `✓ Unbanned ${name}`);
  } catch (e) {
    showMsg(false, e.message || 'Unban failed');
  } finally {
    actingBan.value = false;
  }
}

function remainingText(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expiring…';
  const totalMins = Math.floor(ms / 60000);
  const d = Math.floor(totalMins / 1440);
  const h = Math.floor((totalMins % 1440) / 60);
  const m = totalMins % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

onMounted(() => {
  loadAll();
  // Refresca la lista cada minuto para actualizar las cuentas atrás de baneos temporales
  refreshTimer = setInterval(loadAll, 60000);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
