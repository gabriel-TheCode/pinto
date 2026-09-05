/**
 * Renders the real panel with fixture data, so the README can show actual
 * components rather than a mockup.
 *
 * If a screen breaks, this breaks too — a harness that rendered a hand-built
 * copy of the UI would quietly drift from the thing it claims to depict.
 */
import { createRoot } from 'react-dom/client';
import { installChromeStub } from './fixtures';
import { poseStore, markReady } from './pose';

installChromeStub();

await import('./styles.css');
const { App } = await import('@/app/App');

createRoot(document.getElementById('root')!).render(<App />);

const params = new URLSearchParams(location.search);
await poseStore({ screen: params.get('screen'), strategy: params.get('strategy') });
markReady();
