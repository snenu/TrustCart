import { beforeEach, describe, expect, it } from 'vitest';
import * as Runtime from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Contract,
  ProductStatus,
  ledger,
  pureCircuits,
  type Circuits,
} from '../managed/trustcart/contract/index.js';
import {
  createWitnesses,
  createTrustCartPrivateState,
  type TrustCartPrivateState,
} from '../src/witnesses.js';

const bytes = (value: number): Uint8Array => new Uint8Array(32).fill(value);
const text = (value: string, length = 32): Uint8Array => {
  const encoded = new Uint8Array(length);
  encoded.set(new TextEncoder().encode(value));
  return encoded;
};

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
  ): void => {
    const result = (contract.impureCircuits[name] as (...values: unknown[]) => Runtime.CircuitResults<TrustCartPrivateState, unknown>)(
      context,
      ...args,
    );
    context = result.context;
  };

  const useSecret = (secretKey: Uint8Array): void => {
    context = {
      ...context,
      currentPrivateState: createTrustCartPrivateState(secretKey),
    };
  };

  const registerSellerAndProduct = (): void => {
    call('registerSeller', text('Authorized Seller A'), 1n);
    sellerId = ledger(context.currentQueryContext.state).nextSellerId;
    call('registerProduct', 1n, text('ExamplePhone X'), text('electronics', 16), text('BATCH-2026-09'), 24n, SERIAL_SECRET);
    productId = ledger(context.currentQueryContext.state).nextProductId;
    useSecret(SELLER_SECRET);
    call('authorizeSeller', 1n, sellerId);
    useSecret(MFR_SECRET);
  };

  beforeEach(() => {
    contract = new Contract(createWitnesses());
    const initial = contract.initialState(Runtime.createConstructorContext(createTrustCartPrivateState(MFR_SECRET), COIN));
    context = Runtime.createCircuitContext(
      Runtime.sampleContractAddress(),
      COIN,
      initial.currentContractState,
      initial.currentPrivateState,
    );
    call('registerManufacturer', text('Example Devices'), text('ExampleBrand'));
    registerSellerAndProduct();
  });
  it('registers a manufacturer with a commitment derived from its privacy secret', () => {
    const state = ledger(context.currentQueryContext.state);
    expect(state.nextManufacturerId).toBe(1n);
    const mfr = state.manufacturers.lookup(1n);
    expect(new TextDecoder().decode(mfr.name).replace(/\0/g, '')).toBe('Example Devices');
    expect(new TextDecoder().decode(mfr.brand).replace(/\0/g, '')).toBe('ExampleBrand');
    expect(mfr.mfrHash).toEqual(pureCircuits.mfrCommitment(MFR_SECRET));
    expect(mfr.active).toBe(true);
  });

  it('registers a product with a serial commitment instead of the serial itself', () => {
    const state = ledger(context.currentQueryContext.state);
    expect(state.nextProductId).toBe(1n);
    const product = state.products.lookup(productId);
    expect(new TextDecoder().decode(product.model).replace(/\0/g, '')).toBe('ExamplePhone X');
    expect(new TextDecoder().decode(product.category, 16).replace(/\0/g, '')).toBe('electronics');
    expect(new TextDecoder().decode(product.batch).replace(/\0/g, '')).toBe('BATCH-2026-09');
    expect(product.warrantyMonths).toBe(24n);
    expect(product.productCommitment).toEqual(pureCircuits.productCommitment(SERIAL_SECRET, productId));
    expect(product.sold).toBe(false);
    expect(product.status).toBe(ProductStatus.ACTIVE);
    expect(product.ownershipVersion).toBe(1n);
  });

  it('rejects product registration by a non-manufacturer wallet', () => {
    useSecret(bytes(9));
    expect(() => call('registerProduct', 1n, text('Fake'), text('fakes', 16), text('BATCH-X'), 12n, bytes(8)))
      .toThrow('manufacturer authorization failed');
  });

  it('keeps the serial number and privacy secret out of the serialized ledger', () => {
    const serialized = Runtime.serializeLedgerState(context.currentQueryContext.state);
    const decoded = new TextDecoder().decode(serialized);
    expect(decoded).not.toContain('Example Devices');
    expect(decoded).not.toContain('BATCH-2026-09');
  });

  it('requires manufacturer approval before a seller can register sales', () => {
    const state = ledger(context.currentQueryContext.state);
    expect(state.sellers.lookup(sellerId).authorized).toBe(true);

    useSecret(SELLER_SECRET);
    expect(() => call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n))
      .not.toThrow();

    // A second product sold by an unapproved seller must fail.
    useSecret(MFR_SECRET);
    call('registerProduct', 1n, text('ExamplePhone Y'), text('electronics', 16), text('BATCH-2026-10'), 12n, bytes(6));
    const unsoldId = ledger(context.currentQueryContext.state).nextProductId;
    call('revokeSellerAuthorization', 1n, sellerId);
    useSecret(SELLER_SECRET);
    expect(() => call('registerSale', sellerId, unsoldId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n))
      .toThrow('seller is not authorized');
  });

  it('registers a sale that issues a warranty and moves ownership to the buyer', () => {
    const buyerHash = pureCircuits.ownerCommitment(BUYER_SECRET);
    useSecret(SELLER_SECRET);
    const saleDate = 1_789_000_000n;
    call('registerSale', sellerId, productId, buyerHash, saleDate);

    const state = ledger(context.currentQueryContext.state);
    const product = state.products.lookup(productId);
    expect(product.sold).toBe(true);
    expect(product.ownerHash).toEqual(buyerHash);
    expect(product.warrantyId).toBe(1n);

    const warranty = state.warranties.lookup(product.warrantyId);
    expect(warranty.productId).toBe(productId);
    expect(warranty.sellerId).toBe(sellerId);
    expect(warranty.issuedAt).toBe(saleDate);
    expect(warranty.expiresAt).toBe(saleDate + 24n * 2_592_000n);
    expect(warranty.cancelled).toBe(false);
    expect(state.sellers.lookup(sellerId).salesCount).toBe(1n);

    expect(() => call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET), saleDate))
      .toThrow('already has a sale record');
  });

  it('refuses to sell products that are not in active status', () => {
    useSecret(MFR_SECRET);
    call('setProductStatus', productId, ProductStatus.RECALLED);
    useSecret(SELLER_SECRET);
    expect(() => call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n))
  it('transfers ownership privately and invalidates the previous owner', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);

    useSecret(BUYER_SECRET);
    expect(() => call('transferOwnership', productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET)))
      .not.toThrow();

    const state = ledger(context.currentQueryContext.state);
    const product = state.products.lookup(productId);
    expect(product.ownerHash).toEqual(pureCircuits.ownerCommitment(NEW_BUYER_SECRET));
    expect(product.ownershipVersion).toBe(2n);
    expect(product.transfers).toBe(1n);
    // The warranty follows the product across the transfer.
    expect(product.warrantyId).toBe(1n);

    useSecret(BUYER_SECRET);
    expect(() => call('transferOwnership', productId, pureCircuits.ownerCommitment(bytes(8))))
      .toThrow('ownership proof failed');
  });

  it('refuses ownership transfers that are not authorized or not meaningful', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);

    useSecret(bytes(9));
    expect(() => call('transferOwnership', productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET)))
      .toThrow('ownership proof failed');

    useSecret(BUYER_SECRET);
    expect(() => call('transferOwnership', productId, pureCircuits.ownerCommitment(BUYER_SECRET)))
      .toThrow('new owner must be different');
  });

  it('blocks transfers of stolen or counterfeit products', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);
    useSecret(MFR_SECRET);
    call('setProductStatus', productId, ProductStatus.STOLEN);
    useSecret(BUYER_SECRET);
    expect(() => call('transferOwnership', productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET)))
      .toThrow('product status blocks transfer');
  });

  it('lets only the manufacturer revoke and restore product status', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);

    useSecret(bytes(9));
    expect(() => call('setProductStatus', productId, ProductStatus.COUNTERFEIT)).toThrow('manufacturer authorization failed');
  it('cancels and extends warranties under manufacturer control only', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);

    useSecret(bytes(9));
    expect(() => call('extendWarranty', productId, 12n)).toThrow('manufacturer authorization failed');

    useSecret(MFR_SECRET);
    call('extendWarranty', productId, 12n);
    let warranty = ledger(context.currentQueryContext.state).warranties.lookup(1n);
    expect(warranty.expiresAt).toBe(1_789_000_000n + 36n * 2_592_000n);

    call('cancelWarranty', productId);
    warranty = ledger(context.currentQueryContext.state).warranties.lookup(1n);
    expect(warranty.cancelled).toBe(true);

    expect(() => call('extendWarranty', productId, 12n)).toThrow('warranty is cancelled');
    expect(() => call('cancelWarranty', productId)).toThrow('already cancelled');
  });

  it('refuses warranty operations on products without a sale record', () => {
    useSecret(MFR_SECRET);
    expect(() => call('cancelWarranty', productId)).toThrow('no warranty record');
    expect(() => call('extendWarranty', productId, 6n)).toThrow('no warranty record');
  });

  it('rejects invalid product configuration before any state is written', () => {
    const before = ledger(context.currentQueryContext.state).nextProductId;
    expect(() => call('registerProduct', 1n, text('Bad'), text('bad', 16), text('BATCH-BAD'), 0n, bytes(9)))
      .toThrow('warranty duration');
    expect(() => call('registerProduct', 1n, text('Bad'), text('bad', 16), text('BATCH-BAD'), 12n, bytes(0)))
      .toThrow('serial secret');
    expect(ledger(context.currentQueryContext.state).nextProductId).toBe(before);
  });

  it('keeps buyer identities and serial numbers out of the on-chain record after a full lifecycle', () => {
    useSecret(SELLER_SECRET);
    call('registerSale', sellerId, productId, pureCircuits.ownerCommitment(BUYER_SECRET), 1_789_000_000n);
    useSecret(BUYER_SECRET);
    call('transferOwnership', productId, pureCircuits.ownerCommitment(NEW_BUYER_SECRET));

    const serialized = new TextDecoder().decode(Runtime.serializeLedgerState(context.currentQueryContext.state));
    expect(serialized).not.toContain('Example Devices');
    expect(serialized).not.toContain('Authorized Seller A');
  });
});


    useSecret(MFR_SECRET);
    call('setProductStatus', productId, ProductStatus.COUNTERFEIT);
    expect(ledger(context.currentQueryContext.state).products.lookup(productId).status).toBe(ProductStatus.COUNTERFEIT);

    call('setProductStatus', productId, ProductStatus.ACTIVE);
    expect(ledger(context.currentQueryContext.state).products.lookup(productId).status).toBe(ProductStatus.ACTIVE);
  });

      .toThrow('product is not active');
  });

  it('verifies authenticity only for the correct serial number', () => {
    const state = ledger(context.currentQueryContext.state);
    const product = state.products.lookup(productId);
    const genuine = pureCircuits.productCommitment(SERIAL_SECRET, productId);
    const forged = pureCircuits.productCommitment(bytes(7), productId);
    expect(product.productCommitment).toEqual(genuine);
    expect(product.productCommitment).not.toEqual(forged);
  });

