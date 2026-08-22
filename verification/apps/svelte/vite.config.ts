import { defineConfig, mergeConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { baseConfig, PORTS } from '../../shared/vite.base';

export default defineConfig(
  mergeConfig(baseConfig('svelte', PORTS.svelte), {
    plugins: [svelte()],
  })
);
