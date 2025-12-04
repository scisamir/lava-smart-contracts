use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential, Script}
use cardano/assets.{quantity_of}
use cardano/transaction.{InlineDatum, Transaction}
use lava/constants.{lava_pool_nft_name}
use lava/types.{
  AssetType, GlobalSettingsDatum, PoolDatum, StakeRedeemer, StakeType,
}
use lava/utils.{get_global_settings}

validator stake(
  gs_validator_hash: ScriptHash,
  pool_validator_hash: ScriptHash,
) {
  withdraw(redeemer: StakeRedeemer, _credential: Credential, tx: Transaction) {
    let Transaction { inputs, outputs, reference_inputs, withdrawals, .. } = tx

    let StakeRedeemer { stake_asset } = redeemer

    expect [pool_input] =
      list.filter(
        inputs,
        fn(input) {
          and {
            (input.output.address.payment_credential == Script(
              pool_validator_hash,
            ))?,
            (quantity_of(
              input.output.value,
              pool_validator_hash,
              lava_pool_nft_name,
            ) == 1)?,
          }
        },
      )

    expect InlineDatum(pool_in_datum) = pool_input.output.datum
    expect PoolDatum { pool_asset, .. } = pool_in_datum
    let AssetType { policy_id: pool_asset_pid, asset_name: pool_asset_an, .. } =
      pool_asset

    let GlobalSettingsDatum { stake_details, .. } =
      get_global_settings(reference_inputs, gs_validator_hash)

    expect Some(StakeType { address: stake_address, datum_verifier_hash, .. }) =
      list.find(
        stake_details,
        fn(sd) {
          let StakeType { asset_type: sd_asset_type, .. } = sd
          sd_asset_type == stake_asset
        },
      )

    let pool_asset_quantity =
      quantity_of(pool_input.output.value, pool_asset_pid, pool_asset_an)

    // Must be an output going to the right stake address with value equivalent to the pool asset quantity
    expect [_stake_output] =
      list.filter(
        outputs,
        fn(output) {
          and {
            (output.address == stake_address)?,
            (quantity_of(output.value, pool_asset_pid, pool_asset_an) == pool_asset_quantity)?,
          }
        },
      )

    // pool output must be returned
    expect [_pool_output] =
      list.filter(
        outputs,
        fn(output) {
          and {
            (output.address.payment_credential == Script(pool_validator_hash))?,
            (quantity_of(output.value, pool_validator_hash, lava_pool_nft_name) == 1)?,
          }
        },
      )

    and {
      // The right stake asset is being used
      (stake_asset == pool_asset)?,
      // Stake datum is being verified
      pairs.has_key(withdrawals, Script(datum_verifier_hash)),
    }
  }

  else(_) {
    fail
  }
}
