# TrustCart roadmap

There was no roadmap document in the repository before now, so this file records
the shipped waves and what remains. The deployed registry is a fixed Preprod
contract, so every wave below is an off-chain (UI/API/scripts) improvement
unless a new deployment is promoted.

## Wave 1 — shipped (original build)

- Compact contract: manufacturers, sellers, products, sales, warranties,
  ownership transfer (request / accept / cancel), product status, warranty
  extend/cancel — all proven with zk circuits.
- React dapp: landing page, wallet connection, dashboard (overview, verify,
  manufacture, sell, ownership, settings).
- Encrypted browser private state with an encrypted recovery backup export.
- Public verifier that never needs a wallet.
- Preprod registry deployed and promoted into the UI as the default registry.
- Contract tests (12) and UI helper tests (6).

## Wave 2 — shipped (this pass: "make it fully working end to end")

### Correctness and completeness

- **Cancel a pending transfer.** `cancelOwnershipTransfer` existed in the
  contract and API but had no UI. An owner who pasted the wrong receiving code
  could previously never unregister the pending transfer. The My ownership tab
  now lists every transfer in flight and can cancel it.
- **Pending transfers no longer hide your product.** Products with an in-flight
  transfer were filtered out of your owned list until the buyer accepted; your
  product now stays visible the entire time.
- **Fresh-clone and hosted builds fixed.** `api/` and the contract tests import
  `contract/managed/trustcart/contract` (compiled bindings), which was
  gitignored — a fresh clone and every Vercel build failed to resolve it. The
  small runtime bindings are now committed, while the 34 MB ZK keys stay
  regenerated locally; `copy-zk-artifacts.mjs` now falls back to the committed
  keys in `ui/public/zk/trustcart-v1` instead of hard-crashing.
- **Registry verified on Vercel:** `npm ci && npm run build:ui` only needs the
  committed bindings and committed ZK artifacts.

### UI/UX improvements

- **Registry sync indicator** in the top bar (`SYNCED hh:mm:ss`) so it is
  obvious when a submission has reached the indexer.
- **Disconnect wallet** button in the top bar.
- **Click-to-fill product rows** — catalog/inventory/owned products fill the
  product ID fields for status, warranty, sale, and transfer forms.
- **Transfer-in-flight chip on your passport** with warranty expiry dates and
  richer verify results (batch, ownership version, transfer count).
- **Explorer links** on every successful transaction toast (1am Preprod
  explorer), with a longer toast lifetime for linked messages.
- **Friendly circuit errors:** every circuit assert message (`seller not
  found`, `ownership proof failed`, `another ownership transfer is already
  pending`, …) now maps to actionable guidance.
- **Input validation with inline hints** for receiving codes (exact 64 hex)
  before a proof is ever generated; sale flow clears the buyer code after use;
  product registration clears the serial.
- **Sellable inventory card** in the seller desk listing unsold active
  products of the store's brand.
- **Public verifier:** Enter-key submit, subscription cleanup (no leaked
  indexer subscriptions), registry stats in the completion message, and a
  realistic address placeholder.
- **Accessibility:** focus-visible rings, `aria-current` navigation state, live
  region for toasts, labeled verifier inputs, `og:`/`twitter:` meta tags.
- Dependency hygiene: removed the unused `qrcode` runtime + types.

## Wave 3 — proposed next

- Recovering ownership after restore: guided flow that walks a restored wallet
  through re-verifying its owned products against the registry.
- Warranty claims: a private "claim at the repair desk" proof for warranty
  service, independent of the current owner wallet.
- Batch product registration (CSV, one proof per product) for manufacturers
  with large catalogs.
- Marketplace surfaces: public listing of unsold, verifiable passports with
  seller reputation from `salesCount`.
- Notifications: WebSocket-driven toasts when an incoming transfer appears.
- Product audit trail view: full public event history per product ID.
- Split the 1.3 MB main chunk (`manualChunks`) and lazy-load the dashboard.

## Verification checklist for any change

```powershell
npm run typecheck
npm test
npm run build
npm run dev
```

Then exercise the flows against the Preprod registry: register manufacturer →
register product → register seller → authorize → record sale → public verify →
transfer request → accept → warranty extend/cancel → backup/restore → reload.
