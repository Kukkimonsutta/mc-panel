<template>
  <div class="bg-gray-950/80 rounded-lg border border-gray-800 p-4 space-y-3">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <span class="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-400 flex items-center gap-2">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Power Schedule
      </span>
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <span class="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Auto</span>
        <button
          role="switch"
          :aria-checked="schedule.enabled"
          @click="schedule.enabled = !schedule.enabled; touch()"
          class="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-300"
          :class="schedule.enabled ? 'bg-violet-500' : 'bg-gray-700'"
        >
          <span class="pointer-events-none inline-block h-4 w-4 translate-y-0.5 transform rounded-full bg-white shadow transition duration-300" :class="schedule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'"></span>
        </button>
      </label>
    </div>

    <!-- Event list -->
    <div v-if="schedule.events.length === 0" class="text-xs font-mono text-gray-600 italic py-2">
      No events yet — add one below to auto-start or auto-stop the server.
    </div>
    <div v-else class="space-y-2">
      <div v-for="(e, i) in schedule.events" :key="i" class="bg-gray-900/60 border border-gray-800 rounded-lg p-3 space-y-2">
        <div class="flex items-center gap-2 flex-wrap">
          <input
            v-model="e.time"
            type="time"
            class="bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-violet-700/50 transition-colors"
            @change="touch"
          />
          <select
            v-model="e.action"
            class="bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-[11px] font-mono text-gray-200 focus:outline-none focus:border-violet-700/50 transition-colors cursor-pointer"
            @change="touch"
          >
            <option value="start">Start server</option>
            <option value="stop">Stop server</option>
          </select>
          <button
            @click="removeEvent(i)"
            title="Remove event"
            class="ml-auto p-1.5 rounded text-gray-600 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex items-center gap-1 flex-wrap">
          <button
            v-for="d in DAYS"
            :key="d"
            @click="toggleDay(e, d)"
            :title="DAY_NAMES[d]"
            class="w-8 h-7 rounded text-[9px] font-mono font-bold border transition-colors"
            :class="isDaySelected(e, d) ? 'bg-violet-600 border-violet-500 text-white' : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300'"
          >
            {{ DAY_LABELS[d] }}
          </button>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        @click="addEvent"
        class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
      >+ Add Event</button>
      <button
        @click="save"
        :disabled="saving || !dirty"
        class="px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:opacity-50 text-white rounded-lg border border-violet-500 transition-colors"
      >{{ saving ? 'Saving…' : 'Save' }}</button>
      <span v-if="dirty" class="text-[9px] font-mono text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded">Unsaved</span>
      <span v-if="schedule.timezone" class="text-[9px] font-mono text-gray-600">Times in {{ schedule.timezone }}</span>
    </div>

    <!-- Feedback -->
    <Transition name="fade">
      <div v-if="msg" class="text-[10px] font-mono px-3 py-2 rounded-lg border inline-block" :class="msg.success ? 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20' : 'text-rose-400 border-rose-900/40 bg-rose-950/20'">
        {{ msg.success ? msg.text : '✗ ' + msg.error }}
      </div>
    </Transition>

    <p class="text-[9px] font-mono text-gray-600">
      Days: all highlighted = every day; click to pick specific days. A scheduled stop will kick any online players.
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../lib/api.js';

const DAYS = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sunday (JS getDay)
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const schedule = ref({ enabled: false, events: [], timezone: '' });
const dirty = ref(false);
const saving = ref(false);
const msg = ref(null);

function touch() {
  dirty.value = true;
  msg.value = null;
}

function isDaySelected(e, d) {
  return e.days.length === 0 || e.days.includes(d);
}

function toggleDay(e, d) {
  if (e.days.length === 0) {
    // "Every day" → only this day
    e.days = [d];
  } else if (e.days.includes(d)) {
    e.days = e.days.filter((x) => x !== d);
  } else {
    e.days = [...e.days, d].sort((a, b) => a - b);
    if (e.days.length === 7) e.days = []; // all 7 = every day
  }
  touch();
}

function addEvent() {
  schedule.value.events.push({ time: '08:00', action: 'start', days: [] });
  touch();
}

function removeEvent(i) {
  schedule.value.events.splice(i, 1);
  touch();
}

async function load() {
  try {
    const res = await api.getPowerSchedule();
    if (res.success && res.schedule) schedule.value = res.schedule;
  } catch (e) {
    console.debug('Failed to load power schedule:', e.message);
  }
}

async function save() {
  saving.value = true;
  msg.value = null;
  try {
    const res = await api.setPowerSchedule({
      enabled: schedule.value.enabled,
      events: schedule.value.events,
    });
    if (!res.success) throw new Error(res.error || 'Failed to save schedule');
    schedule.value = res.schedule;
    dirty.value = false;
    msg.value = { success: true, text: '✓ Power schedule saved' };
  } catch (e) {
    msg.value = { success: false, error: e.message || 'Failed to save schedule' };
    load();
  } finally {
    saving.value = false;
    setTimeout(() => { msg.value = null; }, 5000);
  }
}

onMounted(load);
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
