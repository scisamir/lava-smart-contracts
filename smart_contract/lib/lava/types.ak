use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/address.{Address, Credential}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{OutputReference}
use external/minswap_types.{Asset}

pub type AssetType {
  is_stable: Bool,
  policy_id: PolicyId,
  asset_name: AssetName,
  multiplier: Int,
}

pub type StakeType {
  asset_type: AssetType,
  pool_stake_asset_name: AssetName,
  address: Option<Address>,
  datum_verifier_hash: Option<ScriptHash>,
}

pub type SignerType {
  VerificationKeySigner { verification_key_hash: VerificationKeyHash }
  SpendScriptSigner { script_hash: ScriptHash }
  WithdrawScriptSigner { script_hash: ScriptHash }
}

pub type GlobalSettingsDatum {
  admin: ScriptHash,
  authorized_batchers: List<SignerType>,
  allowed_assets: List<AssetType>,
  mint_validator_hash: ScriptHash,
  stake_details: List<StakeType>,
  frost_address: Address,
  authorized_swap_scripts: List<ScriptHash>,
  stake_validator_hash: ScriptHash,
  rewards_validator_hash: ScriptHash,
  min_pool_lovelace: Int,
}

pub type MintRedeemer {
  Mint
  Burn
}

pub type CreatOrderRedeemer {
  MintOrder { utxo_ref: OutputReference }
  BurnOrder
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
  pool_stake_asset_name: AssetName,
}

pub type CreatPoolRedeemer {
  utxo_ref: OutputReference,
}

pub type PoolRedeemer {
  ProcessPool
  UpdatePoolProcessingState
  StakePool
  AddRewardsPool
  ClaimAdaRewards
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
  is_processing_open: Bool,
}

pub type BatchingRedeemer {
  batcher_index: Int,
  batching_asset: AssetType,
  pool_stake_asset_name: AssetName,
}

pub type StakeRedeemer {
  stake_asset: AssetType,
  batcher_index: Int,
}

pub type RewardsRedeemer {
  AddRewards { asset: AssetType, batcher_index: Int }
  SwapRewards
}

pub type SwapRedeemer {
  swap_from_asset: AssetType,
  lp_asset: Asset,
  max_batcher_fee: Int,
}
