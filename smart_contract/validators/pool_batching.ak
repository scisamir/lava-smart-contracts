use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Credential, Script}
use cardano/assets.{AssetName, PolicyId, quantity_of}
use cardano/transaction.{InlineDatum, Input, Output, Transaction}
use lava/constants.{
  global_settings_nft, lava_pool_nft_name, min_pool_lovelace, precision_factor,
}
use lava/types.{
  AssetType, BatchingRedeemer, GlobalSettingsDatum, OrderDatum, PoolDatum,
}
use lava/utils.{find_gs_ref_input}

validator pool_batching(
  gs_validator_hash: ScriptHash,
  pool_validator_hash: ScriptHash,
) {
  withdraw(redeemer: BatchingRedeemer, _stake_cred: Credential, tx: Transaction) {
    let Transaction { inputs, outputs, mint, reference_inputs, .. } = tx

    let BatchingRedeemer { batcher_index, batching_asset } = redeemer

    // find global settings from reference inputs
    expect Some(global_settings_ref) =
      find_gs_ref_input(
        reference_inputs,
        gs_validator_hash,
        global_settings_nft,
      )
    expect InlineDatum(global_settings) = global_settings_ref.output.datum
    expect GlobalSettingsDatum {
      allowed_assets,
      authorized_batchers,
      mint_validator_hash,
      ..
    } = global_settings

    expect Some(batcher) = list.at(authorized_batchers, batcher_index)

    // find pool input, make sure it's only one
    expect [pool_input] = find_pool_input(inputs, pool_validator_hash)

    expect InlineDatum(pool_in_datum) = pool_input.output.datum
    expect PoolDatum {
      pool_batching_cred,
      exchange_rate,
      total_rewards_accrued,
      pool_asset,
      total_underlying,
      total_st_assets_minted,
      pool_stake_asset_name,
    } = pool_in_datum

    let AssetType { policy_id: pool_asset_pid, asset_name: pool_asset_an, .. } =
      pool_asset

    // Inputs that are not batcher's or pool's are orders
    let order_inputs =
      list.filter(
        inputs,
        fn(input) {
          expect Script(oi_hash) = input.output.address.payment_credential
          and {
            oi_hash != pool_validator_hash,
            oi_hash != batcher,
          }
        },
      )

    let (updated_total_underlying, updated_total_st_assets_minted) =
      process_orders(
        mint_validator_hash,
        order_inputs,
        total_underlying,
        total_st_assets_minted,
        exchange_rate,
        pool_asset_pid,
        pool_asset_an,
        pool_stake_asset_name,
        outputs,
      )

    let expected_total_mint =
      updated_total_st_assets_minted - total_st_assets_minted

    expect [Pair(mint_name, mint_quantity)] =
      mint |> assets.tokens(mint_validator_hash) |> dict.to_pairs

    and {
      // Check if it's an allowed asset (in case where allowed_assets has been updated but pool still exists)
      list.has(allowed_assets, pool_asset)?,
      // Must mint calculated amount of stake tokens
      (expected_total_mint == mint_quantity)?,
      // Must mint allowed allowed stake asset name
      (pool_stake_asset_name == mint_name)?,
      // Verify pool output
      verify_pool_output(
        outputs,
        pool_validator_hash,
        pool_asset_pid,
        pool_asset_an,
        pool_batching_cred,
        exchange_rate,
        total_rewards_accrued,
        pool_asset,
        pool_stake_asset_name,
        updated_total_st_assets_minted,
        updated_total_underlying,
      )?,
    }
  }

  else(_) {
    fail
  }
}

fn process_orders(
  mint_validator_hash: ScriptHash,
  orders: List<Input>,
  total_underlying: Int,
  total_st_assets_minted: Int,
  exchange_rate: Int,
  policy_id: PolicyId,
  asset_name: AssetName,
  pool_stake_asset_name: AssetName,
  outputs: List<Output>,
) -> (Int, Int) {
  let (toa, tma) =
    when orders is {
      [] -> (total_underlying, total_st_assets_minted)

      [current_order, ..rest_orders] -> {
        // let [current_order, ..rest_orders] = orders

        let order_amount =
          quantity_of(current_order.output.value, policy_id, asset_name)
        let oa_precised = order_amount * precision_factor

        // Calculate amount of st asset to mint based on current exchange rate
        let asset_amt_to_mint = oa_precised / exchange_rate

        expect InlineDatum(order_datum) = current_order.output.datum
        expect OrderDatum { receiver_address, .. } = order_datum

        // asset_amt_to_mint of pool_stake_asset_name should go to the user's address
        expect Some(_) =
          list.find(
            outputs,
            fn(output) {
              and {
                (output.address == receiver_address)?,
                (quantity_of(
                  output.value,
                  mint_validator_hash,
                  pool_stake_asset_name,
                ) == asset_amt_to_mint)?,
              }
            },
          )

        process_orders(
          mint_validator_hash,
          rest_orders,
          total_underlying + order_amount,
          total_st_assets_minted + asset_amt_to_mint,
          exchange_rate,
          policy_id,
          asset_name,
          pool_stake_asset_name,
          outputs,
        )
      }
    }

  (toa, tma)
}

fn find_pool_input(inputs: List<Input>, pool_validator_hash: ScriptHash) {
  list.filter(
    inputs,
    fn(input) {
      and {
        (input.output.address.payment_credential == Script(pool_validator_hash))?,
        (quantity_of(
          input.output.value,
          pool_validator_hash,
          lava_pool_nft_name,
        ) == 1)?,
      }
    },
  )
}

fn verify_pool_output(
  outputs: List<Output>,
  pool_validator_hash: ScriptHash,
  pool_asset_pid: PolicyId,
  pool_asset_an: AssetName,
  pool_batching_cred: Credential,
  exchange_rate: Int,
  total_rewards_accrued: Int,
  pool_asset: AssetType,
  pool_stake_asset_name: AssetName,
  updated_total_st_assets_minted: Int,
  updated_total_underlying: Int,
) {
  expect [pool_output] =
    list.filter(
      outputs,
      fn(output) {
        (output.address.payment_credential == Script(pool_validator_hash))?
      },
    )

  let expected_pool_value =
    assets.from_lovelace(min_pool_lovelace)
      |> assets.add(pool_validator_hash, lava_pool_nft_name, 1)
      |> assets.add(pool_asset_pid, pool_asset_an, updated_total_underlying)

  expect InlineDatum(pool_out_datum) = pool_output.datum
  expect PoolDatum {
    pool_batching_cred: pool_batching_cred_out,
    total_st_assets_minted: total_st_assets_minted_out,
    total_underlying: total_underlying_out,
    exchange_rate: exchange_rate_out,
    total_rewards_accrued: total_rewards_accrued_out,
    pool_asset: pool_asset_out,
    pool_stake_asset_name: pool_stake_asset_name_out,
  } = pool_out_datum

  let is_pool_out_datum_valid = and {
      pool_batching_cred == pool_batching_cred_out,
      exchange_rate == exchange_rate_out,
      total_rewards_accrued == total_rewards_accrued_out,
      pool_asset == pool_asset_out,
      pool_stake_asset_name == pool_stake_asset_name_out,
      // changed
      updated_total_st_assets_minted == total_st_assets_minted_out,
      updated_total_underlying == total_underlying_out,
    }

  and {
    // pool value out is valid
    (pool_output.value == expected_pool_value)?,
    // pool datum out is valid
    is_pool_out_datum_valid?,
  }
}
