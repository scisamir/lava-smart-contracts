use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Address, Credential}
use cardano/assets.{AssetName, PolicyId}

pub type AssetType {
  is_stable: Bool,
  policy_id: PolicyId,
  asset_name: AssetName,
  multiplier: Int,
}

pub type GlobalSettingsDatum {
  admin: ScriptHash,
  authorized_batchers: List<ScriptHash>,
  allowed_assets: List<AssetType>,
  mint_validator_hash: ScriptHash,
}

pub type GlobalSettingsRedeemer {
  CreateGlobalSettings
  UpdateGlobalSettings
}

pub type MintRedeemer {
  Mint
  Burn
}

pub type OrderRedeemer {
  CancelOrder
  ProcessOrder
}

pub type OrderType {
  OptIn { deposit_amount: Int }
  Redeem { st_amount: Int }
}

pub type OrderDatum {
  order_type: OrderType,
  receiver_address: Address,
  canceller: VerificationKeyHash,
}

pub type PoolDatum {
  pool_batching_cred: Credential,
  total_st_assets_minted: Int,
  total_underlying: Int,
  // Exchange rate is precised ((total_underlying / total_st_assets_minted) * precision_factor)
  exchange_rate: Int,
  total_rewards_accrued: Int,
  pool_asset: AssetType,
  pool_stake_asset_name: AssetName,
}

pub type BatchingRedeemer {
  batcher_index: Int,
  batching_asset: AssetType,
}
