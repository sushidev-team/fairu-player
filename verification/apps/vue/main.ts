import '@fairu/player/wc';
import '@fairu/player/styles.css';
import { createApp } from 'vue';
import App from './App.vue';
import type { Probe } from '@shared/fixtures';

declare global {
  interface Window {
    __probe: Probe;
  }
}

window.__probe = { framework: 'vue', events: [], mounted: false };

createApp(App).mount('#app');

window.__probe.mounted = true;
