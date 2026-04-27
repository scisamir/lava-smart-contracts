# Lava Smart Contracts

This directory contains all on-chain Aiken validators used by the Lava protocol.
The contracts are in `validators/` and shared types/helpers are in `lib/lava/`.

## High-level Architecture

The protocol is centered around a `global_settings` UTxO (identified by the `GSN`
NFT) that other validators read as a reference input.

Main roles:

- `global_settings`: protocol configuration and admin authority.
- `pool`: pool NFT minting and pool-state transitions.
- `order` + `pool_batching` + `minting`: user order lifecycle and stake-token
  mint/burn.
- `stake` + `stake_datums/*`: moving pool assets into external staking systems.
- `rewards` + `swap_validators/*`: receiving rewards and swapping them back into
  pool assets.

## Shared Data Model (Important Types)

Defined in `lib/lava/types.ak`:

- `GlobalSettingsDatum`
  - admin signer
  - authorized batchers
  - allowed pool assets
  - stake token minting policy hash
  - stake detail list (`stake_details`)
  - frost address
  - authorized swap script hashes
  - stake validator hash
  - minimum pool lovelace
- `StakeType`
  - pool asset
  - pool stake asset name
  - external stake address
  - external datum-verifier hash
  - rewards validator hash
- `PoolDatum`
  - batching credential
  - total stake supply / underlying
  - exchange rate
  - total rewards accrued
  - pool asset
  - pool stake asset name
  - processing-open flag

## Contract Reference

### 1) `validators/global_settings.ak` (`global_settings`)

Purpose:
- Owns protocol configuration in a single UTxO containing the `GSN` NFT.

Entrypoints:
- `mint`: creates the first settings UTxO.
- `spend`: updates settings.

Key checks:
- `mint` requires:
  - the configured seed `utxo_ref` is spent,
  - exactly one `GSN` NFT is minted,
  - the output at own script holds only `GSN` (plus lovelace),
  - admin signer authorization.
- `spend` requires:
  - exactly one settings output back to own script with the same `GSN` asset,
  - admin signer authorization,
  - if admin changes, both old and new admin authorize.

### 2) `validators/pool.ak` (`pool_validator`)

Purpose:
- Creates pool NFTs and validates pool state transitions.

Entrypoints:
- `mint` with `CreatPoolRedeemer`: create a pool NFT and initial pool UTxO.
- `spend` with:
  - `ProcessPool`
  - `UpdatePoolProcessingState`
  - `StakePool`
  - `AddRewardsPool`
  - `ClaimAdaRewards`
- `withdraw`: finalizes ADA reward claims into pool accounting.
- `publish`: admin-gated certificate action.

Key checks:
- Pool NFT name must be derived from the seed UTxO.
- Pool output must carry the pool NFT and at least minimum lovelace at creation.
- Pool asset must be in `allowed_assets`.
- Processing-state toggles are admin-authorized.
- `StakePool` requires withdrawal by configured `stake_validator_hash`.
- `AddRewardsPool` links pool stake name -> `stake_details` -> expected
  `rewards_validator_hash`, then enforces `AddRewards` redeemer on that rewards
  spend.
- ADA reward claim path updates pool totals/exchange rate consistently.

### 3) `validators/order.ak` (`order_validator`)

Purpose:
- Handles order NFT minting/burning and order spend rules.

Entrypoints:
- `mint` with:
  - `MintOrder`
  - `BurnOrder`
- `spend` with:
  - `CancelOrder`
  - `ProcessOrder`

Key checks:
- On `MintOrder`, exactly one order NFT is minted to an order UTxO.
- `pool_stake_asset_name` in order datum must map to a stake detail in global
  settings.
- Value rules differ by order type:
  - `OptIn`: deposit amount constraints for pool asset.
  - `Redeem`: required stake-token amount for that pool stake asset name.
- `CancelOrder` requires order NFT burn and output to receiver.
- `ProcessOrder` requires pool batching withdrawal credential.

### 4) `validators/pool_batching.ak` (`pool_batching`)

Purpose:
- Processes many orders against one pool in a single batching transaction.

Entrypoint:
- `withdraw` with `BatchingRedeemer`.

Key checks:
- Authorized batcher must sign.
- Exactly one pool input is processed.
- Only non-batcher, non-pool inputs are treated as orders.
- Each order must have `pool_stake_asset_name` matching pool datum.
- Pool totals are updated from order math using current exchange rate.
- Number of order inputs must equal number of burned order NFTs.
- If net stake token supply changes, mint/burn under `mint_validator_hash` must
  match expected quantity and pool stake asset name.
- Pool output value and datum must match computed post-batch state.

### 5) `validators/minting.ak` (`minting`)

Purpose:
- Policy guard for mint/burn of pool stake tokens.

Entrypoint:
- `mint`.

Key checks:
- Current policy id must equal `mint_validator_hash` from global settings.
- Pool batching credential withdrawal must be present.

### 6) `validators/stake.ak` (`stake_validator`)

Purpose:
- Moves pool-held assets into external staking contracts.

Entrypoint:
- `withdraw` with `StakeRedeemer`.

Key checks:
- Authorized batcher index must be valid and signer present.
- Exactly one pool input is processed.
- Pool datum stake name selects one `StakeType` in global settings.
- Selected stake detail provides:
  - required external stake address,
  - required external datum-verifier hash.
- Net asset decrease from pool must equal net asset increase at selected stake
  address.
