use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential}
use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}
use external/stake_types.{ExternalStakeRedeemer}
use lava/constants.{atrium_diffusion}
use lava/types.{GlobalSettingsDatum, StakeType}
use lava/utils.{get_global_settings}

validator atrium(gs_validator_hash: ScriptHash, atrium_minting_pid: PolicyId) {
  withdraw(
    redeemer: ExternalStakeRedeemer,
    _account: Credential,
    tx: Transaction,
  ) {
    let Transaction { outputs, reference_inputs, mint, .. } = tx

    let ExternalStakeRedeemer { pool_stake_asset_name: ps_asset_name, .. } =
      redeemer
    let GlobalSettingsDatum { stake_details, .. } =
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
    expect [_stake_output] =
      list.filter(outputs, fn(output) { output.address == stake_address })

    // Atrium mint must be successful and positive
    expect [Pair(mint_name, mint_amount)] =
      mint |> assets.tokens(atrium_minting_pid) |> dict.to_pairs

    and {
      (mint_amount > 0)?,
      (mint_name == atrium_diffusion)?,
    }
  }

  else(_) {
    fail
  }
}
