# Fairu Player – Roadmap

Stand: 2026-08-17 · Version 1.4.0

Dieses Dokument beschreibt, was fehlt, um `@fairu/player` zu einem Player zu machen,
der sich gegen JW Player, Video.js, Vidstack und Shaka behaupten kann — und in
welcher Reihenfolge das sinnvoll ist.

> **Hinweis zu `IMPROVEMENTS.md` — korrigiert.** Dieses Dokument hielt zunächst
> fest, die dort als `[x] Completed` markierten 13 Punkte existierten schlicht
> nicht. Das war falsch: sie existierten, nur nicht auf `main`. `FairuProvider`,
> `useABLoop`, `useEqualizer`, `usePlaybackHistory`, `useShareableTimestamp`,
> `useSyncPlayback` und `ErrorBoundary/` liegen alle in PR #16 (siehe unten).
> `IMPROVEMENTS.md` beschrieb also einen Branch, nicht eine Fantasie — es war
> nur nie gesagt, welchen.
>
> Inzwischen sind davon auf `main`: `ErrorBoundary/`, `useAutoplayDetection`,
> `size-limit`, `vitest-axe`, `useABLoop` und `useShareableTimestamp`. Der Rest
> steht weiter aus.

---

## Bestandsaufnahme

**Stark:**

- VAST/VMAP-Stack: Wrapper-Auflösung, Ad-Pods (`sequence`), Icons, Extensions,
  Non-Linear/Overlay, Companion, Consent, Frequency Capping, Viewability
- Audio + Video über eine gemeinsame `useMedia`-Basis
- HLS via `hls.js`, inkl. Live und Quality-Selector
- Reels-Feed, Podcast-Views, Chapters, Markers, Stats/Rating
- Drei CDN-Builds (standalone / light / loader) plus Iframe-Embed
- Theming über CSS Custom Properties, i18n über `LabelsContext`
- Storybook, 91,5 % Statement-Coverage **auf den getesteten Dateien**

**Kennzahlen (Ist):**

| Metrik | Vorher | Jetzt |
|---|---|---|
| Quelldateien (`.ts`/`.tsx`) | 226 | 251 |
| Testdateien | 30 | 60 |
| Tests | 762 | 1 563 |
| Statement-Coverage (gesamt) | 72,3 % | 81,8 % |
| E2E im echten Browser | keine | 108 (4 Frameworks × 3 Engines) |
| Stories | 27 | 42 |
| Komponenten ohne Story | 15 | 0 |
| Lint-Fehler | n/a (Gate deaktiviert) | 0, blockierend |
| Bundle-Gate | keins | 5 Budgets, blockierend |
| React-freie Module | 91 | — |
| React-gekoppelte Module | 77 | — |

Die letzten beiden Zeilen sind der wichtigste Wert in dieser Tabelle — siehe Phase 3.

---

## Phase 0 — Hygiene (sofort, vor allem anderen)

| # | Thema | Warum |
|---|---|---|
| 0.1 | **ESLint installieren** | `npm run lint` konnte nicht laufen: eslint war nicht in `devDependencies`. `ci.yml` wusste das und setzte `continue-on-error: true` — der Job lief seitdem grün, ohne irgendetwas zu prüfen. |
| 0.2 | **Lint-Gate scharf schalten** | `continue-on-error` entfernt. |

**Status:** ✅ erledigt

ESLint 10 mit Flat Config (`eslint.config.js`), `typescript-eslint`,
`eslint-plugin-react-hooks` v6 und `react-refresh`. Der erste Lauf meldete
111 Probleme (59 Fehler). Behoben wurden dabei drei echte Defekte:

- **`PlayerContext.tsx`** — `handleEnded` war *über* `playlistReturn` deklariert,
  griff über die Temporal Dead Zone darauf zu und ließ `playlistReturn.controls`
  aus dem Dependency-Array. Der Callback hielt damit die `controls`, die galten,
  als `autoPlayNext`/`onEnded` zuletzt wechselten — Auto-Advance konnte ein
  veraltetes `next()` aufrufen und zum falschen Track springen. `VideoContext`
  hatte die Reihenfolge bereits richtig.
