use aiken/collection/dict
use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{ScriptHash}
use cardano/address.{Address, Credential, Inline, Script}
use cardano/assets.{
  PolicyId, from_asset, from_lovelace, lovelace_of, without_lovelace,
}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
  placeholder,
}
use lava/constants.{order_nft_name}
use lava/types.{
  AssetType, BurnOrder, CancelOrder, CreatOrderRedeemer, GlobalSettingsDatum,
  MintOrder, OptIn, OrderDatum, OrderRedeemer, ProcessOrder, Redeem, StakeType,
  VerificationKeySigner,
}
use lava/utils.{get_global_settings, is_signed_by}
use mocktail/virgin_address.{mock_pub_key_address, mock_script_credential}
use mocktail/virgin_key_hash.{mock_pub_key_hash}
use mocktail/virgin_output_reference.{mock_utxo_ref}
use test_utils/constants_t.{
  allowed_ast_one_an, allowed_ast_one_pid, gs_validator_hash_t,
  mint_validator_hash_t, pool_batching_cred_t,
}
use test_utils/fns_t.{get_global_settings_input}

validator order_validator(
  gs_validator_hash: ScriptHash,
  pool_batching_cred: Credential,
) {
  mint(redeemer: CreatOrderRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      MintOrder -> {
        let Transaction {
          mint,
          outputs,
          extra_signatories,
          reference_inputs,
          inputs,
          withdrawals,
          ..
        } = tx

        let GlobalSettingsDatum { mint_validator_hash, stake_details, .. } =
          get_global_settings(reference_inputs, gs_validator_hash)

        expect [Pair(nft_name, quantity)] =
          mint |> assets.tokens(policy_id) |> dict.to_pairs

        let is_order_nft_minting = and {
            (nft_name == order_nft_name)?,
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
        expect OrderDatum { order_type, canceller, pool_stake_asset_name, .. } =
          order_datum

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
        let is_ada_asset = at_pid == "" && at_an == ""

        let is_order_value_valid =
          when order_type is {
            OptIn { deposit_amount } ->
              if is_ada_asset {
                and {
                  without_lovelace(order_output.value) == from_asset(
                    policy_id,
                    order_nft_name,
                    1,
                  ),
                  lovelace_of(order_output.value) >= deposit_amount,
                }
              } else {
                without_lovelace(order_output.value) == assets.merge(
                  from_asset(at_pid, at_an, deposit_amount),
                  from_asset(policy_id, order_nft_name, 1),
                )
              }
            Redeem { st_amount } ->
              without_lovelace(order_output.value) == assets.merge(
                from_asset(
                  mint_validator_hash,
                  pool_stake_asset_name,
                  st_amount,
                ),
                from_asset(policy_id, order_nft_name, 1),
              )
          }

        and {
          is_order_nft_minting?,
          is_signed_by(extra_signatories, inputs, withdrawals, mint, canceller)?,
          is_order_value_valid?,
        }
      }

      BurnOrder -> {
        let Transaction { mint, .. } = tx

        expect [Pair(_, quantity)] =
          mint |> assets.tokens(policy_id) |> dict.to_pairs

        (quantity < 0)?
      }
    }
  }

  spend(
    datum: Option<OrderDatum>,
    redeemer: OrderRedeemer,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    let Transaction {
      inputs,
      outputs,
      extra_signatories,
      withdrawals,
      mint,
      ..
    } = tx

    when redeemer is {
      CancelOrder -> {
        expect Some(OrderDatum { receiver_address, canceller, .. }) = datum
        expect Some(order_input) = find_input(inputs, utxo)
        expect Script(own_hash) = order_input.output.address.payment_credential

        // Verify the order NFT is burned
        let burn_tokens = mint |> assets.tokens(own_hash) |> dict.to_pairs
        expect [Pair(burned_name, -1)] = burn_tokens
        expect burned_name == order_nft_name

        let expected_order_out =
          order_input.output.value
            |> assets.add(own_hash, order_nft_name, -1)

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

        is_signed_by(extra_signatories, inputs, withdrawals, mint, canceller)?
      }

      ProcessOrder -> pairs.has_key(withdrawals, pool_batching_cred)?
    }
  }

  else(_) {
    fail
  }
}

test test_create_order() {
  let gs_input = get_global_settings_input()
  let receiver_address = mock_pub_key_address(6, None)
  let canceller_vk = mock_pub_key_hash(6)
  let canceller = VerificationKeySigner(canceller_vk)
  let deposit_amount = 1000
  let order_cred = mock_script_credential(16)
  expect Script(order_hash) = order_cred
  let order_value =
    from_lovelace(2_000_000)
      |> assets.add(allowed_ast_one_pid, allowed_ast_one_an, deposit_amount)
  let order_nft = from_asset(order_hash, order_nft_name, 1)

  let order_datum =
    OrderDatum {
      order_type: OptIn { deposit_amount },
      receiver_address,
      canceller,
      pool_stake_asset_name: "stTest",
    }
  let order_output =
    Output {
      address: Address {
        payment_credential: order_cred,
        stake_credential: Some(Inline(order_cred)),
      },
      value: assets.merge(order_value, order_nft),
      datum: InlineDatum(order_datum),
      reference_script: None,
    }

  let tx =
    Transaction {
      ..placeholder,
      outputs: [order_output],
      extra_signatories: [canceller_vk],
      mint: order_nft,
      reference_inputs: [gs_input],
    }

  order_validator.mint(
    gs_validator_hash_t,
    pool_batching_cred_t,
    MintOrder,
    order_hash,
    tx,
  )
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
      canceller: VerificationKeySigner(mock_pub_key_hash(6)),
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
      withdrawals: [Pair(pool_batching_cred_t, 0)],
    }

  order_validator.spend(
    gs_validator_hash_t,
    pool_batching_cred_t,
    Some(order_datum),
    ProcessOrder,
    order_utxo_ref,
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
      canceller: VerificationKeySigner(mock_pub_key_hash(6)),
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
      withdrawals: [Pair(pool_batching_cred_t, 0)],
    }

  order_validator.spend(
    gs_validator_hash_t,
    pool_batching_cred_t,
    Some(order_datum),
    ProcessOrder,
    order_utxo_ref,
    tx,
  )
}

test test_cancel_order() {
  let receiver_address = mock_pub_key_address(6, None)
  let canceller_vk = mock_pub_key_hash(6)
  let canceller = VerificationKeySigner(canceller_vk)
  let deposit_amount = 1000
  let order_cred = mock_script_credential(16)
  expect Script(order_hash) = order_cred
  let order_value =
    from_lovelace(2_000_000)
      |> assets.add(mint_validator_hash_t, "test", deposit_amount)

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
        value: assets.merge(
          order_value,
          from_asset(order_hash, order_nft_name, 1),
        ),
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

  let order_nft_burn = from_asset(order_hash, order_nft_name, -1)

  let tx =
    Transaction {
      ..placeholder,
      inputs: [order_input],
      outputs: [user_order_output],
      extra_signatories: [canceller_vk],
      mint: order_nft_burn,
    }

  order_validator.spend(
    gs_validator_hash_t,
    pool_batching_cred_t,
    Some(order_datum),
    CancelOrder,
    order_utxo_ref,
    tx,
  ) && order_validator.mint(
    gs_validator_hash_t,
    pool_batching_cred_t,
    BurnOrder,
    order_hash,
    tx,
  )
}
