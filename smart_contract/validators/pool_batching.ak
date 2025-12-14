use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Inline, Script, VerificationKey}
use cardano/assets.{
  AssetName, PolicyId, ada_asset_name, ada_policy_id, from_asset, from_lovelace,
  lovelace_of, quantity_of,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, Transaction, placeholder,
}
use lava/constants.{lava_pool_nft_name, min_pool_lovelace, precision_factor}
use lava/types.{
  AssetType, BatchingRedeemer, GlobalSettingsDatum, OptIn, OrderDatum, PoolDatum,
  Redeem,
}
use lava/utils.{
  find_pool_input, get_global_settings, get_signer_hash, is_signed_by,
}
use mocktail/virgin_address.{mock_pub_key_address, mock_script_credential}
use mocktail/virgin_key_hash.{mock_policy_id, mock_pub_key_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{
  admin_t, gs_validator_hash_t, mint_validator_hash_t, pool_batching_cred_t,
  pool_validator_hash_t,
}
use test_utils/fns_t.{get_global_settings_input}

validator pool_batching(
  gs_validator_hash: ScriptHash,
  pool_validator_hash: ScriptHash,
) {
  withdraw(redeemer: BatchingRedeemer, _stake_cred: Credential, tx: Transaction) {
    let Transaction {
      inputs,
      outputs,
      mint,
      reference_inputs,
      extra_signatories,
      withdrawals,
      ..
    } = tx

    let BatchingRedeemer { batcher_index, batching_asset } = redeemer

    let GlobalSettingsDatum {
      allowed_assets,
      authorized_batchers,
      mint_validator_hash,
      ..
    } = get_global_settings(reference_inputs, gs_validator_hash)

    expect Some(batcher) = list.at(authorized_batchers, batcher_index)
    let batcher_hash = get_signer_hash(batcher)

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
      is_processing_open,
    } = pool_in_datum

    let AssetType { policy_id: pool_asset_pid, asset_name: pool_asset_an, .. } =
      pool_asset

    // Inputs that are not batcher's or pool's are orders
    let order_inputs =
      list.filter(
        inputs,
        fn(input) {
          let order_payment_cred = input.output.address.payment_credential
          and {
            order_payment_cred != Script(pool_validator_hash),
            order_payment_cred != Script(batcher_hash),
            order_payment_cred != VerificationKey(batcher_hash),
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

    // Processing of orders of the pool should be open
    expect is_processing_open

    let expected_total_mint =
      updated_total_st_assets_minted - total_st_assets_minted

    expect [Pair(mint_name, mint_quantity)] =
      mint |> assets.tokens(mint_validator_hash) |> dict.to_pairs

    and {
      // batcher signs transaction
      is_signed_by(extra_signatories, inputs, withdrawals, batcher)?,
      // pool asset is the batching asset
      (pool_asset == batching_asset)?,
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
        is_processing_open,
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
  when orders is {
    [] -> (total_underlying, total_st_assets_minted)

    [current_order, ..rest_orders] -> {
      expect InlineDatum(order_datum) = current_order.output.datum
      expect OrderDatum { receiver_address, order_type, .. } = order_datum

      let is_ada_asset = policy_id == "" && asset_name == "lovelace"

      let (order_amount, asset_amt_to_mint_or_burn) =
        when order_type is {
          OptIn { deposit_amount } -> {
            let order_amount =
              if is_ada_asset {
                lovelace_of(current_order.output.value) / 1_000_000
              } else {
                quantity_of(current_order.output.value, policy_id, asset_name)
              }

            expect order_amount >= deposit_amount

            let da_precised = deposit_amount * precision_factor

            // Calculate amount of st asset to mint based on current exchange rate
            let asset_amt_to_mint = da_precised / exchange_rate

            let partial_expected_oov =
              if is_ada_asset {
                current_order.output.value
                  |> assets.add(
                      ada_policy_id,
                      ada_asset_name,
                      -deposit_amount * 1_000_000,
                    )
              } else {
                current_order.output.value
                  |> assets.add(policy_id, asset_name, -deposit_amount)
              }
            let expected_order_output_value =
              partial_expected_oov
                |> assets.add(
                    mint_validator_hash,
                    pool_stake_asset_name,
                    asset_amt_to_mint,
                  )

            // asset_amt_to_mint of pool_stake_asset_name should go to the user's address
            expect Some(_) =
              list.find(
                outputs,
                fn(output) {
                  and {
                    (output.address == receiver_address)?,
                    (output.value == expected_order_output_value)?,
                  }
                },
              )

            (deposit_amount, asset_amt_to_mint)
          }
          Redeem { st_amount } -> {
            let st_amount_in_order =
              quantity_of(
                current_order.output.value,
                mint_validator_hash,
                pool_stake_asset_name,
              )

            expect st_amount_in_order >= st_amount

            // Calculate amount of asset to return to user based on current exchange rate
            let order_amount_precised = st_amount * exchange_rate
            let order_amount = order_amount_precised / precision_factor

            let partial_expected_oov =
              if is_ada_asset {
                current_order.output.value
                  |> assets.add(
                      ada_policy_id,
                      ada_asset_name,
                      order_amount * 1_000_000,
                    )
              } else {
                current_order.output.value
                  |> assets.add(policy_id, asset_name, order_amount)
              }
            let expected_order_output_value =
              partial_expected_oov
                |> assets.add(
                    mint_validator_hash,
                    pool_stake_asset_name,
                    -st_amount,
                  )

            // order_amount should go to the user's address
            expect Some(_) =
              list.find(
                outputs,
                fn(output) {
                  and {
                    (output.address == receiver_address)?,
                    (output.value == expected_order_output_value)?,
                  }
                },
              )

            (-order_amount, -st_amount)
          }
        }

      process_orders(
        mint_validator_hash,
        rest_orders,
        total_underlying + order_amount,
        total_st_assets_minted + asset_amt_to_mint_or_burn,
        exchange_rate,
        policy_id,
        asset_name,
        pool_stake_asset_name,
        outputs,
      )
    }
  }
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
  is_processing_open: Bool,
  updated_total_st_assets_minted: Int,
  updated_total_underlying: Int,
) {
  expect [pool_output] =
    list.filter(
      outputs,
      fn(output) {
        and {
          (output.address.payment_credential == Script(pool_validator_hash))?,
          (quantity_of(output.value, pool_validator_hash, lava_pool_nft_name) == 1)?,
        }
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
    is_processing_open: is_processing_open_out,
  } = pool_out_datum

  let is_pool_out_datum_valid = and {
      pool_batching_cred == pool_batching_cred_out,
      exchange_rate == exchange_rate_out,
      total_rewards_accrued == total_rewards_accrued_out,
      pool_asset == pool_asset_out,
      pool_stake_asset_name == pool_stake_asset_name_out,
      is_processing_open == is_processing_open_out,
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

test test_batching_opt_in() {
  let gs_input = get_global_settings_input()
  let policy_id = mock_policy_id(11)
  let asset_name = "test"
  let pool_stake_asset_name = "stTest"
  let exchange_rate = 1 * precision_factor

  let batching_asset =
    AssetType { is_stable: False, policy_id, asset_name, multiplier: 1_000_000 }
  let receiver_address = mock_pub_key_address(6, None)
  let deposit_amount = 1000
  let extra = 100
  let order_cred = mock_script_credential(16)

  let da_precised = deposit_amount * precision_factor
  let asset_amt_to_mint = da_precised / exchange_rate

  let order_utxo_ref = mock_utxo_ref(0, 16)
  let order_datum =
    OrderDatum {
      order_type: OptIn { deposit_amount },
      receiver_address,
      canceller: mock_pub_key_hash(6),
    }
  let order_input =
    Input {
      output_reference: order_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: order_cred,
          stake_credential: Some(Inline(order_cred)),
        },
        value: from_lovelace(2_000_000)
          |> assets.add(policy_id, asset_name, deposit_amount + extra),
        datum: InlineDatum(order_datum),
        reference_script: None,
      },
    }

  let user_order_output =
    Output {
      address: receiver_address,
      value: from_lovelace(2_000_000)
        |> assets.add(policy_id, asset_name, extra)
        |> assets.add(
            mint_validator_hash_t,
            pool_stake_asset_name,
            asset_amt_to_mint,
          ),
      datum: NoDatum,
      reference_script: None,
    }

  let pool_value_basic =
    assets.merge(
      from_lovelace(min_pool_lovelace),
      from_asset(pool_validator_hash_t, lava_pool_nft_name, 1),
    )
  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0,
      total_underlying: 0,
      exchange_rate,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id,
        asset_name,
        multiplier: 1_000_000,
      },
      pool_stake_asset_name,
      is_processing_open: True,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_validator_hash_t),
          stake_credential: None,
        },
        value: pool_value_basic,
        datum: InlineDatum(pool_datum),
        reference_script: None,
      },
    }

  let pool_datum_updated =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: 0 + asset_amt_to_mint,
      total_underlying: 0 + deposit_amount,
      exchange_rate,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id,
        asset_name,
        multiplier: 1_000_000,
      },
      pool_stake_asset_name,
      is_processing_open: True,
    }
  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(pool_validator_hash_t),
        stake_credential: None,
      },
      value: pool_value_basic
        |> assets.add(policy_id, asset_name, deposit_amount),
      datum: InlineDatum(pool_datum_updated),
      reference_script: None,
    }

  let mint =
    from_asset(mint_validator_hash_t, pool_stake_asset_name, asset_amt_to_mint)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input, order_input],
      outputs: [pool_output, user_order_output],
      mint,
      reference_inputs: [gs_input],
      withdrawals: [Pair(Script(admin_t), 0)],
    }

  pool_batching.withdraw(
    gs_validator_hash_t,
    pool_validator_hash_t,
    BatchingRedeemer(0, batching_asset),
    pool_batching_cred_t,
    tx,
  )
}

