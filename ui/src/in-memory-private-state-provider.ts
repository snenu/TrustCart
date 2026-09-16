import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';

export const inMemoryPrivateStateProvider = <PSI extends PrivateStateId, PS = unknown>(): PrivateStateProvider<PSI, PS> => {
  const privateStates = new Map<ContractAddress, Map<PSI, PS>>();
  const signingKeys = new Map<ContractAddress, SigningKey>();
  let contractAddress: ContractAddress | null = null;

  const requireContractAddress = (): ContractAddress => {
    if (contractAddress === null) throw new Error('Contract address is not set.');
    return contractAddress;
  };
  const scopedStates = (address: ContractAddress): Map<PSI, PS> => {
    const current = privateStates.get(address);
    if (current) return current;
    const created = new Map<PSI, PS>();
    privateStates.set(address, created);
    return created;
  };
  const encode = <T,>(value: T): string => JSON.stringify(value);
  const decode = <T,>(value: string): T => JSON.parse(value) as T;

  return {
    setContractAddress(address): void { contractAddress = address; },
    set(key, state): Promise<void> {
      scopedStates(requireContractAddress()).set(key, state);
      return Promise.resolve();
    },
    get(key): Promise<PS | null> {
      return Promise.resolve(scopedStates(requireContractAddress()).get(key) ?? null);
    },
    remove(key): Promise<void> {
      scopedStates(requireContractAddress()).delete(key);
      return Promise.resolve();
    },
    clear(): Promise<void> {
      privateStates.delete(requireContractAddress());
      return Promise.resolve();
    },
    setSigningKey(address, key): Promise<void> {
      signingKeys.set(address, key);
      return Promise.resolve();
    },
    getSigningKey(address): Promise<SigningKey | null> {
      return Promise.resolve(signingKeys.get(address) ?? null);
    },
    removeSigningKey(address): Promise<void> {
      signingKeys.delete(address);
      return Promise.resolve();
    },
    clearSigningKeys(): Promise<void> {
      signingKeys.clear();
      return Promise.resolve();
    },
    exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
      const address = requireContractAddress();
      return Promise.resolve({
        format: 'midnight-private-state-export',
        encryptedPayload: encode({
          contractAddress: address,
          states: Object.fromEntries(Array.from(scopedStates(address), ([key, value]) => [key, encode(value)])),
        }),
        salt: 'in-memory',
      });
    },
    importPrivateStates(data: PrivateStateExport, options?: ImportPrivateStatesOptions): Promise<ImportPrivateStatesResult> {
      const states = scopedStates(requireContractAddress());
      const strategy = options?.conflictStrategy ?? 'error';
      const payload = decode<{ states?: Record<string, string> }>(data.encryptedPayload);
      let imported = 0, skipped = 0, overwritten = 0;
      for (const [rawId, serialized] of Object.entries(payload.states ?? {})) {
        const id = rawId as PSI;
        if (states.has(id)) {
          if (strategy === 'skip') { skipped++; continue; }
          if (strategy === 'error') return Promise.reject(new Error(`Private-state conflict: ${id}`));
          overwritten++;
        } else imported++;
        states.set(id, decode<PS>(serialized));
      }
      return Promise.resolve({ imported, skipped, overwritten });
    },
    exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
      return Promise.resolve({
        format: 'midnight-signing-key-export',
        encryptedPayload: encode({ keys: Object.fromEntries(signingKeys) }),
        salt: 'in-memory',
      });
    },
    importSigningKeys(data: SigningKeyExport, options?: ImportSigningKeysOptions): Promise<ImportSigningKeysResult> {
      const strategy = options?.conflictStrategy ?? 'error';
      const payload = decode<{ keys?: Record<string, SigningKey> }>(data.encryptedPayload);
      let imported = 0, skipped = 0, overwritten = 0;
      for (const [address, key] of Object.entries(payload.keys ?? {})) {
        if (signingKeys.has(address)) {
          if (strategy === 'skip') { skipped++; continue; }
          if (strategy === 'error') return Promise.reject(new Error(`Signing-key conflict: ${address}`));
          overwritten++;
        } else imported++;
        signingKeys.set(address, key);
      }
      return Promise.resolve({ imported, skipped, overwritten });
    },
  };
};
