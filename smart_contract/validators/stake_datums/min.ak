use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential}
use cardano/transaction.{InlineDatum, Transaction}
use external/stake_types.{CustomAssetType, ExternalStakeRedeemer, MinDatum}
use lava/types.{GlobalSettingsDatum, StakeType}
use lava/utils.{get_global_settings}

validator min(
  gs_validator_hash: ScriptHash,
  asset_param: CustomAssetType,
  staking_period_param: Int,
) {
  withdraw(
    redeemer: ExternalStakeRedeemer,
    _account: Credential,
    tx: Transaction,
  ) {
    let Transaction { outputs, reference_inputs, .. } = tx

    let ExternalStakeRedeemer { pool_stake_asset_name: ps_asset_name, .. } =
      redeemer
    let GlobalSettingsDatum { stake_details, frost_address, .. } =
      get_global_settings(reference_inputs, gs_validator_hash)

    expect [StakeType { address: stake_address_opt, .. }] =
      list.filter(
        stake_details,
        fn(sd) {
          let StakeType { pool_stake_asset_name, .. } = sd
          pool_stake_asset_name == ps_asset_name
        },
      )
    expect Some(stake_address) = stake_address_opt

    // Stake going to the right address
    expect [stake_output] =
      list.filter(outputs, fn(output) { output.address == stake_address })

    expect InlineDatum(min_datum) = stake_output.datum
    expect MinDatum {
      reward_address,
      one_always_like_that,
      min_token,
      staking_period,
    } = min_datum
    let is_reward_address_correct = reward_address == frost_address

    and {
      is_reward_address_correct?,
      (one_always_like_that == 1)?,
      (min_token == asset_param)?,
      (staking_period == staking_period_param)?,
    }
  }

  else(_) {
    fail
  }
}
