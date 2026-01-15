use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Inline, Script}
use cardano/assets.{from_asset, from_lovelace, lovelace_of, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use lava/constants.{precision_factor}
use lava/types.{
  AddRewards, AssetType, GlobalSettingsDatum, PoolDatum, RewardsRedeemer,
  SwapRewards,
}
use lava/utils.{find_pool_input, get_global_settings, is_signed_by}
use mocktail/virgin_address.{mock_script_address}
use mocktail/virgin_key_hash.{mock_script_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{
  admin_t, allowed_ast_one, allowed_ast_one_an, allowed_ast_one_pid,
  gs_validator_hash_t, pool_batching_cred_t, pool_nft_name_t,
  pool_validator_hash_t,
}
use test_utils/fns_t.{get_global_settings_input}

validator rewards_validator(
  gs_validator_hash: ScriptHash,
  pool_validator_hash: ScriptHash,
) {
  spend(
    _datum: Option<Data>,
    redeemer: RewardsRedeemer,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    let Transaction {
      inputs,
      outputs,
      reference_inputs,
      extra_signatories,
      withdrawals,
      ..
    } = tx

    when redeemer is {
      AddRewards { asset: reward_asset, batcher_index } -> {
        let GlobalSettingsDatum { authorized_batchers, min_pool_lovelace, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)
        expect Some(batcher) = list.at(authorized_batchers, batcher_index)

        expect Some(own_input) = find_input(inputs, utxo)

        // Reward UTxO should have no datum
        expect NoDatum = own_input.output.datum

        let AssetType { policy_id: ra_pid, asset_name: ra_an, .. } =
          reward_asset
        let is_ra_ada = ra_pid == "" && ra_an == "lovelace"

        // Reward UTxO should have only the concerned asset in it's value
        let is_ra_value_correct =
          if is_ra_ada {
            own_input.output.value == from_lovelace(
              lovelace_of(own_input.output.value),
            )
          } else {
            assets.without_lovelace(own_input.output.value) == from_asset(
              ra_pid,
              ra_an,
              quantity_of(own_input.output.value, ra_pid, ra_an),
            )
          }

        // find pool input, make sure it's only one
        expect [pool_input] = find_pool_input(inputs, pool_validator_hash)
        expect InlineDatum(pool_in_datum) = pool_input.output.datum
        expect PoolDatum {
          pool_batching_cred,
          total_rewards_accrued,
          pool_asset,
          total_underlying,
          total_st_assets_minted,
          pool_stake_asset_name,
          is_processing_open,
          ..
        } = pool_in_datum

        expect [Pair(pool_nft_name, _)] =
          pool_input.output.value
            |> assets.tokens(pool_validator_hash)
            |> dict.to_pairs

        expect [pool_output] =
          list.filter(
            outputs,
            fn(output) {
              let raw_pool_value =
                assets.from_lovelace(min_pool_lovelace)
                  |> assets.add(pool_validator_hash, pool_nft_name, 1)
              let expected_pool_value =
                if is_ra_ada {
                  raw_pool_value
                    |> assets.add("", "", lovelace_of(output.value))
                    |> assets.add("", "", lovelace_of(own_input.output.value))
                    |> assets.add("", "", -min_pool_lovelace)
                } else {
                  raw_pool_value
                    |> assets.add(
                        ra_pid,
                        ra_an,
                        quantity_of(pool_input.output.value, ra_pid, ra_an),
                      )
                    |> assets.add(
                        ra_pid,
                        ra_an,
                        quantity_of(own_input.output.value, ra_pid, ra_an),
                      )
                }

              and {
                (output.address.payment_credential == Script(
                  pool_validator_hash,
                ))?,
                (output.address.stake_credential == Some(
                  Inline(Script(pool_validator_hash)),
                ))?,
                (output.value == expected_pool_value)?,
              }
            },
          )
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

        let new_pool_amount = quantity_of(own_input.output.value, ra_pid, ra_an)
        let rewards_accrued = new_pool_amount - total_underlying

        let updated_total_underlying = total_underlying + rewards_accrued
        let updated_total_underlying_precised =
          updated_total_underlying * precision_factor
        let updated_exchange_rate =
          updated_total_underlying_precised / total_st_assets_minted
        let updated_total_rewards_accrued =
          total_rewards_accrued + rewards_accrued

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
          is_ra_value_correct?,
          // batcher signs transaction
          is_signed_by(extra_signatories, inputs, withdrawals, batcher)?,
          // pool asset must be the reward asset
          (pool_asset == reward_asset)?,
          is_pool_out_datum_correct?,
        }
      }

      SwapRewards -> {
        let GlobalSettingsDatum { authorized_swap_scripts, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)

        let is_sc_withdraw =
          list.any(
            authorized_swap_scripts,
            fn(swap_script) { pairs.has_key(withdrawals, Script(swap_script)) },
          )

        // There must be a withdrawal from any of the authorized swap scripts
        is_sc_withdraw?
      }
    }
  }

  else(_) {
    fail
  }
}

test test_add_rewards() {
  let pool_cred = Script(pool_validator_hash_t)
  let mint = from_asset(pool_validator_hash_t, pool_nft_name_t, 1)
  let staking_asset_value =
    from_asset(allowed_ast_one_pid, allowed_ast_one_an, 11_000_000)
  let gs_input = get_global_settings_input()

  expect InlineDatum(gs_datum) = gs_input.output.datum
  expect GlobalSettingsDatum { min_pool_lovelace, .. } = gs_datum

  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum_in =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 10_000_000,
      total_underlying: 10_000_000,
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
      value: assets.merge(
        from_lovelace(min_pool_lovelace),
        assets.merge(mint, staking_asset_value),
      ),
      datum: InlineDatum(pool_datum_out),
      reference_script: None,
    }

  let rewards_utxo_ref = mock_utxo_ref(0, 28)
  let rewards_input =
    Input {
      output_reference: rewards_utxo_ref,
      output: Output {
        address: mock_script_address(14, None),
        value: assets.merge(from_lovelace(10_000_000), staking_asset_value),
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

  let rewards_datum: Data = ""

  rewards_validator.spend(
    gs_validator_hash_t,
    pool_validator_hash_t,
    Some(rewards_datum),
    AddRewards { asset: allowed_ast_one, batcher_index: 0 },
    rewards_utxo_ref,
    tx,
  )
}

test test_swap_rewards() {
  let gs_input = get_global_settings_input()

  let rewards_utxo_ref = mock_utxo_ref(0, 28)

  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: [gs_input],
      withdrawals: [Pair(Script(mock_script_hash(17)), 0)],
    }

  let rewards_datum: Data = ""

  rewards_validator.spend(
    gs_validator_hash_t,
    pool_validator_hash_t,
    Some(rewards_datum),
    SwapRewards,
    rewards_utxo_ref,
    tx,
  )
}
