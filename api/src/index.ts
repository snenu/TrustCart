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

const positiveId = (value: number, label: string): bigint => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return BigInt(value);
};

const boundedByte = (value: number, label: string): bigint => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 255) throw new Error(`${label} must be between 1 and 255.`);
  return BigInt(value);
};

const requiredText = (value: string, label: string): string => {
  if (!value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
};

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
            pendingOwnerHash: bytesToHex(product.pendingOwnerHash),
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

  productCommitment(serialNumber: string): string {
    return bytesToHex(
      ContractBindings.pureCircuits.productCommitment(encodeText(serialNumber)),
    );
  }

  ownsProduct(product: ProductView, secretHex: string): boolean {
    return product.sold && product.pendingOwnerHash === '0'.repeat(64) && product.ownerHash === this.ownerCommitment(secretHex);
  }

  isAuthentic(product: ProductView, serialNumber: string): boolean {
    return product.productCommitment === this.productCommitment(serialNumber);
  }

  async registerManufacturer(input: RegisterManufacturerInput): Promise<string> {
    const tx = await this.deployedContract.callTx.registerManufacturer(
      encodeText(requiredText(input.name, 'Manufacturer name')),
      encodeText(requiredText(input.brand, 'Brand')),
    );
    return tx.public.txId;
  }

  async registerProduct(input: RegisterProductInput): Promise<string> {
    const mfrId = positiveId(input.mfrId, 'Manufacturer ID');
    const warrantyMonths = boundedByte(input.warrantyMonths, 'Warranty months');
    const model = requiredText(input.model, 'Model');
    const category = requiredText(input.category, 'Category');
    const batch = requiredText(input.batch, 'Batch');
    if (!input.serialNumber.trim()) throw new Error('Serial number is required.');
    const tx = await this.deployedContract.callTx.registerProduct(
      mfrId,
      encodeText(model),
      encodeCategory(category),
      encodeText(batch),
      warrantyMonths,
      encodeText(input.serialNumber),
    );
    return tx.public.txId;
  }

  async registerSeller(input: RegisterSellerInput): Promise<string> {
    const mfrId = positiveId(input.mfrId, 'Manufacturer ID');
    const tx = await this.deployedContract.callTx.registerSeller(
      encodeText(requiredText(input.name, 'Seller name')),
      mfrId,
    );
    return tx.public.txId;
  }

  async authorizeSeller(mfrId: number, sellerId: number): Promise<string> {
    const tx = await this.deployedContract.callTx.authorizeSeller(positiveId(mfrId, 'Manufacturer ID'), positiveId(sellerId, 'Seller ID'));
    return tx.public.txId;
  }

  async revokeSellerAuthorization(mfrId: number, sellerId: number): Promise<string> {
    const tx = await this.deployedContract.callTx.revokeSellerAuthorization(positiveId(mfrId, 'Manufacturer ID'), positiveId(sellerId, 'Seller ID'));
    return tx.public.txId;
  }

  async registerSale(input: RegisterSaleInput): Promise<string> {
    const sellerId = positiveId(input.sellerId, 'Seller ID');
    const productId = positiveId(input.productId, 'Product ID');
    const tx = await this.deployedContract.callTx.registerSale(
      sellerId,
      productId,
      hexToBytes(input.buyerReceivingCode),
      input.saleDate,
    );
    return tx.public.txId;
  }

  async transferOwnership(productId: number, newOwnerReceivingCode: string): Promise<string> {
    const tx = await this.deployedContract.callTx.transferOwnership(
      positiveId(productId, 'Product ID'),
      hexToBytes(newOwnerReceivingCode),
    );
    return tx.public.txId;
  }

  async acceptOwnershipTransfer(productId: number): Promise<string> {
    const tx = await this.deployedContract.callTx.acceptOwnershipTransfer(positiveId(productId, 'Product ID'));
    return tx.public.txId;
  }

  async cancelOwnershipTransfer(productId: number): Promise<string> {
    const tx = await this.deployedContract.callTx.cancelOwnershipTransfer(positiveId(productId, 'Product ID'));
    return tx.public.txId;
  }

  async setProductStatus(productId: number, status: ContractBindings.ProductStatus): Promise<string> {
    const tx = await this.deployedContract.callTx.setProductStatus(positiveId(productId, 'Product ID'), status);
    return tx.public.txId;
  }

  async cancelWarranty(productId: number): Promise<string> {
    const tx = await this.deployedContract.callTx.cancelWarranty(positiveId(productId, 'Product ID'));
    return tx.public.txId;
  }

  async extendWarranty(productId: number, extraMonths: number): Promise<string> {
    const tx = await this.deployedContract.callTx.extendWarranty(positiveId(productId, 'Product ID'), boundedByte(extraMonths, 'Extra months'));
    return tx.public.txId;
  }

  static async deploy(providers: TrustCartProviders, secretKey: Uint8Array): Promise<TrustCartAPI> {
    const privateState = createTrustCartPrivateState(secretKey);
    const deployed = await deployContract(providers, {
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
    const deployed = await findDeployedContract(providers, {
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

