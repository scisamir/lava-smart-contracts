# Lava protocol flow

## State and authority

```mermaid
flowchart LR
    Admin["Admin multisig — 2 of 2"]
    User["User wallet"]
    Batcher["Authorized batcher"]

    GS[("Global Settings UTxO<br/>GSN + GlobalSettingsDatum")]
    Pool[("Pool UTxO<br/>Pool NFT + PoolDatum")]
    Orders[("Order UTxOs<br/>Order NFT + OrderDatum")]
    Rewards[("Rewards UTxOs<br/>one reward asset, no datum")]

    Admin -->|create or update| GS
    Admin -->|create pool or toggle batching| Pool
    User -->|create or cancel| Orders
    Batcher -->|process orders| Orders
    Batcher -->|update liquidity| Pool
    Batcher -->|reintegrate yield| Rewards

    GS -.->|reference input| Pool
    GS -.->|reference input| Orders
    GS -.->|reference input| Rewards
```

`globalSettingsSeed` fixes the Global Settings script hash. That hash feeds every
downstream validator. `poolReference` and `batchingReference` are storage UTxOs
for reference scripts; they are not protocol state.

## Order lifecycle

```mermaid
flowchart LR
    User["User wallet"]
    Batcher["Authorized batcher"]
    GS[("Global Settings UTxO")]
    PoolIn[("Pool UTxO")]

    OptIn["Create OptIn order<br/>lock underlying asset"]
    Redeem["Create Redeem order<br/>lock L-tokens"]
    Order[("Order UTxO<br/>Order NFT + inline datum")]

    Cancel["Cancel transaction<br/>CancelOrder + BurnOrder"]
    Refund["Remaining order value<br/>returned to receiver"]

    Batch["Batch transaction — atomic<br/>Pool: ProcessPool<br/>Orders: ProcessOrder<br/>Pool batching: withdrawal<br/>Order policy: burn NFTs<br/>L-token policy: mint or burn"]
    PoolOut[("Updated Pool UTxO")]
    Settlement["User settlement<br/>L-tokens or underlying asset"]

    User --> OptIn
    User --> Redeem
    GS -.->|reference input| OptIn
    GS -.->|reference input| Redeem
    OptIn --> Order
    Redeem --> Order

    User --> Cancel
    Order --> Cancel
    Cancel --> Refund

    Batcher --> Batch
    GS -.->|reference input| Batch
    PoolIn --> Batch
    Order --> Batch
    Batch --> PoolOut
    Batch --> Settlement
```

The exchange rate uses a precision factor of `100000`:

- Opt-in: `L-token amount = deposit × 100000 / exchange rate`
- Redeem: `underlying amount = L-token amount × exchange rate / 100000`

The frontend action labelled **Unstake** creates a `Redeem` order. It is not an
external-staking withdrawal.

## External yield and rewards

```mermaid
flowchart LR
    Admin["Admin multisig — 2 of 2"]
    Batcher["Authorized batcher"]
    GS[("Global Settings UTxO")]
    PoolIn[("Pool UTxO<br/>underlying held locally")]

    StakeTx["External stake transaction — atomic<br/>Pool: StakePool<br/>Stake validator: withdrawal<br/>Integration verifier: withdrawal"]
    PoolShell[("Pool UTxO<br/>minimum ADA + Pool NFT<br/>datum unchanged")]
    Strategy["External staking protocol"]
    RewardAsset[("Rewards UTxO")]

    SwapTx["Optional conversion<br/>Rewards: SwapRewards<br/>authorized swap withdrawal"]
    PoolAsset[("Rewards UTxO<br/>converted to pool asset")]

    AddRewards["Add rewards transaction — atomic<br/>Rewards: AddRewards<br/>Pool: AddRewardsPool"]
    PoolOut[("Updated Pool UTxO<br/>underlying, rewards and rate updated")]

    Claim["Native ADA reward claim<br/>Pool: ClaimAdaRewards + withdrawal"]

    Batcher --> StakeTx
    GS -.->|reference input| StakeTx
    PoolIn --> StakeTx
    StakeTx --> PoolShell
    StakeTx --> Strategy
    Strategy --> RewardAsset

    RewardAsset --> SwapTx
    SwapTx --> PoolAsset
    RewardAsset -->|already the pool asset| AddRewards
    PoolAsset --> AddRewards
    PoolShell --> AddRewards
    Batcher --> AddRewards
    GS -.->|reference input| AddRewards
    AddRewards --> PoolOut

    Admin --> Claim
    PoolIn --> Claim
    GS -.->|reference input| Claim
    Claim --> PoolOut
```

External exit is integration-specific. The current concrete E2E path uses
Atrium; Minswap and the other stake datum validators are adapters around the
same pool and rewards state.

## Validator ownership

| Validator | Responsibility |
| --- | --- |
| `global_settings` | Bootstrap and update the singleton configuration UTxO |
| `pool_validator` | Create pool NFTs and guard pool state transitions |
| `order_validator` | Create, cancel and process user orders |
| `pool_batching` | Check batcher authority, order math and the resulting pool state |
| `minting` | Permit L-token mint or burn only during a valid batch |
| `stake_validator` | Move pool-held underlying into the selected external strategy |
| `rewards_validator` | Convert or reintegrate strategy rewards |
| `stake_datums/*` | Enforce integration-specific deposit rules |
| `swap_validators/*` | Enforce integration-specific reward conversion rules |

## Deployment note

`smart_contract/plutus.json` and the current E2E datum builders use the older
compiled schema. The current Aiken source has since moved
`rewards_validator_hash` from `GlobalSettingsDatum` into each `StakeType`.
Running `aiken build` will change the schema and validator hashes, so the E2E
datum builders must be updated before deploying a freshly rebuilt blueprint.

The current fresh-bootstrap path also needs adjustment: Global Settings creation
asks for a pool-specific rewards validator before that pool exists.
