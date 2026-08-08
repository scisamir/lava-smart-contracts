# Where Does Yield Come From?

Every L-Asset you hold earns yield from a real underlying source. Lava does not create yield from nothing. The protocol routes deposited assets into external staking positions and collects the resulting rewards, which are then added back into the pool to increase the exchange rate.

## The yield flow

1. Users deposit tokens into a Lava pool and receive L-Assets
2. The pooled tokens are sent to an external staking protocol (Strike, Iagon, etc.)
3. The external protocol generates staking rewards over time
4. Rewards are collected and, if needed, swapped into the pool's base token
5. The rewards are added back to the pool, increasing the exchange rate
6. Every L-Asset holder benefits automatically, proportional to their share

Because rewards compound into the exchange rate, you do not need to do anything to receive them. Every time rewards are added to the pool, your L-Assets become redeemable for slightly more of the underlying token.

## Yield sources by asset

**LStrike (tStrike)**

tStrike deposited into the Strike pool is sent to the Strike Finance protocol for native staking. Strike distributes staking rewards to positions over time. These rewards are collected by Lava and added back to the LStrike pool.

**LPulse (tPulse)**

tPulse follows the same pattern through the Pulse protocol's staking mechanism.

**L-IAG (IAG)**

IAG tokens are staked through the Iagon network. Iagon rewards storage node operators and stakers. Lava collects these rewards and routes them into the L-IAG pool.

**L-ADA (ADA)**

ADA is staked to Cardano stake pools, earning the standard Cardano staking rewards (~3-5% APY depending on pool performance). These are the same ADA rewards any Cardano holder earns by delegating, except here they flow into the pool and are distributed across all L-ADA holders proportionally.

## Reward conversion

Sometimes rewards are paid in a token different from the pool's base asset. When this happens, Lava uses an authorized swap integration (currently Minswap) to convert the reward tokens into the correct underlying token before adding them to the pool. This conversion happens automatically without any action from users.

## APY

The displayed APY on the Lava app reflects the annualized rate based on recent reward additions to each pool. Because yield depends on external protocol performance and market conditions, the APY is variable and may change over time.
