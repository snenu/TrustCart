import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum ProductStatus { ACTIVE = 0,
                            STOLEN = 1,
                            LOST = 2,
                            RECALLED = 3,
                            COUNTERFEIT = 4
}

export type ManufacturerRecord = { name: Uint8Array;
                                   brand: Uint8Array;
                                   mfrHash: Uint8Array;
                                   productCount: bigint;
                                   active: boolean
                                 };

export type SellerRecord = { name: Uint8Array;
                             mfrId: bigint;
                             sellerHash: Uint8Array;
                             authorized: boolean;
                             salesCount: bigint
                           };

export type ProductRecord = { mfrId: bigint;
                              model: Uint8Array;
                              category: Uint8Array;
                              batch: Uint8Array;
                              warrantyMonths: bigint;
                              productCommitment: Uint8Array;
                              ownerHash: Uint8Array;
                              pendingOwnerHash: Uint8Array;
                              warrantyId: bigint;
                              sold: boolean;
                              ownershipVersion: bigint;
                              transfers: bigint;
                              status: ProductStatus
                            };

export type WarrantyRecord = { productId: bigint;
                               sellerId: bigint;
                               issuedAt: bigint;
                               expiresAt: bigint;
                               cancelled: boolean
                             };

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerManufacturer(context: __compactRuntime.CircuitContext<PS>,
                       name_0: Uint8Array,
                       brand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerProduct(context: __compactRuntime.CircuitContext<PS>,
                  mfrId_0: bigint,
                  model_0: Uint8Array,
                  category_0: Uint8Array,
                  batch_0: Uint8Array,
                  warrantyMonths_0: bigint,
                  serialSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerSeller(context: __compactRuntime.CircuitContext<PS>,
                 name_0: Uint8Array,
                 mfrId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  authorizeSeller(context: __compactRuntime.CircuitContext<PS>,
                  mfrId_0: bigint,
                  sellerId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeSellerAuthorization(context: __compactRuntime.CircuitContext<PS>,
                            mfrId_0: bigint,
                            sellerId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  registerSale(context: __compactRuntime.CircuitContext<PS>,
               sellerId_0: bigint,
               productId_0: bigint,
               buyerHash_0: Uint8Array,
               saleDate_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transferOwnership(context: __compactRuntime.CircuitContext<PS>,
                    productId_0: bigint,
                    newOwnerHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptOwnershipTransfer(context: __compactRuntime.CircuitContext<PS>,
                          productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancelOwnershipTransfer(context: __compactRuntime.CircuitContext<PS>,
                          productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setProductStatus(context: __compactRuntime.CircuitContext<PS>,
                   productId_0: bigint,
                   status_0: ProductStatus): __compactRuntime.CircuitResults<PS, []>;
  cancelWarranty(context: __compactRuntime.CircuitContext<PS>,
                 productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  extendWarranty(context: __compactRuntime.CircuitContext<PS>,
                 productId_0: bigint,
                 extraMonths_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  registerManufacturer(context: __compactRuntime.CircuitContext<PS>,
                       name_0: Uint8Array,
                       brand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerProduct(context: __compactRuntime.CircuitContext<PS>,
                  mfrId_0: bigint,
                  model_0: Uint8Array,
                  category_0: Uint8Array,
                  batch_0: Uint8Array,
                  warrantyMonths_0: bigint,
                  serialSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerSeller(context: __compactRuntime.CircuitContext<PS>,
                 name_0: Uint8Array,
                 mfrId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  authorizeSeller(context: __compactRuntime.CircuitContext<PS>,
                  mfrId_0: bigint,
                  sellerId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeSellerAuthorization(context: __compactRuntime.CircuitContext<PS>,
                            mfrId_0: bigint,
                            sellerId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  registerSale(context: __compactRuntime.CircuitContext<PS>,
               sellerId_0: bigint,
               productId_0: bigint,
               buyerHash_0: Uint8Array,
               saleDate_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transferOwnership(context: __compactRuntime.CircuitContext<PS>,
                    productId_0: bigint,
                    newOwnerHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptOwnershipTransfer(context: __compactRuntime.CircuitContext<PS>,
                          productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancelOwnershipTransfer(context: __compactRuntime.CircuitContext<PS>,
                          productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setProductStatus(context: __compactRuntime.CircuitContext<PS>,
                   productId_0: bigint,
                   status_0: ProductStatus): __compactRuntime.CircuitResults<PS, []>;
  cancelWarranty(context: __compactRuntime.CircuitContext<PS>,
                 productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  extendWarranty(context: __compactRuntime.CircuitContext<PS>,
                 productId_0: bigint,
                 extraMonths_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  mfrCommitment(sk_0: Uint8Array): Uint8Array;
  sellerCommitment(sk_0: Uint8Array): Uint8Array;
  ownerCommitment(sk_0: Uint8Array): Uint8Array;
  productCommitment(serialSecret_0: Uint8Array): Uint8Array;
  warrantyExpiryFor(issuedAt_0: bigint, warrantyMonths_0: bigint): bigint;
}

export type Circuits<PS> = {
  mfrCommitment(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  sellerCommitment(context: __compactRuntime.CircuitContext<PS>,
                   sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  ownerCommitment(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  productCommitment(context: __compactRuntime.CircuitContext<PS>,
                    serialSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  warrantyExpiryFor(context: __compactRuntime.CircuitContext<PS>,
                    issuedAt_0: bigint,
                    warrantyMonths_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  registerManufacturer(context: __compactRuntime.CircuitContext<PS>,
                       name_0: Uint8Array,
                       brand_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerProduct(context: __compactRuntime.CircuitContext<PS>,
                  mfrId_0: bigint,
                  model_0: Uint8Array,
                  category_0: Uint8Array,
                  batch_0: Uint8Array,
                  warrantyMonths_0: bigint,
                  serialSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerSeller(context: __compactRuntime.CircuitContext<PS>,
                 name_0: Uint8Array,
                 mfrId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  authorizeSeller(context: __compactRuntime.CircuitContext<PS>,
                  mfrId_0: bigint,
                  sellerId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  revokeSellerAuthorization(context: __compactRuntime.CircuitContext<PS>,
                            mfrId_0: bigint,
                            sellerId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  registerSale(context: __compactRuntime.CircuitContext<PS>,
               sellerId_0: bigint,
               productId_0: bigint,
               buyerHash_0: Uint8Array,
               saleDate_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  transferOwnership(context: __compactRuntime.CircuitContext<PS>,
                    productId_0: bigint,
                    newOwnerHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  acceptOwnershipTransfer(context: __compactRuntime.CircuitContext<PS>,
                          productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancelOwnershipTransfer(context: __compactRuntime.CircuitContext<PS>,
                          productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setProductStatus(context: __compactRuntime.CircuitContext<PS>,
                   productId_0: bigint,
                   status_0: ProductStatus): __compactRuntime.CircuitResults<PS, []>;
  cancelWarranty(context: __compactRuntime.CircuitContext<PS>,
                 productId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  extendWarranty(context: __compactRuntime.CircuitContext<PS>,
                 productId_0: bigint,
                 extraMonths_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  manufacturers: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): ManufacturerRecord;
    [Symbol.iterator](): Iterator<[bigint, ManufacturerRecord]>
  };
  sellers: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): SellerRecord;
    [Symbol.iterator](): Iterator<[bigint, SellerRecord]>
  };
  products: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): ProductRecord;
    [Symbol.iterator](): Iterator<[bigint, ProductRecord]>
  };
  warranties: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): WarrantyRecord;
    [Symbol.iterator](): Iterator<[bigint, WarrantyRecord]>
  };
  manufacturerCommitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  sellerCommitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  productCommitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  readonly nextManufacturerId: bigint;
  readonly nextSellerId: bigint;
  readonly nextProductId: bigint;
  readonly nextWarrantyId: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
