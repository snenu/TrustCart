# TrustCart

TrustCart is a privacy-first product passport for authenticity, ownership, and warranty verification on Midnight.

It gives manufacturers, sellers, and buyers a shared product registry without turning private serial numbers, prices, receiving secrets, or wallet identity into public records.

## What the app does

- Registers manufacturers and their brands.
- Registers products using a serial commitment instead of publishing the serial.
- Registers sellers and lets manufacturers authorize or revoke them.
- Records private sales against a buyer receiving commitment.
- Issues, extends, and cancels warranties.
- Verifies a product privately from its serial number.
- Supports ownership transfer requests, acceptance, and cancellation.
- Tracks product status such as active, stolen, lost, recalled, or counterfeit.
- Provides a read-only public verifier that does not require a wallet.
- Keeps encrypted private state and signing keys in the browser.
- Exports and restores an encrypted recovery backup.
- Automatically connects users to the deployed TrustCart Preprod registry after wallet connection.

## Live Preprod deployment

The current TrustCart contract is deployed on Midnight Preprod at:

```text
a6d78d3f68af39016a32258854cfab473024126eb594f9eff41f57e81b3c7bae
```

Deployment transaction:

```text
7528701da55a8846acb3ed7eb67f1184ef84f546cfdb52a9cb692bbd24853ba3
```

[Open the deployment in the 1am Preprod explorer](https://explorer.1am.xyz/tx/7528701da55a8846acb3ed7eb67f1184ef84f546cfdb52a9cb692bbd24853ba3?network=preprod)

The contract address is public configuration, not a secret. The UI includes this Preprod address as a fallback and supports overriding it with `VITE_DEFAULT_CONTRACT_ADDRESS` for a future registry deployment.

## Architecture

```text
contract/  Compact contract, witnesses, generated bindings, and contract tests
api/       Typed contract API, validation, provider types, and public reader
ui/        React + Vite dapp, wallet connection, private state, and landing page
scripts/   Contract compilation and ZK artifact preparation
```

The browser dapp follows Midnight's provider model:

1. The DApp Connector connects a compatible wallet on `preprod`.
2. `setNetworkId('preprod')` is applied before contract operations.
3. The encrypted Level private-state provider stores browser-local state and signing keys.
4. The public data provider reads the deployed registry through the Preprod GraphQL indexer.
5. The ZK config provider fetches TrustCart prover and verifier artifacts from `/zk/trustcart-v1`.
6. The proof provider generates zero-knowledge proofs through the proof server configured by the wallet.
7. The wallet balances and signs transactions, then the Midnight provider submits them.

## Requirements

- Node.js 22 or later.
- A compatible Midnight wallet such as Lace or 1AM.
- The wallet switched to Midnight Preprod.
- A funded Preprod wallet with DUST available for writes.
- A local Midnight proof server on port `6300` for transaction proving. Midnight documentation specifies the proof server as local for Preprod.

Install dependencies:

```powershell
npm ci
```

Copy the environment template when you want to override the defaults:

```powershell
Copy-Item .env.example .env.local
```

Important variables:

```text
VITE_NETWORK_ID=preprod
VITE_DEFAULT_CONTRACT_ADDRESS=a6d78d3f68af39016a32258854cfab473024126eb594f9eff41f57e81b3c7bae
VITE_PUBLIC_INDEXER_URI=https://indexer.preprod.midnight.network/api/v4/graphql
VITE_PUBLIC_INDEXER_WS_URI=wss://indexer.preprod.midnight.network/api/v4/graphql/ws
VITE_ZK_CONFIG_PATH=/zk/trustcart-v1
VITE_PROOF_SERVER_URL=http://127.0.0.1:6300
```

`VITE_PROOF_SERVER_URL` is only a preferred reachable proof-server override. If it is unavailable, TrustCart uses the prover URI returned by the connected wallet.

## Run locally

Start the app:

```powershell
npm run dev
```

Vite prints the local URL. The app opens on the TrustCart landing page. Connect a wallet to enter the live registry; users do not deploy a contract.

## Verification commands

Run the complete local checks:

```powershell
npm run typecheck
npm test
npm run build
```

The test suite covers the Compact contract and UI helpers. The build emits the contract artifacts, API package, ZK assets, and browser bundle.

## Deploy to Vercel

The repository includes `vercel.json` for the Vite workspace app. It builds `ui/dist` and rewrites client-side routes to `index.html`.

Using the Vercel CLI:

```powershell
vercel login
vercel link
vercel --prod
```

The default Preprod contract is compiled into the UI, so no contract deployment is needed during a normal frontend deployment. If you promote a new registry, set `VITE_DEFAULT_CONTRACT_ADDRESS` in the Vercel project environment before rebuilding.

## Privacy and security notes

- Product serials are converted to commitments before verification.
- Private state is stored in the browser and scoped to the wallet and contract.
- The app never asks TrustCart for wallet private keys.
- Wallet signing and transaction submission stay inside the DApp Connector flow.
- Contract state that is intentionally public remains visible through the indexer.
- Recovery backups are encrypted and should be stored offline.
- Preprod is a test network. Do not use it as a production data or funds environment.

## Midnight documentation used

- [Connecting a DApp to a network](https://docs.midnight.network/guides/networks-and-environments#connecting-a-dapp-to-a-network)
- [Environment reference](https://docs.midnight.network/guides/networks-and-environments#environment-reference)
- [Deploying and operating a contract](https://docs.midnight.network/guides/deploy-and-operate)
- [DApp integration](https://docs.midnight.network/sdks/official/wallet-developer-guide#dapp-integration)
- [Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix)

