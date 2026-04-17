# Restaking

Restaking is the practice of taking an asset that is already earning yield and putting it to work again in another protocol to earn a second layer of rewards on top.

Lava makes this straightforward because L-Assets are standard Cardano tokens that any protocol can accept.

## How it works with Lava

When you stake tStrike with Lava, you receive LStrike. Your tStrike is now earning Strike staking rewards, and those rewards compound into the LStrike exchange rate.

At this point you can take your LStrike and deploy it somewhere else:

- Provide LStrike/ADA liquidity on a DEX to earn trading fees
- Deposit LStrike as collateral on a lending protocol to borrow and redeploy capital
- Put LStrike into a yield farming pool through Lava Earn to collect additional incentives

In each case, you are earning on top of the base staking yield without unstaking your original position.

## A practical example

Suppose tStrike is earning 5% APY through Lava.

You take your LStrike and provide it as liquidity on Minswap, earning an additional 3% APY from trading fees and liquidity mining incentives.

Your effective yield becomes 5% from staking plus 3% from liquidity provision, for a combined 8% on your original tStrike position, while your tStrike itself never left Lava's staking pool.

## Risks to understand

Restaking compounds yield but also compounds risk. Each additional protocol you use adds its own smart contract risk.

- If a protocol you have deposited L-Assets into is exploited, you could lose those L-Assets even though the underlying Lava pool is unaffected
- Providing liquidity introduces impermanent loss risk
- Borrowing against L-Assets introduces liquidation risk if the collateral value falls

Understanding each layer of risk is important before pursuing multi-protocol strategies. Start with the simplest option (holding L-Assets) if you are unsure.

## Native Cardano restaking (L-ADA)

For L-ADA specifically, restaking takes on a second meaning. ADA you deposit into Lava is delegated to Cardano stake pools, earning native Cardano staking rewards. Your L-ADA can then be deployed in DeFi on top of those rewards, which means you are effectively earning both network-level staking yield and DeFi yield from the same ADA position.
