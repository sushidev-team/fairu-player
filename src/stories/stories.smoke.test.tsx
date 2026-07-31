/**
 * Renders every story in the repo once.
 *
 * A `storybook build` only proves the stories *compile*. This proves they
 * render: a story that throws on mount, a preview-kit component with a bad
 * prop, or a fixture that no longer matches its component's types all fail here
 * instead of being discovered by a human opening Storybook.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { composeStories, setProjectAnnotations } from '@storybook/react';
import previewAnnotations from '../../.storybook/preview';

setProjectAnnotations([previewAnnotations]);

// Vite's glob import gives us every story module without a hand-maintained list,
// so a new story file is covered the moment it is added.
const storyModules = import.meta.glob<Record<string, unknown>>('../**/*.stories.tsx', {
  eager: true,
});

afterEach(() => cleanup());

describe('story smoke test', () => {
  const entries = Object.entries(storyModules);

  it('finds story files', () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  for (const [path, module] of entries) {
    const name = path.replace('../', 'src/');

    describe(name, () => {
      // `composeStories` applies meta args, decorators and the project
      // annotations, so what renders here is what renders in the browser.
      const composed = composeStories(
        module as Parameters<typeof composeStories>[0]
      ) as Record<string, React.ComponentType>;

      const storyNames = Object.keys(composed);

      it('exports at least one story', () => {
        expect(storyNames.length).toBeGreaterThan(0);
      });

      for (const storyName of storyNames) {
        it(`renders ${storyName}`, () => {
          const Story = composed[storyName];
          const { container } = render(<Story />);
          expect(container).toBeTruthy();
        });
      }
    });
  }
});
