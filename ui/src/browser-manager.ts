import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, toHex, type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Binding,
  type FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { TrustCartAPI, type TrustCartCircuitKeys, type TrustCartProviders } from '../../api/src/index';
import { decryptPrivacyKey, encryptPrivacyKey } from './privacy-key';

const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID ?? 'preprod') as NetworkId;
const PREFERRED_PROOF_SERVER = (import.meta.env.VITE_PROOF_SERVER_URL ?? '').replace(/\/$/, '');
const ZK_CONFIG_PATH = (import.meta.env.VITE_ZK_CONFIG_PATH ?? '').replace(/\/$/, '');

export interface WalletSummary {
  readonly name: string;
  readonly apiVersion: string;
  readonly networkId: string;
  readonly proofServer: string;
  readonly unshieldedAddress: string;
  readonly dustAddress: string;
}

type BrowserConnection = {
  readonly connectedAPI: ConnectedAPI;
  readonly providers: TrustCartProviders;
  readonly wallet: InitialAPI;
  readonly summary: WalletSummary;
};

const walletConnectTimeoutMs = 120_000;
const BACKUP_PREFIX = 'trustcart-backup:v2:';

const withTimeout = <T,>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then(
      (value) => { window.clearTimeout(timeout); resolve(value); },
      (error: unknown) => { window.clearTimeout(timeout); reject(error); },
    );
  });

const resolveProofServer = async (configuredUri: string): Promise<string> => {
  if (!PREFERRED_PROOF_SERVER || PREFERRED_PROOF_SERVER === configuredUri.replace(/\/$/, '')) return configuredUri;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(`${PREFERRED_PROOF_SERVER}/ready`, {
      credentials: 'omit',
      signal: controller.signal,
    });
    return response.ok ? PREFERRED_PROOF_SERVER : configuredUri;
  } catch {
    return configuredUri;
  } finally {
    window.clearTimeout(timeout);
  }
};

export class BrowserTrustCartManager {
  #connection: Promise<BrowserConnection> | undefined;

  constructor(
    private readonly wallet: InitialAPI,
    private readonly connectedAPI: Promise<ConnectedAPI>,
  ) {}

