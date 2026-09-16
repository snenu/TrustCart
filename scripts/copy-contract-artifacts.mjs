import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, 'contract', 'dist', 'managed');
await mkdir(destination, { recursive: true });
await cp(path.join(root, 'contract', 'managed'), destination, { recursive: true });
