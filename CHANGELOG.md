# Changelog

## [1.8.0](https://github.com/sushidev-team/fairu-player/compare/v1.7.0...v1.8.0) (2026-08-25)


### Features

* caption parser and display, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#42](https://github.com/sushidev-team/fairu-player/issues/42)) ([11cc509](https://github.com/sushidev-team/fairu-player/commit/11cc5095ac4dc325c462bfad5cad6b11c788d670))
* equalizer, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#41](https://github.com/sushidev-team/fairu-player/issues/41)) ([bafdcb4](https://github.com/sushidev-team/fairu-player/commit/bafdcb4fb648aeecd74ca52365707fff5722b929))
* gesture feedback, share button and the live region, from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#46](https://github.com/sushidev-team/fairu-player/issues/46)) ([2869e39](https://github.com/sushidev-team/fairu-player/commit/2869e39d97ac6fe94559df6e9b5af7ea15a1c97d))
* pause ads, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#45](https://github.com/sushidev-team/fairu-player/issues/45)) ([547feb3](https://github.com/sushidev-team/fairu-player/commit/547feb3bdb4b36b14687fe6a65fd20e552715717))
* playback history, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#39](https://github.com/sushidev-team/fairu-player/issues/39)) ([a943623](https://github.com/sushidev-team/fairu-player/commit/a943623bdb891897743963770018d17d748dba3e))
* rewarded ads, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#44](https://github.com/sushidev-team/fairu-player/issues/44)) ([8b42f1d](https://github.com/sushidev-team/fairu-player/commit/8b42f1d8abee25dc548ae2dcfe689abdba79e9fb))
* watch-together, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#43](https://github.com/sushidev-team/fairu-player/issues/43)) ([07ecd86](https://github.com/sushidev-team/fairu-player/commit/07ecd868fd647e3890687433ff3bbd8018599c8c))

## [1.7.0](https://github.com/sushidev-team/fairu-player/compare/v1.6.0...v1.7.0) (2026-08-24)


### Features

* scrub thumbnails, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#36](https://github.com/sushidev-team/fairu-player/issues/36)) ([24928a2](https://github.com/sushidev-team/fairu-player/commit/24928a294fefd323b97cf7e36823bdf975ababab))
* sleep timer, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#38](https://github.com/sushidev-team/fairu-player/issues/38)) ([53c0cc8](https://github.com/sushidev-team/fairu-player/commit/53c0cc85bdcc0e187dde333a7ef761490f0cc8ed))
* subtitle appearance, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#34](https://github.com/sushidev-team/fairu-player/issues/34)) ([03f1b40](https://github.com/sushidev-team/fairu-player/commit/03f1b405342525836a7c871b4f57c2d5c1baa41a))

## [1.6.0](https://github.com/sushidev-team/fairu-player/compare/v1.5.0...v1.6.0) (2026-08-23)


### Features

