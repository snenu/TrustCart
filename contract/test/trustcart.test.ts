import { beforeEach, describe, expect, it } from 'vitest';
import * as Runtime from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { sampleCoinPublicKey } from '@midnight-ntwrk/ledger-v8';
import { Contract, ProductStatus, ledger, pureCircuits, type Circuits } from '../managed/trustcart/contract/index.js';
import { createTrustCartPrivateState, createWitnesses, type TrustCartPrivateState } from '../src/witnesses.js';

const bytes = (value: number) => new Uint8Array(32).fill(value);
const text = (value: string, length = 32) => { const result = new Uint8Array(length); result.set(new TextEncoder().encode(value)); return result; };
const COIN = sampleCoinPublicKey();
const MFR_SECRET = bytes(1);
const SELLER_SECRET = bytes(2);
const BUYER_SECRET = bytes(3);
const NEW_BUYER_SECRET = bytes(4);
const SERIAL_SECRET = bytes(5);

describe('TrustCart compiled Compact contract', () => {
  let contract: Contract<TrustCartPrivateState>;
  let context: Runtime.CircuitContext<TrustCartPrivateState>;
  let sellerId: bigint;
  let productId: bigint;

  const call = <K extends keyof Circuits<TrustCartPrivateState>>(
    name: K,
    ...args: Parameters<Circuits<TrustCartPrivateState>[K]> extends [unknown, ...infer Rest] ? Rest : never
  ) => {
    const result = (contract.impureCircuits[name] as (...values: unknown[]) => Runtime.CircuitResults<TrustCartPrivateState, unknown>)(context, ...args);
    context = result.context;
  };
  const useSecret = (secret: Uint8Array) => { context = { ...context, currentPrivateState: createTrustCartPrivateState(secret) }; };
  const registerSellerAndProduct = () => {
    useSecret(SELLER_SECRET);
    call('registerSeller', text('Authorized Seller A'), 1n);
    sellerId = ledger(context.currentQueryContext.state).nextSellerId;
    useSecret(MFR_SECRET);
    call('registerProduct', 1n, text('ExamplePhone X'), text('electronics', 16), text('BATCH-2026-09'), 24n, SERIAL_SECRET);
    productId = ledger(context.currentQueryContext.state).nextProductId;
    call('authorizeSeller', 1n, sellerId);
    useSecret(MFR_SECRET);
  };

  beforeEach(() => {
    contract = new Contract(createWitnesses());
    const initial = contract.initialState(Runtime.createConstructorContext(createTrustCartPrivateState(MFR_SECRET), COIN));
    context = Runtime.createCircuitContext(Runtime.sampleContractAddress(), COIN, initial.currentContractState, initial.currentPrivateState, undefined, undefined, 1_800_000_000n);
    call('registerManufacturer', text('Example Devices'), text('ExampleBrand'));
    registerSellerAndProduct();
  });

  it('registers manufacturer and product commitments', () => {
    const state = ledger(context.currentQueryContext.state);
    const mfr = state.manufacturers.lookup(1n);
    const product = state.products.lookup(productId);
    expect(state.nextManufacturerId).toBe(1n);
    expect(mfr.mfrHash).toEqual(pureCircuits.mfrCommitment(MFR_SECRET));
    expect(mfr.active).toBe(true);
    expect(product.productCommitment).toEqual(pureCircuits.productCommitment(SERIAL_SECRET));
    expect(product.status).toBe(ProductStatus.ACTIVE);
    expect(product.sold).toBe(false);
  });

  it('rejects product registration by a non-manufacturer wallet', () => {
    useSecret(bytes(9));
    expect(() => call('registerProduct', 1n, text('Fake'), text('fakes', 16), text('BATCH-X'), 12n, bytes(8))).toThrow('manufacturer authorization failed');
  });

  it('requires authorization before a seller can register a sale', () => {
    const state = ledger(context.currentQueryContext.state);
    expect(state.sellers.lookup(sellerId).authorized).toBe(true);
    useSecret(SELLER_SECRET);
    expect(() => call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n)).not.toThrow();
    useSecret(MFR_SECRET);
    call('registerProduct', 1n, text('ExamplePhone Y'), text('electronics', 16), text('BATCH-2026-10'), 12n, bytes(6));
    const unsoldId = ledger(context.currentQueryContext.state).nextProductId;
    call('revokeSellerAuthorization', 1n, sellerId);
    useSecret(SELLER_SECRET);
    expect(() => call('registerSale', sellerId, unsoldId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n)).toThrow('seller is not authorized');
  });

  it('registers a sale, moves ownership, and issues a warranty', () => {
    const buyerHash = pureCircuits.ownerCommitment(BUYER_SECRET);
    useSecret(SELLER_SECRET);
    const saleDate = 1_789_000_000n;
    call('registerSale', sellerId, productId, buyerHash, saleDate);
    const state = ledger(context.currentQueryContext.state);
    const product = state.products.lookup(productId);
    const warranty = state.warranties.lookup(product.warrantyId);
    expect(product.ownerHash).toEqual(buyerHash);
    expect(product.sold).toBe(true);
    expect(warranty.expiresAt).toBe(saleDate + 24n * 2_592_000n);
    expect(state.sellers.lookup(sellerId).salesCount).toBe(1n);
    expect(() => call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET), saleDate)).toThrow('already has a sale record');
  });

  it('blocks sale and transfer for revoked products', () => {
    useSecret(MFR_SECRET);
    call('setProductStatus', productId, ProductStatus.RECALLED);
    useSecret(SELLER_SECRET);
    expect(() => call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n)).toThrow('product is not active');
  });

  it('transfers ownership privately and invalidates the previous owner', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);
    useSecret(BUYER_SECRET);
    call('transferOwnership', productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET));
    expect(ledger(context.currentQueryContext.state).products.lookup(productId).pendingOwnerHash).toEqual(pureCircuits.ownerCommitment(NEW_BUYER_SECRET));
    useSecret(NEW_BUYER_SECRET);
    call('acceptOwnershipTransfer', productId);
    const product = ledger(context.currentQueryContext.state).products.lookup(productId);
    expect(product.ownerHash).toEqual(pureCircuits.ownerCommitment(NEW_BUYER_SECRET));
    expect(product.ownershipVersion).toBe(2n);
    expect(product.transfers).toBe(1n);
    useSecret(NEW_BUYER_SECRET);
    expect(() => call('transferOwnership', productId, pureCircuits.ownerCommitment(bytes(8)))).toThrow('ownership proof failed');
  });

  it('allows only the manufacturer to manage status and warranty', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);
    useSecret(bytes(9));
    expect(() => call('setProductStatus', productId, ProductStatus.COUNTERFEIT)).toThrow('manufacturer authorization failed');
    expect(() => call('extendWarranty', productId, 12n)).toThrow('manufacturer authorization failed');
    useSecret(MFR_SECRET);
    call('extendWarranty', productId, 12n);
    expect(ledger(context.currentQueryContext.state).warranties.lookup(1n).expiresAt).toBe(1_789_000_000n + 36n * 2_592_000n);
    call('cancelWarranty', productId);
    expect(ledger(context.currentQueryContext.state).warranties.lookup(1n).cancelled).toBe(true);
    expect(() => call('extendWarranty', productId, 12n)).toThrow('warranty is cancelled');
  });

  it('rejects invalid product configuration before writing state', () => {
    const before = ledger(context.currentQueryContext.state).nextProductId;
    expect(() => call('registerProduct', 1n, text('Bad'), text('bad', 16), text('BATCH-BAD'), 0n, bytes(9))).toThrow('warranty duration');
    expect(() => call('registerProduct', 1n, text('Bad'), text('bad', 16), text('BATCH-BAD'), 12n, bytes(0))).toThrow('serial secret');
    expect(ledger(context.currentQueryContext.state).nextProductId).toBe(before);
  });

  it('keeps private lifecycle inputs out of serialized ledger bytes', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);
    useSecret(BUYER_SECRET);
    call('transferOwnership', productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET));
    const serialized = JSON.stringify(ledger(context.currentQueryContext.state), (_, value) => typeof value === 'bigint' ? value.toString() : value);
    expect(serialized).not.toContain('Example Devices');
    expect(serialized).not.toContain('Authorized Seller A');
  });

  it('rejects duplicate serials and zero ownership credentials', () => {
    useSecret(MFR_SECRET);
    expect(() => call('registerProduct', 1n, text('Duplicate'), text('electronics', 16), text('BATCH-DUP'), 12n, SERIAL_SECRET)).toThrow('product serial is already registered');
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);
    useSecret(BUYER_SECRET);
    expect(() => call('transferOwnership', productId, bytes(0))).toThrow('new owner credential is required');
  });
});
