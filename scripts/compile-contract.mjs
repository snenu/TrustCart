import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
let result;

if (process.platform === 'win32') {
  const drive = root.slice(0, 1).toLowerCase();
  const rest = root.slice(2).replaceAll('\\', '/');
  const wslRoot = `/mnt/${drive}${rest}`;
  const quotedRoot = `'${wslRoot.replaceAll("'", "'\\''")}'`;
  result = spawnSync(
    'wsl',
    ['-d', 'Ubuntu', '--', 'bash', '-lc', `cd ${quotedRoot}/contract && compact compile +0.31.1 trustcart.compact managed/trustcart`],
    { cwd: root, stdio: 'inherit' },
  );
} else {
  result = spawnSync('compact', ['compile', '+0.31.1', 'trustcart.compact', 'managed/trustcart'], {
    cwd: path.join(root, 'contract'),
    stdio: 'inherit',
  });
}

if (result.error) throw result.error;
process.exit(result.status ?? 1);
