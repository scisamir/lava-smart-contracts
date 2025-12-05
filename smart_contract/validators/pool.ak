use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Script}
use cardano/assets.{PolicyId, from_asset, from_lovelace, lovelace_of}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Spend, Transaction,
  find_input, placeholder,
}
use lava/constants.{lava_pool_nft_name, min_pool_lovelace, precision_factor}
use lava/types.{
  AddAdaRewardsPool, AddRewards, AddRewardsPool, AssetType, GlobalSettingsDatum,
  PoolDatum, PoolRedeemer, ProcessPool, StakePool, UpdatePoolProcessingState,
}
use lava/utils.{
  find_pool_input, find_pool_output, get_global_settings, is_multisig_signing,
  is_signed_by,
}
use mocktail/virgin_key_hash.{mock_policy_id, mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{
  admin_t, gs_validator_hash_t, pool_batching_cred_t, pool_validator_hash_t,
}
use test_utils/fns_t.{get_admin_input, get_global_settings_input}

validator pool_validator(gs_validator_hash: ScriptHash) {
  // minting to create pool
  mint(_redeemer: Data, policy_id: PolicyId, tx: Transaction) {
    let Transaction { mint, outputs, inputs, reference_inputs, .. } = tx

    expect [Pair(nft_name, quantity)] =
      mint |> assets.tokens(policy_id) |> dict.to_pairs

    let is_pool_nft_minting = and {
        (nft_name == lava_pool_nft_name)?,
        (quantity == 1)?,
      }

    // only one pool output
    expect Some(pool_output) =
      list.find(
        outputs,
        fn(output) { output.address.payment_credential == Script(policy_id) },
      )

    let GlobalSettingsDatum { admin, allowed_assets, .. } =
      get_global_settings(reference_inputs, gs_validator_hash)

    // pool datum must be of the expected type PoolDatum
    expect InlineDatum(pool_datum) = pool_output.datum
    expect PoolDatum {
      pool_asset,
      total_st_assets_minted,
      total_underlying,
      exchange_rate,
      total_rewards_accrued,
      pool_stake_asset_name,
      is_processing_open,
      ..
    } = pool_datum

    let is_new_pool_datum_valid = and {
        total_st_assets_minted == 0,
        total_underlying == 0,
        exchange_rate == 1 * precision_factor,
        total_rewards_accrued == 0,
        pool_stake_asset_name != #"",
        is_processing_open == True,
      }

    let is_pool_value_valid = and {
        (assets.without_lovelace(pool_output.value) == from_asset(
          policy_id,
          lava_pool_nft_name,
          1,
        ))?,
        (lovelace_of(pool_output.value) == min_pool_lovelace)?,
      }

    and {
      // pool NFT has to be minted
      is_pool_nft_minting?,
      // admin must sign pool creation transaction
      is_multisig_signing(inputs, admin)?,
      // The pool asset should be an allowed asset
      list.has(allowed_assets, pool_asset)?,
      // pool utxo must contain only the pool nft and min pool lovelace
      is_pool_value_valid?,
      // New pool datum must be valid
      is_new_pool_datum_valid?,
    }
  }

  // spending from pool to batch transactions
  spend(
    datum: Option<PoolDatum>,
    redeemer: PoolRedeemer,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    let Transaction {
      inputs,
      outputs,
      reference_inputs,
      withdrawals,
      redeemers,
      extra_signatories,
      ..
    } = tx
    expect Some(own_input) = find_input(inputs, utxo)
    let own_payment_cred = own_input.output.address.payment_credential
    expect Script(own_hash) = own_payment_cred

    when redeemer is {
      ProcessPool -> {
        expect Some(PoolDatum { pool_batching_cred, .. }) = datum
        pairs.has_key(withdrawals, pool_batching_cred)?
      }

      UpdatePoolProcessingState -> {
        let GlobalSettingsDatum { admin, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)

        expect Some(datum_in) = datum
        let PoolDatum {
          pool_batching_cred,
          total_st_assets_minted,
          total_underlying,
          exchange_rate,
          total_rewards_accrued,
          pool_asset,
          pool_stake_asset_name,
          is_processing_open,
        } = datum_in
        let AssetType { policy_id: st_pid, asset_name: st_an, .. } = pool_asset

        let pool_output =
          find_pool_output(outputs, st_pid, st_an, own_payment_cred)
        expect InlineDatum(pool_out_datum) = pool_output.datum
        expect PoolDatum {
          pool_batching_cred: pool_batching_cred_out,
          total_st_assets_minted: total_st_assets_minted_out,
          total_underlying: total_underlying_out,
          exchange_rate: exchange_rate_out,
          total_rewards_accrued: total_rewards_accrued_out,
          pool_asset: pool_asset_out,
          pool_stake_asset_name: pool_stake_asset_name_out,
          is_processing_open: is_processing_open_out,
        } = pool_out_datum

        and {
          // pool in and out value must be unchaged
          own_input.output.value == pool_output.value,
          // other datum parameters must be unchanged
          pool_batching_cred == pool_batching_cred_out,
          total_st_assets_minted == total_st_assets_minted_out,
          total_underlying == total_underlying_out,
          exchange_rate == exchange_rate_out,
          total_rewards_accrued == total_rewards_accrued_out,
          pool_asset == pool_asset_out,
          pool_stake_asset_name == pool_stake_asset_name_out,
          // changed datum paramter
          (is_processing_open != is_processing_open_out)?,
          // admin must sign transaction
          is_multisig_signing(inputs, admin)?,
        }
      }

      StakePool -> {
        let GlobalSettingsDatum { stake_validator_hash, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)

        pairs.has_key(withdrawals, Script(stake_validator_hash))
      }

      AddRewardsPool -> {
        let GlobalSettingsDatum { rewards_validator_hash, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)

        expect [reward_utxo] =
          list.filter(
            inputs,
            fn(input) {
              input.output.address.payment_credential == Script(
                rewards_validator_hash,
              )
            },
          )

        expect [rewards_redeemer] =
          pairs.get_all(redeemers, Spend(reward_utxo.output_reference))

        expect AddRewards { .. } = rewards_redeemer

        True
      }

      AddAdaRewardsPool { batcher_index } -> {
        let GlobalSettingsDatum { authorized_batchers, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)
        expect Some(batcher) = list.at(authorized_batchers, batcher_index)

        // find ada reward input
        expect [ada_rewards_utxo] =
          list.filter(
            inputs,
            fn(input) {
              and {
                input.output.value == from_lovelace(
                  lovelace_of(input.output.value),
                ),
                when input.output.datum is {
                  NoDatum -> True
                  _ -> False
                },
              }
            },
          )

        let new_ada_rewards_amount = lovelace_of(ada_rewards_utxo.output.value)

        // find pool input
        expect [pool_input] = find_pool_input(inputs, own_hash)
        expect InlineDatum(pool_in_datum) = pool_input.output.datum
        expect PoolDatum {
          pool_batching_cred,
          total_st_assets_minted,
          total_underlying,
          total_rewards_accrued,
          pool_asset,
          pool_stake_asset_name,
          is_processing_open,
          ..
        } = pool_in_datum
        let AssetType { policy_id: st_pid, asset_name: st_an, .. } = pool_asset

        // find pool output
        let pool_output =
          find_pool_output(outputs, st_pid, st_an, own_payment_cred)
        expect InlineDatum(pool_out_datum) = pool_output.datum
        expect PoolDatum {
          pool_batching_cred: pool_batching_cred_out,
          total_st_assets_minted: total_st_assets_minted_out,
          total_underlying: total_underlying_out,
          exchange_rate: exchange_rate_out,
          total_rewards_accrued: total_rewards_accrued_out,
          pool_asset: pool_asset_out,
          pool_stake_asset_name: pool_stake_asset_name_out,
          is_processing_open: is_processing_open_out,
        } = pool_out_datum

        let updated_total_underlying = total_underlying + new_ada_rewards_amount
        let updated_total_underlying_precised =
          updated_total_underlying * precision_factor
        let updated_exchange_rate =
          updated_total_underlying_precised / total_st_assets_minted
        let updated_total_rewards_accrued =
          total_rewards_accrued + new_ada_rewards_amount

        let is_pool_out_datum_correct = and {
            pool_batching_cred == pool_batching_cred_out,
            total_st_assets_minted == total_st_assets_minted_out,
            pool_asset == pool_asset_out,
            pool_stake_asset_name == pool_stake_asset_name_out,
            is_processing_open == is_processing_open_out,
            // changed
            updated_total_underlying == total_underlying_out,
            updated_exchange_rate == exchange_rate_out,
            updated_total_rewards_accrued == total_rewards_accrued_out,
          }

        and {
          is_pool_out_datum_correct?,
          // batcher signs transaction
          is_signed_by(extra_signatories, inputs, withdrawals, batcher)?,
        }
      }
    }
  }

  else(_) {
    fail
  }
}

/// Tests
test test_create_pool() {
  let pool_hash = mock_script_hash(18)
  let mint = from_asset(pool_hash, lava_pool_nft_name, 1)
  let gs_input = get_global_settings_input()
  let (_, admin_input) = get_admin_input()

  let pool_datum =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id: mock_policy_id(11),
        asset_name: "test",
        multiplier: 1_000_000,
      },
      pool_stake_asset_name: "stTest",
      is_processing_open: True,
    }
  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(pool_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(min_pool_lovelace), mint),
      datum: InlineDatum(pool_datum),
      reference_script: None,
    }

  let mint = from_asset(pool_hash, lava_pool_nft_name, 1)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [admin_input],
      outputs: [pool_output],
      mint,
      reference_inputs: [gs_input],
    }

  pool_validator.mint(gs_validator_hash_t, "", pool_hash, tx)
}

