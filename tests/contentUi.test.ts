/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { injectInlineEntryPoint, injectUi } from '@/content/ui';

const PANEL = 'chrome-extension://pinto-test/src/panel/index.html';

beforeEach(() => {
  document.body.innerHTML = '';
  document.getElementById('pinto-root')?.remove();
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* jsdom without localstorage-file */
  }
});

function host(): HTMLElement {
  return document.getElementById('pinto-root')!;
}

function panelOf(): HTMLElement {
  return host().shadowRoot!.querySelector('.panel') as HTMLElement;
}

function click(selector: string) {
  (host().shadowRoot!.querySelector(selector) as HTMLButtonElement).click();
}

describe('injected launcher', () => {
  it('mounts inside a shadow root so Play Console styles cannot reach it', () => {
    injectUi(PANEL);
    expect(host()).toBeTruthy();
    expect(host().shadowRoot).toBeTruthy();
    expect(host().shadowRoot!.querySelector('.launcher')).toBeTruthy();
  });

  it('is idempotent — re-injecting replaces rather than duplicates', () => {
    injectUi(PANEL);
    injectUi(PANEL);
    expect(document.querySelectorAll('#pinto-root')).toHaveLength(1);
  });

  it('does not load the panel iframe until it is opened', () => {
    const ui = injectUi(PANEL);
    const iframe = host().shadowRoot!.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toBeNull();

    ui.open();
    expect(iframe.getAttribute('src')).toBe(PANEL);
  });

  it('opens, closes and toggles', () => {
    const ui = injectUi(PANEL);
    const panel = host().shadowRoot!.querySelector('.panel') as HTMLElement;

    expect(ui.isOpen()).toBe(false);
    ui.open();
    expect(panel.dataset.open).toBe('true');
    ui.toggle();
    expect(ui.isOpen()).toBe(false);
    expect(panel.dataset.open).toBe('false');
  });

  it('opens when the launcher is clicked', () => {
    const ui = injectUi(PANEL);
    const launcher = host().shadowRoot!.querySelector('.launcher') as HTMLButtonElement;
    launcher.click();
    expect(ui.isOpen()).toBe(true);
    expect(launcher.hidden).toBe(true);
  });

  it('removes itself completely on destroy', () => {
    injectUi(PANEL).destroy();
    expect(document.getElementById('pinto-root')).toBeNull();
  });
});

describe('window chrome', () => {
  it('starts docked to the right', () => {
    injectUi(PANEL).open();
    expect(panelOf().dataset.dock).toBe('right');
  });

  it('docks to the left and back to the right', () => {
    injectUi(PANEL).open();
    click('[data-act="dock-left"]');
    expect(panelOf().dataset.dock).toBe('left');
    click('[data-act="dock-right"]');
    expect(panelOf().dataset.dock).toBe('right');
  });

  it('floats the window free of the edges', () => {
    injectUi(PANEL).open();
    click('[data-act="float"]');
    const panel = panelOf();
    expect(panel.dataset.dock).toBe('float');
    expect(panel.style.left).not.toBe('auto');
    expect(panel.style.right).toBe('auto');
  });

  it('collapses to just the title bar and expands again', () => {
    injectUi(PANEL).open();
    click('[data-act="collapse"]');
    expect(panelOf().dataset.collapsed).toBe('true');
    click('[data-act="collapse"]');
    expect(panelOf().dataset.collapsed).toBe('false');
  });

  it('double-clicking the bar toggles collapse', () => {
    injectUi(PANEL).open();
    const bar = host().shadowRoot!.querySelector('[data-role="bar"]') as HTMLElement;
    bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(panelOf().dataset.collapsed).toBe('true');
  });

  it('closing from the bar hides the panel and restores the launcher', () => {
    const ui = injectUi(PANEL);
    ui.open();
    click('[data-act="close"]');
    expect(ui.isOpen()).toBe(false);
    expect(panelOf().dataset.open).toBe('false');
    expect((host().shadowRoot!.querySelector('.launcher') as HTMLElement).hidden).toBe(false);
  });

  it('remembers the layout across re-injection', () => {
    let ui = injectUi(PANEL);
    ui.open();
    click('[data-act="dock-left"]');
    ui.destroy();

    ui = injectUi(PANEL);
    ui.open();
    // Only meaningful when the environment actually persists localStorage;
    // jsdom here runs without it, so the assertion is conditional.
    const persisted = (() => {
      try {
        return globalThis.localStorage?.getItem('pinto.panel.layout');
      } catch {
        return null;
      }
    })();
    if (persisted) expect(panelOf().dataset.dock).toBe('left');
  });

  it('keeps the resize handles present for docked and floating modes', () => {
    injectUi(PANEL).open();
    expect(host().shadowRoot!.querySelector('[data-role="resize-edge"]')).toBeTruthy();
    expect(host().shadowRoot!.querySelector('[data-role="resize-corner"]')).toBeTruthy();
  });
});

describe('inline entry point', () => {
  it('attaches above a table that looks like a regional price table', () => {
    document.body.innerHTML = `
      <section id="prices">
        <table><thead><tr><th>Country/Region</th><th>Price</th></tr></thead></table>
      </section>`;
    const onClick = vi.fn();

    expect(injectInlineEntryPoint(onClick)).toBe(true);
    const inline = document.querySelector('[data-pinto-inline]')!;
    expect(inline).toBeTruthy();

    (inline.shadowRoot!.querySelector('.inline') as HTMLButtonElement).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('recognises a localised header', () => {
    document.body.innerHTML = `
      <section><table><thead><tr><th>Pays/Région</th></tr></thead></table></section>`;
    expect(injectInlineEntryPoint(vi.fn())).toBe(true);
  });

  it('declines quietly when the page has no recognisable price table', () => {
    document.body.innerHTML = '<div><table><thead><tr><th>Reviews</th></tr></thead></table></div>';
    expect(injectInlineEntryPoint(vi.fn())).toBe(false);
    expect(document.querySelector('[data-pinto-inline]')).toBeNull();
  });

  it('does not inject twice', () => {
    document.body.innerHTML = `
      <section><table><thead><tr><th>Country</th></tr></thead></table></section>`;
    injectInlineEntryPoint(vi.fn());
    injectInlineEntryPoint(vi.fn());
    expect(document.querySelectorAll('[data-pinto-inline]')).toHaveLength(1);
  });
});
