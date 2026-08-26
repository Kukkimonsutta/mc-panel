<template>
  <div class="space-y-4">
      <!-- Scheduled Backups -->
      <div class="bg-gray-950/80 rounded-lg border border-gray-900 p-3 space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <span class="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Scheduled Backups
          </span>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <span class="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Auto</span>
            <button
              role="switch"
              :aria-checked="schedule.enabled"
              @click="schedule.enabled = !schedule.enabled"
              class="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-300"
              :class="schedule.enabled ? 'bg-emerald-500' : 'bg-gray-700'"
            >
              <span class="pointer-events-none inline-block h-4 w-4 translate-y-0.5 transform rounded-full bg-white shadow transition duration-300" :class="schedule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'"></span>
            </button>
          </label>
        </div>
        <div class="flex items-end gap-3 flex-wrap">
          <div>
            <label class="text-[9px] font-mono uppercase tracking-wider text-gray-600 block mb-1">Every (hours)</label>
            <input v-model.number="schedule.intervalHours" type="number" min="1" max="8760" class="w-20 bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-700/50 transition-colors" />
          </div>
          <div>
            <label class="text-[9px] font-mono uppercase tracking-wider text-gray-600 block mb-1">Keep last</label>
            <input v-model.number="schedule.retention" type="number" min="0" max="500" class="w-20 bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-indigo-700/50 transition-colors" />
          </div>
          <button
            @click="saveSchedule"
            :disabled="savingSchedule"
            class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg border border-indigo-500 transition-colors"
          >
            {{ savingSchedule ? 'Saving…' : 'Save' }}
          </button>
          <span v-if="schedule.enabled" class="text-[10px] font-mono text-gray-600 pb-1">
            {{ schedule.nextRun ? `next run ${formatNextRun(schedule.nextRun)}` : `runs every ${schedule.intervalHours}h` }}
          </span>
        </div>
      </div>

      <!-- Restore progress banner -->
      <Transition name="fade">
        <div v-if="restoring" class="text-[10px] font-mono px-3 py-2.5 rounded-lg border border-amber-800/50 bg-amber-950/20 text-amber-300 flex items-center gap-2">
          <svg class="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span>Restoring world… {{ phaseLabel }}</span>
        </div>
      </Transition>

      <!-- Create Backup Button -->
      <div class="flex items-center gap-3 flex-wrap">
        <button
          @click="doCreate"
          :disabled="creating || restoring"
          class="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg border border-emerald-500 transition-colors"
        >
          <svg v-if="!creating" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          {{ creating ? 'Backing up world…' : 'Create Backup' }}
        </button>
        <span class="text-[10px] font-mono text-gray-500">Server stays online during backup</span>
        <span class="text-[10px] font-mono text-gray-600 ml-auto">{{ backups.length }} stored</span>
      </div>

      <!-- Feedback -->
      <Transition name="fade">
        <div v-if="msg" class="text-[10px] font-mono px-3 py-2 rounded-lg border inline-block" :class="msg.success ? 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20' : 'text-rose-400 border-rose-900/40 bg-rose-950/20'">
          {{ msg.success ? msg.text : '✗ ' + msg.error }}
        </div>
      </Transition>

      <!-- Backup List -->
      <div v-if="loading" class="text-xs font-mono text-gray-500 py-4 text-center">Loading backups…</div>
      <div v-else-if="err" class="text-xs font-mono text-rose-400 py-4 text-center">{{ err }}</div>
      <div v-else-if="backups.length === 0" class="text-xs font-mono text-gray-600 py-4 text-center italic">No backups yet — create your first one above</div>
      <div v-else class="space-y-2">
        <div
          v-for="b in backups"
          :key="b.name"
          class="flex items-center justify-between bg-gray-950/80 px-3 py-2.5 rounded-lg border border-gray-900 group hover:border-gray-800 transition-colors"
        >
          <div class="flex items-center gap-3 min-w-0">
            <svg class="w-4 h-4 text-amber-400/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            <div class="min-w-0">
              <span class="text-[11px] font-mono text-gray-200 truncate block">{{ b.name }}</span>
              <span class="text-[9px] font-mono text-gray-600">{{ b.sizeMB }} MB · {{ formatDate(b.created) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0">
            <button
              @click="doDownload(b.name)"
              :disabled="restoring"
              class="shrink-0 p-1.5 rounded text-gray-500 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors disabled:opacity-30"
              title="Download backup"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </button>
            <button
              @click="doRestore(b.name)"
              :disabled="restoring"
              class="shrink-0 p-1.5 rounded text-gray-500 hover:text-amber-400 hover:bg-amber-950/30 transition-colors disabled:opacity-30"
              title="Restore this backup"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
            <button
              @click="doDelete(b.name)"
              :disabled="restoring"
              class="shrink-0 p-1.5 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-30"
              title="Delete backup"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>

    <Transition name="fade">
      <div v-if="deleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="deleteConfirm = null">
        <div class="bg-gray-900 border border-rose-800/50 rounded-xl p-6 max-w-sm w-full shadow-2xl">
          <h3 class="text-sm font-mono font-bold text-white mb-2">Delete backup?</h3>
          <p class="text-xs font-mono text-gray-400 mb-5 break-all">This permanently removes {{ deleteConfirm }}.</p>
          <div class="flex gap-2 justify-end">
            <button @click="deleteConfirm = null" class="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-200 rounded border border-gray-700 hover:border-gray-600 transition-colors">Cancel</button>
            <button @click="confirmDelete" :disabled="deleting" class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white rounded border border-rose-500 transition-colors">{{ deleting ? 'Deleting…' : 'Delete' }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Restore Confirmation Modal -->
    <Transition name="fade">
      <div v-if="restoreConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="restoreConfirm = null">
        <div class="bg-gray-900 border border-amber-700/50 rounded-xl p-6 max-w-sm w-full shadow-2xl">
          <h3 class="text-sm font-mono font-bold text-white mb-2">Restore world from backup?</h3>
          <p class="text-xs font-mono text-gray-400 mb-2 break-all">{{ restoreConfirm }}</p>
          <p class="text-[11px] font-mono text-amber-400/80 mb-5">The server will be stopped, the current world will be replaced with this backup, and the server will start again. A safety snapshot of the current world is kept automatically.</p>
          <div class="flex gap-2 justify-end">
            <button @click="restoreConfirm = null" class="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:text-gray-200 rounded border border-gray-700 hover:border-gray-600 transition-colors">Cancel</button>
            <button @click="confirmRestore" :disabled="restoring" class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white rounded border border-amber-500 transition-colors">{{ restoring ? 'Restoring…' : 'Restore' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { api } from '../lib/api.js';

const backups = ref([]);
const loading = ref(false);
const err = ref('');
const msg = ref(null);
const creating = ref(false);
const deleteConfirm = ref(null);
const deleting = ref(false);

// Schedule
const schedule = ref({ enabled: false, intervalHours: 24, retention: 10, lastRun: null, nextRun: null });
const savingSchedule = ref(false);

// Restore
const restoreConfirm = ref(null);
const restoring = ref(null); // backup name being restored
const restoreStatus = ref(null);
let restorePollTimer = null;

const PHASE_LABELS = {
  queued: 'queued…',
  stopping: 'stopping server…',
  snapshot: 'creating safety snapshot…',
  extracting: 'restoring world files…',
  starting: 'starting server…',
  cleaning: 'cleaning up…',
  done: 'finished',
  error: 'failed',
};
const phaseLabel = computed(() => (restoreStatus.value ? PHASE_LABELS[restoreStatus.value.phase] || restoreStatus.value.phase : ''));

async function fetchBackups() {
  loading.value = true;
  err.value = '';
  try {
    const res = await api.listBackups();
    backups.value = res.backups || [];
  } catch (e) {
    err.value = e.message || 'Failed to load backups';
  } finally {
    loading.value = false;
  }
}

async function fetchSchedule() {
  try {
    const res = await api.getBackupSchedule();
    if (res.success && res.schedule) schedule.value = res.schedule;
  } catch (e) {
    console.debug('Failed to load backup schedule:', e.message);
  }
}

async function saveSchedule() {
  savingSchedule.value = true;
  msg.value = null;
  try {
    const res = await api.setBackupSchedule({
      enabled: schedule.value.enabled,
      intervalHours: schedule.value.intervalHours,
      retention: schedule.value.retention,
    });
    if (res.success && res.schedule) {
      schedule.value = res.schedule;
      msg.value = { success: true, text: '✓ Backup schedule saved' };
    } else {
      throw new Error(res.error || 'Failed to save schedule');
    }
  } catch (e) {
    msg.value = { success: false, error: e.message || 'Failed to save schedule' };
    fetchSchedule();
  } finally {
    savingSchedule.value = false;
    setTimeout(() => { msg.value = null; }, 5000);
  }
}

async function doCreate() {
  creating.value = true;
  msg.value = null;
  try {
    const res = await api.createBackup();
    if (res.success) {
      msg.value = { success: true, text: `✓ Created ${res.backup.name} (${res.backup.sizeMB} MB)` };
      backups.value.unshift(res.backup);
    } else {
      msg.value = { success: false, error: res.error };
    }
  } catch (e) {
    msg.value = { success: false, error: e.message || 'Backup failed' };
  } finally {
    creating.value = false;
    setTimeout(() => { msg.value = null; }, 5000);
  }
}

async function doDownload(name) {
  msg.value = null;
  try {
    await api.downloadBackup(name);
    msg.value = { success: true, text: `✓ Downloading ${name}` };
  } catch (e) {
    msg.value = { success: false, error: e.message || 'Download failed' };
  }
  setTimeout(() => { msg.value = null; }, 5000);
}

async function doRestore(name) {
  restoreConfirm.value = name;
}

async function confirmRestore() {
  if (!restoreConfirm.value || restoring.value) return;
  const name = restoreConfirm.value;
  restoreConfirm.value = null;
  msg.value = null;
  try {
    const res = await api.restoreBackup(name);
    if (!res.success) throw new Error(res.error || 'Restore failed');
    restoring.value = name;
    startRestorePolling();
  } catch (e) {
    msg.value = { success: false, error: e.message || 'Restore failed' };
  }
}

function startRestorePolling() {
  stopRestorePolling();
  restorePollTimer = setInterval(async () => {
    try {
      const st = await api.getRestoreStatus();
      restoreStatus.value = st;
      if (!st.running) {
        stopRestorePolling();
        restoring.value = null;
        if (st.result && st.result.success) {
          msg.value = { success: true, text: st.result.snapshot ? `✓ World restored — safety snapshot kept (${st.result.snapshot})` : '✓ World restored' };
          fetchBackups();
        } else {
          msg.value = { success: false, error: (st.result && st.result.error) || 'Restore failed' };
        }
        setTimeout(() => { restoreStatus.value = null; msg.value = null; }, 8000);
      }
    } catch (e) {
      // Transient polling errors — keep trying until the job reports finished
    }
  }, 2500);
}

function stopRestorePolling() {
  if (restorePollTimer) {
    clearInterval(restorePollTimer);
    restorePollTimer = null;
  }
}

async function doDelete(name) {
  deleteConfirm.value = name;
}

async function confirmDelete() {
  if (!deleteConfirm.value || deleting.value) return;
  const name = deleteConfirm.value;
  deleting.value = true;
  try {
    await api.deleteBackup(name);
    backups.value = backups.value.filter(b => b.name !== name);
    deleteConfirm.value = null;
  } catch (e) {
    msg.value = { success: false, error: e.message || 'Delete failed' };
  } finally {
    deleting.value = false;
  }
}

function formatDate(date) {
  return new Date(date).toLocaleString();
}

function formatNextRun(iso) {
  return new Date(iso).toLocaleString();
}

onMounted(async () => {
  fetchBackups();
  fetchSchedule();
  // Resume progress display if a restore is already running server-side
  try {
    const st = await api.getRestoreStatus();
    if (st.running) {
      restoring.value = st.name;
      restoreStatus.value = st;
      startRestorePolling();
    }
  } catch (e) {
    // Ignore
  }
});

onUnmounted(stopRestorePolling);
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
