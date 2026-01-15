use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use aiken/primitive/bytearray
use aiken/primitive/string.{from_int, to_bytearray}
use cardano/address.{Address, Credential, Inline, Script, VerificationKey}
use cardano/assets.{PolicyId, from_asset, from_lovelace, without_lovelace}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use lava/types.{
  AssetType, BurnOrder, CancelOrder, CreatOrderRedeemer, GlobalSettingsDatum,
  MintOrder, OptIn, OrderDatum, OrderRedeemer, ProcessOrder, Redeem, StakeType,
}
use lava/utils.{get_global_settings, signed_by}
use mocktail/virgin_address.{mock_pub_key_address, mock_script_credential}
use mocktail/virgin_key_hash.{mock_pub_key_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{
  gs_validator_hash_t, mint_validator_hash_t, pool_batching_cred_t,
}

validator order_validator(
  gs_validator_hash: ScriptHash,
  pool_batching_cred: Credential,
) {
  mint(redeemer: CreatOrderRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      MintOrder { utxo_ref } -> {
        let Transaction {
          mint,
          outputs,
          extra_signatories,
          reference_inputs,
          ..
        } = tx

        let GlobalSettingsDatum { mint_validator_hash, stake_details, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)

        let expected_order_an =
          bytearray.concat(
            utxo_ref.transaction_id,
            to_bytearray(from_int(utxo_ref.output_index)),
          )

        expect [Pair(nft_name, quantity)] =
          mint |> assets.tokens(policy_id) |> dict.to_pairs

        let is_order_nft_minting = and {
            (nft_name == expected_order_an)?,
            (quantity == 1)?,
          }

        expect [order_output] =
          list.filter(
            outputs,
            fn(output) {
              output.address.payment_credential == Script(policy_id)
            },
          )

        expect InlineDatum(order_datum) = order_output.datum
        expect OrderDatum {
          order_type,
          receiver_address,
          canceller,
          pool_stake_asset_name,
        } = order_datum

        expect VerificationKey(receiver_vk) =
          receiver_address.payment_credential

        expect Some(StakeType { asset_type, .. }) =
          list.find(
            stake_details,
            fn(sd) {
              let StakeType {
                pool_stake_asset_name: sd_pool_stake_asset_name,
                ..
              } = sd
              sd_pool_stake_asset_name == pool_stake_asset_name
            },
          )
        let AssetType { policy_id: at_pid, asset_name: at_an, .. } = asset_type
        let is_ada_asset = at_pid == "" && at_an == "lovelace"

        let is_order_value_valid =
          when order_type is {
            OptIn { deposit_amount } ->
              if is_ada_asset {
                order_output.value == assets.merge(
                  from_lovelace(deposit_amount),
                  from_asset(policy_id, expected_order_an, 1),
                )
              } else {
                without_lovelace(order_output.value) == assets.merge(
                  from_asset(at_pid, at_an, deposit_amount),
                  from_asset(policy_id, expected_order_an, 1),
                )
              }
            Redeem { st_amount } ->
              without_lovelace(order_output.value) == assets.merge(
                from_asset(
                  mint_validator_hash,
                  pool_stake_asset_name,
                  st_amount,
                ),
                from_asset(policy_id, expected_order_an, 1),
              )
          }

        and {
          is_order_nft_minting?,
          list.has(extra_signatories, receiver_vk)?,
          (receiver_vk == canceller)?,
          is_order_value_valid?,
        }
      }

      BurnOrder -> {
        let Transaction { mint, .. } = tx

        let burn_tokens = mint |> assets.tokens(policy_id) |> dict.to_pairs
        let burn_keys = pairs.find_all(burn_tokens, -1)

        (list.length(burn_tokens) == list.length(burn_keys))?
      }
    }
  }

  spend(
    _datum: Option<OrderDatum>,
    _redeemer: Data,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    let Transaction { inputs, .. } = tx

    expect Some(order_input) = find_input(inputs, utxo)
    let Input {
      output: Output { address: Address { payment_credential, .. }, .. },
      ..
    } = order_input

    pairs.has_key(tx.withdrawals, payment_credential)?
  }

  withdraw(redeemer: OrderRedeemer, account: Credential, tx: Transaction) {
    let Transaction { inputs, outputs, extra_signatories, withdrawals, .. } = tx

    when redeemer is {
      CancelOrder -> {
        expect Script(own_hash) = account

        // only one order input when cancelling an order
        expect [order_input] =
          list.filter(
            inputs,
            fn(input) {
              input.output.address.payment_credential == Script(own_hash)
            },
          )

        expect InlineDatum(order_datum) = order_input.output.datum
        expect OrderDatum { receiver_address, canceller, .. } = order_datum

        expect [Pair(nft_name, quantity)] =
          order_input.output.value |> assets.tokens(own_hash) |> dict.to_pairs

        let expected_order_out =
          order_input.output.value |> assets.add(own_hash, nft_name, -quantity)

        expect Some(_order_output) =
          list.find(
            outputs,
            fn(output) {
              // order output must go to 'receiver address'
              and {
                (output.address == receiver_address)?,
                (output.value == expected_order_out)?,
              }
            },
          )

        signed_by(extra_signatories, canceller)?
      }

      ProcessOrder -> pairs.has_key(withdrawals, pool_batching_cred)?
    }
  }

  else(_) {
    fail
  }
}

