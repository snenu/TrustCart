# TrustCart preprod deployment

## Local verification

```powershell
npm ci
npm run compile
npm run typecheck
npm test
npm run build
npm run dev
```

The browser app expects a compatible Midnight DApp Connector wallet, a funded preprod account, and a reachable local proof server at `http://127.0.0.1:6300` unless `VITE_PROOF_SERVER_URL` is overridden.

## First deployment

1. Copy `.env.example` to `.env.local` and confirm the network is `preprod`.
2. Start the proof server and unlock the Midnight wallet on preprod.
3. Open the app, connect the wallet, and deploy a fresh contract. The current contract schema is v2; old TrustCart addresses are intentionally not auto-reused.
4. Save the deployed contract address and export a TrustCart recovery backup from Settings.
5. Test manufacturer registration, product registration, seller authorization, sale recording, public verification, transfer request, buyer acceptance, warranty management, and reload recovery.

Never commit `.env.local`, private keys, recovery passphrases, or generated private-state databases.
