import '@fairu/player/wc';
import '@fairu/player/styles.css';
import { mount } from 'svelte';
import App from './App.svelte';
import type { Probe } from '@shared/fixtures';

declare global {
  interface Window {
    __probe: Probe;
  }
}

window.__probe = { framework: 'svelte', events: [], mounted: false };

mount(App, { target: document.querySelector('#app')! });

window.__probe.mounted = true;
