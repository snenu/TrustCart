const BYTE_LENGTH = 32;
export const CATEGORY_BYTE_LENGTH = 16;
const MAX_UINT_64 = (1n << 64n) - 1n;

export const encodeText = (value: string): Uint8Array => {
  const bytes = new TextEncoder().encode(value.trim());
  if (bytes.length > BYTE_LENGTH) throw new Error('Text fields are limited to 32 UTF-8 bytes.');
  const result = new Uint8Array(BYTE_LENGTH);
  result.set(bytes);
  return result;
};

export const decodeText = (value: Uint8Array): string =>
  new TextDecoder().decode(value).replace(/\0+$/g, '');

export const encodeCategory = (value: string): Uint8Array => {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  if (bytes.length > CATEGORY_BYTE_LENGTH) throw new Error('Category is limited to 16 UTF-8 bytes.');
  const result = new Uint8Array(CATEGORY_BYTE_LENGTH);
  result.set(bytes);
  return result;
};

export const bytesToHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');

export const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.trim().replace(/^0x/, '');
  if (!/^[\da-f]{64}$/i.test(normalized)) throw new Error('Expected a 32-byte hexadecimal code.');
  return Uint8Array.from(normalized.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
};

export const isZeroBytes = (value: Uint8Array): boolean => value.every((byte) => byte === 0);

const MONTH_SECONDS = 2_592_000n;

export const warrantyExpiry = (issuedAt: bigint, months: bigint): bigint => {
  if (months <= 0n || months > 255n) throw new Error('Warranty duration is invalid.');
  const expiry = issuedAt + months * MONTH_SECONDS;
  if (expiry > MAX_UINT_64) throw new Error('Warranty expiry exceeds the protocol limit.');
  return expiry;
};

export const formatEpochDate = (epoch: bigint): string =>
  new Date(Number(epoch) * 1000).toISOString().slice(0, 10);

export const dateToEpoch = (date: string): bigint => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) throw new Error('A valid date (YYYY-MM-DD) is required.');
  const [, yearValue, monthValue, dayValue] = match;
  const parsed = new Date(`${date.trim()}T00:00:00Z`);
  if (
    parsed.getUTCFullYear() !== Number(yearValue) ||
    parsed.getUTCMonth() !== Number(monthValue) - 1 ||
    parsed.getUTCDate() !== Number(dayValue)
  ) {
    throw new Error('A valid date (YYYY-MM-DD) is required.');
  }
  return BigInt(Math.floor(parsed.getTime() / 1000));
};