* A-B repeat, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#31](https://github.com/sushidev-team/fairu-player/issues/31)) ([353a0ac](https://github.com/sushidev-team/fairu-player/commit/353a0ac8f07c1b246be81649b6a21e975ad1da67))
* shareable timestamps, extracted from PR [#16](https://github.com/sushidev-team/fairu-player/issues/16) ([#33](https://github.com/sushidev-team/fairu-player/issues/33)) ([ed22f21](https://github.com/sushidev-team/fairu-player/commit/ed22f21d7bd2fd8b65d3fe2e08134903d4319bfc))

## [1.5.0](https://github.com/sushidev-team/fairu-player/compare/v1.4.0...v1.5.0) (2026-08-23)


### Features

* **ads:** return non-linear creatives as overlay ads ([45eb31f](https://github.com/sushidev-team/fairu-player/commit/45eb31f20dd3051629ad341095daa96d06183f45))
* error boundaries, autoplay detection, a11y checks and a size gate ([9aa27b1](https://github.com/sushidev-team/fairu-player/commit/9aa27b1d6ae3555ff0546a0a1da47a88cdb81a69))
* Media Session, persistence, custom element and a working lint gate ([d795e59](https://github.com/sushidev-team/fairu-player/commit/d795e59b37371485e61227eecfa0e1232b086ada))
* publish playback to the OS via Media Session ([b2bf96d](https://github.com/sushidev-team/fairu-player/commit/b2bf96d5069ad4ed15df9db92e5fd2807f15898f))
* remember volume, mute, speed and playback position ([c40b583](https://github.com/sushidev-team/fairu-player/commit/c40b5830f25ee10f3fdc7242f9ad2985bb33c336))
* **wc:** ship the player as a &lt;fairu-player&gt; custom element ([e238320](https://github.com/sushidev-team/fairu-player/commit/e23832076cf0838c8b56bc0ab5b4215be9c45935))


### Bug Fixes

* **ads:** clear stale banners and plan non-linear VMAP breaks ([07dcfaf](https://github.com/sushidev-team/fairu-player/commit/07dcfaf7bf4c269baade929f32400177edc10f1c))
* **ads:** honour adConfig.enabled in the video player ([b1343c8](https://github.com/sushidev-team/fairu-player/commit/b1343c852fcda9c4658d922208fa7f0d5aa5aba8))
* **core:** four defects from review ([03523cd](https://github.com/sushidev-team/fairu-player/commit/03523cd4e86efff6cc03c866cea2ff3b1c301a65))
* **hls:** bound error recovery, and stop reloading the stream to switch quality ([7eb41eb](https://github.com/sushidev-team/fairu-player/commit/7eb41eb39a85e059c6e9a3057eceb9d8448e63c2))
* **keyboard:** make the arrow-key volume steps relative again ([0614945](https://github.com/sushidev-team/fairu-player/commit/0614945c316e441f3ede776fc19ca7869117522b))
* **playlist:** traverse the whole shuffled order and adopt new track lists ([f6da867](https://github.com/sushidev-team/fairu-player/commit/f6da867f43e26cea98f07282f429427f22158671))
* **reels:** fall back when keyboardStep is zero, negative or NaN ([e784bb9](https://github.com/sushidev-team/fairu-player/commit/e784bb9c3781fce34e767f917b266ca5d48d21a7))
* **reels:** make releaseGate actually open the ad gate ([e5503a1](https://github.com/sushidev-team/fairu-player/commit/e5503a18ee436eb3a29df1d860630c6126868e40))
* **reels:** seek the scrub bar by keyboard, and open the gate on the last slide ([b4471dc](https://github.com/sushidev-team/fairu-player/commit/b4471dc674313e68a9261fd783fdf7c7523e0500))
* restore persisted preferences, and harden three review findings ([5f6b76d](https://github.com/sushidev-team/fairu-player/commit/5f6b76d6374dadfc8b30ca307c5c459bf0d774ff))
* **video:** stop the track and playlist props clobbering config ([fc0bc8d](https://github.com/sushidev-team/fairu-player/commit/fc0bc8d18765e705fa082b9be519b32c7c916b39))
* **wc:** configure VideoPlayer directly instead of nesting a provider ([59644ec](https://github.com/sushidev-team/fairu-player/commit/59644ec1a8e7f3c69f0ab7ca8c4590cc97542ac4))
* **wc:** make the element usable in Angular and under SSR ([7da284d](https://github.com/sushidev-team/fairu-player/commit/7da284d4a041ff484f59cdf46a57c95387d52935))


### Performance Improvements

* **hls:** fetch hls.js on demand instead of bundling it into every video ([2359b88](https://github.com/sushidev-team/fairu-player/commit/2359b88ad0af5d08fe6cede58ee7bc0bb1cb28b9))

## [1.4.0](https://github.com/sushidev-team/fairu-player/compare/v1.3.3...v1.4.0) (2026-08-04)


### Features

* **ads:** consent, capping, viewability and the unrendered creatives ([#23](https://github.com/sushidev-team/fairu-player/issues/23)) ([8a637ae](https://github.com/sushidev-team/fairu-player/commit/8a637ae771774fe26cfda57d0cbf301730f840e4))

## [1.3.3](https://github.com/sushidev-team/fairu-player/compare/v1.3.2...v1.3.3) (2026-08-03)


### Miscellaneous Chores

* release 1.3.3 ([b8ea512](https://github.com/sushidev-team/fairu-player/commit/b8ea512b8c32af92f1f2460e03a048eec7eab3a4))

## [1.3.2](https://github.com/sushidev-team/fairu-player/compare/v1.3.1...v1.3.2) (2026-08-01)


### Bug Fixes

* make player adjustable ([556eea0](https://github.com/sushidev-team/fairu-player/commit/556eea00ea4dbc85ae7dd924d4ccd8135840ec61))

## [1.3.1](https://github.com/sushidev-team/fairu-player/compare/v1.3.0...v1.3.1) (2026-07-31)


### Bug Fixes

* ad issues ([7cde4d5](https://github.com/sushidev-team/fairu-player/commit/7cde4d5c8fe9d0ac0d420341e57808fa90733620))

## [1.3.0](https://github.com/sushidev-team/fairu-player/compare/v1.2.0...v1.3.0) (2026-07-31)


### Features

* add VMAP Support + Reels ([7a071a6](https://github.com/sushidev-team/fairu-player/commit/7a071a6ab92f5b377cf1b54f1ac1c7bd53c93530))

## [1.2.0](https://github.com/sushidev-team/fairu-player/compare/v1.1.0...v1.2.0) (2026-01-26)


### Features

* add pip / tracker ([b079f3c](https://github.com/sushidev-team/fairu-player/commit/b079f3c524a47fd82855de7dcd293da661123e0a))

## [1.1.0](https://github.com/sushidev-team/fairu-player/compare/v1.0.1...v1.1.0) (2026-01-23)


### Features

* add cdn setup ([199903f](https://github.com/sushidev-team/fairu-player/commit/199903f839481c956ffce5552bd1a72243201bca))
* add support for storybook on gh ([2d15b6a](https://github.com/sushidev-team/fairu-player/commit/2d15b6a12b5e94e09fc001270a71bb849150515c))


### Bug Fixes

* cdn issues ([dfcfb8e](https://github.com/sushidev-team/fairu-player/commit/dfcfb8e32bc99a4e58934075fa4b2f7e732db6a0))

## [1.0.1](https://github.com/sushidev-team/fairu-player/compare/v1.0.0...v1.0.1) (2026-01-17)


### Bug Fixes

* gha issue for deployment ([8c7eb59](https://github.com/sushidev-team/fairu-player/commit/8c7eb59234b72be3694ee8702f08654b9e077cc7))

## 1.0.0 (2026-01-17)


### Features

* add more ad functions ([09249ec](https://github.com/sushidev-team/fairu-player/commit/09249ecc34b753b99213f273337dc3c9daa2c9e9))
* add more features and support. ([c75547f](https://github.com/sushidev-team/fairu-player/commit/c75547fc5161f512409f05e4000f33e5c7c36361))
* add support for hls / ads (vast and custom react components) ([d6ab3f0](https://github.com/sushidev-team/fairu-player/commit/d6ab3f0e7ff22c9fcdd4e1b6890e9d7a4d5f3e58))
* init implementation for the player ([ab6b4d9](https://github.com/sushidev-team/fairu-player/commit/ab6b4d9ef383f59809f84ad3587d3130138026e9))


### Bug Fixes

* testing issues ([c64bf8a](https://github.com/sushidev-team/fairu-player/commit/c64bf8a08449a730fe1c8bed026a617a1d72cd50))
* type issues, + add support for ad events ([d21f781](https://github.com/sushidev-team/fairu-player/commit/d21f78110d4c7c30005a3650929ab411a0044384))
* update dependencies ([debc6ef](https://github.com/sushidev-team/fairu-player/commit/debc6ef8a9de8b1eb352360a4f1ea62afd8a50f0))
