import { access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const generated = path.join(root, 'contract', 'managed', 'trustcart', 'contract', 'index.js');

try {
  await access(generated);
} catch {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'compile-contract.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
