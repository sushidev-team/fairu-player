/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';

  return {
    plugins: [
      react(),
      isLib && dts({
        include: ['src'],
        exclude: ['src/**/*.stories.tsx', 'src/**/*.test.tsx'],
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/**/*.stories.tsx',
          'src/**/*.d.ts',
          'src/test/',
        ],
      },
    },
    build: isLib
      ? {
          lib: {
            entry: {
              index: resolve(__dirname, 'src/index.ts'),
              embed: resolve(__dirname, 'src/embed/embed.ts'),
            },
            formats: ['es', 'cjs'],
            fileName: (format, entryName) => {
              const ext = format === 'es' ? 'js' : 'cjs';
              return `${entryName}.${ext}`;
            },
          },
          rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime'],
            output: {
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
                'react/jsx-runtime': 'jsxRuntime',
              },
            },
          },
          cssCodeSplit: false,
        }
      : {},
  };
});