  private async secretStorageKey(address?: string): Promise<string> {
    const resolvedAddress = address ?? (await this.connection()).summary.unshieldedAddress;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(resolvedAddress)));
    return `trustcart:private-secret:v2:${toHex(digest)}`;
  }

  private async getSecretKeyForAddress(address: string): Promise<Uint8Array> {
    const storageKey = await this.secretStorageKey(address);
    const stored = localStorage.getItem(storageKey);
    if (stored) return Uint8Array.from(atob(stored), (character) => character.charCodeAt(0));
    const secret = crypto.getRandomValues(new Uint8Array(32));
    localStorage.setItem(storageKey, btoa(String.fromCharCode(...secret)));
    return secret;
  }

  private async getSecretKey(): Promise<Uint8Array> {
    return this.getSecretKeyForAddress((await this.connection()).summary.unshieldedAddress);
  }

  private async privateStoragePassword(address: string): Promise<string> {
    const key = `trustcart:private-storage-password:v1:${toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address))))}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const random = crypto.getRandomValues(new Uint8Array(32));
    const password = `TrustCart!${btoa(String.fromCharCode(...random))}#Store`;
    localStorage.setItem(key, password);
    return password;
  }

  private connection(): Promise<BrowserConnection> {
    if (!this.#connection) {
      const attempt = this.initialize();
      this.#connection = attempt;
      void attempt.catch(() => {
        if (this.#connection === attempt) this.#connection = undefined;
      });
    }
    return this.#connection;
  }
  private async initialize(): Promise<BrowserConnection> {
    setNetworkId(NETWORK_ID);
    const connectedAPI = await withTimeout(
      this.connectedAPI,
      walletConnectTimeoutMs,
      'The wallet connection timed out. Open your Midnight wallet, approve this site, and try again.',
    );
    const config = await connectedAPI.getConfiguration();
    if (!config.proverServerUri) {
      throw new Error('Your wallet has no proof server configured. Select its local proof server option (http://127.0.0.1:6300) and reconnect.');
    }
    if (config.networkId !== NETWORK_ID) {
      throw new Error(`${this.wallet.name} is connected to ${config.networkId}; switch it to ${NETWORK_ID}.`);
    }
    const proofServerUri = await resolveProofServer(config.proverServerUri);

    const [{ unshieldedAddress }, { dustAddress }, shielded] = await Promise.all([
      connectedAPI.getUnshieldedAddress(),
      connectedAPI.getDustAddress(),
      connectedAPI.getShieldedAddresses(),
    ]);
    const zkConfigRoot = `${window.location.origin}${ZK_CONFIG_PATH}`;
    const zkConfigProvider = new FetchZkConfigProvider<TrustCartCircuitKeys>(zkConfigRoot, fetch.bind(window));
    const providers: TrustCartProviders = {
      privateStateProvider: levelPrivateStateProvider({
        midnightDbName: 'trustcart-midnight',
        privateStateStoreName: 'private-states',
        signingKeyStoreName: 'signing-keys',
        accountId: unshieldedAddress,
        privateStoragePasswordProvider: () => this.privateStoragePassword(unshieldedAddress),
      }),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
      publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
      walletProvider: {
        getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
        getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
        balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
          const response = await connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(response.tx),
          );
        },
      },
      midnightProvider: {
        submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
          await connectedAPI.submitTransaction(toHex(tx.serialize()));
          return tx.identifiers()[0];
        },
      },
    };

    return {
      connectedAPI,
      providers,
      wallet: this.wallet,
      summary: {
        name: this.wallet.name,
        apiVersion: this.wallet.apiVersion,
        networkId: config.networkId,
        proofServer: proofServerUri,
        unshieldedAddress,
        dustAddress,
      },
    };
  }


  async getWalletSummary(): Promise<WalletSummary> {
    return (await this.connection()).summary;
  }

  async getReceivingCode(): Promise<string> {
    return TrustCartAPI.receivingCodeFor(await this.getSecretKey());
  }

  async getSecretHex(): Promise<string> {
    const secret = await this.getSecretKey();
    return Array.from(secret, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async deploy(): Promise<TrustCartAPI> {
    const { providers } = await this.connection();
    return TrustCartAPI.deploy(providers, await this.getSecretKey());
  }

  async join(contractAddress: string): Promise<TrustCartAPI> {
    const { providers } = await this.connection();
    return TrustCartAPI.join(providers, contractAddress as ContractAddress, await this.getSecretKey());
  }

  async exportPrivacyKey(passphrase: string): Promise<string> {
    const { providers } = await this.connection();
    const [secretBackup, privateStates, signingKeys] = await Promise.all([
      encryptPrivacyKey(await this.getSecretKey(), passphrase),
      providers.privateStateProvider.exportPrivateStates({ password: passphrase }),
      providers.privateStateProvider.exportSigningKeys({ password: passphrase }),
    ]);
    const payload = new TextEncoder().encode(JSON.stringify({ secretBackup, privateStates, signingKeys }));
    return `${BACKUP_PREFIX}${btoa(String.fromCharCode(...payload))}`;
  }

  async importPrivacyKey(backup: string, passphrase: string): Promise<void> {
    const normalized = backup.trim();
    if (normalized.startsWith('trustcart-key:v1:')) {
      const secret = await decryptPrivacyKey(normalized, passphrase);
      localStorage.setItem(await this.secretStorageKey(), btoa(String.fromCharCode(...secret)));
      return;
    }
    if (!normalized.startsWith(BACKUP_PREFIX)) throw new Error('This TrustCart backup is not valid.');
    let payload: { secretBackup: string; privateStates: Parameters<TrustCartProviders['privateStateProvider']['importPrivateStates']>[0]; signingKeys: Parameters<TrustCartProviders['privateStateProvider']['importSigningKeys']>[0] };
    try {
      const bytes = Uint8Array.from(atob(normalized.slice(BACKUP_PREFIX.length)), (character) => character.charCodeAt(0));
      payload = JSON.parse(new TextDecoder().decode(bytes)) as typeof payload;
    } catch {
      throw new Error('This TrustCart backup is not valid.');
    }
    const secret = await decryptPrivacyKey(payload.secretBackup, passphrase);
    const { providers } = await this.connection();
    await providers.privateStateProvider.importPrivateStates(payload.privateStates, { password: passphrase, conflictStrategy: 'overwrite' });
    await providers.privateStateProvider.importSigningKeys(payload.signingKeys, { password: passphrase, conflictStrategy: 'overwrite' });
    localStorage.setItem(await this.secretStorageKey(), btoa(String.fromCharCode(...secret)));
  }
}
