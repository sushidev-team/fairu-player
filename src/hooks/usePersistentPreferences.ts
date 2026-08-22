import { useCallback, useEffect, useMemo, useState } from 'react';
import { readStored, writeStored, removeStored } from '@/utils/storage';
import type {
  PersistedPreferences,
  PersistenceConfig,
} from '@/types/persistence';

const PREFERENCES_KEY = 'preferences';

/**
 * Player preferences that survive a reload: volume, mute, playback rate and
 * subtitle choice.
 *
 * These are deliberately stored under a single key rather than one key per
 * setting. They are always read and written together, a single JSON blob is one
 * storage round trip instead of four, and it keeps the namespace tidy for the
 * `clearStored` "forget me" path.
 *
 * Scoping: preferences are global to the player by default, not per track —
 * someone who turns the volume down wants it down for the next episode too.
 * Pass a `scope` to namespace them (per site section, per embed instance).
 */
export interface UsePersistentPreferencesOptions extends PersistenceConfig {
  /** Defaults used when nothing is stored yet. */
  defaults?: PersistedPreferences;
}

export interface UsePersistentPreferencesReturn {
  /** Stored preferences merged over the defaults. */
  preferences: PersistedPreferences;
  /** Merge a patch and persist it. */
  update: (patch: Partial<PersistedPreferences>) => void;
  /** Drop stored preferences and fall back to the defaults. */
  reset: () => void;
  /**
   * Whether the initial read has happened. Consumers that would otherwise apply
   * the defaults on the first frame (and visibly jump when the stored value
   * lands) can wait on this.
   */
  isHydrated: boolean;
}

function storageKey(scope?: string): string {
  return scope ? `${PREFERENCES_KEY}:${scope}` : PREFERENCES_KEY;
}

export function usePersistentPreferences(
  options: UsePersistentPreferencesOptions = {}
): UsePersistentPreferencesReturn {
  const { enabled = true, scope, maxAge, defaults } = options;

  const key = storageKey(scope);

  // Callers pass `defaults` as an object literal, so it is a new reference on
  // every render. Compared by identity it would re-run the read effect
  // constantly and clobber the listener's changes with the site defaults.
  //
  // Compared by *value* instead: the record is a handful of scalars, so
  // serialising it is cheap and gives a dependency that only changes when the
  // defaults actually do.
  const defaultsKey = JSON.stringify(defaults ?? {});
  const stableDefaults = useMemo<PersistedPreferences>(
    () => JSON.parse(defaultsKey) as PersistedPreferences,
    [defaultsKey]
  );

  const [stored, setStored] = useState<PersistedPreferences | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read once on mount. Not during useState initialisation: that runs on the
  // server too, where there is no storage, and would desync hydration.
  useEffect(() => {
    if (!enabled) {
      setIsHydrated(true);
      return;
    }
    setStored(readStored<PersistedPreferences>(key, { maxAge }));
    setIsHydrated(true);
  }, [enabled, key, maxAge]);

  const preferences = useMemo<PersistedPreferences>(
    () => ({ ...stableDefaults, ...stored }),
    [stableDefaults, stored]
  );

  const update = useCallback(
    (patch: Partial<PersistedPreferences>) => {
      setStored((prev) => {
        const next = { ...prev, ...patch };
        if (enabled) writeStored(key, next);
        return next;
      });
    },
    [enabled, key]
  );

  const reset = useCallback(() => {
    removeStored(key);
    setStored(null);
  }, [key]);

  return { preferences, update, reset, isHydrated };
}
