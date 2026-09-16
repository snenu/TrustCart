import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';

const CONNECTOR_VERSION = '4.x';

export interface WalletConnectionAttempt {
  readonly wallet: InitialAPI;
  readonly connectedAPI: Promise<ConnectedAPI>;
}

export interface WalletOption {
  readonly id: string;
  readonly wallet: InitialAPI;
}

export const listCompatibleWallets = (
  wallets: Record<string, InitialAPI | undefined> | undefined,
): WalletOption[] => {
  const seen = new Set<string>();
  return Object.entries(wallets ?? {}).flatMap(([id, wallet]) => {
    if (!wallet || typeof wallet !== 'object' || typeof wallet.apiVersion !== 'string' || !semver.satisfies(wallet.apiVersion, CONNECTOR_VERSION)) return [];
    const identity = wallet.rdns || wallet.name || id;
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [{ id, wallet }];
  });
};

export const findCompatibleWallet = (
  wallets: Record<string, InitialAPI | undefined> | undefined,
): InitialAPI | undefined => listCompatibleWallets(wallets)[0]?.wallet;

export const beginWalletConnection = (
  wallets: Record<string, InitialAPI | undefined> | undefined,
  networkId: string,
  walletId?: string,
): WalletConnectionAttempt => {
  const options = listCompatibleWallets(wallets);
  const wallet = (walletId ? options.find((option) => option.id === walletId) : options[0])?.wallet;
  if (!wallet) {
    throw new Error('No compatible Midnight wallet was detected. Open or unlock your Midnight wallet extension, refresh this page, and try again.');
  }

  // Keep this call synchronous with the user's click so wallet authorization pop-ups are not blocked.
  return { wallet, connectedAPI: wallet.connect(networkId) };
};
