<script lang="ts">
  /**
   * Svelte 5 sets non-primitive values as DOM properties on custom elements,
   * and `on<name>` attaches a listener for that exact event name — both of
   * which are what the element needs.
   */
  import { TRACK_ONE, TRACK_TWO, type Probe } from '@shared/fixtures';

  const probe = window.__probe as Probe;

  let config = $state<Record<string, unknown>>({ track: TRACK_ONE });

  function record(name: string) {
    return (event: Event) => {
      probe.events.push({ name, detail: (event as CustomEvent).detail });
    };
  }

  function swap() {
    config = { track: TRACK_TWO };
  }
</script>

<h1>Svelte</h1>
<div id="host">
  <fairu-player
    {config}
    muted
    theme="dark"
    onfairu-ready={record('fairu-ready')}
    onfairu-play={record('fairu-play')}
    onfairu-pause={record('fairu-pause')}
    onfairu-ended={record('fairu-ended')}
    onfairu-timeupdate={record('fairu-timeupdate')}
    onfairu-trackchange={record('fairu-trackchange')}
    onfairu-error={record('fairu-error')}
  ></fairu-player>
</div>
<button id="swap" type="button" onclick={swap}>Swap track</button>