- **`usePlaylist.ts`** — zwei `useMemo`-Blöcke riefen `setState`. Ein Memo läuft
  während des Renders und kann verworfen werden; unter StrictMode feuerte das
  doppelt und würfelte die Shuffle-Reihenfolge bei jedem Render neu. Jetzt
  `useEffect`.
- **`ProgressBar.tsx` / `VolumeControl.tsx`** — tote Initialisierer, die
  verdeckten, dass jeder erreichbare Switch-Zweig ohnehin zuweist.

Die verbleibenden ~50 Meldungen der React-Compiler-Regeln (`refs`,
`set-state-in-effect`, `immutability`, `globals`) sind auf `warn` gesetzt, mit
Begründung in `eslint.config.js`: Sie kodieren Compiler-Annahmen, nicht
Hook-Korrektheit, und einige der markierten Stellen sind Absicht — der
`src`-Sync-Effekt in `useMedia` läuft bewusst bei jedem Render. Der ehrliche Fix
ist die State-Extraktion in Phase 3, nicht ein Streufeuer von
Disable-Kommentaren.

**Das Gate:** null Fehler, plus ein Warnungsbudget (`--max-warnings` in
`package.json`), das nur nach unten wandert. Die Zahl zu senken ist die sichtbare
Fortschrittsmetrik für die Compiler-Regeln.

---

## Phase 1 — Tischkante (das kostet heute Nutzer)

Diese vier Punkte sind kein „nice to have". Nutzer erwarten sie und merken ihr
Fehlen sofort.

| # | Thema | Zustand vorher |
|---|---|---|
| 1.1 | **Media Session API** | Kein einziger Treffer auf `mediaSession` im gesamten `src/`. Kein Lockscreen-Control, keine Metadaten im OS, keine Kopfhörer-/Bluetooth-Tasten, kein Auto/CarPlay. Für einen Podcast-Player die auffälligste Lücke. |
| 1.2 | **Persistenz** | `localStorage`/`sessionStorage` kamen in `src/` **nirgends** vor. Keine Resume-Position, keine gemerkte Lautstärke, kein Speed, keine Untertitelwahl. |
| 1.3 | **Thumbnail-Preview auf der Timeline** | Fehlt. Standard bei jedem ernstzunehmenden Video-Player (Sprite-Sheet + WebVTT). |
| 1.4 | **QoE-Metriken** | `TrackingService` sendet fachliche Events, aber keine Startup-Zeit, Rebuffer-Ratio, Bitrate-Verteilung, Error-Rate. Ohne diese Zahlen kann kein Kunde den Player betrieblich bewerten. |

**Status:** 1.1 ✅ · 1.2 ✅ · 1.3 offen · 1.4 offen

### 1.1 Media Session — erledigt

`useMediaSession` (`src/hooks/useMediaSession.ts`), verdrahtet in `PlayerContext`
und `VideoContext`. Metadaten, Playback-State, acht Action-Handler und
`positionState` für den OS-Scrubber. Standardmäßig an, abschaltbar über
`config.mediaSession.enabled`.

Alles feature-detected. Jeder Action-Handler wird einzeln registriert, weil
Chrome für nicht implementierte Aktionen `NotSupportedError` wirft — sonst nimmt
eine fehlende Aktion die übrigen Transportsteuerungen mit. Die Callbacks liegen
in einem Ref, das in einem Effekt aktualisiert wird, damit Inline-Arrow-Functions
nicht bei jedem Render das ganze Action-Set neu registrieren.

### 1.2 Persistenz — erledigt

Drei Bausteine:

- **`src/utils/storage.ts`** — namespaced Wrapper mit Envelope
  (Schema-Version + Zeitstempel), gecachter Verfügbarkeitsprobe, TTL-Expiry und
  Quota-Recovery. Bei `QuotaExceededError` wird der älteste *eigene* Eintrag
  geräumt und einmal erneut geschrieben; fremde Keys werden nie angefasst.
