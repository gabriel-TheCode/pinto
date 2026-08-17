/**
 * The injected surface inside Play Console.
 *
 * Everything Pinto renders on Google's page lives inside a shadow root, and
 * the product UI itself lives in an extension-origin iframe. Play Console's
 * stylesheets cannot reach into either, and Pinto's cannot leak out — which
 * matters when the host page is a large Angular app that is redesigned often.
 */

const HOST_ID = 'pinto-root';
const PANEL_WIDTH = 460;

export interface InjectedUi {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; }

  .launcher {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483000;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px 10px 12px;
    border: 1px solid rgba(17, 24, 39, 0.08);
    border-radius: 999px;
    background: #101828;
    color: #fff;
    font-size: 13px;
    font-weight: 550;
    letter-spacing: -0.01em;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.16), 0 12px 32px rgba(16, 24, 40, 0.2);
    transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
  }
  .launcher:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(16,24,40,.18), 0 18px 40px rgba(16,24,40,.24); }
  .launcher:active { transform: translateY(0); }
  .launcher[hidden] { display: none; }
  .launcher .mark {
    width: 22px; height: 22px; border-radius: 7px;
    background: linear-gradient(140deg, #ff9100, #df301c);
    display: grid; place-items: center;
    font-size: 13px; font-weight: 700; color: #fff;
  }
  .launcher .kbd {
    margin-left: 4px; padding: 1px 5px; border-radius: 4px;
    background: rgba(255,255,255,.12); font-size: 11px; font-weight: 500;
  }

  .panel {
    position: fixed;
    z-index: 2147483001;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid rgba(17,24,39,.12);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(16,24,40,.12), 0 24px 60px rgba(16,24,40,.18);
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease, transform 220ms cubic-bezier(0.32,0.72,0,1);
  }
  .panel[data-open="true"] { opacity: 1; pointer-events: auto; }
  /* Docked to a side: full height, square inner corner, slide in from the edge. */
  .panel[data-dock="right"], .panel[data-dock="left"] {
    top: 0; bottom: 0; height: auto; border-radius: 0;
  }
  .panel[data-dock="right"] { right: 0; border-right: 0; }
  .panel[data-dock="left"] { left: 0; border-left: 0; }
  .panel[data-dock="right"][data-open="false"] { transform: translateX(24px); }
  .panel[data-dock="left"][data-open="false"] { transform: translateX(-24px); }
  .panel[data-collapsed="true"] { height: auto !important; bottom: auto !important; }

  .panel .bar {
    display: flex; align-items: center; gap: 6px;
    height: 34px; padding: 0 6px 0 10px;
    background: linear-gradient(180deg, #fbfcfe, #f3f5f9);
    border-bottom: 1px solid rgba(17,24,39,.08);
    cursor: grab; user-select: none; flex: none;
  }
  .panel .bar:active { cursor: grabbing; }
  .panel .bar .grip { color: #9aa2b1; font-size: 13px; letter-spacing: -1px; }
  .panel .bar .title {
    flex: 1; font-size: 12px; font-weight: 600; color: #101828;
    letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .panel .bar .mark {
    width: 16px; height: 16px; border-radius: 5px;
    background: linear-gradient(140deg, #ff9100, #df301c); flex: none;
  }
  .panel .bar button {
    width: 24px; height: 24px; flex: none;
    display: grid; place-items: center;
    border: 0; background: transparent; border-radius: 6px;
    color: #5b6472; font-size: 14px; cursor: pointer; line-height: 1;
  }
  .panel .bar button:hover { background: rgba(17,24,39,.08); color: #101828; }
  .panel .bar button[data-on="true"] { background: rgba(124,92,255,.14); color: #5535d0; }

  .panel .body { flex: 1; min-height: 0; position: relative; }
  .panel iframe { width: 100%; height: 100%; border: 0; display: block; background: #fff; }
  .panel[data-collapsed="true"] .body { display: none; }

  /* Transparent shield over the iframe so drags/resizes keep receiving events. */
  .panel .shield { position: fixed; inset: 0; z-index: 2147483002; cursor: inherit; display: none; }
  .panel[data-busy="true"] .shield { display: block; }

  .panel .resize {
    position: absolute; z-index: 3; }
  .panel .resize.edge { top: 0; bottom: 0; width: 8px; cursor: ew-resize; }
  .panel[data-dock="right"] .resize.edge { left: -3px; }
  .panel[data-dock="left"] .resize.edge { right: -3px; }
  .panel .resize.corner {
    width: 16px; height: 16px; right: 0; bottom: 0; cursor: nwse-resize;
  }
  .panel[data-dock] .resize.corner { display: none; }
  .panel[data-dock="float"] .resize.edge { display: none; }

  .inline {
    display: flex; align-items: center; gap: 10px;
    margin: 12px 0; padding: 10px 14px;
    border: 1px solid rgba(17,24,39,.1); border-radius: 10px;
    background: linear-gradient(180deg, #fbfcff, #f5f7fb);
    font-size: 13px; color: #101828; cursor: pointer;
  }
  .inline:hover { border-color: rgba(17,24,39,.2); }
  .inline .mark { width: 18px; height: 18px; border-radius: 6px;
    background: linear-gradient(140deg, #ff9100, #df301c); }
  .inline .spacer { flex: 1; }
  .inline .cta { color: #a02114; font-weight: 600; }
`;

type Dock = 'right' | 'left' | 'float';

interface PanelState {
  dock: Dock;
  collapsed: boolean;
  dockedWidth: number;
  float: { left: number; top: number; width: number; height: number };
}

const STORAGE_KEY = 'pinto.panel.layout';
const MIN_WIDTH = 340;
const MIN_HEIGHT = 260;

function loadState(): PanelState {
  const fallback: PanelState = {
    dock: 'right',
    collapsed: false,
    dockedWidth: PANEL_WIDTH,
    float: { left: Math.max(24, window.innerWidth - PANEL_WIDTH - 40), top: 72, width: PANEL_WIDTH, height: 620 },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PanelState>;
    return { ...fallback, ...parsed, float: { ...fallback.float, ...parsed.float } };
  } catch {
    return fallback;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function injectUi(panelUrl: string): InjectedUi {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.append(style);

  const launcher = document.createElement('button');
  launcher.className = 'launcher';
  launcher.type = 'button';
  launcher.innerHTML =
    '<span class="mark">P.</span><span>Bulk pricing</span><span class="kbd">⇧P</span>';

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.dataset.open = 'false';

  // The window chrome — drag bar, dock/collapse controls — lives in the shadow
  // root, not the iframe, because moving and resizing the frame has to happen
  // from outside the frame's own document.
  panel.innerHTML = `
    <div class="bar" data-role="bar">
      <span class="mark"></span>
      <span class="title">Pinto</span>
      <button data-act="dock-left" title="Dock left" aria-label="Dock left">⇤</button>
      <button data-act="dock-right" title="Dock right" aria-label="Dock right">⇥</button>
      <button data-act="float" title="Float" aria-label="Float window">▭</button>
      <button data-act="collapse" title="Collapse" aria-label="Collapse">▾</button>
      <button data-act="close" title="Close (Esc)" aria-label="Close">✕</button>
    </div>
    <div class="body">
      <div class="resize edge" data-role="resize-edge"></div>
      <div class="resize corner" data-role="resize-corner"></div>
    </div>
    <div class="shield" data-role="shield"></div>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Pinto — bulk pricing for Google Play');
  iframe.setAttribute('allow', 'clipboard-write');
  panel.querySelector('.body')!.prepend(iframe);

  shadow.append(launcher, panel);
  document.documentElement.append(host);

  const bar = panel.querySelector<HTMLElement>('[data-role="bar"]')!;
  const collapseBtn = panel.querySelector<HTMLElement>('[data-act="collapse"]')!;

  let state = loadState();
  let open = false;
  let loaded = false;

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode / quota — layout simply won't be remembered */
    }
  };

  /** Writes the current state onto the element's inline styles and data attrs. */
  const render = () => {
    panel.dataset.dock = state.dock;
    panel.dataset.collapsed = String(state.collapsed);
    collapseBtn.textContent = state.collapsed ? '▸' : '▾';
    collapseBtn.setAttribute('title', state.collapsed ? 'Expand' : 'Collapse');
    for (const act of ['dock-left', 'dock-right', 'float']) {
      const on = state.dock === act.replace('dock-', '');
      panel.querySelector(`[data-act="${act}"]`)?.setAttribute('data-on', String(on));
    }

    if (state.dock === 'float') {
      const maxLeft = window.innerWidth - MIN_WIDTH;
      const maxTop = window.innerHeight - bar.offsetHeight - 8;
      const f = state.float;
      panel.style.left = `${clamp(f.left, 0, Math.max(0, maxLeft))}px`;
      panel.style.top = `${clamp(f.top, 0, Math.max(0, maxTop))}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.width = `${clamp(f.width, MIN_WIDTH, window.innerWidth)}px`;
      panel.style.height = state.collapsed ? 'auto' : `${clamp(f.height, MIN_HEIGHT, window.innerHeight)}px`;
    } else {
      panel.style.top = '0';
      panel.style.left = state.dock === 'left' ? '0' : 'auto';
      panel.style.right = state.dock === 'right' ? '0' : 'auto';
      panel.style.bottom = state.collapsed ? 'auto' : '0';
      panel.style.width = `${clamp(state.dockedWidth, MIN_WIDTH, window.innerWidth)}px`;
      panel.style.height = 'auto';
    }
  };

  const setDock = (dock: Dock) => {
    // Floating remembers where it was; docking snaps to full height on a side.
    if (dock === 'float' && state.dock !== 'float') {
      state.float.width = state.dockedWidth;
    }
    state.dock = dock;
    if (state.collapsed && dock !== 'float') state.collapsed = false;
    render();
    persist();
  };

  const setCollapsed = (collapsed: boolean) => {
    state.collapsed = collapsed;
    render();
    persist();
  };

  // --- Dragging the title bar ------------------------------------------------

  bar.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;

    // Starting a drag from a docked panel lifts it into a floating window,
    // seeded from its current on-screen box so it doesn't jump.
    if (state.dock !== 'float') {
      const rect = panel.getBoundingClientRect();
      state.float = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      state.dock = 'float';
      render();
    }
    const origin = { ...state.float };
    panel.dataset.busy = 'true';

    const move = (e: PointerEvent) => {
      state.float.left = origin.left + (e.clientX - startX);
      state.float.top = origin.top + (e.clientY - startY);
      render();
    };
    const up = () => {
      panel.dataset.busy = 'false';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // A drag to the very edge re-docks that side — a familiar snap gesture.
      if (state.float.left < 16) setDock('left');
      else if (state.float.left + state.float.width > window.innerWidth - 16) setDock('right');
      else persist();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // --- Resizing --------------------------------------------------------------

  const startResize = (mode: 'edge' | 'corner') => (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = {
      width: state.dock === 'float' ? state.float.width : state.dockedWidth,
      height: state.float.height,
      left: state.float.left,
    };
    panel.dataset.busy = 'true';

    const move = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      if (state.dock === 'right') {
        state.dockedWidth = clamp(origin.width - dx, MIN_WIDTH, window.innerWidth);
      } else if (state.dock === 'left') {
        state.dockedWidth = clamp(origin.width + dx, MIN_WIDTH, window.innerWidth);
      } else {
        state.float.width = clamp(origin.width + dx, MIN_WIDTH, window.innerWidth);
        if (mode === 'corner') {
          state.float.height = clamp(origin.height + (e.clientY - startY), MIN_HEIGHT, window.innerHeight);
        }
      }
      render();
    };
    const up = () => {
      panel.dataset.busy = 'false';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      persist();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  panel
    .querySelector('[data-role="resize-edge"]')!
    .addEventListener('pointerdown', startResize('edge') as EventListener);
  panel
    .querySelector('[data-role="resize-corner"]')!
    .addEventListener('pointerdown', startResize('corner') as EventListener);

  // --- Bar buttons -----------------------------------------------------------

  bar.addEventListener('click', (event) => {
    const act = (event.target as HTMLElement).closest('button')?.getAttribute('data-act');
    if (act === 'dock-left') setDock('left');
    else if (act === 'dock-right') setDock('right');
    else if (act === 'float') setDock('float');
    else if (act === 'collapse') setCollapsed(!state.collapsed);
    else if (act === 'close') api.close();
  });

  // Double-clicking the bar is the fast collapse/expand toggle.
  bar.addEventListener('dblclick', (event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    setCollapsed(!state.collapsed);
  });

  window.addEventListener('resize', render);

  const api: InjectedUi = {
    isOpen: () => open,
    open() {
      if (!loaded) {
        iframe.src = panelUrl;
        loaded = true;
      }
      open = true;
      render();
      panel.dataset.open = 'true';
      launcher.hidden = true;
      iframe.focus();
    },
    close() {
      open = false;
      panel.dataset.open = 'false';
      launcher.hidden = false;
    },
    toggle() {
      if (open) api.close();
      else api.open();
    },
    destroy() {
      window.removeEventListener('resize', render);
      host.remove();
    },
  };

  launcher.addEventListener('click', () => api.open());
  return api;
}

/**
 * Optional inline entry point placed next to the price table, so Pinto shows
 * up where the work is. Purely additive: if the anchor cannot be found — which
 * will happen whenever Google reshuffles the page — the floating launcher is
 * still there and nothing is lost.
 */
export function injectInlineEntryPoint(onClick: () => void): boolean {
  const existing = document.querySelector('[data-pinto-inline]');
  if (existing) return true;

  const anchor = findPriceTableAnchor();
  if (!anchor?.parentElement) return false;

  const host = document.createElement('div');
  host.setAttribute('data-pinto-inline', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;

  const button = document.createElement('button');
  button.className = 'inline';
  button.type = 'button';
  button.innerHTML =
    '<span class="mark"></span><span>Edit these prices in bulk with Pinto</span>' +
    '<span class="spacer"></span><span class="cta">Open →</span>';
  button.addEventListener('click', onClick);

  shadow.append(style, button);
  anchor.parentElement.insertBefore(host, anchor);
  return true;
}

const REGION_HEADERS = ['country', 'region', 'pays', 'país', 'land', 'paese', '国', '지역'];

function findPriceTableAnchor(): Element | null {
  const tables = document.querySelectorAll('table, [role="table"], [role="grid"]');
  for (const table of tables) {
    const header = (table.querySelector('thead, [role="rowgroup"], [role="row"]')?.textContent ?? '')
      .toLowerCase()
      .slice(0, 400);
    if (REGION_HEADERS.some((word) => header.includes(word))) {
      return table.closest('section, [role="region"]') ?? table;
    }
  }
  return null;
}
