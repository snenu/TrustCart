import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { map, type Observable } from 'rxjs';
import * as ContractBindings from '../../contract/managed/trustcart/contract/index.js';
import {
  CompiledTrustCartContract,
  createTrustCartPrivateState,
  type TrustCartPrivateState,
} from '../../contract/src/index.js';
import {
  type DeployedTrustCartContract,
  type ManufacturerView,
  type ProductView,
  type RegisterManufacturerInput,
  type RegisterProductInput,
  type RegisterSaleInput,
  type RegisterSellerInput,
  type SellerView,
  type TrustCartDerivedState,
  type TrustCartProviders,
  type WarrantyView,
  trustCartPrivateStateKey,
} from './common-types.js';
import { bytesToHex, decodeText, encodeCategory, encodeText, hexToBytes } from './encoding.js';

export class TrustCartAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<TrustCartDerivedState>;

  private constructor(
    public readonly deployedContract: DeployedTrustCartContract,
    private readonly providers: TrustCartProviders,
    private privateState: TrustCartPrivateState,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(
        map((state) => ContractBindings.ledger(state.data)),
        map((ledger): TrustCartDerivedState => ({
          manufacturerCount: Number(ledger.nextManufacturerId),
          sellerCount: Number(ledger.nextSellerId),
          productCount: Number(ledger.nextProductId),
          warrantyCount: Number(ledger.nextWarrantyId),
          manufacturers: Array.from(ledger.manufacturers, ([id, mfr]): ManufacturerView => ({
            id: Number(id),
            name: decodeText(mfr.name),
            brand: decodeText(mfr.brand),
            mfrHash: bytesToHex(mfr.mfrHash),
            productCount: Number(mfr.productCount),
            active: mfr.active,
          })).sort((a, b) => a.id - b.id),
          sellers: Array.from(ledger.sellers, ([id, seller]): SellerView => ({
            id: Number(id),
            name: decodeText(seller.name),
            mfrId: Number(seller.mfrId),
            sellerHash: bytesToHex(seller.sellerHash),
            authorized: seller.authorized,
            salesCount: Number(seller.salesCount),
          })).sort((a, b) => a.id - b.id),
          products: Array.from(ledger.products, ([id, product]): ProductView => ({
            id: Number(id),
            mfrId: Number(product.mfrId),
            model: decodeText(product.model),
            category: decodeText(product.category),
            batch: decodeText(product.batch),
            warrantyMonths: Number(product.warrantyMonths),
            productCommitment: bytesToHex(product.productCommitment),
            ownerHash: bytesToHex(product.ownerHash),
            warrantyId: Number(product.warrantyId),
            sold: product.sold,
            ownershipVersion: Number(product.ownershipVersion),
            transfers: Number(product.transfers),
            status: product.status,
          })).sort((a, b) => a.id - b.id),
          warranties: Array.from(ledger.warranties, ([id, warranty]): WarrantyView => ({
            id: Number(id),
            productId: Number(warranty.productId),
            sellerId: Number(warranty.sellerId),
            issuedAt: Number(warranty.issuedAt),
            expiresAt: Number(warranty.expiresAt),
            cancelled: warranty.cancelled,
          })).sort((a, b) => a.id - b.id),
        })),
      );
  }
  ownerCommitment(secretHex: string): string {
    return bytesToHex(ContractBindings.pureCircuits.ownerCommitment(hexToBytes(secretHex)));
  }

  mfrCommitment(secretHex: string): string {
    return bytesToHex(ContractBindings.pureCircuits.mfrCommitment(hexToBytes(secretHex)));
  }

  sellerCommitment(secretHex: string): string {
    return bytesToHex(ContractBindings.pureCircuits.sellerCommitment(hexToBytes(secretHex)));
  }

  static receivingCodeFor(secret: Uint8Array): string {
    return bytesToHex(ContractBindings.pureCircuits.ownerCommitment(secret));
  }

  productCommitment(serialNumber: string, productId: number): string {
    return bytesToHex(
      ContractBindings.pureCircuits.productCommitment(encodeText(serialNumber), BigInt(productId)),
    );
  }

  ownsProduct(product: ProductView, secretHex: string): boolean {
    return product.ownerHash === this.ownerCommitment(secretHex);
  }

  isAuthentic(product: ProductView, serialNumber: string): boolean {
    return product.productCommitment === this.productCommitment(serialNumber, product.id);
  }

  async registerManufacturer(input: RegisterManufacturerInput): Promise<void> {
    await (this.deployedContract as any).callTx.registerManufacturer(
      encodeText(input.name),
      encodeText(input.brand),
    );
  }

  async registerProduct(input: RegisterProductInput): Promise<void> {
    await (this.deployedContract as any).callTx.registerProduct(
      BigInt(input.mfrId),
      encodeText(input.model),
      encodeCategory(input.category),
      encodeText(input.batch),
      BigInt(input.warrantyMonths),
      encodeText(input.serialNumber),
    );
  }

  async registerSeller(input: RegisterSellerInput): Promise<void> {
    await (this.deployedContract as any).callTx.registerSeller(
      encodeText(input.name),
      BigInt(input.mfrId),
    );
  }

  async authorizeSeller(mfrId: number, sellerId: number): Promise<void> {
    await (this.deployedContract as any).callTx.authorizeSeller(BigInt(mfrId), BigInt(sellerId));
  }

  async revokeSellerAuthorization(mfrId: number, sellerId: number): Promise<void> {
    await (this.deployedContract as any).callTx.revokeSellerAuthorization(BigInt(mfrId), BigInt(sellerId));
  }

  async registerSale(input: RegisterSaleInput): Promise<void> {
    await (this.deployedContract as any).callTx.registerSale(
      BigInt(input.sellerId),
      BigInt(input.productId),
      hexToBytes(input.buyerReceivingCode),
      input.saleDate,
    );
  }

  async transferOwnership(productId: number, newOwnerReceivingCode: string): Promise<void> {
    await (this.deployedContract as any).callTx.transferOwnership(
      BigInt(productId),
      hexToBytes(newOwnerReceivingCode),
    );
  }

  async setProductStatus(productId: number, status: typeof ContractBindings.ProductStatus): Promise<void> {
    await (this.deployedContract as any).callTx.setProductStatus(BigInt(productId), status);
  }

  async cancelWarranty(productId: number): Promise<void> {
    await (this.deployedContract as any).callTx.cancelWarranty(BigInt(productId));
  }

  async extendWarranty(productId: number, extraMonths: number): Promise<void> {
    await (this.deployedContract as any).callTx.extendWarranty(BigInt(productId), BigInt(extraMonths));
  }

  static async deploy(providers: TrustCartProviders, secretKey: Uint8Array): Promise<TrustCartAPI> {
    const privateState = createTrustCartPrivateState(secretKey);
    const deployed = await deployContract(providers as any, {
      compiledContract: CompiledTrustCartContract,
      privateStateId: trustCartPrivateStateKey,
      initialPrivateState: privateState,
    });
    return new TrustCartAPI(deployed, providers, privateState);
  }

  static async join(
    providers: TrustCartProviders,
    contractAddress: ContractAddress,
    secretKey: Uint8Array,
  ): Promise<TrustCartAPI> {
    const privateState = createTrustCartPrivateState(secretKey);
    const deployed = await findDeployedContract(providers as any, {
      contractAddress,
      compiledContract: CompiledTrustCartContract,
      privateStateId: trustCartPrivateStateKey,
      initialPrivateState: privateState,
    });
    return new TrustCartAPI(deployed, providers, privateState);
  }
}

export * from './common-types.js';
export * from './encoding.js';
export { ProductStatus } from '../../contract/managed/trustcart/contract/index.js';

