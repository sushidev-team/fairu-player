import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '..', '..');

/**
 * Config shared by every verification app.
 *
 * The apps resolve `@fairu/player/wc` to the **built** `dist`, not to `src`.
 * That is the point of this workspace: a consumer installs the package, so the
 * thing under test has to be the published artefact — bundling, the `exports`
 * map and the type declarations included. Pointing at source would verify code
 * that nobody ships.
 */
export function baseConfig(app: string, port: number): UserConfig {
  return {
    root: resolve(here, '..', 'apps', app),
    // Each app is served on its own port so Playwright can address them
    // independently and a crash in one cannot mask another.
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    // ...and its own dependency cache. The apps' roots contain no node_modules,
    // so all four resolved to the workspace's `node_modules/.vite` and
    // invalidated each other's optimised deps on every start. Vite recovers by
    // reloading the page — mid-test, which is exactly as flaky as it sounds.
    cacheDir: resolve(here, '..', 'node_modules', '.vite', app),
    resolve: {
      alias: {
        '@fairu/player/wc': resolve(repoRoot, 'dist/wc.js'),
        '@fairu/player/styles.css': resolve(repoRoot, 'dist/player.css'),
        '@shared': resolve(here),
      },
    },
    // React is bundled into dist/wc.js, so nothing here needs it as a dep.
    optimizeDeps: { include: [] },
  };
}

export const PORTS = {
  plain: 5181,
  vue: 5182,
  svelte: 5183,
  angular: 5184,
} as const;
