type StoredSecret = { iv: ArrayBuffer; ciphertext: ArrayBuffer };

const DATABASE = 'trustcart-secure-storage';
const STORE = 'secrets';
const DEVICE_KEY = 'device-key';

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Secure storage could not be opened.'));
});

const readRecord = <T,>(db: IDBDatabase, key: IDBValidKey): Promise<T | undefined> => new Promise((resolve, reject) => {
  const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
  request.onsuccess = () => resolve(request.result as T | undefined);
  request.onerror = () => reject(request.error ?? new Error('Secure storage could not be read.'));
});

const writeRecord = (db: IDBDatabase, key: IDBValidKey, value: unknown): Promise<void> => new Promise((resolve, reject) => {
  const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error ?? new Error('Secure storage could not be written.'));
});

const getDeviceKey = async (db: IDBDatabase): Promise<CryptoKey> => {
  const stored = await readRecord<CryptoKey>(db, DEVICE_KEY);
  if (stored) return stored;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await writeRecord(db, DEVICE_KEY, key);
  return key;
};

export const readSecret = async (storageKey: string): Promise<Uint8Array | null> => {
  if (!('indexedDB' in window)) return null;
  const db = await openDatabase();
  const stored = await readRecord<StoredSecret>(db, storageKey);
  if (!stored) return null;
  const key = await getDeviceKey(db);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.iv }, key, stored.ciphertext);
  return new Uint8Array(plaintext);
};

export const writeSecret = async (storageKey: string, secret: Uint8Array): Promise<void> => {
  if (!('indexedDB' in window)) throw new Error('Secure browser storage is unavailable.');
  const db = await openDatabase();
  const key = await getDeviceKey(db);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, secret);
  await writeRecord(db, storageKey, { iv: iv.buffer, ciphertext });
};

export const loadOrCreateSecret = async (storageKey: string): Promise<Uint8Array> => {
  try {
    const secure = await readSecret(storageKey);
    if (secure?.length === 32) return secure;
    const legacy = localStorage.getItem(storageKey);
    if (legacy) {
      const secret = Uint8Array.from(atob(legacy), (character) => character.charCodeAt(0));
      if (secret.length === 32) {
        await writeSecret(storageKey, secret);
        localStorage.removeItem(storageKey);
        return secret;
      }
    }
    const secret = crypto.getRandomValues(new Uint8Array(32));
    await writeSecret(storageKey, secret);
    return secret;
  } catch {
    const stored = localStorage.getItem(storageKey);
    if (stored) return Uint8Array.from(atob(stored), (character) => character.charCodeAt(0));
    const secret = crypto.getRandomValues(new Uint8Array(32));
    localStorage.setItem(storageKey, btoa(String.fromCharCode(...secret)));
    return secret;
  }
};

export const storeSecret = async (storageKey: string, secret: Uint8Array): Promise<void> => {
  try {
    await writeSecret(storageKey, secret);
    localStorage.removeItem(storageKey);
  } catch {
    localStorage.setItem(storageKey, btoa(String.fromCharCode(...secret)));
  }
};
