import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as TrustCartContract from '../managed/trustcart/contract/index.js';
import { createWitnesses } from './witnesses.js';

export * as TrustCart from '../managed/trustcart/contract/index.js';
export * from '../managed/trustcart/contract/index.js';
export { createWitnesses, createTrustCartPrivateState } from './witnesses.js';
export type { TrustCartPrivateState } from './witnesses.js';

export const CompiledTrustCartContract = CompiledContract.make(
  'trustcart',
  TrustCartContract.Contract,
).pipe(
  CompiledContract.withWitnesses(createWitnesses()),
  CompiledContract.withCompiledFileAssets('./managed/trustcart'),
);
