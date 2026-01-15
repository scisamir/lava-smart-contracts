use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential, VerificationKey}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Transaction}
use external/stake_types.{DelegationDatum, ExternalStakeRedeemer}
use lava/types.{GlobalSettingsDatum, StakeType}
use lava/utils.{get_global_settings}

validator iag(gs_validator_hash: ScriptHash, iag_minting_pid: PolicyId) {
  withdraw(
    redeemer: ExternalStakeRedeemer,
    _account: Credential,
    tx: Transaction,
  ) {
    let Transaction { outputs, reference_inputs, mint, .. } = tx

    let ExternalStakeRedeemer { pool_stake_asset_name: ps_asset_name, .. } =
      redeemer
    let GlobalSettingsDatum { stake_details, frost_address, .. } =
      get_global_settings(reference_inputs, gs_validator_hash)

    expect Some(StakeType { address: stake_address_opt, .. }) =
      list.find(
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

    expect InlineDatum(iag_datum) = stake_output.datum
    expect DelegationDatum { keeper, .. } = iag_datum
    expect VerificationKey(frost_vk_hash) = frost_address.payment_credential
    let is_owner_hash_correct = keeper == frost_vk_hash

    // IAG mint must be successful and positive
    expect [Pair(_, mint_amount)] =
      mint |> assets.tokens(iag_minting_pid) |> dict.to_pairs

    and {
      is_owner_hash_correct?,
      (mint_amount > 0)?,
    }
  }

  else(_) {
    fail
  }
}
