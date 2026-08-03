# Dependency security & upgrade plan

State as of 2026-07-30.

```
npm audit                 → 0 vulnerabilities   (was 22)
npm audit --omit=dev      → 0 vulnerabilities   (was 0)
npm ci                    → clean, no --legacy-peer-deps needed
```

---

## 1. The finding that reframes everything

Before any changes:

| Scope | Advisories |
|---|---|
| `npm audit` (everything) | **22** — 1 critical, 11 high, 9 moderate, 1 low |
| `npm audit --omit=dev` (what consumers install) | **0** |

**None of the 22 advisories ever reached a consumer of `@fairu/player`.** The
published package ships `dist` only and its runtime dependencies are `clsx`,
`hls.js` and `tailwind-merge` — none of which were affected. Everything flagged
was in `vite`, `vitest`, `storybook`, `rollup`, `postcss`, `ws`, `minimatch`,
`lodash` and friends: **build-time and developer-machine risk**, not shipped code.

That distinction is not an excuse to ignore them. The vulnerabilities were real
and the exposure was real, just aimed at a different target:

- `vite` ≤ 6.4.2 — arbitrary file read via the dev-server WebSocket, and
  `server.fs.deny` bypass. **Anyone on your network can read files off a dev
  machine.**
- `vitest` 4.0.x — **CVSS 9.8**: with the Vitest UI listening, arbitrary file
  read *and execute*.
- `storybook` 8.1–8.6.16 — dev-server WebSocket hijacking.
- `rollup` 4 ≤ 4.58.0 — arbitrary file write via path traversal, i.e. a
  compromised dependency can write outside the output directory **during a
  release build**.

For a library, a build-time RCE is arguably worse than a runtime one: it is the
supply-chain path to everyone who installs the package.

## 2. A second, quieter problem: lockfile drift

`package-lock.json` pinned `vitest@4.0.17`; `node_modules` contained
`vitest@4.1.4`. Someone had installed a newer version without committing the lock.

This mattered because **CI installs from the lockfile**. The local machine
happened to have the patched version, so a developer running `npm audit` locally
could have seen a different result from CI — and CI was installing the
CVSS-9.8 version on every run. The lockfile is the source of truth; the tree in
`node_modules` is not evidence of anything.

Fixed: lockfile and installed tree now agree on every package (verified).

## 3. What was changed

### 3.1 Transitive resolutions (`npm audit fix`, lockfile only)

22 → 10. No manifest changes; npm moved transitive dependencies to patched
versions inside the existing semver ranges. This cleared the critical `vitest`
issue, the `vite` path traversals, `ws`, `postcss`, `lodash`, `picomatch`,
`rollup` and `@babel/core`.

### 3.2 `vite-plugin-dts` 4.5.4 → 5.0.3 (major)

Root cause of 5 of the remaining 10: it pulled an old `@vue/language-core`,
which pulled vulnerable `minimatch` / `brace-expansion` / `glob`.

Risk assessment: peer deps are only `vite >=3`, `rollup >=3`,
`@microsoft/api-extractor >=7` — all satisfied. It affects the `build:lib` type
emit and nothing else.

Verified: `dist/*.d.ts` still emitted, 148 declaration files, new Reels and VAST
types present.

### 3.3 Storybook 8.6 → 10.5.5 (major)

Root cause of the last 3: `@storybook/addon-essentials` →
`@storybook/addon-actions` → `uuid` < 11.1.1. npm's suggested "fix" was to
*downgrade* to `addon-essentials@7.0.6`, which is not a fix.

There is no stable 9.x or 10.x of `@storybook/addon-essentials` — Storybook 9
folded docs, controls, actions, viewport, backgrounds, toolbars, measure, outline
and interactions into core. So the upgrade **is** the fix.

The migration was cheap because the repo's Storybook API surface is tiny: 25
type-only imports of `Meta`/`StoryObj` from `@storybook/react`, one from
`@storybook/react-vite`, and zero usages of `@storybook/test` or
`@storybook/blocks`.

Removed: `@storybook/addon-essentials`, `@storybook/addon-interactions`,
`@storybook/blocks`, `@storybook/test`.
Bumped: `storybook`, `@storybook/react`, `@storybook/react-vite`,
`@storybook/addon-links` to `^10.5.5`; `@chromatic-com/storybook` to `^5.2.1`.

Two config changes were required:

- `.storybook/main.ts` is now loaded as **ESM**, so `__dirname` no longer exists
  → replaced with `fileURLToPath(import.meta.url)`.
- The addons array dropped the three now-in-core entries.

> Installation gotcha: npm's resolver deadlocks if the old 8.x packages are still
> in `node_modules` — it reports `ERESOLVE` against the very packages you are
> replacing. Uninstall all Storybook packages first, then install the 10.x set in
> one command.

### 3.4 In-range updates

`@testing-library/react`, `autoprefixer`, `hls.js`, `tailwind-merge`,
`@types/react` moved to their latest in-range versions. The `@types/react` bump
surfaced two genuine type errors, both fixed (unused React import in
`preview.tsx`; missing `vite/client` types for `import.meta.glob`).

### 3.5 Packaging fix found along the way

