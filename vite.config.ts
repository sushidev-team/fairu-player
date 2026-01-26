/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';
  const isCdnStandalone = mode === 'cdn-standalone';
  const isCdnLight = mode === 'cdn-light';
  const isCdnLoader = mode === 'cdn-loader';
  const isCdn = isCdnStandalone || isCdnLight;

  // Use classic JSX transform for CDN builds (React.createElement instead of jsx-runtime)
  // This is required because React UMD globals don't expose jsx-runtime separately
  const esbuildOptions = isCdn
    ? {
        jsx: 'transform' as const,
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
      }
    : {};

  // Determine build configuration
  const getBuildConfig = () => {
    if (isLib) {
      return {
        lib: {
          entry: {
            index: resolve(__dirname, 'src/index.ts'),
            embed: resolve(__dirname, 'src/embed/embed.ts'),
          },
          formats: ['es', 'cjs'] as const,
          fileName: (format: string, entryName: string) => {
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
            },
          },
        },
        cssCodeSplit: false,
      };
    }

    if (isCdnStandalone) {
      // Standalone: React bundled
      return {
        lib: {
          entry: resolve(__dirname, 'src/embed/embed.ts'),
          formats: ['iife'] as const,
          name: 'FairuPlayer',
          fileName: () => 'fairu-player.iife.js',
        },
        rollupOptions: {
          output: {
            // Inline all dependencies including React
            inlineDynamicImports: true,
          },
        },
        cssCodeSplit: false,
        emptyOutDir: false,
      };
    }

    if (isCdnLight) {
      // Lightweight: React as external globals
      // Note: react/jsx-runtime is NOT externalized because we use classic JSX transform
      return {
        lib: {
          entry: resolve(__dirname, 'src/embed/embed.ts'),
          formats: ['iife'] as const,
          name: 'FairuPlayer',
          fileName: () => 'fairu-player.light.iife.js',
        },
        rollupOptions: {
          external: ['react', 'react-dom'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
            },
            inlineDynamicImports: true,
          },
        },
        cssCodeSplit: false,
        emptyOutDir: false,
      };
    }

    if (isCdnLoader) {
      // Minimal loader: Vanilla JS, no React, no external deps
      return {
        lib: {
          entry: resolve(__dirname, 'src/embed/loader.ts'),
          formats: ['iife'] as const,
          name: 'FairuPlayerLoader',
          fileName: () => 'fairu-player.loader.iife.js',
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
        minify: 'esbuild' as const,
        cssCodeSplit: false,
        emptyOutDir: false,
      };
    }

    return {};
  };

  return {
    plugins: [
      // Don't use React plugin for CDN builds - esbuild handles JSX with classic transform
      !isCdn && !isCdnLoader && react(),
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
    esbuild: esbuildOptions,
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
    build: getBuildConfig(),
  };
});
