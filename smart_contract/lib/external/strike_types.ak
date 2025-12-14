use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId}
use lava/types.{AssetType}

pub type StrikeStakeRedeemer {
  StakeStrike { stake_asset: AssetType }
  RedeemStrikeRewards
}

pub type POSIXTime =
  Int

pub type StrikeStakeDatum {
  owner_address_hash: VerificationKeyHash,
  staked_at: POSIXTime,
  mint_policy_id: PolicyId,
}
