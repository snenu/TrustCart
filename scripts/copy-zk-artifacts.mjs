import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const managed = path.join(root, 'contract', 'managed', 'trustcart');
const versionedTarget = path.join(root, 'ui', 'public', 'zk', 'trustcart-v1');

// The compiled contract is produced locally by `compact compile`, which is
// unavailable in hosted CI (Vercel). The prover/verifier keys committed under
// ui/public are the fallback, so only refresh them when the freshly compiled
// copy actually exists.
let hasCompiledArtifacts = true;
try {
  await access(path.join(managed, 'keys'));
} catch {
  hasCompiledArtifacts = false;
}

if (hasCompiledArtifacts) {
  await rm(versionedTarget, { recursive: true, force: true });
  for (const directory of ['keys', 'zkir']) {
    const destination = path.join(versionedTarget, directory);
    await mkdir(destination, { recursive: true });
    await cp(path.join(managed, directory), destination, { recursive: true });
  }
  console.log('Copied freshly compiled zk artifacts into ui/public/zk/trustcart-v1.');
} else {
  for (const directory of ['keys', 'zkir']) {
    await access(path.join(versionedTarget, directory));
  }
  console.log('Using the committed zk artifacts in ui/public/zk/trustcart-v1 (no locally compiled contract found).');
}
