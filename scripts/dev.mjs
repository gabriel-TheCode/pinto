/**
 * Watches both bundles at once. The UI and the content script have different
 * output formats and therefore different Vite configs, and adding a process
 * runner as a dependency to start two children is not worth it.
 */
import { spawn } from 'node:child_process';

const targets = [
  ['vite', ['build', '--watch']],
  ['vite', ['build', '--watch', '--config', 'vite.content.config.ts']],
];

const children = targets.map(([command, args]) =>
  spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' }),
);

const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

for (const child of children) {
  child.on('exit', (code) => {
    if (code) {
      stop();
      process.exit(code);
    }
  });
}

console.log('watching — reload the extension in chrome://extensions after worker or content changes');
