/**
 * FairuPlayer Loader — Lightweight lazy-loading facade
 * Zero dependencies. No React. No imports from the project.
 */

interface LoaderOptions {
  playerSrc?: string;
  playerCss?: string;
  variant?: 'standalone' | 'light';
}

const CSS = `.fl{position:relative;overflow:hidden;font-family:'Figtree',system-ui,sans-serif;color:var(--fp-color-text,#fff);background:var(--fp-glass-bg,rgba(18,18,18,.85));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--fp-glass-border,rgba(255,255,255,.1));border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);padding:20px;display:flex;align-items:center;gap:16px;cursor:pointer;transition:box-shadow .2s,transform .15s;user-select:none}.fl:hover{box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 20px var(--fp-color-accent-glow,rgba(0,169,157,.4));transform:translateY(-1px)}.fl[data-theme=light]{color:var(--fp-color-text,#1f2937);background:var(--fp-glass-bg,rgba(255,255,255,.85));border-color:var(--fp-glass-border,rgba(0,0,0,.1));box-shadow:0 4px 12px rgba(0,0,0,.1)}.fl[data-theme=light]:hover{box-shadow:0 8px 24px rgba(0,0,0,.15),0 0 20px var(--fp-color-accent-glow,rgba(0,169,157,.3))}.fl__art{flex-shrink:0;width:64px;height:64px;border-radius:8px;overflow:hidden;background:var(--fp-color-surface,#282828)}.fl__art img{width:100%;height:100%;object-fit:cover;display:block}.fl__info{flex:1;min-width:0}.fl__title{font-size:1.125rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fl__artist{font-size:.875rem;color:var(--fp-color-text-secondary,#b3b3b3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}.fl[data-theme=light] .fl__artist{color:var(--fp-color-text-secondary,#6b7280)}.fl__play{flex-shrink:0;width:48px;height:48px;border-radius:50%;background:var(--fp-color-accent,#00a99d);display:flex;align-items:center;justify-content:center;transition:transform .15s,background .15s}.fl:hover .fl__play{transform:scale(1.05);background:var(--fp-color-accent-hover,#04c8b6)}.fl__play svg{width:20px;height:20px;fill:#000;margin-left:2px}.fl--loading .fl__play svg{animation:fp-ls 1s linear infinite}@keyframes fp-ls{to{transform:rotate(360deg)}}`;

const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const SPIN = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';

const opts: LoaderOptions = {};
let base = '';
let bundleP: Promise<void> | null = null;
let cssP: Promise<void> | null = null;
let styled = false;

function injectCSS() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
}

function loadEl(tag: 'script' | 'link', attr: string, val: string): Promise<void> {
  return new Promise((ok, fail) => {
    if (document.querySelector(`${tag}[${attr}="${val}"]`)) { ok(); return; }
    const el = document.createElement(tag) as HTMLScriptElement & HTMLLinkElement;
    if (tag === 'script') el.src = val;
    else { el.rel = 'stylesheet'; el.href = val; }
    el.onload = () => ok();
    el.onerror = () => fail(new Error(`Load failed: ${val}`));
    document.head.appendChild(el);
  });
}

function srcUrl() {
  return opts.playerSrc || base + ((opts.variant === 'light') ? 'fairu-player.light.iife.js' : 'fairu-player.iife.js');
}
function cssUrl() {
  return opts.playerCss || base + 'player.css';
}

function preload() {
  if (!bundleP) {
    bundleP = loadEl('script', 'src', srcUrl());
    cssP = loadEl('link', 'href', cssUrl());
  }
}

async function ensureLoaded() {
  preload();
  await Promise.all([bundleP, cssP]);
}

function render(el: HTMLElement) {
  if (el.querySelector('.fl')) return;

  const { title = '', artist = '', artwork = '', theme = '' } = el.dataset;
  const w = document.createElement('div');
  w.className = 'fl';
  if (theme) w.dataset.theme = theme;

  if (artwork) {
    const d = document.createElement('div');
    d.className = 'fl__art';
    d.innerHTML = `<img src="${artwork}" alt="${title || 'Cover art'}" loading="lazy">`;
    w.appendChild(d);
  }

  if (title || artist) {
    const d = document.createElement('div');
    d.className = 'fl__info';
    if (title) { const t = document.createElement('div'); t.className = 'fl__title'; t.textContent = title; d.appendChild(t); }
    if (artist) { const a = document.createElement('div'); a.className = 'fl__artist'; a.textContent = artist; d.appendChild(a); }
    w.appendChild(d);
  }

  const btn = document.createElement('div');
  btn.className = 'fl__play';
  btn.innerHTML = PLAY;
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Play');
  btn.tabIndex = 0;
  w.appendChild(btn);
  el.appendChild(w);

  const activate = async () => {
    w.classList.add('fl--loading');
    btn.innerHTML = SPIN;
    try {
      await ensureLoaded();
      w.remove();
      const fp = (window as any).FairuPlayer;
      if (fp?.mount) fp.mount(el);
    } catch (e) {
      w.classList.remove('fl--loading');
      btn.innerHTML = PLAY;
      console.error('[FairuPlayerLoader]', e);
    }
  };

  w.addEventListener('click', activate);
  w.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { preload(); io.disconnect(); break; }
    }, { rootMargin: '200px' });
    io.observe(w);
  }
}

const FairuPlayerLoader = {
  init(selector = '[data-fairu-player]') {
    injectCSS();
    document.querySelectorAll<HTMLElement>(selector).forEach(render);
  },
  configure(o: LoaderOptions) { Object.assign(opts, o); },
};

// Capture script base URL synchronously (document.currentScript only available at parse time)
{
  const s = document.currentScript as HTMLScriptElement | null;
  if (s?.src) base = s.src.substring(0, s.src.lastIndexOf('/') + 1);
  if (s) {
    if (s.dataset.playerSrc) opts.playerSrc = s.dataset.playerSrc;
    if (s.dataset.playerCss) opts.playerCss = s.dataset.playerCss;
    if (s.dataset.variant) opts.variant = s.dataset.variant as 'standalone' | 'light';
  }
}

// Expose on window
if (typeof window !== 'undefined') {
  (window as any).FairuPlayerLoader = FairuPlayerLoader;
}

// Auto-init
if (typeof document !== 'undefined') {
  const s = document.currentScript as HTMLScriptElement | null;
  if (s?.hasAttribute('data-auto-init')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => FairuPlayerLoader.init());
    } else {
      FairuPlayerLoader.init();
    }
  }
}

export { FairuPlayerLoader };
export type { LoaderOptions };
