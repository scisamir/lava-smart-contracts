# Lava Protocol

Lava is a liquid staking protocol built on Cardano. Users deposit supported assets into staking pools and receive liquid staking tokens (stTokens) in return. These tokens represent a proportional claim on the pool's underlying assets and can be freely traded, used as collateral, or deployed in other DeFi protocols while the deposited assets continue earning yield.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [stTokens and Exchange Rates](#sttokens-and-exchange-rates)
3. [Protocol Architecture](#protocol-architecture)
4. [Validators](#validators)
5. [Transaction Flows](#transaction-flows)
6. [Supported Integrations](#supported-integrations)
7. [Security Audit](#security-audit)

---

## How It Works

### Staking (OptIn)

1. A user submits a transaction that creates an order UTxO at the order validator address
2. The UTxO contains the deposit amount and an inline datum specifying the receiver address and the amount to stake
3. An authorized batcher picks up the order and includes it in a batching transaction
4. The pool batching validator calculates how many stTokens the deposit is worth at the current exchange rate and mints them
5. The user receives their stTokens at the receiver address specified in the order

### Unstaking (Redeem)

1. A user creates a redeem order UTxO containing their stTokens
2. A batcher includes it in a batching transaction
3. The batching validator calculates the underlying asset amount owed based on the current exchange rate and burns the stTokens
4. The user receives the underlying asset at their receiver address

### Cancelling an Order

At any point before a batcher processes an order, the original canceller (set in the order datum) can submit a cancel transaction. The full value of the order UTxO is returned to the receiver address.

---

## stTokens and Exchange Rates

stTokens are rebase tokens. Their quantity in your wallet stays constant, but their value relative to the underlying asset increases as rewards accrue to the pool.

The exchange rate is stored in each pool's datum:

```
exchange_rate = (total_underlying * precision_factor) / total_st_assets_minted
```

The `precision_factor` is `100,000`.

### Example Progression

| Time | total_underlying | total_st_assets_minted | exchange_rate | 1 stADA worth |
|------|-----------------|------------------------|---------------|---------------|
| Day 0 | 1,000,000 | 1,000,000 | 100,000 | 1.00 ADA |
| Day 30 | 1,100,000 | 1,000,000 | 110,000 | 1.10 ADA |
| Day 60 | 1,210,000 | 1,000,000 | 121,000 | 1.21 ADA |

The exchange rate only changes when rewards are added to a pool. Batching deposits and redemptions does not affect the rate, which ensures all users in a batch are treated fairly.

### Deposit Calculation

```
stTokens_minted = (deposit_amount * precision_factor) / exchange_rate
```

Example: depositing 100 ADA when the rate is 1.1 (110,000) gives:
`(100 * 100,000) / 110,000 = 90.9 stADA`

### Redemption Calculation

```
underlying_returned = (st_amount * exchange_rate) / precision_factor
```

Example: redeeming 90.9 stADA when the rate is 1.21 (121,000) gives:
`(90.9 * 121,000) / 100,000 = 110 ADA`

---

## Protocol Architecture

The protocol is written in Aiken and targets Plutus v3 on Cardano. It consists of eight validators that work together:

```
                       GLOBAL SETTINGS
                       (configuration)
                             |
         +-------------------+-------------------+
         |                   |                   |
       POOL             REWARDS               STAKE
    (liquidity)         (yield)            (external)
         |                   |                   |
    POOL BATCHING            |              STRIKE DATUM
    (order engine)      MINSWAP SWAP         VERIFIER
         |
    MINTING + ORDER
  (tokens + orders)
```

All validators read configuration from the Global Settings UTxO via reference inputs. This means they share consistent configuration without contending on a single UTxO.

### Authorization Patterns

**Withdrawal-based authorization:** Many validators authorize cross-validator actions by checking that a specific script credential appears in the transaction's withdrawals. For example, the pool validator allows spending when the batching credential is present in withdrawals.

**NFT-based identification:** Each global settings UTxO holds a GSN (Global Settings NFT) and each pool UTxO holds an LPN (Lava Pool NFT). These one-shot NFTs uniquely identify canonical UTxOs.

**Authorized batchers:** Batchers are listed in the global settings datum. They can be verification keys, spend scripts, or withdraw scripts. Only authorized batchers can trigger order processing, reward addition, and external staking operations.

---

## Validators

### global_settings

**File:** `smart_contract/validators/global_settings.ak`

The central configuration hub for the protocol. Holds all protocol-wide settings in a single UTxO identified by the GSN NFT.

**Datum fields:**

| Field | Type | Description |
|-------|------|-------------|
| `admin` | `SignerType` | Admin multisig controlling the protocol |
| `authorized_batchers` | `List<SignerType>` | Addresses permitted to batch orders |
| `allowed_assets` | `List<AssetType>` | Assets that can have staking pools |
| `mint_validator_hash` | `ScriptHash` | Hash of the minting validator |
| `stake_details` | `List<StakeType>` | External staking config per asset |
| `frost_address` | `Address` | FROST threshold signature address for admin operations |
| `authorized_swap_scripts` | `List<ScriptHash>` | Scripts permitted to swap rewards |
| `stake_validator_hash` | `ScriptHash` | Hash of the stake validator |
| `rewards_validator_hash` | `ScriptHash` | Hash of the rewards validator |
| `min_pool_lovelace` | `Int` | Minimum ADA held in each pool UTxO |

**Actions:**

- `CreateGlobalSettings` (mint): Creates the GSN and stores initial configuration. Requires the admin to sign and a one-shot UTxO reference to be spent.
- `UpdateGlobalSettings` (spend): Updates configuration. Requires the admin to sign.

---

### pool

**File:** `smart_contract/validators/pool.ak`

Manages individual staking pools. Each pool is identified by an LPN NFT and tracks the total stTokens in circulation, total underlying assets, and the current exchange rate.

**Datum fields:**

| Field | Type | Description |
|-------|------|-------------|
| `pool_batching_cred` | `Credential` | Credential that can authorize batching |
| `total_st_assets_minted` | `Int` | Total stTokens in circulation for this pool |
| `total_underlying` | `Int` | Total underlying asset held by the pool |
| `exchange_rate` | `Int` | Current exchange rate (precision_factor scaled) |
| `total_rewards_accrued` | `Int` | Cumulative rewards added to this pool |
| `pool_asset` | `AssetType` | The asset this pool accepts |
| `pool_stake_asset_name` | `AssetName` | Name of the stToken (e.g. "stADA") |
| `is_processing_open` | `Bool` | Whether batching is currently allowed |

**Redeemers:**

| Redeemer | Who | Description |
|----------|-----|-------------|
| `ProcessPool` | Batcher | Allows pool spending when the batching credential is in withdrawals |
| `UpdatePoolProcessingState` | Admin | Toggles `is_processing_open` without changing any other state |
| `StakePool` | Batcher | Allows pool spending when the stake validator credential is in withdrawals |
| `AddRewardsPool` | Batcher | Allows pool spending when the rewards validator is spending with `AddRewards` |
| `ClaimAdaRewards` | Batcher | Adds ADA rewards directly from an ADA-only UTxO |

**Pool creation:** The pool's `mint` endpoint creates a new pool. It requires admin authorization, validates the initial datum (exchange rate must be `precision_factor`, all counters must be zero), and ensures the pool holds exactly 5 ADA and one LPN token.

---

### pool_batching

**File:** `smart_contract/validators/pool_batching.ak`

The core order processing engine. Runs as a withdrawal validator and processes multiple user orders in a single transaction.

**Redeemer fields:**

| Field | Type | Description |
|-------|------|-------------|
| `batcher_index` | `Int` | Index into `authorized_batchers` in global settings |
| `batching_asset` | `AssetType` | The asset being processed in this batch |

**Processing logic:**

1. Reads the pool input and extracts the current exchange rate and totals
2. Iterates over all order inputs (any input that is not the pool or batcher)
3. For each OptIn order: calculates stTokens owed, verifies an output exists at the receiver address with the correct value
4. For each Redeem order: calculates underlying owed, verifies an output exists at the receiver address with the correct value
5. Validates the pool output has the updated totals
6. Validates the net mint amount matches the stToken minting field

The exchange rate is not changed during batching. It only changes through the rewards flow.

---

### minting

**File:** `smart_contract/validators/minting.ak`

Controls minting and burning of stTokens. It delegates the actual accounting to the pool batching validator and only checks that:

1. Its own policy ID matches the `mint_validator_hash` stored in global settings
2. The pool batching credential is present in the transaction's withdrawals

---

### order

**File:** `smart_contract/validators/order.ak`

Holds user orders until they are processed or cancelled.

**Datum fields:**

| Field | Type | Description |
|-------|------|-------------|
| `order_type` | `OptIn` or `Redeem` | Type of order with associated amount |
| `receiver_address` | `Address` | Where to send the result |
| `canceller` | `SignerType` | Who is allowed to cancel this order |
| `pool_stake_asset_name` | `AssetName` | Which pool this order targets |

**Redeemers:**

- `CancelOrder`: Allows the canceller to reclaim the full UTxO value. Only one order can be cancelled per transaction.
- `ProcessOrder`: Allows spending when the pool batching credential is present in withdrawals.

The spend endpoint uses the withdraw-0 pattern: it checks that the order's own credential appears in withdrawals, and the withdraw endpoint does the actual validation.

---

### rewards

**File:** `smart_contract/validators/rewards.ak`

Handles adding yield back into pools, either by depositing reward tokens directly or by routing them through a swap before deposit.

**Redeemers:**

- `AddRewards { asset, batcher_index }`: Spends a reward UTxO and deposits its contents into the corresponding pool. Recalculates the exchange rate and updates the pool datum.
- `SwapRewards`: Allows the reward UTxO to be spent by an authorized swap script (for example, Minswap) to convert the reward tokens before depositing.

---

### stake

**File:** `smart_contract/validators/stake.ak`

Moves pool assets to external staking protocols (such as Strike) to generate yield. It validates that:

- The stake asset matches the pool asset
- All underlying assets are sent to the correct staking address defined in `stake_details`
- The pool UTxO is returned with its datum unchanged, holding only the LPN and minimum ADA
- The Strike datum verifier validator runs to validate the staking datum

---

### stake datum validators

Located in `smart_contract/validators/stake_datums/`, these validators verify integration-specific staking requirements:

| Validator | Protocol |
|-----------|---------|
| `strike.ak` | Strike protocol |
| `iag.ak` | IAG token staking |
| `atrium.ak` | Atrium protocol |
| `palm.ak` | Palm protocol |
| `min.ak` | Minswap protocol |

The Strike validator checks that exactly two Strike NFTs are minted, the owner address matches the FROST multisig address from global settings, and the mint policy ID matches the Strike script hash.

---

### swap validators

Located in `smart_contract/validators/swap_validators/`:

- `minswap_swap.ak`: Creates a swap order at the Minswap DEX. Validates the reward UTxO contents, the order output datum, receiver addresses, LP asset, and batcher fee. Both the refund and success receiver addresses must point back to the rewards validator so swapped tokens are automatically available for the `AddRewards` flow.

---

## Transaction Flows

### Pool Creation

```
Inputs:  Admin wallet UTxO
Outputs: Pool UTxO (5 ADA + 1 LPN, initial PoolDatum)
Mint:    1 LPN
Ref:     Global Settings UTxO
Signers: Admin multisig
```

### Order Processing (Batching)

```
Inputs:  Pool UTxO, Order UTxO x N, Batcher UTxO
Outputs: Updated Pool UTxO, User outputs x N, Batcher change
Mint:    Net stToken amount (positive for net OptIn, negative for net Redeem)
Ref:     Global Settings UTxO
Withdrawals:
  - pool_batching_cred: 0
  - each order credential: 0
Redeemers:
  - Pool spend: ProcessPool
  - Pool batching withdraw: BatchingRedeemer
  - Each order withdraw: ProcessOrder
```

### External Staking to Strike

```
Inputs:  Pool UTxO (with underlying assets)
Outputs: Pool UTxO (LPN + min ADA only, datum unchanged)
         Strike staking output at stake_address
Mint:    2 Strike NFTs
Ref:     Global Settings UTxO
Withdrawals:
  - stake_validator: 0
  - strike_validator (datum_verifier_hash): 0
Redeemers:
  - Pool spend: StakePool
  - Stake withdraw: StakeRedeemer
  - Strike withdraw: StakeStrike
```

### Reward Swap via Minswap

```
Inputs:  Rewards UTxO (tokens to swap)
Outputs: Minswap Order UTxO (refund_receiver and success_receiver = rewards_address)
Ref:     Global Settings UTxO
Withdrawals:
  - minswap_swap: 0
Redeemers:
  - Rewards spend: SwapRewards
  - Minswap withdraw: SwapRedeemer
```

After the Minswap batcher executes the swap, the swapped tokens land at the rewards validator address and are ready for the `AddRewards` flow.

### Adding Rewards to Pool

```
Inputs:  Pool UTxO, Rewards UTxO
Outputs: Updated Pool UTxO (total_underlying and exchange_rate increased)
Ref:     Global Settings UTxO
Redeemers:
  - Pool spend: AddRewardsPool
  - Rewards spend: AddRewards
```

---

## Supported Integrations

| Protocol | Type | Purpose |
|----------|------|---------|
| Strike | External staking | Earns yield on deposited assets |
| IAG | External staking | Earns yield on IAG tokens |
| Atrium | External staking / DEX | Staking and reward swapping |
| Palm | External staking | Earns yield on Palm tokens |
| Minswap | DEX | Swaps non-native reward tokens back to pool asset |

---

## Security Audit

The Lava smart contracts were audited by UTxO Company. The audit covered the commit range from `81b072a` to `71d37a5` and examined all 21 validator and library files.

**Audit date:** March 23, 2026

**Finding summary:**

| Severity | Count | Resolved |
|----------|-------|---------|
| Critical | 13 | 13 |
| Major | 4 | 3 |
| Minor | 4 | 4 |
| Informational | 15 | 14 |

All critical and minor findings were resolved before mainnet. One major and one informational finding were acknowledged and left for a future update.

---

### Critical Findings

**LAVA-001: Pool NFT Name Collision Allows Cross-Pool Asset Theft**

All pools were minted with the same NFT name (`lava_pool_nft_name`), making it impossible to distinguish between multiple pools for the same asset. This could enable reward theft and misdirected unstaking.

Resolution: Implemented unique pool identification using UTxO reference parameterization.

---

**LAVA-002: Dead Code Path in Pool Withdraw Handler**

The `withdraw` handler in the pool validator was unreachable. No redeemer authorized a simultaneous pool spend and withdrawal, creating a circular dependency that broke ADA reward collection entirely.

Resolution: Added a `ClaimAdaRewards` redeemer case. (commit e334b28)

---

**LAVA-003: Unfinished Protocol Implementation**

The codebase contained an always-success script marker in test infrastructure, indicating incomplete functionality and raising concerns about protocol readiness.

Resolution: Resolved prior to mainnet deployment.

---

**LAVA-004: Pool Staking Delegation Impossible**

The pool validator had no mechanism to delegate its staking credentials, preventing pool registration and native Cardano staking rewards on pool holdings.

Resolution: Added a `publish` handler to authorize stake certificate registration and delegation. (commit e334b28)

---

**LAVA-005: ADA Pool Unit Mismatch Causes Value Discrepancy**

In the pool batching validator, `updated_total_underlying` was stored in ADA units but passed to `assets.add` expecting lovelace units, creating a 1,000,000x discrepancy. A 10 ADA deposit would only add 10 lovelace to the pool value.

Resolution: ADA unit values are multiplied by 1,000,000 before constructing pool value.

---

**LAVA-006: Missing Pool Input Lovelace in ADA Reward Addition**

The rewards validator's `AddRewards` handler for ADA pools omitted the pool input's lovelace when calculating the expected pool output value, causing all ADA reward transactions to fail validation.

Resolution: Pool input lovelace is now included in the ADA path calculation.

---

**LAVA-007: Circular Value Comparison Prevents ADA Pool Output Discovery**

Pool output filtering contained a circular dependency. The expected pool value was calculated using `lovelace_of(output.value)` inside the filter and then compared against that same output's value, making the condition unsatisfiable for any non-zero base value.

Resolution: Pool output lovelace is no longer added inside the filter callback.

---

**LAVA-008: Incorrect Reward Amount Calculation in Pool Datum Update**

The reward calculation formula produced a wrong result:

```
rewards_accrued = new_pool_amount - total_underlying
updated_total_underlying = total_underlying + rewards_accrued = new_pool_amount
```

This meant `updated_total_underlying` reflected only the reward amount, erasing all existing pool assets and potentially causing total loss of user funds.

Resolution: Rewards are treated as additive. `reward_amount` is derived directly and added to `total_underlying`. (commit 46086b1)

---

**LAVA-009: Incorrect ADA Asset Name Check Breaks All ADA Pool Functionality**

Six locations in the codebase checked for the asset name `"lovelace"` to detect ADA, but on-chain ADA uses an empty string `""` for both its policy ID and asset name. This broke every code path that handled ADA pools.

Affected files and lines:
- `rewards.ak:60`
- `pool_batching.ak:204`
- `order.ak:81`
- `stake.ak:72`
- `lib/lava/utils.ak:150`
- `validators/swap_validators/minswap.ak:26`

Resolution: All checks changed from `"lovelace"` to `""`.

---

**LAVA-010: Batcher Can Direct Rewards to Arbitrary Pool via Redeemer**

The `AddRewards` redeemer allowed the batcher to specify which pool receives rewards through a `pool_nft_name` field. A malicious batcher could redirect rewards from one pool to another.

Resolution: Reward destination is now enforced based on the origin, not the redeemer. (commit ee894f3)

---

**LAVA-011: Double Satisfaction from Multiple Reward Inputs**

The rewards validator was vulnerable to double satisfaction. When two reward inputs with the same value were included, only one was credited to the pool while the batcher could pocket the second.

Resolution: Transaction structure validation prevents spending multiple reward inputs simultaneously. (commit 84ae54f)

---

**LAVA-012: Fragmented Reward UTxOs Locked Until Consolidation**

The rewards validator required the pool output amount to be greater than or equal to `total_underlying`. If staked assets were returned in multiple UTxOs each smaller than `total_underlying`, they became permanently locked because none individually satisfied the condition and the validator could not self-consolidate.

Resolution: `reward_amount` is derived from the reward input and added to `total_underlying` to compute `expected_pool_amount`, allowing incremental processing. (commit 46086b1)

---

**LAVA-013: Strike Validator Missing Minting Policy Parameterization**

The Strike validator extracted the policy ID from the stake output's payment credential at runtime instead of parameterizing it at compile time like the IAG and Atrium validators do. This is less secure because the policy ID is not cryptographically enforced.

Resolution: Minting policy parameterization added. (commit 636e9a9)

---

### Major Findings

**LAVA-101: Incorrect Rewards Accrued Calculation for Off-Chain Tracking**

The `total_rewards_accrued` field used the same incorrect subtraction formula as LAVA-008, producing wrong values. While not used in on-chain validation, this broke off-chain analytics and yield reporting.

Resolution: Fixed alongside LAVA-008. (commit 46086b1)

---

**LAVA-102: Batch Order Burning Restricted to Single Order**

The `BurnOrder` redeemer checked `list.length(burn_tokens) == burned_order_count`, which only evaluated to true when burning a single order. Burning five orders would produce `burn_tokens` of length 1 but `burned_order_count` of 5, causing the check to fail and forcing users to cancel one order at a time.

Resolution: The check was simplified to verify that the minted amount is negative. (commit 64eb9d6)

---

**LAVA-103: Atrium Validator Accepts Arbitrary Asset Names During Minting**

The Atrium validator verified that tokens were minted from the correct policy ID but used a wildcard pattern for the asset name, allowing tokens with any name to satisfy the check.

Resolution: Asset name validation added. (commit 708d46a)

---

**LAVA-104: IAG Validator Accepts Arbitrary Asset Names During Minting**

The same wildcard asset name issue as LAVA-103 affected the IAG validator.

Status: Acknowledged. Not resolved at time of audit completion.

---

### Minor Findings

**LAVA-201: Pool Value Comparison Vulnerable to Network Parameter Changes**

`UpdatePoolProcessingState` used strict equality to compare pool values. If Cardano's minimum UTxO ADA parameter were increased through governance, the strict check would prevent adding the required extra ADA, potentially locking the pool.

Resolution: Replaced with a minimum threshold check.

---

**LAVA-202: Order UTxO Susceptible to DDoS via Datum Spam**

The order validator did not enforce that an order NFT was present on order UTxOs. Anyone could flood the order address with invalid datums or underfunded orders that would only fail during batching, wasting batcher fees.

Resolution: Order NFT minting policy now validates correct amounts, and the NFT is burned on processing or cancellation. (commit e334b28)

---

**LAVA-203: Order NFT UTxO Reference Not Verified in Inputs**

The order NFT minting derived the asset name from a UTxO reference in the redeemer without verifying that UTxO was actually consumed. This broke the one-shot NFT uniqueness guarantee.

Resolution: A `find_input` check now verifies the referenced UTxO is consumed. (commit e334b28)

---

**LAVA-204: Order Token Burn Not Verified on Cancel**

`CancelOrder` calculated the expected output without the order NFT but never verified the NFT was actually burned. An attacker could keep the NFT by sending it to a different output.

Resolution: The mint field is now checked to confirm NFT burn during cancellation. (commit 13f152a)

---

### Informational Findings

| ID | Issue | Status |
|----|-------|--------|
| LAVA-301 | `1 * precision_factor` expression wastes execution units; should be `precision_factor` | Resolved |
| LAVA-302 | Strict equality with `min_pool_lovelace` on pool creation is fragile to parameter changes | Resolved |
| LAVA-303 | `pairs.get_all` used for single element; `pairs.get_first` is more efficient | Resolved |
| LAVA-304 | Both spend and withdraw handlers execute per order, doubling execution overhead | Resolved |
| LAVA-305 | O(n) order input filtering; passing indices via redeemer would give O(1) access | Acknowledged |
| LAVA-306 | `admin_sc` parameter duplicates datum's admin field, adding unnecessary complexity | Resolved |
| LAVA-307 | `GlobalSettingsRedeemer` type is redundant when script purpose already determines action | Resolved |
| LAVA-308 | `validate_settings_input` performs checks already guaranteed by the one-shot GSN NFT | Resolved |
| LAVA-309 | Three-step filter/length/index pattern can be replaced with direct pattern matching | Resolved |
| LAVA-310 | Manual destruction and reconstruction of all nine datum fields adds maintenance burden | Resolved |
| LAVA-311 | Expected pool value is constructed inside a filter callback, executing per output | Resolved |
| LAVA-312 | Unique order NFT names require iteration to find burns; empty name with UTxO uniqueness is simpler | Resolved |
| LAVA-313 | `rewards_accrued` intermediate variable and its subtraction/addition are mathematically redundant | Resolved |
| LAVA-314 | Duplicate entries in `pool_stake_asset_name` list can route stakes to the wrong validator | Resolved |
| LAVA-315 | Variable named `iag_datum` in Atrium validator (copy-paste error) | Resolved |

---

## Constants Reference

| Constant | Value | Description |
|----------|-------|-------------|
| `precision_factor` | 100,000 | Scaling factor for exchange rate math |
| `global_settings_nft` | `0x47534e` ("GSN") | Asset name of the Global Settings NFT |
| `lava_pool_nft_name` | `0x4c504e` ("LPN") | Asset name of Lava Pool NFTs |
| `min_pool_lovelace` | 5,000,000 | Minimum ADA held in each pool UTxO (5 ADA) |

---

## Deployment Order

Validators must be deployed in this order because each depends on the hash of previously deployed validators:

1. `global_settings` (produces `gs_validator_hash`)
2. `pool` (needs `gs_validator_hash`, produces `pool_validator_hash`)
3. `pool_batching` (needs `gs_validator_hash` and `pool_validator_hash`, produces `pool_batching_cred`)
4. `minting` (needs `pool_batching_cred` and `gs_validator_hash`)
5. `order` (needs `pool_batching_cred`)
6. `rewards` (needs `gs_validator_hash` and `pool_validator_hash`)
7. `stake` (needs `gs_validator_hash` and `pool_validator_hash`)
8. Create the Global Settings UTxO with all validator hashes populated in the datum

Changing the `utxo_ref` parameter of `global_settings` changes its hash, which cascades to change the hash of every downstream validator.

---

## Authorized Operations Summary

| Operation | Authorization | Validator |
|-----------|--------------|-----------|
| Create global settings | Admin multisig | `global_settings` |
| Update global settings | Admin multisig | `global_settings` |
| Create pool | Admin multisig | `pool` (mint) |
| Toggle processing state | Admin multisig | `pool` |
| Process orders | Authorized batcher | `pool_batching` |
| Add rewards | Authorized batcher | `rewards` |
| Stake to external protocol | Authorized batcher | `stake` |
| Swap rewards via DEX | Authorized swap script | `rewards` + `minswap_swap` |
| Create order | Anyone | `order` (output creation) |
| Cancel order | Order canceller (set in datum) | `order` |
