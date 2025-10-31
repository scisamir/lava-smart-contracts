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

pub type OrderDatum {
  receiver_address: Address,
  canceller: VerificationKeyHash,
  deposit_amount: Int,
  st_amount: Int,
}

pub type PoolDatum {
  pool_batching_cred: Credential,
  total_st_assets_minted: Int,
  total_underlying: Int,
  exchange_rate: Int,
  total_rewards_accrued: Int,
  pool_asset: AssetType,
}
