import { describe, expect, it, vi } from 'vitest';
import { beginWalletConnection, listCompatibleWallets } from './wallet-connector';

describe('wallet connector discovery', () => {
  it('keeps unique compatible wallets and ignores unsupported versions', () => {
    const connect = vi.fn();
    const wallets = listCompatibleWallets({
      lace: { name: 'Lace', rdns: 'io.lace', icon: '', apiVersion: '4.0.1', connect },
      duplicate: { name: 'Lace again', rdns: 'io.lace', icon: '', apiVersion: '4.0.1', connect },
      old: { name: 'Old wallet', rdns: 'io.old', icon: '', apiVersion: '3.0.0', connect },
    });
    expect(wallets.map(({ id }) => id)).toEqual(['lace']);
  });

  it('starts the connection synchronously from the selected wallet', () => {
    const connect = vi.fn(() => Promise.resolve({} as never));
    const attempt = beginWalletConnection({ lace: { name: 'Lace', rdns: 'io.lace', icon: '', apiVersion: '4.0.1', connect } }, 'preprod');
    expect(connect).toHaveBeenCalledWith('preprod');
    expect(attempt.wallet.name).toBe('Lace');
  });
});