test test_process_pool() {
  let pool_hash = mock_script_hash(18)

  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id: mock_policy_id(11),
        asset_name: "test",
        multiplier: 1_000_000,
      },
      pool_stake_asset_name: "stTest",
      is_processing_open: True,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(min_pool_lovelace),
          from_asset(pool_hash, lava_pool_nft_name, 1),
        ),
        datum: InlineDatum(pool_datum),
        reference_script: None,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input],
      withdrawals: [Pair(pool_batching_cred_t, 0)],
    }

  pool_validator.spend(
    gs_validator_hash_t,
    Some(pool_datum),
    ProcessPool,
    pool_utxo_ref,
    tx,
  )
}

test test_update_pool_processing_state() {
  let pool_hash = mock_script_hash(18)
  let mint = from_asset(pool_hash, lava_pool_nft_name, 1)
  let gs_input = get_global_settings_input()
  let (_, admin_input) = get_admin_input()

  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum_in =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id: mock_policy_id(11),
        asset_name: "test",
        multiplier: 1_000_000,
      },
      pool_stake_asset_name: "stTest",
      is_processing_open: True,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(min_pool_lovelace),
          from_asset(pool_hash, lava_pool_nft_name, 1),
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
      pool_asset: AssetType {
        is_stable: False,
        policy_id: mock_policy_id(11),
        asset_name: "test",
        multiplier: 1_000_000,
      },
      pool_stake_asset_name: "stTest",
      is_processing_open: False,
    }
  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(pool_hash),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(min_pool_lovelace), mint),
      datum: InlineDatum(pool_datum_out),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input, admin_input],
      outputs: [pool_output],
      reference_inputs: [gs_input],
    }

  pool_validator.spend(
    gs_validator_hash_t,
    Some(pool_datum_in),
    UpdatePoolProcessingState,
    pool_utxo_ref,
    tx,
  )
}

