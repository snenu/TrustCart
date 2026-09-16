const BACKUP_PREFIX = 'trustcart-key:v1:';
import { validatePassword } from '@midnight-ntwrk/midnight-js-utils';
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

const toBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

const fromBase64 = (value: string): Uint8Array => {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new Error('This privacy-key backup is not valid.');
  }
};

const validatePassphrase = (passphrase: string): void => {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((pattern) => pattern.test(passphrase)).length;
  if (passphrase.length < 16 || classes < 3) {
    throw new Error('Use at least 16 characters from three character types.');
  }
  validatePassword(passphrase);
};

export const isValidPrivacyPassphrase = (passphrase: string): boolean => {
  try { validatePassphrase(passphrase); return true; } catch { return false; }
};

const deriveKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: asArrayBuffer(salt), iterations: PBKDF2_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const encryptPrivacyKey = async (secret: Uint8Array, passphrase: string): Promise<string> => {
  if (secret.length !== 32) throw new Error('The privacy key must be exactly 32 bytes.');
  validatePassphrase(passphrase);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, key, asArrayBuffer(secret)));
  const payload = new Uint8Array(salt.length + iv.length + encrypted.length);
  payload.set(salt);
  payload.set(iv, salt.length);
  payload.set(encrypted, salt.length + iv.length);
  return `${BACKUP_PREFIX}${toBase64(payload)}`;
};

export const decryptPrivacyKey = async (backup: string, passphrase: string): Promise<Uint8Array> => {
  validatePassphrase(passphrase);
  if (!backup.trim().startsWith(BACKUP_PREFIX)) throw new Error('This privacy-key backup is not valid.');
  const payload = fromBase64(backup.trim().slice(BACKUP_PREFIX.length));
  if (payload.length <= SALT_BYTES + IV_BYTES) throw new Error('This privacy-key backup is not valid.');
  const salt = payload.slice(0, SALT_BYTES);
  const iv = payload.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const encrypted = payload.slice(SALT_BYTES + IV_BYTES);
  try {
    const key = await deriveKey(passphrase, salt);
    const secret = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, key, asArrayBuffer(encrypted)));
    if (secret.length !== 32) throw new Error('Invalid decrypted key length.');
    return secret;
  } catch {
    throw new Error('The passphrase is incorrect or this backup is damaged.');
  }
};