test test_process_opt_in_order() {
  let receiver_address = mock_pub_key_address(6, None)
  let deposit_amount = 1000
  let extra = 100
  let order_cred = mock_script_credential(16)

  let order_utxo_ref = mock_utxo_ref(0, 16)
  let order_datum =
    OrderDatum {
      order_type: OptIn { deposit_amount },
      receiver_address,
      canceller: mock_pub_key_hash(6),
      pool_stake_asset_name: "stTest",
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
          |> assets.add(mint_validator_hash_t, "test", deposit_amount + extra),
        datum: InlineDatum(order_datum),
        reference_script: None,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [order_input],
      withdrawals: [Pair(pool_batching_cred_t, 0), Pair(order_cred, 0)],
    }

  order_validator.spend(
    gs_validator_hash_t,
    pool_batching_cred_t,
    Some(order_datum),
    "",
    order_utxo_ref,
    tx,
  ) && order_validator.withdraw(
    gs_validator_hash_t,
    pool_batching_cred_t,
    ProcessOrder,
    order_cred,
    tx,
  )
}

test test_process_redeem_order() {
  let receiver_address = mock_pub_key_address(6, None)
  let st_amount = 1000
  let extra = 100
  let order_cred = mock_script_credential(16)

  let order_utxo_ref = mock_utxo_ref(0, 16)
  let order_datum =
    OrderDatum {
      order_type: Redeem { st_amount },
      receiver_address,
      canceller: mock_pub_key_hash(6),
      pool_stake_asset_name: "stTest",
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
          |> assets.add(mint_validator_hash_t, "test", extra),
        datum: InlineDatum(order_datum),
        reference_script: None,
      },
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [order_input],
      withdrawals: [Pair(pool_batching_cred_t, 0), Pair(order_cred, 0)],
    }

  order_validator.spend(
    gs_validator_hash_t,
    pool_batching_cred_t,
    Some(order_datum),
    "",
    order_utxo_ref,
    tx,
  ) && order_validator.withdraw(
    gs_validator_hash_t,
    pool_batching_cred_t,
    ProcessOrder,
    order_cred,
    tx,
  )
}

test test_cancel_order() {
  let receiver_address = mock_pub_key_address(6, None)
  let canceller = mock_pub_key_hash(6)
  let deposit_amount = 1000
  let extra = 100
  let order_cred = mock_script_credential(16)
  expect Script(order_hash) = order_cred
  let order_value =
    from_lovelace(2_000_000)
      |> assets.add(mint_validator_hash_t, "test", deposit_amount + extra)

  let order_utxo_ref = mock_utxo_ref(0, 16)
  let order_datum =
    OrderDatum {
      order_type: OptIn { deposit_amount },
      receiver_address,
      canceller,
      pool_stake_asset_name: "stTest",
    }
  let order_input =
    Input {
      output_reference: order_utxo_ref,
      output: Output {
        address: Address {
          payment_credential: order_cred,
          stake_credential: Some(Inline(order_cred)),
        },
        value: assets.merge(order_value, from_asset(order_hash, "orderoder", 1)),
        datum: InlineDatum(order_datum),
        reference_script: None,
      },
    }

  let user_order_output =
    Output {
      address: receiver_address,
      value: order_value,
      datum: NoDatum,
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      inputs: [order_input],
      outputs: [user_order_output],
      withdrawals: [Pair(order_cred, 0)],
      extra_signatories: [canceller],
    }

  order_validator.spend(
    gs_validator_hash_t,
    pool_batching_cred_t,
    Some(order_datum),
    "",
    order_utxo_ref,
    tx,
  ) && order_validator.withdraw(
    gs_validator_hash_t,
    pool_batching_cred_t,
    CancelOrder,
    order_cred,
    tx,
  )
}
