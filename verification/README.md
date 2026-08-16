# Framework verification

Real-browser proof that `<fairu-player>` works in Vue, Angular, Svelte and plain
HTML.

## Why this exists

The unit tests in `src/wc/` drive the element the way a framework would — set a
property, dispatch an event, remove and re-insert the node. That proves the
element behaves. It does **not** prove that a real template compiles to those
calls, and the gap between the two is not theoretical:

- `(fairu:play)` compiled in Angular **without an error** and bound to `play`,
  because a colon in a binding name is a namespace separator there. The handler
  would never have fired for our event, and would have fired for the native
  `play` bubbling out of the inner media element.
- Importing the package threw `ReferenceError: HTMLElement is not defined` in
  Node, taking down every server render.

Both passed every unit test. Only a real framework in a real browser catches
that class of defect, so that is what this runs.

## What it checks

Four apps, one shared spec — the apps differ *only* in how they bind, so a
failure points at a framework rather than at the app written for it. `plain` is
the control: if it fails too, the element is broken and the framework is
innocent.

Per framework:

| Check | What it proves |
|---|---|
| renders the player | the element upgraded and React mounted inside it |
| bound config reaches the element | the framework wrote a **property**, not an attribute |
| ready / play / pause / timeupdate | events cross from the media element, through React, out of the custom element, and into the framework's own listener |
| never binds to a native event | the colon regression cannot come back — firing `play` once must produce exactly one `fairu-play` |
| rebinding swaps the track | the framework's reactivity reaches the property, and the player acts on it |
| logs no errors | nothing warns or throws along the way |

The two audio fixtures are different lengths on purpose: identical sources would
make a successful swap indistinguishable from no swap at all.

## Running it

```bash
npm --prefix .. run build:lib   # the apps import dist, not src
npm install
npm run install:browsers
npm test
```

Roughly a minute. `npm run test:headed` watches it happen.

To poke at one app by hand:

```bash
npm run dev:angular   # or dev:vue / dev:svelte / dev:plain
```

## Notes on the setup

**It tests `dist`, not `src`.** A consumer installs the package, so the thing
under test has to be the published artefact — bundling and the `exports` map
included. Pointing at source would verify code nobody ships.

**Dependencies live here, not in the library.** Angular, Vue and Svelte together
are a large tree, and none of it belongs in `npm ci` for someone who just wants
the player.

**Angular runs JIT.** `@angular/compiler` is imported for its side effect, which
keeps this to a plain Vite build instead of the full Angular toolchain. What is
under test is Angular's template semantics, and those are identical either way.

**Each app gets its own Vite cache dir.** The app roots contain no
`node_modules`, so all four resolved to the same `node_modules/.vite` and
invalidated each other's optimised dependencies on every start — Vite recovers
by reloading the page, mid-test.
