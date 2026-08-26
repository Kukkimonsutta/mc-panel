<template>
  <div class="space-y-4">
      <!-- Create Backup Button -->
      <div class="flex items-center gap-3 flex-wrap">
        <button
          @click="doCreate"
          :disabled="creating"
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
          <button
            @click="doDelete(b.name)"
            class="shrink-0 p-1.5 rounded text-gray-600 hover:text-rose-400 hover:bg-rose-950/30 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete backup"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../lib/api.js';

const backups = ref([]);
const loading = ref(false);
const err = ref('');
const msg = ref(null);
const creating = ref(false);
const deleteConfirm = ref(null);
const deleting = ref(false);

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

onMounted(fetchBackups);
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
