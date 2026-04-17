# Fee Structure

> **This section is under construction.** The fee model is still evolving and figures may change before mainnet launch. Check back for updates.

---

## Protocol fee

Lava charges a flat fee on staking and unstaking operations.

| Action | Fee |
|--------|-----|
| Deposit (stake) | 1 ADA |
| Withdrawal (unstake) | 1 ADA |

These fees cover protocol operations and are separate from the Cardano network transaction fee.

## Batcher fee and refundable deposit

When you submit a staking order, a small ADA deposit is included in the order UTxO alongside your tokens. This deposit is held on-chain while your order is pending and is returned to you in full when the batcher processes your order.

You will see this amount come back to your wallet together with your L-Assets once the order is batched. It is not a cost, it is a Cardano UTxO minimum ADA requirement that gets refunded automatically.

## Network transaction fee

Every stake, unstake, and cancel action involves an on-chain transaction on Cardano. You pay the standard Cardano network fee, which is typically a fraction of an ADA. This fee goes to Cardano network validators, not to Lava.

Because Lava batches multiple orders into a single transaction, the per-user cost is kept lower than it would be if each order were processed individually.

## Yield fees

Lava may retain a portion of staking rewards before distributing the remainder to L-Asset holders. Any yield fee is factored into the displayed APY, so the rate you see in the app already reflects what you receive after fees.

## What you never pay

- No fee for holding L-Assets
- No fee for transferring L-Assets to another address or protocol
- No fee to cancel a pending order

## Summary

| Fee type | Amount | Notes |
|----------|--------|-------|
| Deposit fee | 1 ADA | Charged on stake |
| Withdrawal fee | 1 ADA | Charged on unstake |
| Batcher deposit | Variable (refunded) | Returned with your L-Assets after processing |
| Network transaction fee | Standard Cardano fee | Paid to Cardano validators |
| Yield fee | Included in displayed APY | Deducted before rewards hit the pool |
