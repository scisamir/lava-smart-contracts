use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential, Script, VerificationKey}
use cardano/assets
use cardano/transaction.{InlineDatum, Transaction}
use external/stake_types.{ExternalStakeRedeemer, StrikeStakeDatum}
use lava/types.{GlobalSettingsDatum, StakeType}
use lava/utils.{get_global_settings}

validator strike(gs_validator_hash: ScriptHash) {
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

    expect [stake_output] =
      list.filter(outputs, fn(output) { output.address == stake_address })

    expect Script(strike_hash) = stake_address.payment_credential
    expect [Pair(_, q1),
      Pair(_, q2)] = mint |> assets.tokens(strike_hash) |> dict.to_pairs
    let positive_mint_from_strike = q1 == 1 && q2 == 1

    expect InlineDatum(strike_datum) = stake_output.datum
    expect StrikeStakeDatum { owner_address_hash, mint_policy_id, .. } =
      strike_datum
    expect VerificationKey(frost_vk_hash) = frost_address.payment_credential
    let is_owner_hash_correct = owner_address_hash == frost_vk_hash

    and {
      positive_mint_from_strike?,
      is_owner_hash_correct?,
      // strike hash/mint policy must be correct
      (strike_hash == mint_policy_id)?,
    }
  }

  else(_) {
    fail
  }
}
