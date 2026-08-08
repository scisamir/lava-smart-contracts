# What are L-Assets?

L-Assets are the liquid staking tokens you receive when you deposit into a Lava pool. Each one represents your share of a specific staking pool and grows in value over time as rewards are added.

## How they work

Every Lava pool holds a pool of underlying tokens (for example, tStrike) and tracks how many L-Assets are in circulation. As rewards flow into the pool, the ratio between the underlying token and the L-Asset shifts in the L-Asset's favour.

This means you do not need to claim rewards manually. The value is baked into the token itself.

| L-Asset | Underlying token | Yield source |
|---------|-----------------|--------------|
| LStrike | tStrike | Strike protocol staking rewards |
| LPulse | tPulse | Pulse protocol staking rewards |
| L-IAG | IAG | Iagon network staking rewards |
| L-ADA | ADA | Cardano staking rewards |

## Exchange rate

The exchange rate tells you how much of the underlying token each L-Asset can be redeemed for at any given moment.

```
exchange_rate = total_underlying / total_L-Assets_in_circulation
```

At launch, the rate starts at 1:1. Over time, as rewards are deposited into the pool, the rate increases. If the rate is 1.08, each L-Asset redeems for 1.08 of the underlying token.

## L-Assets are standard Cardano tokens

L-Assets are native Cardano tokens. They behave exactly like any other token on the network:

- They live in your wallet like any other asset
- They can be sent to any address
- They can be listed on DEXes
- They can be used as collateral on lending protocols

There is nothing special you need to do to hold them. As long as they are in your wallet, they are accumulating value from the underlying staking position.

## Why hold L-Assets instead of just staking directly?

Direct staking locks your assets in place. L-Assets keep your capital mobile. You get the yield from staking while being free to do whatever you want with the token itself. This opens up a range of additional strategies described in the sections that follow.
