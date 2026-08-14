/**
 * Framework-neutral entry point.
 *
 * Importing this module for its side effect registers `<fairu-player>`:
 *
 * ```ts
 * import '@fairu/player/wc';
 * ```
 *
 * The named exports are for callers that want a different tag name or need the
 * class itself (Angular's `CUSTOM_ELEMENTS_SCHEMA` setups, SSR guards, tests).
 */

export {
  FairuPlayerElement,
  defineFairuPlayer,
  FAIRU_EVENTS,
  FAIRU_PLAYER_TAG,
  type FairuEventName,
} from './FairuPlayerElement';

import { defineFairuPlayer } from './FairuPlayerElement';

// Auto-register on import. `defineFairuPlayer` is a no-op without a DOM, so
// this stays safe under SSR.
defineFairuPlayer();
