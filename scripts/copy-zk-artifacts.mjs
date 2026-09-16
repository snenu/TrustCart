import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const managed = path.join(root, 'contract', 'managed', 'trustcart');
const target = path.join(root, 'ui', 'public');
const versionedTarget = path.join(target, 'zk', 'trustcart-v1');

await rm(versionedTarget, { recursive: true, force: true });
for (const directory of ['keys', 'zkir']) {
  const destination = path.join(versionedTarget, directory);
  await mkdir(destination, { recursive: true });
  await cp(path.join(managed, directory), destination, { recursive: true });
}
