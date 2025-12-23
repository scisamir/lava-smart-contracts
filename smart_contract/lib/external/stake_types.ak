use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId}
use lava/types.{AssetType}

/// Strike
pub type ExternalStakeRedeemer {
  stake_asset: AssetType,
  pool_stake_asset_name: AssetName,
}

pub type POSIXTime =
  Int

pub type StrikeStakeDatum {
  owner_address_hash: VerificationKeyHash,
  staked_at: POSIXTime,
  mint_policy_id: PolicyId,
}

/// IAG
/// Delegation can have many states
pub type DelegationState {
  // Delegation is for sale
  OnSale(Int)
  // Can withdraw after given time
  Retiring(Int)
  // Delegated to Address
  Delegated
}

/// The field delegation_size is not used in on-chain verfication. It is stored
/// here for on-chain reference. The value is determined off-chain during delegation creation.
pub type DelegationDatum {
  keeper: VerificationKeyHash,
  node_token_name: AssetName,
  delegation_token_name: AssetName,
  // the current delegation state
  state: DelegationState,
  // the size of the delegation in bytes, it is determined off-chain during delegation creation
  delegation_size: Int,
}
