use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Inline, Script}
use cardano/assets.{from_asset, from_lovelace, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, Transaction, placeholder,
}
use lava/constants.{lava_pool_nft_name, min_pool_lovelace, precision_factor}
use lava/types.{
  AssetType, GlobalSettingsDatum, PoolDatum, StakeRedeemer, StakeType,
}
use lava/utils.{find_pool_input, get_global_settings, is_signed_by}
use mocktail/virgin_address.{mock_script_address, mock_script_credential}
use mocktail/virgin_key_hash.{mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{
  admin_t, allowed_ast_one, allowed_ast_one_an, allowed_ast_one_pid,
  gs_validator_hash_t, pool_batching_cred_t, pool_validator_hash_t,
}
use test_utils/fns_t.{get_global_settings_input}

validator stake_validator(
  gs_validator_hash: ScriptHash,
  pool_validator_hash: ScriptHash,
) {
  withdraw(redeemer: StakeRedeemer, _credential: Credential, tx: Transaction) {
    let Transaction {
      inputs,
      outputs,
      reference_inputs,
      withdrawals,
      extra_signatories,
      ..
    } = tx

    let StakeRedeemer { stake_asset, batcher_index } = redeemer

    let GlobalSettingsDatum { authorized_batchers, stake_details, .. } =
      get_global_settings(reference_inputs, gs_validator_hash)
    expect Some(batcher) = list.at(authorized_batchers, batcher_index)

    expect [pool_input] = find_pool_input(inputs, pool_validator_hash)

    expect InlineDatum(pool_in_datum) = pool_input.output.datum
    expect PoolDatum { pool_asset, pool_stake_asset_name, .. } = pool_in_datum
    let AssetType { policy_id: pool_asset_pid, asset_name: pool_asset_an, .. } =
      pool_asset

    expect Some(StakeType {
      pool_stake_asset_name: ps_an,
      address: stake_address,
      datum_verifier_hash,
      ..
    }) =
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
    expect [pool_output] =
      list.filter(
        outputs,
        fn(output) {
          and {
            (output.address.payment_credential == Script(pool_validator_hash))?,
            (output.address.stake_credential == Some(
              Inline(Script(pool_validator_hash)),
            ))?,
            (output.value == assets.merge(
              from_lovelace(min_pool_lovelace),
              from_asset(pool_validator_hash, lava_pool_nft_name, 1),
            ))?,
          }
        },
      )

    and {
      // The right stake asset is being used
      (stake_asset == pool_asset)?,
      // Pool datum remains the same
      (pool_input.output.datum == pool_output.datum)?,
      // Stake datum is being verified
      pairs.has_key(withdrawals, Script(datum_verifier_hash))?,
      // batcher must sign transaction
      is_signed_by(extra_signatories, inputs, withdrawals, batcher)?,
      // pool stake asset name in pool datum should be same in stake details
      (pool_stake_asset_name == ps_an)?,
    }
  }

  else(_) {
    fail
  }
}

test test_staking() {
  let pool_cred = Script(pool_validator_hash_t)
  let mint = from_asset(pool_validator_hash_t, lava_pool_nft_name, 1)
  let staking_asset_value =
    from_asset(allowed_ast_one_pid, allowed_ast_one_an, 10_000_000)
  let gs_input = get_global_settings_input()
  let datum_verifier_hash = mock_script_hash(14)

  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum_in =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: allowed_ast_one,
      pool_stake_asset_name: "stTest",
      is_processing_open: False,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: pool_cred,
          stake_credential: Some(Inline(pool_cred)),
        },
        value: assets.merge(
          from_lovelace(min_pool_lovelace),
          assets.merge(mint, staking_asset_value),
        ),
        datum: InlineDatum(pool_datum_in),
        reference_script: None,
      },
    }

  let pool_datum_out =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: allowed_ast_one,
      pool_stake_asset_name: "stTest",
      is_processing_open: False,
    }
  let pool_output =
    Output {
      address: Address {
        payment_credential: pool_cred,
        stake_credential: Some(Inline(pool_cred)),
      },
      value: assets.merge(from_lovelace(min_pool_lovelace), mint),
      datum: InlineDatum(pool_datum_out),
      reference_script: None,
    }

  let stake_output =
    Output {
      address: mock_script_address(14, None),
      value: assets.merge(from_lovelace(10_000_000), staking_asset_value),
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input],
      outputs: [pool_output, stake_output],
      reference_inputs: [gs_input],
      withdrawals: [
        Pair(Script(datum_verifier_hash), 0),
        Pair(Script(admin_t), 0),
      ],
    }

  stake_validator.withdraw(
    gs_validator_hash_t,
    pool_validator_hash_t,
    StakeRedeemer { stake_asset: allowed_ast_one, batcher_index: 0 },
    mock_script_credential(17),
    tx,
  )
}
