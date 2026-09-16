import type { FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { TrustCartPrivateState } from '../../contract/src/index.js';
import type { ProductStatus } from '../../contract/managed/trustcart/contract/index.js';

export const trustCartPrivateStateKey = 'trustCartPrivateState';
export type PrivateStateId = typeof trustCartPrivateStateKey;

export type TrustCartCircuitKeys =
  | 'registerManufacturer'
  | 'registerProduct'
  | 'registerSeller'
  | 'authorizeSeller'
  | 'revokeSellerAuthorization'
  | 'registerSale'
  | 'transferOwnership'
  | 'setProductStatus'
  | 'cancelWarranty'
  | 'extendWarranty';

export type TrustCartProviders = MidnightProviders<TrustCartCircuitKeys, PrivateStateId, TrustCartPrivateState>;
export type DeployedTrustCartContract = FoundContract<any>;

export interface ManufacturerView {
  readonly id: number;
  readonly name: string;
  readonly brand: string;
  readonly mfrHash: string;
  readonly productCount: number;
  readonly active: boolean;
}

export interface SellerView {
  readonly id: number;
  readonly name: string;
  readonly mfrId: number;
  readonly sellerHash: string;
  readonly authorized: boolean;
  readonly salesCount: number;
}

export interface ProductView {
  readonly id: number;
  readonly mfrId: number;
  readonly model: string;
  readonly category: string;
  readonly batch: string;
  readonly warrantyMonths: number;
  readonly productCommitment: string;
  readonly ownerHash: string;
  readonly warrantyId: number;
  readonly sold: boolean;
  readonly ownershipVersion: number;
  readonly transfers: number;
  readonly status: ProductStatus;
}

export interface WarrantyView {
  readonly id: number;
  readonly productId: number;
  readonly sellerId: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly cancelled: boolean;
}

export interface TrustCartDerivedState {
  readonly manufacturerCount: number;
  readonly sellerCount: number;
  readonly productCount: number;
  readonly warrantyCount: number;
  readonly manufacturers: ManufacturerView[];
  readonly sellers: SellerView[];
  readonly products: ProductView[];
  readonly warranties: WarrantyView[];
}

export interface RegisterManufacturerInput {
  readonly name: string;
  readonly brand: string;
}

export interface RegisterProductInput {
  readonly mfrId: number;
  readonly model: string;
  readonly category: string;
  readonly batch: string;
  readonly warrantyMonths: number;
  readonly serialNumber: string;
}

export interface RegisterSellerInput {
  readonly name: string;
  readonly mfrId: number;
}

export interface RegisterSaleInput {
  readonly sellerId: number;
  readonly productId: number;
  readonly buyerReceivingCode: string;
  readonly saleDate: bigint;
}
