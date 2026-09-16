import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { map, type Observable } from 'rxjs';
import * as ContractBindings from '../../contract/managed/trustcart/contract/index.js';
import { trustCartStateFromLedger } from './index.js';
import type { TrustCartDerivedState } from './common-types.js';

export class TrustCartPublicReader {
  readonly state$: Observable<TrustCartDerivedState>;

  constructor(indexerUri: string, indexerWsUri: string, contractAddress: string) {
    const provider = indexerPublicDataProvider(indexerUri, indexerWsUri);
    this.state$ = provider
      .contractStateObservable(contractAddress as ContractAddress, { type: 'latest' })
      .pipe(map((state) => trustCartStateFromLedger(ContractBindings.ledger(state.data))));
  }
}