- **`usePersistentPreferences`** — Volume, Mute, Rate, Untertitel- und
  Qualitätswahl unter einem Key.
- **`useResumePosition`** — Position pro Track in *einer* Map statt einem Key je
  Track, sonst wäre Eviction unmöglich und eine Bibliothek mit hunderten Folgen
  kostete hunderte Reads.

Jeder Fehlerpfad degradiert lautlos zu „keine Persistenz": SSR ohne `window`,
blockierter Storage im Cross-Origin-Iframe, Safari Private Mode, volles
Kontingent. Ein Player, der sich die Lautstärke nicht merken kann, muss trotzdem
abspielen.

Abgesichert durch 44 Tests (18 Storage, 14 Resume, 12 Preferences) inklusive
der feindlichen Umgebungen.

---

## Phase 2 — Robustheit

| # | Thema | Detail |
|---|---|---|
| 2.1 | **HLS-Recovery härten** | ✅ Drei Versuche je Fehlerklasse, Netzwerk-Backoff 1s/2s/4s, echter Fehler danach, Budget zurückgesetzt sobald ein Level lädt. |
| 2.2 | **Error Boundaries** | ✅ `PlayerErrorBoundary` um Overlay-Ads, Info-Cards und End-Screen; Reset bei Trackwechsel, `subsystemError` auf dem Bus. |
| 2.3 | **Autoplay-Policy** | ✅ `useAutoplayDetection` — `allowed` / `muted-only` / `blocked`. |
| 2.4 | **Testabdeckung heben** | ✅ 30 → 60 Testdateien, 762 → 1 563 Tests, Gesamt-Coverage 81,8 % Statements / 84,2 % Lines. |
| 2.5 | **a11y + Bundle-Gate** | ✅ 19 axe-Prüfungen ohne Verstöße; `size-limit` mit fünf Budgets, blockierend in CI. |

**Phase 2 ist abgeschlossen.**

### Was dabei gefunden wurde

Jede dieser Stellen war vorher ungetestet:

| Wo | Was |
|---|---|
| `useHLS` | Unbegrenzte Recovery — bei totem CDN eine enge Schleife, die den Origin hämmert, hinter einem Spinner, der nie aufhört, ohne je einen Fehler zu melden. |
| `useHLS` | Ein Qualitätswechsel zerstörte die Instanz und lud den Stream neu: Stall, neuer Buffer, gewähltes Level verloren. |
| `TrackingContext` | Batch-Timer in einem `useMemo` mit Cleanup, die React nie aufruft — lief nach dem Unmount weiter. |
| `AdContext` | Skip-Countdown ohne Unmount-Pfad, eines pro Ad-Break. |
| `VideoPlayer` | `{...config, track, playlist}` überschrieb `config.track` mit `undefined`. `<VideoPlayer config={{track}} />` rendert ohne Quelle. |

Die ersten beiden Timer-Lecks sind dasselbe Muster wie in `usePlaylist`:
`useMemo` für Seiteneffekte. Drei Fundstellen — das ist ein wiederkehrender
Fehler, keine Einzelfälle.

### Offen geblieben

- ~~`hls.js` wird statisch importiert.~~ Erledigt: wird nur noch bei einer
  HLS-Quelle nachgeladen, siehe `perf(hls)` in v1.5.0.
- **Abdeckung von `VideoPlayer.tsx` und Reels.** Stand heute 61 % bzw. 64 %
  Statements — die beiden einzigen nennenswerten Lücken im Paket
  (Gesamt: 81,8 % Statements, `src/core` bei 98,6 %). Beides sind große
  Komponenten mit viel UI-Verzweigung; der Weg dahin ist derselbe wie in
  Phase 3: Logik heraustrennen, dann ohne Renderer testen.

### E2E-Framework-Verifikation — erledigt

`verification/` enthält vier Apps (Vue, Angular, Svelte, Plain-HTML), die das
Custom Element genau so einbinden wie die README es dokumentiert. Playwright
fährt alle vier im echten Browser gegen das **gebaute** `dist`, als eigener
CI-Job. 36 Assertions, ~1 Minute.

