# Lava E2E Frontend

Standalone testing frontend for the root `e2e/` flows only.

This app does not replace or modify the existing `lava_frontend/`. It is a separate, minimal browser console for:

- creating deposit and redeem orders
- cancelling your own pending orders
- batching pending orders with an env-backed wallet
- viewing the Atrium Lava pool state
- staking the Atrium Lava pool into Atrium
- withdrawing Atrium rewards back to the Lava pool

It intentionally does not expose direct user flows for `e2e/atrium_mainnet/depositToAtrium.ts` or `e2e/atrium_mainnet/withdrawFromAtrium.ts`.

## Run it

1. `cd lava_e2e_frontend`
2. `npm install`
3. copy `.env.example` to `.env.local` and fill the values
4. `npm run dev`

Open `http://localhost:3000`.

## Env

All values are browser-side, so they must use the `NEXT_PUBLIC_` prefix.

- `NEXT_PUBLIC_CARDANO_NETWORK`
- `NEXT_PUBLIC_BLOCKFROST_ID` or `NEXT_PUBLIC_BLOCKFROST_API_KEY`
- `NEXT_PUBLIC_BATCHER_WALLET_MNEMONIC`

Notes:

- The current latest-e2e console targets mainnet.
- Batching uses the env mnemonic directly in the browser, so only use a testing wallet for it.
- Admin actions use the connected wallet like a regular signer, matching the current testing requirement.

## Deploy To Vercel

Recommended project settings:

1. Import the repository into Vercel.
2. Set the Root Directory to `lava_e2e_frontend`.
3. Framework preset should resolve to `Next.js`.
4. Keep the install/build commands as the defaults from `package.json`.
5. Add these Environment Variables for Preview and Production:
   - `NEXT_PUBLIC_CARDANO_NETWORK=mainnet`
   - `NEXT_PUBLIC_BLOCKFROST_ID=...`
   - `NEXT_PUBLIC_BATCHER_WALLET_MNEMONIC=...` only if you intentionally want browser-side batching enabled on the hosted site

Important:

- `NEXT_PUBLIC_*` values are exposed to the browser bundle. Do not put any wallet mnemonic there unless it is a disposable testing wallet you are comfortable making public.
- This app currently targets mainnet data and signs real transactions from the connected wallet.
- The repo root is a monorepo, so the Vercel Root Directory must be `lava_e2e_frontend`.

CLI alternative:

```bash
vercel --cwd lava_e2e_frontend
vercel --cwd lava_e2e_frontend --prod
```
