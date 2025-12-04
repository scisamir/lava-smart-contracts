use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Script}
use cardano/assets.{from_asset, from_lovelace, lovelace_of, quantity_of}
use cardano/transaction.{
  InlineDatum, NoDatum, OutputReference, Transaction, find_input,
}
use lava/constants.{lava_pool_nft_name, min_pool_lovelace, precision_factor}
use lava/types.{
  AddRewards, AssetType, GlobalSettingsDatum, PoolDatum, RewardsRedeemer,
  SwapRewards,
}
use lava/utils.{find_pool_input, get_global_settings, is_signed_by}

validator rewards(
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
        let GlobalSettingsDatum { authorized_batchers, .. } =
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

        expect [pool_output] =
          list.filter(
            outputs,
            fn(output) {
              let raw_pool_value =
                assets.from_lovelace(min_pool_lovelace)
                  |> assets.add(pool_validator_hash, lava_pool_nft_name, 1)
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
                        quantity_of(output.value, ra_pid, ra_an),
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
