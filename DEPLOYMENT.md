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

The browser app expects a compatible Midnight DApp Connector wallet, a funded preprod account, and a reachable local proof server at `http://127.0.0.1:6300` unless `VITE_PROOF_SERVER_URL` is overridden. Users do not deploy contracts: the app automatically connects to the configured registry after wallet connection. The current Preprod registry is also built into the UI as a public fallback, while `VITE_DEFAULT_CONTRACT_ADDRESS` can override it for a future deployment.

## Registry deployment

1. Copy `.env.example` to `.env.local` and confirm the network is `preprod`.
2. Keep `VITE_DEFAULT_CONTRACT_ADDRESS` set to the deployed TrustCart registry. The current Preprod registry is `a6d78d3f68af39016a32258854cfab473024126eb594f9eff41f57e81b3c7bae`.
3. Start the proof server and unlock the Midnight wallet on preprod.
4. Open the app and connect the wallet. TrustCart joins the configured registry automatically; users never see the deployment flow.
5. Export a TrustCart recovery backup from Settings, then test manufacturer registration, product registration, seller authorization, sale recording, public verification, transfer request, buyer acceptance, warranty management, and reload recovery.

The developer setup fallback still supports deploying or connecting another registry when `VITE_DEFAULT_CONTRACT_ADDRESS` is empty. A fresh deployment should be treated as an administrator operation, then its address should be promoted into the environment configuration.

Never commit `.env.local`, private keys, recovery passphrases, or generated private-state databases.
