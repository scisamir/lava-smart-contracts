# How to Withdraw

When you are ready to exit your position, you redeem your L-Assets for the underlying token. The amount you receive reflects the current exchange rate, which will be higher than when you first staked if rewards have accumulated.

## Step-by-step

**1. Go to the Stake page**

Navigate to the **Stake** page and locate the staking card.

**2. Switch to unstake mode**

Click the arrow icon in the middle of the staking card to flip the direction. The card will now show your L-Asset in the top field and the underlying token in the bottom field.

**3. Select your L-Asset and enter the amount**

Choose the L-Asset you want to redeem. Enter the amount or hit **Max** to redeem your full balance.

The card will show you exactly how much of the underlying token you will receive at the current exchange rate.

**4. Submit and confirm**

Click **Unstake**. Approve the transaction in your wallet.

Your redemption order is now on-chain. A batcher will process it shortly and you will receive the underlying token in your wallet.

## Understanding what you receive

The amount you get back depends on the current exchange rate at the time of processing, not at the time you submit the order. Since the exchange rate only ever increases (as rewards are added), you will always receive at least as much as you deposited.

Example:

- You staked 100 tStrike and received 100 LStrike at a 1:1 rate
- You redeem after rewards have pushed the rate to 1 LStrike = 1.08 tStrike
- You receive 108 tStrike for your 100 LStrike

## Partial withdrawals

You can redeem any portion of your L-Asset balance. You do not need to exit your full position at once.

## Things to know

- Withdrawals are subject to pool liquidity. If the pool assets are fully deployed in an external staking protocol, there may be a short wait until liquidity returns.
- Once you submit a redemption order, it cannot be modified, but it can be cancelled before a batcher processes it.
- Fees are taken from the yield, not from your principal. You always receive at least what you put in, plus whatever yield has accumulated.
