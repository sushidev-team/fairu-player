import { defineConfig, mergeConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { baseConfig, PORTS } from '../../shared/vite.base';

export default defineConfig(
  mergeConfig(baseConfig('vue', PORTS.vue), {
    plugins: [
      vue({
        template: {
          compilerOptions: {
            // Without this Vue treats <fairu-player> as an unresolved component
            // and warns. It is also the line every consumer has to add, so
            // verifying the documented setup means including it.
            isCustomElement: (tag: string) => tag === 'fairu-player',
          },
        },
      }),
    ],
  })
);