Das war nötig, weil zwei Defekte jeden Unit-Test bestanden hatten: Angular band
`(fairu:play)` an `play`, und der Import warf in Node. Ein dritter fiel bei der
Einrichtung auf — `fairu-ready` feuerte synchron im `connectedCallback`, den
Angular nie hörte.

Die Abhängigkeiten liegen in `verification/package.json`, damit `npm ci` für die
Bibliothek unberührt bleibt.

### Storybook-Abdeckung — erledigt

15 Komponenten hatten keinerlei Story. Alle geschlossen:

| Bereich | Neu |
|---|---|
| Controls | `CastButton`, `FullscreenButton`, `PictureInPictureButton`, `QualitySelector`, `SubtitleSelector`, `TimeDisplay` |
| Ads | `AdSkipButton`, `CompanionAd`, `AdChoicesIcon` |
| Playlist | `PlaylistControls`, `TrackItem` |
| Video | `VideoControls`, `VideoOverlay`, `LogoOverlay` |
| Chapters | `ChapterMarker` |

Damit hat jede Komponente unter `src/components/` mindestens eine Story.

Der Nebeneffekt ist der eigentliche Gewinn: `src/stories/stories.smoke.test.tsx`
rendert per Glob-Import jede Story im Repo. Die 15 neuen Dateien haben dort
71 Testfälle erzeugt, ohne dass eine Liste gepflegt werden musste — die Suite
wuchs von 826 auf 897 Tests.

---

## Phase 3 — Framework-Öffnung (Vue, Angular, Web Component)

Das ist strategisch der wichtigste Block — und zufällig auch die Antwort auf die
Frage, warum `VideoPlayer.tsx` 943 Zeilen hat.

**Kein Port. Eine Core-Extraktion.**

Der Ausgangspunkt ist günstiger als erwartet: **91 Module in `src/` sind bereits
React-frei** — der komplette VAST-Parser, `AdService`, `TrackingService`,
`AdEventBus`, `PlayerEventBus`, `adCaps`, `security`, `theme`, `fairu`. Das ist
substanziell der halbe Core. Was noch in React steckt, ist die Zustandslogik in
den Contexts und in `VideoPlayer.tsx`.

### Stand: drei Schnitte erledigt

| Slice | Wo | Beweis |
|---|---|---|
| Playlist-Regeln | `src/core/playlist.ts` | 49 bestehende Hook-Tests unverändert grün, 36 neue ohne Renderer |
| Watch-Progress | `src/core/watchProgress.ts` | 30 bestehende unverändert grün, 29 neue ohne Renderer |
| Media-Controller | `src/core/mediaController.ts` | 41 bestehende unverändert grün, 40 neue ohne Renderer |

Keiner der drei importiert React. Playlist und Watch-Progress sind reine
Funktionen; der Media-Controller ist es nicht und soll es nicht sein — er hält
ein `HTMLMediaElement` und dessen Listener, weil das Element die Sache ist, die
gesteuert wird. Framework-neutral heißt hier: keine Meinung darüber, wie ein UI
zusieht. Die Hooks sind zu dünnen Bindungen geschrumpft; ein Vue- oder
Angular-Adapter wäre dieselbe Form über denselben Core.

Das Muster, das sich bewährt hat: **die bestehenden Tests unverändert lassen.**
Dass sie durchlaufen, ist der Beleg für Verhaltensgleichheit — nicht, dass die
neuen Tests grün sind. Beim Playlist-Schnitt hat genau das einen Fehler
gefangen (Callbacks auf einen Microtask verschoben), beim Watch-Progress eine
Mutation, die Aufrufer-Objekte nachträglich veränderte.

Der Media-Controller war der tragende Teil: `useMedia` ging von 348 auf 141
Zeilen und ist jetzt ein `useSyncExternalStore` über den Controller. Das ist die
idiomatische Leseweise für Zustand außerhalb von React und ersetzt das
Spiegeln derselben Werte in `useState`, womit der alte Hook den Großteil seiner
Länge verbracht hat. Vier `react-hooks/refs`-Warnungen sind damit weg — das
Budget fiel von 96 auf 94.

