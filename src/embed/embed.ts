import React from 'react';
import { createRoot } from 'react-dom/client';
import { EmbedPlayer } from './EmbedPlayer';
import { parseDataAttributes, parseUrlParams } from './parseConfig';
import type { EmbedConfig } from './parseConfig';

// Import styles
import '../styles/base.css';

declare global {
  interface Window {
    FairuPlayer: typeof FairuPlayer;
  }
}

/**
 * FairuPlayer - Embeddable podcast player
 */
const FairuPlayer = {
  /**
   * Initialize player from data attributes on elements
   */
  init(selector = '[data-fairu-player]') {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach((element) => {
      this.mount(element);
    });
  },

  /**
   * Mount player on a specific element
   */
  mount(element: HTMLElement, config?: Partial<EmbedConfig>) {
    const parsedConfig = parseDataAttributes(element);
    const mergedConfig: EmbedConfig = {
      ...parsedConfig,
      ...config,
      player: {
        ...parsedConfig.player,
        ...config?.player,
      },
    };

    const root = createRoot(element);
    root.render(React.createElement(EmbedPlayer, { config: mergedConfig }));

    // Store root for cleanup
    (element as HTMLElement & { _fairuRoot?: ReturnType<typeof createRoot> })._fairuRoot = root;

    return {
      unmount: () => this.unmount(element),
    };
  },

  /**
   * Unmount player from element
   */
  unmount(element: HTMLElement) {
    const root = (element as HTMLElement & { _fairuRoot?: ReturnType<typeof createRoot> })._fairuRoot;
    if (root) {
      root.unmount();
      delete (element as HTMLElement & { _fairuRoot?: ReturnType<typeof createRoot> })._fairuRoot;
    }
  },

  /**
   * Create player programmatically
   */
  create(container: string | HTMLElement, config: EmbedConfig) {
    const element = typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;

    if (!element) {
      throw new Error(`Container not found: ${container}`);
    }

    return this.mount(element, config);
  },

  /**
   * Parse configuration from URL (for iframe embeds)
   */
  parseUrl(url: string) {
    return parseUrlParams(url);
  },
};

// Export for module usage
export { FairuPlayer, parseDataAttributes, parseUrlParams };
export type { EmbedConfig };

// Auto-initialize if script has data-auto-init attribute
if (typeof document !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script?.hasAttribute('data-auto-init')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => FairuPlayer.init());
    } else {
      FairuPlayer.init();
    }
  }

  // Expose to window
  window.FairuPlayer = FairuPlayer;
}