test test_batching_redeem() {
  let gs_input = get_global_settings_input()
  let policy_id = mock_policy_id(11)
  let asset_name = "test"
  let pool_stake_asset_name = "stTest"
  let exchange_rate = 1 * precision_factor

  let batching_asset =
    AssetType { is_stable: False, policy_id, asset_name, multiplier: 1_000_000 }
  let receiver_address = mock_pub_key_address(6, None)
  let st_amount = 1000
  let order_cred = mock_script_credential(16)

  let order_amount_precised = st_amount * exchange_rate
  let order_amount = order_amount_precised / precision_factor

  let order_utxo_ref = mock_utxo_ref(0, 16)
  let order_datum =
    OrderDatum {
      order_type: Redeem { st_amount },
      receiver_address,
      canceller: mock_pub_key_hash(6),
    }
  let order_input =
    Input {
      output_reference: order_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: order_cred,
          stake_credential: Some(Inline(order_cred)),
        },
        value: from_lovelace(2_000_000)
          |> assets.add(mint_validator_hash_t, pool_stake_asset_name, st_amount),
        datum: InlineDatum(order_datum),
        reference_script: None,
      },
    }

  let user_order_output =
    Output {
      address: receiver_address,
      value: from_lovelace(2_000_000)
        |> assets.add(policy_id, asset_name, order_amount),
      datum: NoDatum,
      reference_script: None,
    }

  let total_st_assets_minted = 10_000
  let total_underlying = 10_000
  let pool_value_basic =
    assets.merge(
      from_lovelace(min_pool_lovelace),
      from_asset(pool_validator_hash_t, lava_pool_nft_name, 1),
    )
  let pool_utxo_ref = mock_utxo_ref(0, 18)
  let pool_datum =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted,
      total_underlying,
      exchange_rate,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id,
        asset_name,
        multiplier: 1_000_000,
      },
      pool_stake_asset_name,
      is_processing_open: True,
    }
  let pool_input =
    Input {
      output_reference: pool_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: Script(pool_validator_hash_t),
          stake_credential: None,
        },
        value: pool_value_basic
          |> assets.add(policy_id, asset_name, total_underlying),
        datum: InlineDatum(pool_datum),
        reference_script: None,
      },
    }

  let pool_datum_updated =
    PoolDatum {
      pool_batching_cred: pool_batching_cred_t,
      total_st_assets_minted: total_st_assets_minted - st_amount,
      total_underlying: total_underlying - order_amount,
      exchange_rate,
      total_rewards_accrued: 0,
      pool_asset: AssetType {
        is_stable: False,
        policy_id,
        asset_name,
        multiplier: 1_000_000,
      },
      pool_stake_asset_name,
      is_processing_open: True,
    }
  let pool_output =
    Output {
      address: Address {
        payment_credential: Script(pool_validator_hash_t),
        stake_credential: None,
      },
      value: pool_value_basic
        |> assets.add(policy_id, asset_name, total_underlying - order_amount),
      datum: InlineDatum(pool_datum_updated),
      reference_script: None,
    }

  let mint =
    from_asset(mint_validator_hash_t, pool_stake_asset_name, -st_amount)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [pool_input, order_input],
      outputs: [pool_output, user_order_output],
      mint,
      reference_inputs: [gs_input],
      withdrawals: [Pair(Script(admin_t), 0)],
    }

  pool_batching.withdraw(
    gs_validator_hash_t,
    pool_validator_hash_t,
    BatchingRedeemer(0, batching_asset),
    pool_batching_cred_t,
    tx,
  )
}