### Nächste Schnitte

- **Ad-Contexts → Scheduler.** `AdContext` und `VideoAdContext` halten
  Terminierung, Capping und Pod-Fortschritt. Beide sind inzwischen gut getestet
  (98 % bzw. 84 %), also gibt es ein Orakel für die Extraktion.
- **Monorepo-Split**: `@fairu/player-core` plus Adapter. Erst sinnvoll, wenn der
  Core alles hält, was ein Adapter braucht — nach dem Ad-Schnitt ist das der
  Fall.

Was noch **nicht** im Core ist und dort hingehört: HLS-Engine-Auswahl
(`useHLS` ist bereits größtenteils neutral), Persistenz und Media Session (beide
fast reine Funktionen), Kapitel- und Marker-Auflösung.

### Zielstruktur — Monorepo, kein eigenes Repo

```
packages/
  core/      @fairu/player-core     vanilla TS: State-Machine, Media-Engine,
                                     Ad-Engine, Tracking. Null Framework-Deps.
  react/     @fairu/player          heutiges Paket, wird zum dünnen Adapter
  vue/       @fairu/player-vue
  angular/   @fairu/player-angular
  wc/        @fairu/player-wc       Web Component
```

**Warum Monorepo und nicht getrennte Repos:** Core und Adapter müssen synchron
released werden, und jeder VAST-Fix muss gleichzeitig in allen Adaptern landen.
Getrennte Repos erzeugen Versions-Drift — und der Ad-Stack ist genau der Teil,
wo Drift teuer wird. `release-please` beherrscht Monorepos; die Konfiguration
liegt bereits im Repo.

### Reihenfolge

1. **Core extrahieren** — das große Stück. Zustandslogik aus den Contexts und
   `VideoPlayer.tsx` in framework-neutrale Module. React-Paket wird zum Adapter.
2. **Web Component zuerst ausliefern** — ein `<fairu-player>` deckt Vue, Angular,
   Svelte und plain HTML mit *einem* Artefakt ab. Grob 20 % des Aufwands für 80 %
   der Reichweite.
3. **Native Vue-/Angular-Adapter danach** — für die DX (typisierte Props,
   reaktive Bindings, SSR). Als Adapter über denselben Core, nie als zweite
   Implementierung.

### Teststrategie

Der entscheidende Punkt, sonst driften die Implementierungen still auseinander:

- **Core:** Vitest in Node-Env — ohne den jsdom-Mock-Apparat aus `src/test/setup.ts`.
- **Adapter:** je `@testing-library/{react,vue,angular}`.
- **Darüber: ein gemeinsames Contract-Test-Set.** Eine Playwright-Suite, die
  dieselben Szenarien gegen *alle* Adapter fährt. Ohne das merkt man Divergenz
  erst beim Kunden.

**Wichtig:** Phase 3 sollte **vor** den verbleibenden Feature-Phasen kommen.
Sonst baut man DASH, DRM und Offline dreimal.

---

## Phase 4 — Neue Kundensegmente

| # | Thema | Wer wird dadurch adressierbar |
|---|---|---|
| 4.1 | **DASH-Support** | EU-Broadcaster und CTV fahren DASH, nicht HLS. Kandidat: Shaka Player als Engine, die HLS **und** DASH abdeckt und `hls.js` ersetzen könnte. |
| 4.2 | **DRM / EME** | Kein `requestMediaKeySystemAccess` im Code. Ohne Widevine/PlayReady/FairPlay fällt jeder Premium-Content-Kunde raus. Kommt über 4.1 praktisch mit. |
| 4.3 | **Offline / Download** | Kein ServiceWorker, kein IndexedDB. Relevant für echte Podcast-App-Nutzung. |
| 4.4 | **SSAI / DAI** | Server-side Ad Insertion fehlt vollständig. |
| 4.5 | **VPAID-Ausführung** | VPAID wird heute nur *erkannt* und in `mediaFile.ts` herausgefiltert, nicht ausgeführt. |
| 4.6 | **OMID / Open Measurement** | Existiert bisher nur als Typ plus `docs/OMID.md`. Für zertifizierte Viewability ist eine echte OM-SDK-Anbindung nötig. |

