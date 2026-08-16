import { defineConfig, mergeConfig } from 'vite';
import { baseConfig, PORTS } from '../../shared/vite.base';

export default defineConfig(
  mergeConfig(baseConfig('angular', PORTS.angular), {
    esbuild: {
      // Angular's JIT compiler reads the metadata that `experimentalDecorators`
      // emits. Without this, @Component is transpiled to the ES-standard
      // decorator form, which Angular does not understand.
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  })
);
