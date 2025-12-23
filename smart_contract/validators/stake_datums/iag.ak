use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential, Script, VerificationKey}
use cardano/transaction.{InlineDatum, Transaction}
use external/stake_types.{DelegationDatum, ExternalStakeRedeemer}
use lava/types.{GlobalSettingsDatum, StakeType}
use lava/utils.{get_global_settings}

validator iag(gs_validator_hash: ScriptHash) {
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

    expect Some(StakeType { address: stake_address, .. }) =
      list.find(
        stake_details,
        fn(sd) {
          let StakeType { pool_stake_asset_name, .. } = sd
          pool_stake_asset_name == ps_asset_name
        },
      )

    expect [stake_output] =
      list.filter(outputs, fn(output) { output.address == stake_address })

    expect Script(iag_hash) = stake_address.payment_credential
    expect InlineDatum(iag_datum) = stake_output.datum
    expect DelegationDatum { keeper, .. } = iag_datum
    expect VerificationKey(frost_vk_hash) = frost_address.payment_credential
    let is_owner_hash_correct = keeper == frost_vk_hash

    and {
      is_owner_hash_correct?,
      True,
    }
  }

  else(_) {
    fail
  }
}