- Withdrawal from selected datum-verifier hash must be present.

### 7) `validators/rewards.ak` (`rewards_validator`)

Purpose:
- Controls spending of rewards UTxOs and reintegration to pools.

Entrypoint:
- `spend` with `RewardsRedeemer`:
  - `AddRewards`
  - `SwapRewards`

Key checks:
- `AddRewards` path:
  - authorized batcher required,
  - only one rewards input from this rewards address in tx,
  - rewards input datum must be absent,
  - rewards input must contain only the declared reward asset (plus lovelace),
  - one matching pool input/output with consistent accounting updates,
  - pool NFT in pool input must match validator parameter `pool_nft_name_param`.
- `SwapRewards` path:
  - requires a withdrawal by at least one script in
    `authorized_swap_scripts` from global settings.

### 8) `validators/swap_validators/minswap.ak` (`minswap_swap`)

Purpose:
- Authorizes swap transactions that route rewards into a Minswap order UTxO.

Entrypoint:
- `withdraw` with `SwapRedeemer`.

Key checks:
- Requires exactly one rewards input at the configured rewards script address.
- Rewards input must be "single-asset" for `swap_from_asset`.
- Requires exactly one Minswap order output with matching asset quantity.
- Minswap order datum must:
  - use rewards address for refund/success,
  - have no datum receivers and no expiry,
  - match `lp_asset` and `max_batcher_fee` from redeemer.

### 9) `validators/swap_validators/atrium_swap.ak` (`atrium_swap`)

Purpose:
- Authorizes Atrium reward-conversion transactions.

Entrypoint:
- `withdraw` (Void redeemer).

Key checks:
- Exactly one reward input at configured reward address.
- Exactly one Atrium input and one Atrium output identified by stake-pool token.
- All diffusion tokens in reward input are burned.
- Reward output at reward address has no datum and receives lovelace difference
  from Atrium input/output delta.

### 10) `validators/stake_datums/min.ak` (`min`)

Purpose:
- Verifies correct datum/output shape for MIN external staking integration.

Entrypoint:
- `withdraw` with `ExternalStakeRedeemer`.

Key checks:
- Redeemer pool stake name must resolve to exactly one stake detail.
- Stake output must go to selected stake address.
- Stake output inline datum must match configured MIN parameters:
  - reward address equals `frost_address`,
  - fixed marker integer,
  - expected custom asset type,
  - expected staking period.

### 11) `validators/stake_datums/iag.ak` (`iag`)

Purpose:
- Verifies IAG delegation output and mint behavior.

Entrypoint:
- `withdraw` with `ExternalStakeRedeemer`.

Key checks:
- Stake output must go to selected IAG stake address.
- Delegation datum keeper must match `frost_address` verification key hash.
- Mint under IAG policy must be present and positive.

### 12) `validators/stake_datums/palm.ak` (`palm`)

Purpose:
- Verifies Palm staking proxy guard mint and output destination.

Entrypoint:
- `withdraw` with `ExternalStakeRedeemer`.

Key checks:
- Stake output must go to selected Palm stake address.
- Exactly one guard token with expected token name must be minted under Palm
  policy.

### 13) `validators/stake_datums/strike.ak` (`strike`)

Purpose:
- Verifies Strike stake output datum and mint requirements.

Entrypoint:
- `withdraw` with `ExternalStakeRedeemer`.

Key checks:
- Stake output must go to selected Strike stake address.
- Two Strike-policy token mints must both be positive one-unit mints.
- Strike datum owner hash must match `frost_address` key hash.
- Datum mint policy id must equal stake script hash and configured Strike policy.

### 14) `validators/stake_datums/atrium.ak` (`atrium`)

Purpose:
- Verifies Atrium staking deposit shape and diffusion mint routing.

Entrypoint:
- `withdraw` with `ExternalStakeRedeemer`.

Key checks:
- Stake detail selects exact Atrium stake address.
- Exactly one Atrium input and output carrying stake-pool token.
- Atrium mint under configured policy must be positive and for diffusion token.
- Reward output to configured reward address must carry exactly minted diffusion
  amount and have no datum.
- Atrium output lovelace must increase relative to Atrium input.

## Typical End-to-End Flows

### A) Create and configure protocol

1. `global_settings.mint` creates the settings UTxO with `GSN`.
2. Admin later updates config using `global_settings.spend`.

### B) Create pool and process user orders

1. `pool_validator.mint` creates pool NFT and initial pool UTxO.
2. Users create/cancel orders through `order_validator`.
3. Batcher processes orders with `pool_batching.withdraw`.
4. Stake-token mint/burn is authorized by `minting.mint`.

### C) Stake pool funds externally

1. `pool_validator.spend(StakePool)` authorizes stake phase.
2. `stake_validator.withdraw` validates movement from pool to external stake
   address.
3. Chosen external integration validator in `stake_datums/*` validates its own
   datum/mint invariants.

### D) Handle rewards

1. Rewards UTxO is spent via `rewards_validator`:
   - `AddRewards` path returns value into pool with accounting updates.
   - `SwapRewards` path allows conversion via authorized swap script.
2. Swap-specific validator (`minswap_swap` or `atrium_swap`) validates the swap
   transaction shape.

## Local Development

Build:

```sh
aiken build
```

Run tests:

```sh
aiken check
```

Run a subset:

```sh
aiken check -m <pattern>
```

Generate docs:

```sh
aiken docs
```