test test_stake_pool() {
  let pool_hash = mock_script_hash(18)
  let gs_input = get_global_settings_input()

  expect InlineDatum(gs_datum_data) = gs_input.output.datum
  expect GlobalSettingsDatum { stake_validator_hash, .. } = gs_datum_data

  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum_in =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id: mock_policy_id(11),
        asset_name: "test",
        multiplier: 1_000_000,
      },
      pool_stake_asset_name: "stTest",
      is_processing_open: True,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(min_pool_lovelace),
          from_asset(pool_hash, lava_pool_nft_name, 1),
        ),
        datum: InlineDatum(pool_datum_in),
        reference_script: None,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input],
      reference_inputs: [gs_input],
      withdrawals: [Pair(Script(stake_validator_hash), 0)],
    }

  pool_validator.spend(
    gs_validator_hash_t,
    Some(pool_datum_in),
    StakePool,
    pool_utxo_ref,
    tx,
  )
}

test test_add_rewards_to_pool() {
  let pool_hash = mock_script_hash(18)
  let gs_input = get_global_settings_input()

  expect InlineDatum(gs_datum_data) = gs_input.output.datum
  expect GlobalSettingsDatum { rewards_validator_hash, .. } = gs_datum_data

  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum_in =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id: mock_policy_id(11),
        asset_name: "test",
        multiplier: 1_000_000,
      },
      pool_stake_asset_name: "stTest",
      is_processing_open: True,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_hash),
          stake_credential: None,
        },
        value: assets.merge(
          from_lovelace(min_pool_lovelace),
          from_asset(pool_hash, lava_pool_nft_name, 1),
        ),
        datum: InlineDatum(pool_datum_in),
        reference_script: None,
      },
    }

  let reward_utxo_ref = mock_utxo_ref(0, 19)
  let reward_input =
    Input {
      output_reference: reward_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(rewards_validator_hash),
          stake_credential: None,
        },
        value: from_lovelace(10_000_000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let reward_redeemer =
    AddRewards {
      asset: AssetType {
        is_stable: False,
        policy_id: "",
        asset_name: "lovelace",
        multiplier: 1_000_000,
      },
      batcher_index: 0,
    }
  let reward_redeemer_data: Data = reward_redeemer

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input, reward_input],
      reference_inputs: [gs_input],
      redeemers: [Pair(Spend(reward_utxo_ref), reward_redeemer_data)],
    }

  pool_validator.spend(
    gs_validator_hash_t,
    Some(pool_datum_in),
    AddRewardsPool,
    pool_utxo_ref,
    tx,
  )
}

