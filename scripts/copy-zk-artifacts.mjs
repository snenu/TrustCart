import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const managed = path.join(root, 'contract', 'managed', 'trustcart');
const target = path.join(root, 'ui', 'public');
const versionedTarget = path.join(target, 'zk', 'trustcart-v1');

for (const rootTarget of [target, versionedTarget]) {
  for (const directory of ['keys', 'zkir']) {
    const destination = path.join(rootTarget, directory);
    await rm(destination, { recursive: true, force: true });
    await mkdir(destination, { recursive: true });
    await cp(path.join(managed, directory), destination, { recursive: true });
  }
}