`vite.config.ts` excluded `src/**/*.stories.tsx` and `src/**/*.test.tsx` from the
type emit — but **not** `.test.ts`. So `dist` was publishing
`parseVast.test.d.ts`, `security.test.d.ts`, `test/setup.d.ts` and (newly)
`stories/preview-kit.d.ts` to consumers. The exclude list now covers specs,
stories, the preview kit, the test setup and examples. 159 → 148 declaration
files, no dev surface published.

### 3.6 CI hardening

- **Dropped `npm ci --legacy-peer-deps`.** It was needed while Storybook 8
  conflicted with its own addons. Keeping it would hide the next incompatible
  upgrade instead of failing on it. Verified `npm ci` now succeeds clean.
- **Added an `audit` job** with two gates:
  - `npm audit --omit=dev --audit-level=low` — blocking. A runtime advisory
    reaches consumers, so nothing is tolerated.
  - `npm audit --audit-level=high` — blocking at high. A moderate ReDoS in a
    build tool should not block a release, but a high should.

A one-time cleanup decays without a gate; this is what keeps it at zero.

## 4. Verification

Every check below was run after the final state:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **476 passed** / 14 files |
| `npm run build:lib` | ok, ESM + CJS + 148 `.d.ts` |
| `npm run build:cdn` | ok, 4 bundles |
| `npm run build-storybook` | ok, 187 story entries |
| `npm ci` from scratch | clean, 0 vulnerabilities |
| `npm audit` | 0 |
| `npm audit --omit=dev` | 0 |

Of the 476 tests, **212 are a new story smoke test**
(`src/stories/stories.smoke.test.tsx`) that renders every story in the repo via
`composeStories`. A `storybook build` only proves stories *compile*; this proves
they *render*, which is what actually caught issues during the migration.

## 5. Deliberately deferred majors

These are **not** security issues — audit is at zero. They are listed with the
reason they were left alone, so the next person does not have to re-derive it.

| Package | Current | Latest | Why deferred |
|---|---|---|---|
| `react` / `react-dom` | 18.3.1 | 19.2.8 | `peerDependencies` already allows `^18 || ^19`, so consumers on 19 work today. Bumping the **dev** React to 19 changes what the test suite exercises without changing what ships. Do it as its own PR, with the `@types/react` 19 bump, and re-check the `inert` handling in `ReelsPlayer` (React 19 types it natively; the current cast can then go). |
| `tailwindcss` | 3.4.19 | 4.3.3 | v4 replaces the JS config with CSS-first `@theme`, drops `tailwind.config.js` and changes the PostCSS plugin. `src/styles/variables.css` already holds the design tokens as custom properties, so the migration is mostly mechanical — but it touches every component's class output and needs visual review. Highest-effort item here. |
| `vite` | 6.4.3 | 8.1.5 | Two majors. Storybook 10 accepts `^5–^8`, so it is unblocked, but `@vitejs/plugin-react` and `vite-plugin-dts` should move in the same PR. |
| `@vitejs/plugin-react` | 4.7.0 | 6.0.4 | Couple with the Vite bump. |
| `typescript` | 5.9.3 | 7.0.2 | TS 7 is the native-port compiler. Wait for the ecosystem — `vite-plugin-dts` and `react-docgen-typescript` need to be verified against it first. |
| `jsdom` | 26.1.0 | 29.1.1 | Test-env only. Three majors of DOM behaviour changes; worth doing, but expect the pointer-event and media-element shims in `src/test/setup.ts` to need review. |
| `tailwind-merge` | 2.6.1 | 3.6.0 | **Runtime dependency** — the only major on this list that ships. v3 requires Tailwind 4, so it is gated behind the Tailwind migration. |
| `@testing-library/jest-dom` | 6.9.1 | 7.0.0 | Low risk, low value. Fold into the next test-tooling PR. |

Suggested order, each as its own PR:

1. `jsdom` + `@testing-library/jest-dom` — test env only, no product risk
2. `vite` + `@vitejs/plugin-react` + `vite-plugin-dts` — build chain together
3. `react` 19 + `@types/react` 19 — dev-side; drop the `inert` cast
4. `tailwindcss` 4 + `tailwind-merge` 3 — biggest, needs visual review
5. `typescript` 7 — last, once the rest of the ecosystem has caught up

## 6. Outstanding, unrelated to security

Two things found while working that are worth flagging:

**`npm run lint` cannot pass.** The script runs `eslint . --ext ts,tsx
--max-warnings 0`, but neither `eslint` nor any config/plugin is in
`devDependencies` — the binary is simply missing. CI hides this with
`continue-on-error: true`, so the repo has had **no working lint for as long as
that has been true**. Fixing it properly means adding eslint 9 + the TS and React
plugins and then triaging the initial findings, which is its own piece of work.

**`IMPROVEMENTS.md` is inaccurate.** All 13 items are marked
`Status: [x] Completed`, but none of the described files exist —
`src/context/FairuProvider.tsx`, `src/components/ErrorBoundary/`,
`src/hooks/useABLoop.ts`, `src/hooks/useEqualizer.ts`, `src/utils/thumbnails.ts`
and the rest are all absent. The `size-limit` packages from item 4 were left
behind in `node_modules` as extraneous installs (now pruned). The document should
either be reset to `[ ]` or deleted, because right now it actively misleads.