test test_add_ada_rewards_pool() {
  let mint = from_asset(pool_validator_hash_t, lava_pool_nft_name, 1)
  let gs_input = get_global_settings_input()
  let ada_asset =
    AssetType {
      is_stable: False,
      policy_id: "",
      asset_name: "lovelace",
      multiplier: 1_000_000,
    }

  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum_in =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 10_000_000,
      total_underlying: 10_000_000,
      exchange_rate: 1 * precision_factor,
      total_rewards_accrued: 0,
      pool_asset: ada_asset,
      pool_stake_asset_name: "stTest",
      is_processing_open: False,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_validator_hash_t),
          stake_credential: None,
        },
        value: assets.merge(from_lovelace(min_pool_lovelace), mint),
        datum: InlineDatum(pool_datum_in),
        reference_script: None,
      },
    }

  let pool_datum_out =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 10_000_000,
      total_underlying: 11_000_000,
      exchange_rate: 11 * precision_factor / 10,
      total_rewards_accrued: 1_000_000,
      pool_asset: ada_asset,
      pool_stake_asset_name: "stTest",
      is_processing_open: False,
    }
  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(pool_validator_hash_t),
        stake_credential: None,
      },
      value: assets.merge(from_lovelace(min_pool_lovelace + 1_000_000), mint),
      datum: InlineDatum(pool_datum_out),
      reference_script: None,
    }

  let rewards_utxo_ref = mock_utxo_ref(0, 28)
  let rewards_input =
    Input {
      output_reference: rewards_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_validator_hash_t),
          stake_credential: None,
        },
        value: from_lovelace(1_000_000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input, rewards_input],
      outputs: [pool_output],
      reference_inputs: [gs_input],
      withdrawals: [Pair(Script(admin_t), 0)],
    }

  pool_validator.spend(
    gs_validator_hash_t,
    Some(pool_datum_in),
    AddAdaRewardsPool { batcher_index: 0 },
    pool_utxo_ref,
    tx,
  )
}
