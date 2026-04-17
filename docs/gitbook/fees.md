# Fee Structure

Lava is designed to keep costs simple and transparent. There are two types of fees to be aware of: the protocol fee and the on-chain transaction fee.

## Protocol fee

Lava charges a small fee on staking and unstaking operations. This is reflected in the conversion rate shown in the staking card before you confirm any transaction.

**Conversion rate example:**

```
1 LStrike = 0.996 tStrike
```

When you stake, you receive slightly fewer L-Assets than a pure 1:1 exchange would give you. When you redeem, the same rate applies in reverse. This spread covers the operational costs of running the batcher infrastructure that processes orders.

The fee is embedded in the exchange rate, so you always see the exact amount you will receive before confirming.

## Transaction fees

Every stake, unstake, and cancel action involves an on-chain transaction on Cardano. You pay the standard Cardano network fee for each transaction, which is typically a fraction of an ADA. These fees go to Cardano network validators, not to Lava.

Because Lava batches multiple orders into single transactions, the per-user cost is kept lower than it would be if each order were processed individually.

## Yield fees

Lava may retain a portion of the staking rewards generated before distributing the remainder to L-Asset holders. Any yield fee is factored into the displayed APY on the app, so the APY you see reflects what you actually receive after fees.

## What you never pay

- No deposit fee
- No withdrawal fee beyond the embedded conversion rate
- No fee for holding L-Assets
- No fee for transferring L-Assets to another address or protocol

## Summary

| Fee type | Amount | Who receives it |
|----------|--------|----------------|
| Protocol fee | Embedded in exchange rate | Lava protocol |
| Network transaction fee | Standard Cardano fee (fraction of ADA) | Cardano validators |
| Yield fee | Included in displayed APY | Lava protocol |