---

## Vorhandene, nicht gemergte Arbeit — PR #16

**Der wichtigste offene Punkt in diesem Dokument.** PR #16 (`feature/tests`,
Merge-Basis 26.01.2026, 143 Dateien, ~30.000 Zeilen) enthält den Großteil von
Phase 5 bereits fertig geschrieben, inklusive 52 Testdateien:

| Vorhanden in #16 | Entspricht |
|---|---|
| ~~`useEqualizer`, `Equalizer`~~ — **übernommen**: `src/core/equalizer.ts`, `src/hooks/useEqualizer.ts`, `src/components/controls/Equalizer/` | 5.1 Web Audio |
| ~~`useABLoop`~~ — **übernommen**, siehe `src/core/abLoop.ts` | 5.2 A-B-Loop |
| ~~`useShareableTimestamp`~~ — **übernommen**, siehe `src/core/timestamp.ts` | 5.3 Shareable Timestamps |
| ~~`types/history.ts`~~ — **übernommen**, siehe `src/core/playbackHistory.ts` | 5.4 Playback-History |
| ~~`useSubtitleStyling`, `SubtitleSettings`~~ — **übernommen**, siehe `src/core/subtitleStyle.ts` | 5.5 Untertitel-Styling |
| `useSyncPlayback` (233 Z.), `SyncService` | 5.6 Synchronized Playback |
| ~~`useSleepTimer`, `SleepTimer`~~ — **übernommen**, siehe `src/core/sleepTimer.ts` | — |
| ~~`utils/thumbnails.ts`, `ThumbnailPreview`~~ — **übernommen**, siehe `src/core/thumbnails.ts` | Scrubbing-Vorschau |
| `PauseAd`, `RewardedAd`, `useRewardedAd` | zusätzliche Ad-Formate |
| `GestureOverlay`, `ShareButton`, `ScreenReaderAnnouncer` | — |

Zwei Dinge daran sind wichtig:

**Es ist einzeln übernehmbar.** `useABLoop` und `useShareableTimestamp`
importieren ausschließlich React, die übrigen Hooks nur React plus ihre eigenen
Typen. Sie hängen nicht an `useMedia` oder `useVideo` und überleben die
Core-Extraktion daher unbeschadet. Der Branch als Ganzes ist nicht mergebar —
er konfliktiert, und seine Tests laufen gegen APIs von Januar — aber
Datei für Datei gegen den aktuellen `main` ist realistisch.

**Es ist bereits einmal doppelt gebaut worden.** `PlayerErrorBoundary` und
`useAutoplayDetection` liegen sowohl in #16 als auch auf `main`, unabhängig
voneinander entstanden. Das ist der Preis dafür, den Branch liegen zu lassen,
und er steigt mit jeder Phase.

Empfehlung: nicht mergen, sondern einzeln herausziehen — pro Feature ein PR
gegen den aktuellen Stand, mit den Tests aus #16 als Vorlage.

---

## Size-Budgets — was gemessen wird und warum

Neun Budgets, und sie messen absichtlich **Artefakte, die jemand herunterlädt**:

| | Grenze |
|---|---|
| Audio-Chunk, Video-Chunk, `hls.js` | 29 / 30 / 200 kB |
| Stylesheet, Custom-Element-Entry | 10 / 3 kB |
| CDN standalone / light / loader | 145 / 25 / 2,5 kB |
| ESM-Entry (`dist/index.js`) | 45 kB — **Indikator**, kein Download |

Zwei Dinge waren vorher falsch bzw. fehlten:

