<script setup lang="ts">
/**
 * Vue binds through its own template syntax, which is the thing under test:
 * `:config` has to reach the element's `config` **property** (not an
 * attribute), and `@fairu-play` has to reach the custom event.
 */
import { ref } from 'vue';
import { TRACK_ONE, TRACK_TWO, type Probe } from '@shared/fixtures';

const probe = window.__probe as Probe;
const config = ref<Record<string, unknown>>({ track: TRACK_ONE });

function record(name: string, event: Event) {
  probe.events.push({ name, detail: (event as CustomEvent).detail });
}

function swap() {
  config.value = { track: TRACK_TWO };
}
</script>

<template>
  <h1>Vue</h1>
  <div id="host">
    <fairu-player
      :config="config"
      muted
      theme="dark"
      @fairu-ready="record('fairu-ready', $event)"
      @fairu-play="record('fairu-play', $event)"
      @fairu-pause="record('fairu-pause', $event)"
      @fairu-ended="record('fairu-ended', $event)"
      @fairu-timeupdate="record('fairu-timeupdate', $event)"
      @fairu-trackchange="record('fairu-trackchange', $event)"
      @fairu-error="record('fairu-error', $event)"
    />
  </div>
  <button id="swap" type="button" @click="swap">Swap track</button>
</template>