**Die drei CDN-Bundles hatten überhaupt kein Budget.** Sie werden ausgeliefert —
133 kB brotli beim Standalone, inklusive React —, und eine Regression dort war
schlicht unsichtbar. CI hat sie nicht einmal gebaut; `npm run size` tut das
jetzt selbst, denn ein Budget für etwas, das nie gebaut wird, ist keines.

**`dist/index.js` misst nichts, das jemand zahlt.** `sideEffects` ist gesetzt,
Bundler shaken die ungenutzten Exporte heraus, und CDN-Nutzer bekommen eigene
IIFE-Builds. Die Zahl wächst mit jedem Hook, ohne dass ein Konsument davon
betroffen wäre — sie deshalb pro Feature hochzuhandeln war eine Verhandlung über
eine Zahl ohne Adressaten. Jetzt mit echtem Spielraum als grober Deckel, und der
Name sagt es.

Kurz erwogen und wieder verworfen: `@size-limit/esbuild`, um echte
Import-Kosten (`import { AudioPlayer }`) zu messen. Sobald der Adapter
installiert ist, schaltet size-limit **alle** Einträge auf Bundle-Modus — die
Datei-Budgets messen dann etwas anderes und reißen sämtlich. Die beiden Modi
vertragen sich in einer Config nicht, und die Chunk-Dateien beantworten dieselbe
Frage bereits.

---

## Abhängigkeiten

**`tailwind-merge` bleibt auf v2.** Nachgemessen, nicht geschätzt: v3 kostet
**+2,7 kB brotli** im Audio-Chunk (27,9 → 30,6 kB) und reißt damit das
29-kB-Budget. Funktional war in keinem geprüften Fall ein Unterschied messbar —
`bg-*`, `h-*`, `max-h-*`, `flex-grow`, `overflow-ellipsis`, `aspect-*` lieferten
unter v2 und v3 identische Ergebnisse. Die Version ist also nicht vernachlässigt,
sondern richtig gepinnt; sie zieht mit, wenn Tailwind selbst auf v4 geht.

---

## Phase 5 — Differenzierung

| # | Thema | Detail |
|---|---|---|
| 5.1 | **Web Audio** — teilweise | **EQ erledigt** — `src/core/equalizer.ts` (Bänder, Presets), `src/hooks/useEqualizer.ts` (Audio-Graph), `src/components/controls/Equalizer/Equalizer.tsx` (Panel). Offen: Lautstärke-Normalisierung und Silence-Skip. |
| 5.2 | ~~**A-B-Loop / Segment-Repeat**~~ | **Erledigt.** `src/core/abLoop.ts` plus `useABLoop`, aus #16 übernommen und dabei neu geschrieben. |
| 5.3 | ~~**Shareable Timestamps**~~ | **Erledigt.** `src/core/timestamp.ts` plus `useShareableTimestamp`. Die Anbindung an `embed/parseConfig` steht noch aus — der Embed-Loader liest `t` bisher nicht. |
| 5.4 | ~~**Playback-History**~~ | **Erledigt.** `src/core/playbackHistory.ts` plus `usePlaybackHistory`, ein Store pro Storage-Key. |
| 5.5 | ~~**Untertitel-Styling**~~ | **Erledigt.** `src/core/subtitleStyle.ts`, `useSubtitleStyling`, `SubtitleSettings`. Als `::cue`-Regel statt Style-Objekt — der Player rendert Cues nativ. |
| 5.6 | **Synchronized Playback** | Watch-Together. Transport-agnostisch: Client-Hook plus Referenz-Interface, Server bleibt außerhalb des Scopes. |

---

## Empfohlene Reihenfolge

```
Phase 0  ──▶  Phase 1  ──▶  Phase 2  ──▶  Phase 3  ──▶  Phase 4  ──▶  Phase 5
Hygiene       Tischkante    Robustheit    Core +        Segmente      Differenz.
                                          Vue/Angular
```

Einzige Abweichung, die sich lohnt: Phase 0 kostet etwa eine Stunde und sollte
vor jedem Refactoring stehen — ein Lint-Gate, das nichts prüft, ist schlimmer
als keins.
